import { useEffect, useState } from 'react'
import { CalendarClock, Flag, ListPlus, Trash2, X } from 'lucide-react'
import type { TodoDraft, TodoItem, TodoList } from '@focusnotes/core'
import { fromDateTimeInput, toDateTimeInput } from '../date'

interface TaskDialogProps {
  todo?: TodoItem | null
  lists: TodoList[]
  defaultListId: string
  defaultDueAt?: string | null
  onClose: () => void
  onSave: (draft: TodoDraft, id?: string) => Promise<void>
  onDelete?: (id: string) => void
}

export function TaskDialog({ todo, lists, defaultListId, defaultDueAt, onClose, onSave, onDelete }: TaskDialogProps) {
  const [title, setTitle] = useState(todo?.title ?? '')
  const [notes, setNotes] = useState(todo?.notes ?? '')
  const [due, setDue] = useState(toDateTimeInput(todo?.dueAt ?? defaultDueAt ?? null))
  const [listId, setListId] = useState(todo?.listId ?? defaultListId)
  const [important, setImportant] = useState(todo?.important ?? false)
  const [urgent, setUrgent] = useState(todo?.urgent ?? false)
  const [tags, setTags] = useState((todo?.tags ?? []).join(', '))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async () => {
    if (!title.trim()) {
      setError('请输入任务标题')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onSave({
        title: title.trim(),
        notes: notes.trim(),
        dueAt: fromDateTimeInput(due),
        listId,
        important,
        urgent,
        tags: tags.split(/[,，\s#]+/).map((tag) => tag.trim()).filter(Boolean),
      }, todo?.id)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="modal task-dialog" role="dialog" aria-modal="true" aria-label={todo ? '编辑任务' : '新建任务'}>
        <header className="modal-head">
          <div>
            <span className="modal-kicker">{todo ? '编辑任务' : '新建任务'}</span>
            <h2>{todo ? '调整这件事' : '接下来要做什么？'}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭">
            <X size={17} />
          </button>
        </header>

        <div className="modal-body">
          <label className="field">
            <span>标题</span>
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) void submit() }}
              placeholder="例如：提交季度复盘"
              maxLength={200}
            />
          </label>

          <label className="field">
            <span>备注</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="补充背景、链接或下一步动作" maxLength={4000} />
          </label>

          <div className="field-grid">
            <label className="field">
              <span><CalendarClock size={13} /> 截止时间</span>
              <input type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} />
            </label>
            <label className="field">
              <span><ListPlus size={13} /> 清单</span>
              <select value={listId} onChange={(event) => setListId(event.target.value)}>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>{list.name}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>标签</span>
            <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="用逗号分隔，例如：深度工作, 复盘" />
          </label>

          <div className="toggle-row">
            <button type="button" className={`toggle-pill${important ? ' on' : ''}`} onClick={() => setImportant((value) => !value)} aria-pressed={important}>
              <Flag size={14} /> 重要
            </button>
            <button type="button" className={`toggle-pill urgent${urgent ? ' on' : ''}`} onClick={() => setUrgent((value) => !value)} aria-pressed={urgent}>
              <Flag size={14} /> 紧急
            </button>
            <span className="toggle-hint">四象限会自动更新</span>
          </div>

          {error && <p className="form-error">{error}</p>}
        </div>

        <footer className="modal-foot">
          {todo && onDelete && (
            <button className="ghost-button danger" onClick={() => { onDelete(todo.id); onClose() }}>
              <Trash2 size={14} /> 删除
            </button>
          )}
          <span className="modal-foot-spacer" />
          <button className="ghost-button" onClick={onClose}>取消</button>
          <button className="primary-button" onClick={() => void submit()} disabled={busy}>{busy ? '保存中…' : '保存任务'}</button>
        </footer>
      </div>
    </div>
  )
}
