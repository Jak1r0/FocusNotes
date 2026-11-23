const { app, dialog, nativeImage } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

let statePath = ''
let state = { imagePath: '', mode: 'system' }

function initBackground() {
  statePath = path.join(app.getPath('userData'), 'ui-background.json')
  try {
    const raw = JSON.parse(fs.readFileSync(statePath, 'utf8'))
    if (raw && typeof raw.imagePath === 'string') state.imagePath = raw.imagePath
    if (raw && (raw.mode === 'image' || raw.mode === 'system')) state.mode = raw.mode
  } catch {
    // 首次启动或状态文件损坏。
  }
}

function saveState() {
  if (!statePath) return
  try { fs.writeFileSync(statePath, JSON.stringify(state, null, 2)) } catch { /* 忽略 */ }
}

function imageDataUrl() {
  if (!state.imagePath) return null
  try {
    const info = fs.statSync(state.imagePath)
    if (!info.isFile() || info.size > 32 * 1024 * 1024) return null
    const image = nativeImage.createFromPath(state.imagePath)
    if (image.isEmpty()) return null
    const { width, height } = image.getSize()
    const scale = Math.min(1, 1920 / Math.max(width, height || 1))
    const output = scale < 1 ? image.resize({ width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }) : image
    return 'data:image/jpeg;base64,' + output.toJPEG(84).toString('base64')
  } catch {
    return null
  }
}

function getBackground() {
  return { image: imageDataUrl(), mode: state.mode }
}

function setBackgroundMode(mode) {
  state.mode = mode === 'image' ? 'image' : 'system'
  saveState()
  return { ok: true, mode: state.mode }
}

async function pickBackground(parent) {
  const result = await dialog.showOpenDialog(parent || undefined, {
    title: '选择玻璃背景图片',
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }],
  })
  if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true }
  const source = result.filePaths[0]
  try {
    const info = fs.statSync(source)
    if (!info.isFile()) return { ok: false, error: '所选路径不是文件。' }
    if (info.size > 32 * 1024 * 1024) return { ok: false, error: '图片不能超过 32MB。' }
    const ext = path.extname(source).toLowerCase() || '.jpg'
    const destination = path.join(app.getPath('userData'), `custom-background${ext}`)
    if (state.imagePath && state.imagePath !== destination) {
      try { fs.rmSync(state.imagePath, { force: true }) } catch { /* 忽略 */ }
    }
    fs.copyFileSync(source, destination)
    state.imagePath = destination
    state.mode = 'image'
    saveState()
    const image = imageDataUrl()
    if (!image) return { ok: false, error: '无法读取该图片，请选择 PNG/JPG/BMP。' }
    return { ok: true, image }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '读取图片失败。' }
  }
}

function clearBackground() {
  if (state.imagePath) {
    try { fs.rmSync(state.imagePath, { force: true }) } catch { /* 忽略 */ }
  }
  state = { imagePath: '', mode: 'system' }
  saveState()
  return { ok: true }
}

module.exports = { initBackground, getBackground, setBackgroundMode, pickBackground, clearBackground }