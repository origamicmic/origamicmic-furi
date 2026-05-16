import type { LyricData, LyricToken } from "@/types"

function getTokenText(token: Pick<LyricToken, "surface" | "reading" | "userReading">): string {
  return token.userReading || token.reading
}

export function exportAsTxt(data: LyricData): string {
  const header = `${data.title} - ${data.artist}\n${"=".repeat(30)}\n\n`
  const body = data.lines
    .map((line) => {
      const converted = line.tokens.map(getTokenText).join(" ")
      return `${line.original}\n${converted}\n`
    })
    .join("\n")
  return header + body
}

function formatTimestamp(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const centiseconds = Math.floor((ms % 1000) / 10)
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`
}

export function exportAsLrc(data: LyricData): string {
  const lines: string[] = []
  lines.push(`[ti:${data.title}]`)
  lines.push(`[ar:${data.artist}]`)

  for (const line of data.lines) {
    const converted = line.tokens.map(getTokenText).join(" ")
    if (line.timestamp !== undefined) {
      lines.push(`[${formatTimestamp(line.timestamp)}]${line.original}`)
      lines.push(`[${formatTimestamp(line.timestamp)}]${converted}`)
    } else {
      lines.push(line.original)
      lines.push(converted)
    }
  }

  return lines.join("\n")
}

export function exportAsConvertedOnlyTxt(data: LyricData): string {
  return data.lines
    .map((line) => line.tokens.map(getTokenText).join(" "))
    .join("\n")
}

export function hasTimestamps(data: LyricData): boolean {
  return data.lines.some((line) => line.timestamp !== undefined)
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
