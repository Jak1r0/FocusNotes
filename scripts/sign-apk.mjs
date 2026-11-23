#!/usr/bin/env node
/**
 * 严格签名流程：从未签名/已签名 APK 复制对齐版本 -> zipalign -> apksigner(v1/v2/v3)
 * 密码来源优先级：KS_PASS/KEY_PASS 环境变量 > PASS_FILE（第一行 keystore，第二行 key）> local.properties
 * 不会打印密码。
 */
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk')
const buildTools = process.env.BUILD_TOOLS || path.join(sdk, 'build-tools', '35.0.0')
const tool = (name) => {
  const base = path.join(buildTools, name)
  if (process.platform !== 'win32') return base
  return existsSync(`${base}.exe`) ? `${base}.exe` : `${base}.bat`
}

const input = path.resolve(process.env.APK_PATH || path.join(root, 'apps/mobile/android/app/build/outputs/apk/release/app-release.apk'))
const output = path.resolve(process.env.APK_OUT || path.join(root, 'artifacts', `FocusNotes-${process.env.VERSION || 'signed'}.apk`))
const aligned = output.replace(/\.apk$/i, '.aligned.apk')
const keystore = path.resolve(process.env.KS_PATH || path.join(root, 'apps/mobile/android/app/focusnotes-release.jks'))

function fail(message) {
  console.error(`[sign-apk] ${message}`)
  process.exit(1)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: command.toLowerCase().endsWith('.bat'),
    ...options,
  })
  if (result.error) fail(`${path.basename(command)} failed: ${result.error.message}`)
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim()
    fail(`${path.basename(command)} failed (${result.status})${detail ? `: ${detail}` : ''}`)
  }
  return result.stdout || ''
}

function readProps() {
  try {
    const lines = readFileSync(path.join(root, 'apps/mobile/android/local.properties'), 'utf8').split(/\r?\n/)
    return Object.fromEntries(lines.filter((line) => line.includes('=')).map((line) => {
      const index = line.indexOf('=')
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()]
    }))
  } catch {
    return {}
  }
}

function readPasswords() {
  let store = process.env.KS_PASS || ''
  let key = process.env.KEY_PASS || store
  const passFile = process.env.PASS_FILE
  if ((!store || !key) && passFile && existsSync(passFile)) {
    const lines = readFileSync(passFile, 'utf8').split(/\r?\n/)
    store = store || lines[0] || ''
    key = key || lines[1] || store
  }
  if (!store || !key) {
    const props = readProps()
    store = store || props.FN_RELEASE_STORE_PASSWORD || ''
    key = key || props.FN_RELEASE_KEY_PASSWORD || store
  }
  return { store, key }
}

if (!existsSync(input)) fail(`APK not found: ${input}`)
if (!existsSync(keystore)) fail(`keystore not found: ${keystore}`)
if (!existsSync(tool('zipalign')) || !existsSync(tool('apksigner'))) fail(`Android build-tools not found: ${buildTools}`)

const props = readProps()
const alias = process.env.KS_ALIAS || props.FN_RELEASE_KEY_ALIAS || 'focusnotes'
const { store, key } = readPasswords()
if (!store || !key) fail('missing signing password; set KS_PASS/KEY_PASS, PASS_FILE, or local.properties')

mkdirSync(path.dirname(output), { recursive: true })
rmSync(aligned, { force: true })

console.log(`[sign-apk] input: ${input}`)
run(tool('zipalign'), ['-f', '-p', '4', input, aligned])
run(tool('apksigner'), [
  'sign',
  '--ks', keystore,
  '--ks-key-alias', alias,
  '--ks-pass', 'env:KS_PASS',
  '--key-pass', 'env:KEY_PASS',
  '--v1-signing-enabled', 'true',
  '--v2-signing-enabled', 'true',
  '--v3-signing-enabled', 'true',
  '--v4-signing-enabled', 'false',
  '--out', output,
  aligned,
], { env: { ...process.env, KS_PASS: store, KEY_PASS: key } })

const verify = run(tool('apksigner'), ['verify', '--min-sdk-version', '21', '--verbose', '--print-certs', output])
const schemes = ['v1', 'v2', 'v3'].map((scheme) => {
  const match = verify.match(new RegExp(`Verified using ${scheme} scheme[^:]*: (true|false)`))
  return { scheme, ok: match?.[1] === 'true' }
})
if (schemes.some((item) => !item.ok)) fail(`signature scheme check failed: ${JSON.stringify(schemes)}`)
run(tool('zipalign'), ['-c', '-P', '16', '4', output])
rmSync(aligned, { force: true })

const hash = createHash('sha256').update(readFileSync(output)).digest('hex')
console.log(`[sign-apk] signed: ${output}`)
console.log(`[sign-apk] size: ${statSync(output).size}`)
console.log(`[sign-apk] sha256: ${hash}`)
console.log('[sign-apk] schemes: v1=true v2=true v3=true v4=false')