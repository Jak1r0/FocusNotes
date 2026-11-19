import fs from 'node:fs'

const out = process.argv[2] || 'artifacts/screenshots/modal.png'
const action = process.argv[3] || ''
const waitMs = Number(process.argv[4] || 500)
const targets = await (await fetch('http://127.0.0.1:9223/json/list')).json()
const target = targets.find((item) => item.type === 'page')
const ws = new WebSocket(target.webSocketDebuggerUrl)
let seq = 0
const pending = new Map()
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq
  pending.set(id, { resolve, reject })
  ws.send(JSON.stringify({ id, method, params }))
})
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)
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
if (action) {
  const r = await send('Runtime.evaluate', { expression: action, returnByValue: true, awaitPromise: true })
  console.log('action:', JSON.stringify(r.result?.value))
}
await new Promise((r) => setTimeout(r, waitMs))
const before = await send('Runtime.evaluate', { expression: `JSON.stringify({modals:document.querySelectorAll('.modal-backdrop').length, tail:document.body.innerText.slice(-80)})`, returnByValue: true })
console.log('before:', before.result?.value)
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
fs.mkdirSync(out.split('/').slice(0, -1).join('/'), { recursive: true })
fs.writeFileSync(out, Buffer.from(shot.data, 'base64'))
const after = await send('Runtime.evaluate', { expression: `JSON.stringify({modals:document.querySelectorAll('.modal-backdrop').length, tail:document.body.innerText.slice(-80)})`, returnByValue: true })
console.log('after:', after.result?.value)
console.log('saved', out)
ws.close()
