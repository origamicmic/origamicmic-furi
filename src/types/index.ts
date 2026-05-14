export interface LyricToken {
  surface: string
  reading: string
  isKanji: boolean
  isKana: boolean
  isEditable: boolean
  tokenId: string
  userModified: boolean
  userReading?: string
}

export interface LyricLine {
  index: number
  original: string
  tokens: LyricToken[]
  timestamp?: number
}

export interface LyricData {
  title: string
  artist: string
  lines: LyricLine[]
  source: string
  sourceId?: string
}

export interface SongResult {
  id: string
  title: string
  artist: string
  source: string
  thumbnail?: string
}

export interface SearchResult {
  songs: SongResult[]
  source: string
}

export interface CorrectionEntry {
  id?: string
  word: string
  default_reading: string
  user_reading: string
  song_id?: string
  song_title?: string
  artist?: string
  created_at?: string
  votes?: number
}

export type ConvertMode = "hiragana" | "romaji"

export type InputMode = "search" | "paste"

export type ExportFormat = "txt" | "lrc"

export interface Recommendation {
  id: string
  word: string
  reading: string
  default_reading?: string
  votes_up: number
  votes_down: number
  is_official: boolean
  created_at?: string
}
