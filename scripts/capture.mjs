import fs from 'node:fs'
import path from 'node:path'

const out = process.argv[2] || 'artifacts/screenshots/view.png'
const clickText = process.argv[3] || ''
const waitMs = Number(process.argv[4] || 900)

const targets = await (await fetch('http://127.0.0.1:9223/json/list')).json()
const target = targets.find((item) => item.type === 'page')
if (!target) throw new Error('no page target')

const ws = new WebSocket(target.webSocketDebuggerUrl)
let seq = 0
const pending = new Map()

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)
  if (!msg.id) return
  const item = pending.get(msg.id)
  if (!item) return
  pending.delete(msg.id)
  if (msg.error) item.reject(new Error(msg.error.message))
  else item.resolve(msg.result)
})

await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true })
  ws.addEventListener('error', reject, { once: true })
})

await send('Page.enable')
await send('Runtime.enable')
await send('Page.bringToFront').catch(() => {})
await new Promise((r) => setTimeout(r, 600))

if (clickText) {
  const expression = `(() => {
    const preferred = [...document.querySelectorAll('.side-row, .rail-button')]
    const nodes = preferred.length ? preferred : [...document.querySelectorAll('button, a, [role="button"]')]
    const hit = nodes.find((node) => ((node.textContent || '') + ' ' + (node.getAttribute('title') || '') + ' ' + (node.getAttribute('aria-label') || '')).includes(${JSON.stringify(clickText)}))
    if (!hit) return 'miss'
    hit.click()
    return 'clicked'
  })()`
  const result = await send('Runtime.evaluate', { expression, returnByValue: true })
  console.log('click:', result.result?.value)
}

await new Promise((r) => setTimeout(r, waitMs))

const metrics = await send('Runtime.evaluate', {
  expression: `JSON.stringify({ w: innerWidth, h: innerHeight, title: document.title, text: document.body.innerText.slice(0, 400) })`,
  returnByValue: true,
})
console.log(metrics.result?.value)

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, Buffer.from(shot.data, 'base64'))
console.log('saved', out)
ws.close()
