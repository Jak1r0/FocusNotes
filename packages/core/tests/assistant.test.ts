import { describe, expect, it } from 'vitest'
import { assistantEndpoint, buildAssistantRequest, parseAssistantReply, assistantTaskContext } from '../src/index'

describe('AI 助手 OpenAI 兼容客户端', () => {
  it('端点拼接兼容带 /v1 与 /chat/completions 的地址', () => {
    expect(assistantEndpoint('https://api.example.com')).toBe('https://api.example.com/v1/chat/completions')
    expect(assistantEndpoint('https://api.example.com/v1/')).toBe('https://api.example.com/v1/chat/completions')
    expect(assistantEndpoint('https://api.example.com/v1/chat/completions')).toBe('https://api.example.com/v1/chat/completions')
  })

  it('构造带 Bearer 的请求，缺少配置时返回 null', () => {
    const request = buildAssistantRequest(
      { endpoint: 'https://api.example.com', model: 'gpt-4o-mini', apiKey: 'sk-test' },
      [{ role: 'user', content: '你好' }],
    )
    expect(request?.url).toBe('https://api.example.com/v1/chat/completions')
    expect(request?.headers.Authorization).toBe('Bearer sk-test')
    expect(JSON.parse(request!.body).messages).toEqual([{ role: 'user', content: '你好' }])
    expect(buildAssistantRequest({ endpoint: '', model: 'm', apiKey: 'k' }, [{ role: 'user', content: 'x' }])).toBeNull()
  })

  it('从响应中安全提取文本', () => {
    expect(parseAssistantReply({ choices: [{ message: { content: '  回复  ' } }] })).toBe('回复')
    expect(parseAssistantReply({ choices: [] })).toBeNull()
    expect(parseAssistantReply({ choices: [{ text: 123 }] })).toBeNull()
  })

  it('把待办压成精简上下文', () => {
    const context = assistantTaskContext([
      { title: '写周报', dueAt: '2026-11-27T09:00:00.000Z', important: true, urgent: false, completed: false },
      { title: '已完成', dueAt: null, important: false, urgent: false, completed: true },
    ], new Date(2026, 10, 26))
    expect(context).toContain('写周报')
    expect(context).not.toContain('已完成')
  })
})
