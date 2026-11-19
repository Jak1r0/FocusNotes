import { CalendarClock, Check, Flag, RotateCcw, Trash2 } from 'lucide-react'
import type { TodoItem, TodoList } from '@focusnotes/core'
import { formatDue } from '../date'

interface TaskRowProps {
  todo: TodoItem
  lists: TodoList[]
  compact?: boolean
  onToggle: (id: string) => void
  onEdit: (todo: TodoItem) => void
  onDelete: (id: string) => void
  onRestore?: (id: string) => void
  onPurge?: (id: string) => void
}

export function TaskRow({ todo, lists, compact, onToggle, onEdit, onDelete, onRestore, onPurge }: TaskRowProps) {
  const list = lists.find((item) => item.id === todo.listId)
  const due = todo.dueAt ? formatDue(todo, new Date()) : ''
  const overdue = Boolean(todo.dueAt && !todo.completed && Date.parse(todo.dueAt) < Date.now())
  return (
    <div className={`task-row${todo.completed ? ' done' : ''}${compact ? ' compact' : ''}`}>
      {todo.deleted ? (
        <>
          <span className="task-deleted-mark">已删除</span>
          <div className="task-main">
            <span className="task-title">{todo.title}</span>
            <span className="task-meta">移入垃圾桶 · 可恢复</span>
          </div>
          <div className="task-actions">
            {onRestore && (
              <button className="icon-ghost" onClick={() => onRestore(todo.id)} title="恢复任务" aria-label="恢复任务">
                <RotateCcw size={15} />
              </button>
            )}
            {onPurge && (
              <button className="icon-ghost danger-hover" onClick={() => onPurge(todo.id)} title="彻底删除" aria-label="彻底删除">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <button
            className={`task-check${todo.completed ? ' checked' : ''}`}
            onClick={() => onToggle(todo.id)}
            aria-label={todo.completed ? '标记为未完成' : '标记为完成'}
            aria-pressed={todo.completed}
          >
            {todo.completed && <Check size={12} strokeWidth={3} />}
          </button>
          <button className="task-main" onClick={() => onEdit(todo)}>
            <span className="task-title">{todo.title}</span>
            {!compact && todo.notes && <span className="task-notes">{todo.notes}</span>}
            <span className="task-meta">
              {due && (
                <span className={`task-due${overdue ? ' overdue' : ''}`}>
                  <CalendarClock size={12} />
                  {due}
                </span>
              )}
              {list && (
                <span className="task-list-name" style={{ color: list.color }}>
                  {list.name}
                </span>
              )}
              {todo.important && (
                <span className="task-flag important">
                  <Flag size={11} />
                  重要
                </span>
              )}
              {todo.urgent && (
                <span className="task-flag urgent">
                  <Flag size={11} />
                  紧急
                </span>
              )}
              {!compact && todo.tags.map((tag) => <span className="task-tag" key={tag}>#{tag}</span>)}
            </span>
          </button>
          <div className="task-actions">
            <button className="icon-ghost" onClick={() => onEdit(todo)} title="编辑任务" aria-label="编辑任务">
              <Flag size={14} />
            </button>
            <button className="icon-ghost danger-hover" onClick={() => onDelete(todo.id)} title="删除任务" aria-label="删除任务">
              <Trash2 size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
