// Usage: node scripts/convert-gif.mjs your-file.gif
// Generates src/components/ascii-loader-frames.ts
import { existsSync, writeFileSync } from "fs"
import sharp from "sharp"

const ASCII_CHARS = "  .'`,:;\"_-+~=<>!il|/\\()[]{}1?tfjrnxuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"
const GAMMA = 1.8
const COLS = 60
const ROWS = 53

function buildHistogram(grayValues) {
  const hist = new Array(256).fill(0)
  for (const g of grayValues) hist[Math.round(g)]++
  return hist
}

function buildCdf(hist, total) {
  const cdf = new Array(256).fill(0)
  let sum = 0
  for (let i = 0; i < 256; i++) {
    sum += hist[i]
    cdf[i] = sum / total
  }
  return cdf
}

function pixelToChar(cdf, r, g, b) {
  const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const equalized = cdf[Math.round(gray)]
  const inv = 1 - equalized
  const mapped = Math.pow(inv, GAMMA)
  const idx = Math.round(mapped * (ASCII_CHARS.length - 1))
  return ASCII_CHARS[Math.min(idx, ASCII_CHARS.length - 1)]
}

async function convert(inputPath) {
  const meta = await sharp(inputPath).metadata()
  if (!meta.pages || meta.pages < 1) throw new Error("Not an animated GIF or no frames")

  const frames = []
  const delays = meta.delay ?? []

  for (let i = 0; i < meta.pages; i++) {
    const { data, info } = await sharp(inputPath, { page: i })
      .resize(COLS, ROWS, { fit: "contain", background: { r: 0, g: 0, b: 0 } })
      .raw()
      .toBuffer({ resolveWithObject: true })

    // Collect gray values for histogram equalization
    const grayValues = []
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const px = (y * info.width + x) * info.channels
        grayValues.push(0.2126 * data[px] + 0.7152 * data[px + 1] + 0.0722 * data[px + 2])
      }
    }

    const hist = buildHistogram(grayValues)
    const cdf = buildCdf(hist, grayValues.length)

    const lines = []
    for (let y = 0; y < ROWS; y++) {
      let line = ""
      const row = Math.min(y, info.height - 1)
      for (let x = 0; x < COLS; x++) {
        const col = Math.min(x, info.width - 1)
        const px = (row * info.width + col) * info.channels
        line += pixelToChar(cdf, data[px], data[px + 1], data[px + 2])
      }
      lines.push(line)
    }
    frames.push(lines)
  }

  const normDelays = delays.length === frames.length
    ? delays.map((d) => Math.max(d, 20))
    : frames.map(() => 100)

  const out =
    `// Auto-generated — ${frames.length} frames ${COLS}x${ROWS}\n` +
    `// Run: node scripts/convert-gif.mjs <file.gif>\n` +
    `export const asciiFrames = ${JSON.stringify(frames, null, 2)};\n` +
    `export const frameDelays = ${JSON.stringify(normDelays)};\n`

  const target = "src/components/ascii-loader-frames.ts"
  writeFileSync(target, out)
  console.log(`Wrote ${frames.length} frames, delays: [${normDelays.join(",")}] to ${target}`)
}

const inputPath = process.argv[2]
if (!inputPath) {
  console.error("Usage: node scripts/convert-gif.mjs <file.gif>")
  process.exit(1)
}
if (!existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`)
  process.exit(1)
}
convert(inputPath).catch((e) => { console.error(e); process.exit(1) })
