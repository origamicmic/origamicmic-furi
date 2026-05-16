const { createServer } = require("http")

async function main() {
  const next = require("next")
  const port = parseInt(process.env.PORT || "3000", 10)
  const app = next({ dev: true, port })
  await app.prepare()
  const handle = app.getRequestHandler()

  createServer((req, res) => {
    // Next.js dev server sets Cache-Control: no-cache on every
    // response for HMR.  We replace it with no-store which is the
    // only header that disables bfcache, preventing React's event
    // system from freezing after back/forward navigation.
    const origSet = res.setHeader
    res.setHeader = function (name, value) {
      if (name.toLowerCase() === "cache-control" && String(value).includes("no-cache")) {
        value = "no-store"
      }
      return origSet.call(this, name, value)
    }
    handle(req, res)
  }).listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
