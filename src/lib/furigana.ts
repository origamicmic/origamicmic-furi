import Kuroshiro from "kuroshiro"
import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji"
import type { LyricToken, LyricLine, ConvertMode, CorrectionEntry } from "@/types"

let kuroshiroInstance: Kuroshiro | null = null
let initPromise: Promise<void> | null = null

const INIT_TIMEOUT = 30000

export async function initKuroshiro(): Promise<void> {
  if (kuroshiroInstance) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    kuroshiroInstance = new Kuroshiro()
    const analyzer = new KuromojiAnalyzer({ dictPath: "/dict/" })

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("字典加载超时，请刷新页面重试")), INIT_TIMEOUT)
    )

    await Promise.race([kuroshiroInstance.init(analyzer), timeout])
  })()

  try {
    return await initPromise
  } catch (e) {
    initPromise = null
    kuroshiroInstance = null
    throw e
  }
}

function generateTokenId(index: number, tokenIndex: number): string {
  return `t-${index}-${tokenIndex}`
}

const KANJI_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/
const KATAKANA_REGEX = /[\u30a0-\u30ff]/
const HIRAGANA_REGEX = /[\u3040-\u309f]/

const KANJI_FALLBACK: Record<string, string> = {
  "攫": "つか",
  "訊": "たず",
  "屡": "しばしば",
  "偏": "かたよ",
  "葛": "くず",
  "攣": "つ",
  "臀": "しり",
  "繋": "つな",
  "雖": "いえど",
  "剥": "は",
  "罠": "わな",
  "箒": "ほうき",
  "霾": "つちふ",
  "闇": "やみ",
  "妖": "あや",
  "歪": "ゆが",
  "覗": "のぞ",
  "這": "は",
  "憐": "あわ",
  "唱": "とな",
  "傲": "おご",
  "蔑": "さげす",
  "嘲": "あざけ",
  "諦": "あきら",
  "諳": "そら",
  "諱": "い",
  "謳": "うた",
  "赳": "たけ",
  "跋": "ばつ",
  "踪": "しょう",
  "躊": "ためら",
  "躇": "ためら",
  "躓": "つまず",
  "躙": "にじ",
  "躁": "さわ",
  "辣": "らつ",
  "辿": "たど",
  "遵": "じゅん",
  "遽": "にわか",
  "邂": "かい",
  "逅": "こう",
  "蔽": "おお",
  "閃": "ひらめ",
  "渦": "うず",
  "渓": "たに",
  "淵": "ふち",
  "湊": "みなと",
  "甦": "よみがえ",
}

const VERB_SUFFIXES = ["る", "う", "く", "す", "つ", "ぬ", "む", "ぐ", "ぶ", "れる", "ける", "める", "べる", "じる", "ずる"]

async function tryPseudoWordFallback(ch: string, to: "hiragana" | "romaji"): Promise<string | null> {
  if (!kuroshiroInstance) return null
  for (const suffix of VERB_SUFFIXES) {
    try {
      const word = ch + suffix
      const reading = await kuroshiroInstance.convert(word, { to: "hiragana" })
      if (reading !== word && reading.length > suffix.length) {
        const stem = reading.slice(0, reading.length - suffix.length)
        if (to === "romaji") {
          const r = await kuroshiroInstance.convert(stem, { to: "romaji" })
          return r !== stem ? r : stem
        }
        return stem
      }
    } catch { /* try next */ }
  }
  return null
}

async function lookupKanjiReading(ch: string, to: "hiragana" | "romaji"): Promise<string | null> {
  if (KANJI_FALLBACK[ch]) {
    const fallback = KANJI_FALLBACK[ch]
    if (to === "romaji" && kuroshiroInstance) {
      try {
        return await kuroshiroInstance.convert(fallback, { to: "romaji" })
      } catch {
        return fallback
      }
    }
    return fallback
  }
  return null
}

export function normalizeLyricsText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[　\u3000]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

type FuriganaPattern = { pattern: RegExp; replacement: string } | { pattern: RegExp; replacer: (m: string) => string }

const FURIGANA_PATTERNS: FuriganaPattern[] = [
  { pattern: /[\u4e00-\u9fff\u3400-\u4dbf]+[(（][\u3040-\u309f\u30a0-\u30ffa-zA-Z]+[)）]/g,
    replacer: (m: string) => m.replace(/[(（][\u3040-\u309f\u30a0-\u30ffa-zA-Z]+[)）]/, '') },
  { pattern: /[(（][\u3040-\u309f\u30a0-\u30ffa-zA-Z]+[)）]/g, replacement: '' },
  { pattern: /\[[\u3040-\u309f\u30a0-\u30ffa-zA-Z]+\]/g, replacement: '' },
  { pattern: /([\u4e00-\u9fff\u3400-\u4dbf]+)([a-zA-Z]{1,15})(?=[\s\u3040-\u309f\u30a0-\u30ff.,:;!?）\)\]\n]|$)/g, replacement: '$1' },
  { pattern: /([a-zA-Z]{1,15})([\u4e00-\u9fff\u3400-\u4dbf]+)(?=[\s\u3040-\u309f\u30a0-\u30ff.,:;!?）\)\]\n]|$)/g, replacement: '$2' },
]

export function cleanLyricsText(text: string): string {
  for (const entry of FURIGANA_PATTERNS) {
    if ('replacer' in entry) {
      text = text.replace(entry.pattern, entry.replacer)
    } else {
      text = text.replace(entry.pattern, entry.replacement)
    }
  }
  return text.trim()
}

export function parseOkuriganaResult(
  result: string,
  lineIndex: number
): LyricToken[] {
  const tokens: LyricToken[] = []
  const regex = /([^()]*?)([\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+)\(([^)]+)\)|([^()]+)/g
  let match
  let tokenIndex = 0

  while ((match = regex.exec(result)) !== null) {
    if (match[2] && match[3]) {
      const prefix = match[1]
      if (prefix) {
        const hasKana = KATAKANA_REGEX.test(prefix) || HIRAGANA_REGEX.test(prefix)
        tokens.push({
          surface: prefix,
          reading: prefix,
          isKanji: false,
          isKana: hasKana,
          isEditable: false,
          tokenId: generateTokenId(lineIndex, tokenIndex++),
          userModified: false,
        })
      }
      tokens.push({
        surface: match[2],
        reading: match[3],
        isKanji: true,
        isKana: false,
        isEditable: true,
        tokenId: generateTokenId(lineIndex, tokenIndex++),
        userModified: false,
      })
    } else if (match[4]) {
      const text = match[4]
      const hasKanji = KANJI_REGEX.test(text)
      const hasKatakana = KATAKANA_REGEX.test(text)
      const hasHiragana = HIRAGANA_REGEX.test(text)
      tokens.push({
        surface: text,
        reading: text,
        isKanji: hasKanji,
        isKana: hasKatakana || hasHiragana,
        isEditable: hasKanji || (hasKatakana && text.length >= 2),
        tokenId: generateTokenId(lineIndex, tokenIndex++),
        userModified: false,
      })
    }
  }

  if (tokens.length === 0) {
    tokens.push({
      surface: result,
      reading: result,
      isKanji: false,
      isKana: false,
      isEditable: false,
      tokenId: generateTokenId(lineIndex, 0),
      userModified: false,
    })
  }

  return tokens
}

function normalizeRomaji(text: string): string {
  return text
    .replace(/ā/g, "aa").replace(/Ā/g, "Aa")
    .replace(/ī/g, "ii").replace(/Ī/g, "Ii")
    .replace(/ū/g, "uu").replace(/Ū/g, "Uu")
    .replace(/ē/g, "ee").replace(/Ē/g, "Ee")
    .replace(/ō/g, "oo").replace(/Ō/g, "Oo")
}

async function tryConvertKuroshiro(text: string, to: "hiragana" | "romaji"): Promise<string | null> {
  if (!kuroshiroInstance) return null
  try {
    const opts: { to: "hiragana" | "romaji" } = { to }
    const r = await kuroshiroInstance.convert(text, opts)
    const result = r !== text ? r : null
    return to === "romaji" && result ? normalizeRomaji(result) : result
  } catch {
    return null
  }
}

async function convertTokenReading(
  surface: string,
  to: "hiragana" | "romaji"
): Promise<string> {
  const result = await tryConvertKuroshiro(surface, to)
  if (result) return result

  const chars = [...surface]
  const readings: string[] = []
  for (const ch of chars) {
    if (KANJI_REGEX.test(ch)) {
      const fallback = await lookupKanjiReading(ch, to)
      if (fallback) { readings.push(fallback); continue }
      const pseudo = await tryPseudoWordFallback(ch, to)
      if (pseudo) { readings.push(pseudo); continue }
      const kuro = await tryConvertKuroshiro(ch, to)
      readings.push(kuro ?? ch)
    } else {
      if (to === "romaji" && (HIRAGANA_REGEX.test(ch) || KATAKANA_REGEX.test(ch))) {
        const kuro = await tryConvertKuroshiro(ch, to)
        readings.push(kuro ?? ch)
      } else {
        readings.push(ch)
      }
    }
  }
  return readings.join("")
}

export async function convertLine(
  text: string,
  mode: ConvertMode,
  lineIndex: number,
  corrections?: CorrectionEntry[]
): Promise<LyricToken[]> {
  if (!kuroshiroInstance) {
    throw new Error("Kuroshiro not initialized")
  }

  if (!text.trim()) {
    return []
  }

  const cleanText = cleanLyricsText(normalizeLyricsText(text))

  const result = await kuroshiroInstance.convert(cleanText, {
    to: "hiragana",
    mode: "okurigana",
  })

  let tokens = parseOkuriganaResult(result, lineIndex)

  await Promise.all(tokens.map(async (token) => {
    if (token.isKanji && token.reading === token.surface) {
      const reading = await convertTokenReading(token.surface, "hiragana")
      if (reading !== token.surface) {
        token.reading = reading
      }
    }
  }))

  // Merge adjacent kanji tokens that form a compound word
  let merged = tokens
  for (let i = 0; i < merged.length - 1; i++) {
    const a = merged[i]
    const b = merged[i + 1]
    if (!a.isKanji || !b.isKanji) continue
    const combined = a.surface + b.surface
    try {
      const r = await kuroshiroInstance!.convert(combined, { to: "hiragana" })
      if (r !== combined && r !== a.reading + b.reading) {
        const mergedToken = { ...a, surface: combined, reading: r, tokenId: a.tokenId }
        merged = [...merged.slice(0, i), mergedToken, ...merged.slice(i + 2)]
        i--
      }
    } catch { /* skip */ }
  }
  tokens = merged

  if (mode === "romaji") {
    for (const token of tokens) {
      try {
        const r = Kuroshiro.Util.kanaToRomaji(token.reading)
        if (r && r !== token.reading) token.reading = r
      } catch { /* skip */ }
    }
  }

  if (corrections && corrections.length > 0) {
    for (const token of tokens) {
      if (token.isKanji) {
        const correction = corrections.find(
          (c) => c.word === token.surface && c.default_reading === token.reading
        )
        if (correction) {
          token.userReading = correction.user_reading
          token.userModified = true
        }
      }
    }
  }

  return tokens
}

export function splitLyricsToLines(lyrics: string): string[] {
  return lyrics
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export async function tokenizeLyrics(
  lyrics: string,
  mode: ConvertMode,
  corrections?: CorrectionEntry[]
): Promise<LyricLine[]> {
  const normalized = normalizeLyricsText(lyrics)
  const lines = splitLyricsToLines(normalized)
  const results = await Promise.allSettled(
    lines.map(async (line, index) => {
      const tokens = await convertLine(line, mode, index, corrections)
      return { index, original: line, tokens }
    })
  )
  return results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { index: 0, original: "", tokens: [] }
  )
}
