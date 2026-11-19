import type { TodoItem } from './types'

export function mergeSyncedTodos(local: TodoItem[], remote: TodoItem[]): TodoItem[] {
  const merged = new Map<string, TodoItem>()
  for (const todo of local) merged.set(todo.id, todo)
  for (const candidate of remote) {
    const current = merged.get(candidate.id)
    if (!current || candidate.revision > current.revision ||
      (candidate.revision === current.revision && Date.parse(candidate.updatedAt) > Date.parse(current.updatedAt))) {
      merged.set(candidate.id, candidate)
    }
  }
  return [...merged.values()]
}

export interface SyncResult {
  pushed: number
  pulled: number
  syncedAt: string
}

export interface SyncService {
  sync(): Promise<SyncResult>
}
