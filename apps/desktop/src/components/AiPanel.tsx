import { useEffect, useState } from 'react'
import { Bot, Check, Eye, EyeOff, KeyRound, Link2 } from 'lucide-react'

interface AiPanelProps {
  onSaved?: () => void
  /** 把非凭据配置写进个人档案，随 JSON 同步到其它设备。 */
  onPreferences?: (patch: { aiEndpoint: string; aiModel: string; aiTemperature: number }) => void
}

interface Status {
  endpoint: string
  model: string
  hasKey: boolean
  encrypted: boolean
  temperature: number
}

export function AiPanel({ onSaved, onPreferences }: AiPanelProps) {
  const [status, setStatus] = useState<Status | null>(null)
  const [endpoint, setEndpoint] = useState('')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [temperature, setTemperature] = useState(0.4)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    void window.focusDesktop?.ai?.get?.().then((value) => {
      if (!value) return
      setStatus(value)
      setEndpoint(value.endpoint)
      setModel(value.model)
      setTemperature(value.temperature)
    }).catch(() => setMessage('无法读取模型配置。'))
  }, [])

  const save = async () => {
    setBusy(true)
    setMessage('')
    try {
      const result = await window.focusDesktop?.ai?.set?.({ endpoint, model, apiKey, temperature })
      if (!result?.ok) { setMessage(result?.message || '保存失败。'); return }
      setApiKey('')
      setStatus((current) => current ? { ...current, endpoint, model, hasKey: Boolean(result.hasKey), temperature } : current)
      onPreferences?.({ aiEndpoint: endpoint.trim(), aiModel: model.trim(), aiTemperature: temperature })
      setMessage(result.encrypted ? '已保存，API 密钥已加密存储在本机。' : '已保存，但当前系统不支持密钥加密。')
      onSaved?.()
    } finally { setBusy(false) }
  }

  return (
    <div className="settings-section ai-panel">
      <div className="settings-section-title"><Bot size={15} /> AI 助手 · 大模型接口</div>
      <p className="settings-hint">支持任何 OpenAI 兼容的 chat completions 接口（OpenAI、DeepSeek、通义等）。密钥使用系统加密存储，不会写进个人 JSON 或同步文件。</p>
      <label className="field-row">
        <span>接口地址</span>
        <input value={endpoint} onChange={(event) => setEndpoint(event.target.value)}
          placeholder="https://api.deepseek.com 或 https://api.openai.com/v1" aria-label="模型接口地址" />
      </label>
      <label className="field-row">
        <span>模型名称</span>
        <input value={model} onChange={(event) => setModel(event.target.value)}
          placeholder="deepseek-chat / gpt-4o-mini" aria-label="模型名称" />
      </label>
      <label className="field-row">
        <span>API 密钥</span>
        <span className="ai-key-field">
          <input value={apiKey} onChange={(event) => setApiKey(event.target.value)}
            type={showKey ? 'text' : 'password'} placeholder={status?.hasKey ? '已保存，留空表示不修改' : 'sk-...'} aria-label="API 密钥" autoComplete="off" />
          <button className="icon-ghost tiny" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? '隐藏密钥' : '显示密钥'}>
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </span>
      </label>
      <label className="field-row">
        <span>创造性 temperature</span>
        <input type="number" min={0} max={2} step={0.1} value={temperature}
          onChange={(event) => setTemperature(Number(event.target.value))} aria-label="temperature" />
      </label>
      <div className="ai-status-row">
        <span><Link2 size={12} /> {status?.endpoint || '未配置'}</span>
        <span><KeyRound size={12} /> {status?.hasKey ? '密钥已保存' : '无密钥'}{status?.encrypted ? ' · 已加密' : ''}</span>
      </div>
      {message && <p className="settings-hint" role="status">{message}</p>}
      <button className="primary-button" disabled={busy || !endpoint.trim() || !model.trim()} onClick={() => void save()}>
        {busy ? '保存中…' : <><Check size={14} /> 保存模型配置</>}
      </button>
    </div>
  )
}
