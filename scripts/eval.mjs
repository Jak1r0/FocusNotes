const expression = process.argv[2]
if (!expression) {
  console.error('usage: node scripts/eval.mjs "<expression>"')
  process.exit(1)
}
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
await send('Runtime.enable')
const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
console.log(JSON.stringify(result.result?.value ?? result, null, 2))
ws.close()
