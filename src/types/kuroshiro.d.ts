declare module "kuroshiro" {
  interface KuroshiroOptions {
    to: "hiragana" | "katakana" | "romaji"
    mode?: "normal" | "spaced" | "okurigana" | "furigana"
    romajiSystem?: "nippon" | "passport" | "hepburn"
    delimiter_start?: string
    delimiter_end?: string
  }

  interface Analyzer {
    init(): Promise<void>
  }

  class Kuroshiro {
    constructor()
    init(analyzer: Analyzer): Promise<void>
    convert(str: string, options?: KuroshiroOptions): Promise<string>
    static Util: {
      isHiragana(char: string): boolean
      isKatakana(char: string): boolean
      isKana(char: string): boolean
      isKanji(char: string): boolean
      isJapanese(char: string): boolean
      hasHiragana(str: string): boolean
      hasKatakana(str: string): boolean
      hasKana(str: string): boolean
      hasKanji(str: string): boolean
      hasJapanese(str: string): boolean
      kanaToHiragana(str: string): string
      kanaToKatakana(str: string): string
      kanaToRomaji(str: string, system?: string): string
    }
  }

  export default Kuroshiro
}

declare module "kuroshiro-analyzer-kuromoji" {
  interface KuromojiAnalyzerOptions {
    dictPath?: string
  }

  class KuromojiAnalyzer {
    constructor(options?: KuromojiAnalyzerOptions)
    init(): Promise<void>
  }

  export default KuromojiAnalyzer
}
