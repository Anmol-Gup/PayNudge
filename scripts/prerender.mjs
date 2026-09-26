// Runs after `vite build` (see package.json's "postbuild" script). The
// production bundle is a client-only React SPA, which means the raw HTML
// most crawlers fetch is just `<div id="root"></div>` — most AI crawlers
// (GPTBot, ClaudeBot, PerplexityBot, etc.) don't execute JavaScript at all,
// so they'd see nothing. This renders the public "/" route once with a
// headless browser and bakes the resulting HTML into dist/index.html, so
// the real homepage content ships in the initial response. The app still
// hydrates into a normal interactive SPA from there (main.tsx uses
// createRoot, not hydrateRoot, so a plain client-side remount over the
// prerendered markup is expected and safe).
import { preview } from 'vite'
import puppeteer from 'puppeteer'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distIndexPath = path.join(__dirname, '..', 'dist', 'index.html')

// A sentinel string only present once the Landing page has actually
// rendered — used to fail loudly instead of silently shipping a blank page.
const READY_MARKER = 'Get paid without chasing clients.'

async function main() {
  const server = await preview({ preview: { port: 4319, strictPort: true } })
  const url = server.resolvedUrls.local[0]

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  })

  try {
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle0' })
    await page.waitForFunction(
      (marker) => document.body.innerText.includes(marker),
      { timeout: 10_000 },
      READY_MARKER
    )

    const html = await page.evaluate(() => document.documentElement.outerHTML)

    if (!html.includes(READY_MARKER)) {
      throw new Error('Prerendered HTML is missing expected Landing page content — aborting.')
    }

    writeFileSync(distIndexPath, `<!doctype html>\n${html}\n`)
    console.log('Prerendered dist/index.html with real Landing page content.')
  } finally {
    await browser.close()
    await server.close()
  }
}

main().catch((err) => {
  console.error('Prerender failed:', err)
  process.exit(1)
})
