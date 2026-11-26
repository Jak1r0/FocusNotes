/** OpenAI 兼容 chat completions 的最小配置；密钥永不进入这里。 */
export interface AssistantConfig {
  endpoint: string
  model: string
  apiKey: string
  temperature?: number
}

export interface AssistantMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AssistantRequest {
  url: string
  headers: Record<string, string>
  body: string
}

/** 拼接 OpenAI 兼容端点，允许用户填带 /v1 或不带 /v1 的地址。 */
export function assistantEndpoint(endpoint: string): string {
  const base = endpoint.trim().replace(/\/+$/, '')
  if (!base) return ''
  return /\/chat\/completions$/.test(base) ? base : `${base.replace(/\/v1$/, '')}/v1/chat/completions`
}

/** 构造请求；core 只生成参数，真正的 fetch 由宿主（Electron 主进程或移动端）执行。 */
export function buildAssistantRequest(config: AssistantConfig, messages: readonly AssistantMessage[]): AssistantRequest | null {
  const url = assistantEndpoint(config.endpoint)
  if (!url || !config.model.trim() || !config.apiKey.trim() || messages.length === 0) return null
  return {
    url,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model.trim(),
      messages: messages.map((item) => ({ role: item.role, content: item.content })),
      temperature: Math.min(2, Math.max(0, config.temperature ?? 0.4)),
      stream: false,
    }),
  }
}

/** 从 OpenAI 兼容响应里安全取出 assistant 文本。 */
export function parseAssistantReply(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices) || !choices.length) return null
  const first = choices[0] as { message?: { content?: unknown }; text?: unknown }
  const content = first?.message?.content ?? first?.text
  return typeof content === 'string' && content.trim() ? content.trim() : null
}

/** 把待办压成简短上下文，避免把整份档案塞给模型。 */
export function assistantTaskContext(todos: readonly { title: string; dueAt: string | null; important: boolean; urgent: boolean; completed: boolean }[], now = new Date()): string {
  const open = todos.filter((todo) => !todo.completed).slice(0, 40)
  if (!open.length) return '当前没有未完成待办。'
  return open.map((todo) => {
    const due = todo.dueAt ? new Date(todo.dueAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '无期限'
    return `- ${todo.title}（截止 ${due}${todo.important ? '，重要' : ''}${todo.urgent ? '，紧急' : ''}）`
  }).join('\n') + `\n以上为 ${now.toLocaleDateString('zh-CN')} 的待办。`
}
