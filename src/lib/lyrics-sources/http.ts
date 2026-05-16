import https from "node:https"
import http from "node:http"
import { IncomingMessage } from "node:http"
import { gunzipSync, inflateSync } from "node:zlib"

type FetchResult = { statusCode: number; text(): Promise<string>; json<T>(): Promise<T> }

function decompress(buffer: Buffer, encoding: string): Buffer {
  const enc = encoding.toLowerCase()
  if (enc === "gzip" || enc === "x-gzip") return gunzipSync(buffer)
  if (enc === "deflate") return inflateSync(buffer)
  return buffer
}

function doRequest(
  url: string,
  headers?: Record<string, string>,
  timeoutMs = 15000,
  redirectCount = 0
): Promise<FetchResult> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const mod = parsed.protocol === "https:" ? https : http
    const req = mod.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: "GET",
        family: 4,
        headers: {
          "Accept-Encoding": "gzip, deflate",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) origamicmic-furi/1.0",
          ...headers,
        },
        timeout: timeoutMs,
      },
      (res: IncomingMessage) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode ?? 0) && redirectCount < 3) {
          const location = res.headers.location
          if (location) {
            const target = location.startsWith("http") ? location : new URL(location, url).href
            resolve(doRequest(target, headers, timeoutMs, redirectCount + 1))
            return
          }
        }
        const chunks: Buffer[] = []
        res.on("data", (chunk: Buffer) => chunks.push(chunk))
        res.on("end", () => {
          let body = Buffer.concat(chunks)
          const enc = res.headers["content-encoding"]
          if (enc && body.length > 0) {
            try { body = decompress(body, enc) } catch { /* keep raw on decompress failure */ }
          }
          const raw = body.toString("utf-8")
          resolve({
            statusCode: res.statusCode ?? 500,
            text: () => Promise.resolve(raw),
            json: <T>() => {
              try { return Promise.resolve(JSON.parse(raw) as T) }
              catch { return Promise.reject(new Error("Invalid JSON")) }
            },
          })
        })
        res.on("error", reject)
      }
    )
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")) })
    req.on("error", reject)
    req.end()
  })
}

export function httpGet(
  url: string,
  headers?: Record<string, string>,
  timeoutMs?: number
): Promise<FetchResult> {
  return doRequest(url, headers, timeoutMs)
}
