import type { SongResult } from "@/types"

export interface LyricsSource {
  name: string
  search(query: string): Promise<SongResult[]>
  fetchLyrics(songId: string): Promise<string>
}
