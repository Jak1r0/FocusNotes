import { isOverdue, type TodoItem } from '@focusnotes/core'

export function toDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export function fromDateTimeInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

export function formatDue(todo: TodoItem, now = new Date()): string {
  if (!todo.dueAt) return '无截止时间'
  const date = new Date(todo.dueAt)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const days = Math.round((target.getTime() - today.getTime()) / 86400000)
  const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  const day = days === 0 ? '今天' : days === 1 ? '明天' : days === -1 ? '昨天' : date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  return `${isOverdue(todo, now) ? '已逾期 · ' : ''}${day} ${time}`
}
