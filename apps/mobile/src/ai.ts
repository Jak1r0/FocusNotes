import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  assistantEndpoint,
  buildAssistantRequest,
  parseAssistantReply,
  type ParsedTodoDraft,
} from '@focusnotes/core'

export interface MobileAiConfig {
  endpoint: string
  model: string
  apiKey: string
  temperature: number
}

export async function loadMobileAiConfig(preferences: { aiEndpoint: string; aiModel: string; aiTemperature: number }): Promise<MobileAiConfig | null> {
  const apiKey = await AsyncStorage.getItem('focusnotes.ai.key').catch(() => null)
  if (!preferences.aiEndpoint || !preferences.aiModel || !apiKey) return null
  return { endpoint: preferences.aiEndpoint, model: preferences.aiModel, apiKey, temperature: preferences.aiTemperature }
}

/** 让模型把自然语言转换为待办草稿；失败返回 null，交给本地解析器。 */
export async function recognizeWithAi(config: MobileAiConfig, input: string, now = new Date()): Promise<ParsedTodoDraft | null> {
  const request = buildAssistantRequest(config, [
    {
      role: 'system',
      content: `你是待办解析助手。当前本地日期时间：${now.toLocaleString('zh-CN')}。把用户输入解析为 JSON，字段：title(string), dueAt(ISO 8601 字符串或 null), important(boolean), urgent(boolean), tags(string[])。只输出 JSON，不要其它文字。支持中文日期如"明年十月一"、"下周三"、"明晚八点"。生日/纪念日/周年请给 tags 加"纪念日"。`,
    },
    { role: 'user', content: input },
  ])
  if (!request) return null
  const response = await fetch(request.url, { method: 'POST', headers: request.headers, body: request.body })
  if (!response.ok) return null
  const text = parseAssistantReply(await response.json())
  if (!text) return null
  try {
    const json = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')) as Record<string, unknown>
    const title = typeof json.title === 'string' ? json.title.trim() : ''
    if (!title) return null
    return {
      title,
      dueAt: typeof json.dueAt === 'string' && !Number.isNaN(Date.parse(json.dueAt)) ? new Date(json.dueAt).toISOString() : null,
      important: json.important === true,
      urgent: json.urgent === true,
      tags: Array.isArray(json.tags) ? json.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 8) : [],
      confidence: 0.92,
      recognizedTerms: ['大模型识别'],
      warnings: [],
    }
  } catch { return null }
}

export { assistantEndpoint }
