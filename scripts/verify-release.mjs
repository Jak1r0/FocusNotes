#!/usr/bin/env node
/**
 * 发布前校验：APK 版本、v1/v2/v3 签名、证书指纹、zipalign、文件哈希；可选校验 Windows EXE 版本。
 * 用法：APK_PATH=... EXE_PATH=... node scripts/verify-release.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
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

const packageVersion = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version
const apk = path.resolve(process.env.APK_PATH || path.join(root, 'apps/mobile/android/app/build/outputs/apk/release/app-release.apk'))
const exe = process.env.EXE_PATH ? path.resolve(process.env.EXE_PATH) : ''
const expectedCert = (process.env.EXPECTED_CERT_SHA256 || '7a851890d7d62edf66d08f7183846517cdcb98f6fc24fc23bfa87b2f2aa39c2b').toLowerCase()
const expectedVersion = process.env.EXPECTED_VERSION || packageVersion

const failures = []
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const run = (command, args) => spawnSync(command, args, {
  encoding: 'utf8',
  shell: command.toLowerCase().endsWith('.bat'),
})

if (!existsSync(apk)) failures.push(`APK not found: ${apk}`)
if (!existsSync(tool('apksigner')) || !existsSync(tool('aapt')) || !existsSync(tool('zipalign'))) {
  failures.push(`Android build-tools not found: ${buildTools}`)
}

if (!failures.length) {
  const badging = run(tool('aapt'), ['dump', 'badging', apk])
  const versionCode = badging.stdout?.match(/versionCode='(\d+)'/)?.[1] || ''
  const versionName = badging.stdout?.match(/versionName='([^']+)'/)?.[1] || ''
  console.log(`[verify] apk: ${apk}`)
  console.log(`[verify] versionCode=${versionCode} versionName=${versionName}`)
  if (versionName !== expectedVersion) failures.push(`versionName ${versionName} != ${expectedVersion}`)

  const verify = run(tool('apksigner'), ['verify', '--min-sdk-version', '21', '--verbose', '--print-certs', apk])
  const text = `${verify.stdout || ''}\n${verify.stderr || ''}`
  for (const scheme of ['v1', 'v2', 'v3']) {
    const ok = new RegExp(`Verified using ${scheme} scheme[^:]*: true`).test(text)
    console.log(`[verify] ${scheme}: ${ok}`)
    if (!ok) failures.push(`${scheme} signature missing`)
  }
  const cert = text.match(/certificate SHA-256 digest: ([0-9a-f]+)/i)?.[1]?.toLowerCase() || ''
  console.log(`[verify] certificate sha256: ${cert || '-'}`)
  if (cert !== expectedCert) failures.push(`certificate fingerprint mismatch: ${cert || '-'}`)

  const align = run(tool('zipalign'), ['-c', '-P', '16', '4', apk])
  console.log(`[verify] zipalign(16K): ${align.status === 0 ? 'OK' : 'FAILED'}`)
  if (align.status !== 0) failures.push('zipalign check failed')

  const digest = hash(apk)
  console.log(`[verify] sha256: ${digest}`)
  if (process.env.EXPECTED_APK_SHA256 && digest.toLowerCase() !== process.env.EXPECTED_APK_SHA256.toLowerCase()) {
    failures.push('APK sha256 mismatch')
  }
}

if (exe) {
  if (!existsSync(exe)) {
    failures.push(`EXE not found: ${exe}`)
  } else {
    console.log(`[verify] exe: ${exe}`)
    console.log(`[verify] exe sha256: ${hash(exe)}`)
    if (process.platform === 'win32') {
      const info = spawnSync('powershell.exe', ['-NoProfile', '-Command',
        `(Get-Item -LiteralPath '${exe.replace(/'/g, "''")}').VersionInfo.ProductVersion`], { encoding: 'utf8' })
      const version = (info.stdout || '').trim()
      console.log(`[verify] exe product version: ${version || '-'}`)
      if (version && version !== expectedVersion) failures.push(`EXE version ${version} != ${expectedVersion}`)
    }
  }
}

if (failures.length) {
  console.error('\n[verify] FAILED')
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}
console.log('\n[verify] OK')