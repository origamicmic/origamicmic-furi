"use client"

import Kuroshiro from "kuroshiro"
import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji"
import type { LyricToken, LyricLine, ConvertMode } from "@/types"
import ON_READINGS from "./on-readings"

let kuroshiroInstance: Kuroshiro | null = null
let initPromise: Promise<void> | null = null
const conversionCache = new Map<string, string>()

const INIT_TIMEOUT = 15000

export async function initKuroshiro(): Promise<void> {
  if (kuroshiroInstance) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    conversionCache.clear()
    kuroshiroInstance = new Kuroshiro()
    const analyzer = new KuromojiAnalyzer({ dictPath: "/dict/" })

    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error("字典加载超时，请稍后重试")),
        INIT_TIMEOUT
      )
    })

    try {
      await Promise.race([kuroshiroInstance.init(analyzer), timeout])
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }
  })()

  try {
    return await initPromise
  } catch (e) {
    initPromise = null
    kuroshiroInstance = null
    throw e
  }
}

export function resetEngine() {
  initPromise = null
  kuroshiroInstance = null
  conversionCache.clear()
}

export async function isEngineAlive(): Promise<boolean> {
  if (!kuroshiroInstance) return false
  try {
    const result = await Promise.race([
      kuroshiroInstance.convert("日本語", { to: "hiragana" }),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000)),
    ])
    return result === "にほんご" || result === "にっぽんご"
  } catch {
    return false
  }
}

function generateTokenId(index: number, tokenIndex: number): string {
  return `t-${index}-${tokenIndex}`
}

async function cachedConvert(text: string, to: "hiragana" | "romaji"): Promise<string | null> {
  if (!kuroshiroInstance) return null
  const cacheKey = `${to}:${text}`
  const cached = conversionCache.get(cacheKey)
  if (cached !== undefined) return cached || null
  try {
    const r = await kuroshiroInstance.convert(text, { to })
    if (r !== text) {
      conversionCache.set(cacheKey, r)
      return r
    }
    conversionCache.set(cacheKey, "")
    return null
  } catch {
    conversionCache.set(cacheKey, "")
    return null
  }
}

const KANJI_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/
const KATAKANA_REGEX = /[\u30a0-\u30ff]/
const HIRAGANA_REGEX = /[\u3040-\u309f]/

const KANJI_FALLBACK: Record<string, string> = {
  "攫": "つか",
  "訊": "たず",
  "屡": "しばしば",
  "偏": "かたよ",
  "攣": "つ",
  "臀": "しり",
  "繋": "つな",
  "雖": "いえど",
  "剥": "は",
  "箒": "ほうき",
  "霾": "つちふ",
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
  "渓": "たに",
  "湊": "みなと",
  "甦": "よみがえ",
  "其": "そ",
  "此": "こ",
  "等": "など",
  // Extended — common kuromoji misreadings
  "失": "うしな",
  "掻": "か",
  "揺": "ゆ",
  "蘇": "よみがえ",
  "繕": "つくろ",
  "綻": "ほころ",
  "檻": "おり",
  "涎": "よだれ",
}

const COMPOUND_READINGS: Record<string, string> = {
  // 熟字訓 — compound kanji with fixed special readings
  "今日": "きょう",
  "明日": "あした",
  "昨日": "きのう",
  "明後日": "あさって",
  "一昨日": "おととい",
  "大人": "おとな",
  "一人": "ひとり",
  "二人": "ふたり",
  "下手": "へた",
  "上手": "じょうず",
  "眼鏡": "めがね",
  "浴衣": "ゆかた",
  "果物": "くだもの",
  "田舎": "いなか",
  "乙女": "おとめ",
  "河岸": "かし",
  "小豆": "あずき",
  "海苔": "のり",
  "梅雨": "つゆ",

  // 促音便 counters (ち・つ・く → っ before k/s/t/h/p)
  "一回": "いっかい",
  "六回": "ろっかい",
  "八回": "はっかい",
  "十回": "じゅっかい",
  "一本": "いっぽん",
  "六本": "ろっぽん",
  "八本": "はっぽん",
  "十本": "じゅっぽん",
  "一匹": "いっぴき",
  "六匹": "ろっぴき",
  "八匹": "はっぴき",
  "十匹": "じゅっぴき",
  "一足": "いっそく",
  "八足": "はっそく",

  // 連濁 counters
  "三本": "さんぼん",
  "三匹": "さんびき",
  "三百": "さんびゃく",

  // 不規則な日付・数量
  "一日": "ついたち",
  "二日": "ふつか",
  "三日": "みっか",
  "四日": "よっか",
  "五日": "いつか",
  "六日": "むいか",
  "七日": "なのか",
  "八日": "ようか",
  "九日": "ここのか",
  "十日": "とおか",
  "二十日": "はつか",
  "二十歳": "はたち",
  "一目": "ひとめ",
  "一度": "いちど",
  "二度": "にど",

  // Multi-kanji compounds kuromoji treats as a single token
  "三百回": "さんびゃくかい",
  "六百回": "ろっぴゃくかい",
  "八百回": "はっぴゃくかい",

  // Multi-kanji counter compounds with rendaku/gemination
  "三百本": "さんびゃくほん",
  "六百本": "ろっぴゃくほん",
  "八百本": "はっぴゃくほん",
  "三百匹": "さんびゃくひき",
  "六百匹": "ろっぴゃくひき",
  "八百匹": "はっぴゃくひき",
}

const PSEUDO_SUFFIXES = ["る", "う", "く", "す", "つ", "ぬ", "む", "ぐ", "ぶ", "じる", "ずる", "がす", "める", "える", "げる", "ける", "せる", "てる", "べる", "れる", "われる"]

async function tryPseudoWordFallbacks(ch: string, to: "hiragana" | "romaji"): Promise<string[]> {
  const results: string[] = []
  for (const suffix of PSEUDO_SUFFIXES) {
    try {
      const word = ch + suffix
      const reading = await cachedConvert(word, "hiragana")
      if (reading && reading.length > suffix.length && reading.endsWith(suffix)) {
        const stem = reading.slice(0, reading.length - suffix.length)
        if (to === "romaji") {
          const r = await cachedConvert(stem, "romaji")
          const romajiStem = r ? normalizeRomaji(r) : normalizeRomaji(stem)
          if (!results.includes(romajiStem)) results.push(romajiStem)
        } else {
          if (!results.includes(stem)) results.push(stem)
        }
      }
    } catch { /* try next */ }
  }
  return results
}

async function lookupKanjiReading(ch: string, to: "hiragana" | "romaji"): Promise<string | null> {
  if (KANJI_FALLBACK[ch]) {
    const fallback = KANJI_FALLBACK[ch]
    if (to !== "romaji") return fallback
    const r = await cachedConvert(fallback, "romaji")
    return r ?? fallback
  }
  return null
}

function lookupKanjiReadingSync(ch: string, to: "hiragana" | "romaji"): string | null {
  if (KANJI_FALLBACK[ch]) {
    if (to !== "romaji") return KANJI_FALLBACK[ch]
    return KANJI_FALLBACK[ch] // rough romaji fallback
  }
  return null
}

export function normalizeLyricsText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[　\u3000]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    // Remove half-width spaces between Japanese characters (CJK + kana).
    // Lyrics from many sources use spaces for visual spacing, but they break
    // kuromoji token adjacency and prevent compound merge from working.
    .replace(
      /([\u3040-\u309f\u30a0-\u30ff\uff66-\uff9f\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]) +(?=[\u3040-\u309f\u30a0-\u30ff\uff66-\uff9f\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff])/g,
      "$1"
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

type FuriganaPattern = { pattern: RegExp; replacement: string } | { pattern: RegExp; replacer: (m: string) => string }

const FURIGANA_PATTERNS: FuriganaPattern[] = [
  { pattern: /[\u4e00-\u9fff\u3400-\u4dbf]+[(（][\u3040-\u309f\u30a0-\u30ffa-zA-Z]+[)）]/g,
    replacer: (m: string) => m.replace(/[(（][\u3040-\u309f\u30a0-\u30ffa-zA-Z]+[)）]/, '') },
  { pattern: /[(（][\u3040-\u309f\u30a0-\u30ffa-zA-Z]+[)）]/g, replacement: '' },
  { pattern: /\[[\u3040-\u309f\u30a0-\u30ffa-zA-Z]+\]/g, replacement: '' },
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
  const result = await cachedConvert(text, to)
  return to === "romaji" && result ? normalizeRomaji(result) : result
}

async function convertTokenReading(
  surface: string,
  to: "hiragana" | "romaji"
): Promise<string> {
  const chars = [...surface]
  const singleKanji = chars.length === 1 && KANJI_REGEX.test(chars[0])

  const result = await tryConvertKuroshiro(surface, to)

  // For single kanji, try pseudo-word ONLY when kuromoji clearly failed.
  if (singleKanji) {
    const kuromojiFailed = !result || result === chars[0] || KANJI_REGEX.test(result)
    if (kuromojiFailed) {
      const candidates = await tryPseudoWordFallbacks(chars[0], to)
      if (candidates.length > 0) return candidates[0]
    }
    // Also check KANJI_FALLBACK for known kuromoji misreadings
    const fallback = lookupKanjiReadingSync(chars[0], to)
    if (fallback && (!result || fallback !== result)) return fallback
  }

  if (result) return result

  const readings: string[] = []
  for (const ch of chars) {
    if (KANJI_REGEX.test(ch)) {
      const kuro = await tryConvertKuroshiro(ch, to)
      if (kuro) { readings.push(kuro); continue }
      const onyomi = ON_READINGS[ch]
      if (onyomi) {
        if (to === "romaji") {
          const r = await cachedConvert(onyomi, "romaji")
          readings.push(r ? normalizeRomaji(r) : normalizeRomaji(onyomi))
        } else {
          readings.push(onyomi)
        }
        continue
      }
      const fallback = await lookupKanjiReading(ch, to)
      if (fallback) { readings.push(fallback); continue }
      if (singleKanji) {
        const candidates = await tryPseudoWordFallbacks(ch, to)
        if (candidates.length > 0) { readings.push(candidates[0]); continue }
      }
      readings.push(ch)
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
  lineIndex: number
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
    // Run fallback for any kanji that needs it:
    // - reading === surface: kuromoji couldn't convert at all
    // - single kanji with short reading (≤3 kana): likely on-yomi, try kun-yomi
    const needsFallback = token.isKanji && (
      token.reading === token.surface ||
      (token.surface.length === 1 && token.reading.length <= 2 && token.reading !== token.surface)
    )
    if (needsFallback) {
      const reading = await convertTokenReading(token.surface, "hiragana")
      if (reading !== token.surface && reading !== token.reading) {
        token.reading = reading
      }
    }
  }))

  // Override multi-kanji tokens with known compound readings.
  // This catches cases where kuromoji treated a compound as a single token
  // but gave a wrong reading (e.g., 三百回 → さんひゃくかい instead of さんびゃくかい).
  for (const token of tokens) {
    if (token.isKanji && token.surface.length > 1) {
      const dictReading = COMPOUND_READINGS[token.surface]
      if (dictReading && dictReading !== token.reading) {
        token.reading = dictReading
      }
    }
  }

  // Split unresolved multi-char kanji tokens so compound merge can re-attempt
  tokens = tokens.flatMap((token) => {
    if (token.isKanji && token.surface.length > 1 && token.reading === token.surface) {
      return [...token.surface].map((ch, ci) => ({
        surface: ch,
        reading: ch,
        isKanji: KANJI_REGEX.test(ch),
        isKana: false,
        isEditable: true,
        tokenId: `${token.tokenId}-${ci}`,
        userModified: false,
      }))
    }
    return [token]
  })

  // Merge adjacent kanji tokens that form a compound word.
  // Strategy: check compound dictionary first (authoritative), then try kuromoshi.
  // Key fix: also merge when individual tokens have readings but the compound
  // has a different reading (e.g., 一+回 → いっかい not いち+かい).
  let merged = tokens
  for (let i = 0; i < merged.length - 1; i++) {
    const a = merged[i]
    const b = merged[i + 1]
    if (!a.isKanji || !b.isKanji) continue

    const combined = a.surface + b.surface

    // Check compound dictionary first (fast, authoritative)
    const dictReading = COMPOUND_READINGS[combined]
    if (dictReading) {
      merged = [...merged.slice(0, i), { ...a, surface: combined, reading: dictReading, tokenId: a.tokenId }, ...merged.slice(i + 2)]
      i--
      continue
    }

    // For short compounds (≤3 chars), try kuromoshi.
    // Only merge when kuromoshi gives a DIFFERENT reading than the concatenation
    // of individual readings, indicating it recognizes this as a compound word.
    if (combined.length > 3) continue
    try {
      const r = await cachedConvert(combined, "hiragana")
      if (!r || r === combined) continue
      const concatenated = a.reading + b.reading
      if (r !== concatenated) {
        merged = [...merged.slice(0, i), { ...a, surface: combined, reading: r, tokenId: a.tokenId }, ...merged.slice(i + 2)]
        i--
      }
    } catch { /* skip */ }
  }
  tokens = merged

  if (mode === "romaji") {
    for (const token of tokens) {
      try {
        const r = Kuroshiro.Util.kanaToRomaji(token.reading)
        if (r && r !== token.reading) token.reading = normalizeRomaji(r)
      } catch { /* skip */ }
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
  mode: ConvertMode
): Promise<LyricLine[]> {
  const normalized = normalizeLyricsText(lyrics)
  const lines = splitLyricsToLines(normalized)
  const results = await Promise.allSettled(
    lines.map(async (line, index) => {
      try {
        const tokens = await convertLine(line, mode, index)
        return { index, original: line, tokens }
      } catch {
        return { index, original: line, tokens: [] }
      }
    })
  )
  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { index: i, original: lines[i] ?? "", tokens: [] }
  )
}
