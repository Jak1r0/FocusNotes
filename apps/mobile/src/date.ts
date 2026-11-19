import { isOverdue, type TodoItem } from '@focusnotes/core'

export function formatDue(todo: TodoItem, now = new Date()): string {
  if (!todo.dueAt) return '无截止时间'
  const date = new Date(todo.dueAt)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const days = Math.round((target.getTime() - today.getTime()) / 86400000)
  const time = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  const day = days === 0 ? '今天' : days === 1 ? '明天' : days === -1 ? '昨天' : `${date.getMonth() + 1}月${date.getDate()}日`
  return `${isOverdue(todo, now) ? '已逾期 · ' : ''}${day} ${time}`
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '设置截止时间'
  const date = new Date(iso)
  return `${date.getMonth() + 1}月${date.getDate()}日 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}`
}
