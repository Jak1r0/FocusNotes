import type { Quadrant, TodoItem } from './types'

/**
 * 四象限展示顺序：紧急优先于重要。
 * 颜色策略：凡含「紧急」的一律使用暖色高强调（红/橙），
 * 仅「重要」的退为蓝色，都不沾的保持灰色。
 */
export const QUADRANTS: Record<Quadrant, { label: string; shortLabel: string; color: string }> = {
  'important-urgent': { label: '紧急且重要', shortLabel: '紧急 · 重要', color: '#ff3b30' },
  'not-important-urgent': { label: '紧急不重要', shortLabel: '紧急 · 不重要', color: '#ff9f0a' },
  'important-not-urgent': { label: '重要不紧急', shortLabel: '重要 · 不紧急', color: '#0a84ff' },
  'not-important-not-urgent': { label: '不重要不紧急', shortLabel: '不紧急 · 不重要', color: '#8e8d93' },
}

export function getQuadrant(todo: Pick<TodoItem, 'important' | 'urgent'>): Quadrant {
  if (todo.important && todo.urgent) return 'important-urgent'
  if (todo.important) return 'important-not-urgent'
  if (todo.urgent) return 'not-important-urgent'
  return 'not-important-not-urgent'
}

/** 同等截止条件下，紧急排前、重要次之，最后是其余任务。 */
export function quadrantRank(todo: Pick<TodoItem, 'important' | 'urgent'>): number {
  if (todo.important && todo.urgent) return 0
  if (todo.urgent) return 1
  if (todo.important) return 2
  return 3
}

export function compareTodos(a: TodoItem, b: TodoItem): number {
  if (a.completed !== b.completed) return a.completed ? 1 : -1
  if (a.dueAt === null && b.dueAt !== null) return 1
  if (a.dueAt !== null && b.dueAt === null) return -1
  if (a.dueAt !== null && b.dueAt !== null) {
    const difference = Date.parse(a.dueAt) - Date.parse(b.dueAt)
    if (difference !== 0) return difference
  }
  const rank = quadrantRank(a) - quadrantRank(b)
  if (rank !== 0) return rank
  return Date.parse(a.createdAt) - Date.parse(b.createdAt)
}

export function sortTodos(todos: TodoItem[]): TodoItem[] {
  return [...todos].sort(compareTodos)
}

export function isOverdue(todo: TodoItem, now = new Date()): boolean {
  return !todo.completed && todo.dueAt !== null && Date.parse(todo.dueAt) < now.getTime()
}
