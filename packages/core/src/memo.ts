import type { Memo } from './types'

export const MEMO_CONTENT_LIMIT = 50000
export const MEMO_LIMIT = 500

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function text(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.slice(0, limit) : ''
}

/** 归一化备忘录列表：丢弃无 id/title 的项，限制正文长度与总数，置顶优先。 */
export function normalizeMemos(value: unknown, now = new Date()): Memo[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const memos: Memo[] = []
  const fallbackTime = now.toISOString()
  for (const raw of value) {
    if (memos.length >= MEMO_LIMIT) break
    const record = asRecord(raw)
    if (!record) continue
    const id = typeof record.id === 'string' ? record.id.trim() : ''
    if (!id || seen.has(id)) continue
    const title = text(record.title, 200).trim()
    const content = text(record.content, MEMO_CONTENT_LIMIT)
    if (!title && !content) continue
    seen.add(id)
    const createdAt = typeof record.createdAt === 'string' && Number.isFinite(Date.parse(record.createdAt)) ? record.createdAt : fallbackTime
    const updatedAt = typeof record.updatedAt === 'string' && Number.isFinite(Date.parse(record.updatedAt)) ? record.updatedAt : createdAt
    memos.push({
      id,
      title: title || '无标题',
      content,
      pinned: record.pinned === true,
      createdAt,
      updatedAt,
      revision: typeof record.revision === 'number' && Number.isFinite(record.revision) ? Math.max(1, Math.round(record.revision)) : 1,
      deleted: record.deleted === true,
    })
  }
  return memos.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  })
}
