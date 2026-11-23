import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { HABIT_EMOJIS, HABIT_GROUPS, LIST_COLORS, type Habit, type HabitFrequency, type HabitPersistence } from '@focusnotes/core'

interface HabitDialogProps {
  habit?: Habit | null
  onClose: () => void
  onSave: (habit: Habit) => void
  onDelete?: (id: string) => void
}

function todayKey(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `habit-${Date.now()}`
}

export function HabitDialog({ habit, onClose, onSave, onDelete }: HabitDialogProps) {
  const [name, setName] = useState(habit?.name ?? '')
  const [emoji, setEmoji] = useState(habit?.emoji ?? HABIT_EMOJIS[0] ?? '🌱')
  const [color, setColor] = useState(habit?.color ?? LIST_COLORS[1] ?? '#2f6fed')
  const [frequency, setFrequency] = useState<HabitFrequency>(habit?.frequency ?? 'daily')
  const [goal, setGoal] = useState(habit?.goal ?? 1)
  const [startDate, setStartDate] = useState(habit?.startDate ?? todayKey())
  const [persistence, setPersistence] = useState<HabitPersistence>(habit?.persistence ?? 'forever')
  const [group, setGroup] = useState(habit?.group ?? '其他')
  const [autoLog, setAutoLog] = useState(habit?.autoLog ?? false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = () => {
    if (!name.trim()) {
      setError('给习惯起个名字吧')
      return
    }
    onSave({
      id: habit?.id ?? newId(),
      name: name.trim(),
      emoji,
      color,
      frequency,
      goal: Math.max(1, Math.min(20, Number(goal) || 1)),
      unit: goal > 1 ? '次' : '次',
      startDate,
      persistence,
      group,
      reminder: habit?.reminder ?? null,
      autoLog,
      archived: habit?.archived ?? false,
      createdAt: habit?.createdAt ?? new Date().toISOString(),
      streak: habit?.streak ?? 0,
      bestStreak: habit?.bestStreak ?? 0,
    })
    onClose()
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="modal habit-dialog" role="dialog" aria-modal="true" aria-label={habit ? '编辑习惯' : '添加习惯'}>
        <header className="modal-head">
          <div>
            <span className="modal-kicker">{habit ? '编辑习惯' : '添加习惯'}</span>
            <h2>每天进步一点点</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭"><X size={17} /></button>
        </header>

        <div className="modal-body">
          <div className="habit-preview">
            <span className="habit-emoji big" style={{ background: `${color}22`, color }}>{emoji}</span>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') submit() }}
              placeholder="例如：每天阅读 20 分钟"
              maxLength={60}
            />
          </div>

          <div className="field">
            <span>图标</span>
            <div className="emoji-grid">
              {HABIT_EMOJIS.map((item) => (
                <button key={item} className={`emoji-button${emoji === item ? ' active' : ''}`} onClick={() => setEmoji(item)}>{item}</button>
              ))}
            </div>
          </div>

          <div className="field">
            <span>颜色</span>
            <div className="color-row">
              {LIST_COLORS.map((item) => (
                <button
                  key={item}
                  className={`color-dot${color === item ? ' active' : ''}`}
                  style={{ background: item }}
                  onClick={() => setColor(item)}
                  aria-label={`选择颜色 ${item}`}
                />
              ))}
            </div>
          </div>

          <div className="field-grid">
            <label className="field">
              <span>频率</span>
              <select value={frequency} onChange={(event) => setFrequency(event.target.value as HabitFrequency)}>
                <option value="daily">每天</option>
                <option value="weekdays">工作日</option>
                <option value="weekends">周末</option>
              </select>
            </label>
            <label className="field">
              <span>目标</span>
              <input type="number" min={1} max={20} value={goal} onChange={(event) => setGoal(Number(event.target.value))} />
            </label>
          </div>

          <div className="field-grid">
            <label className="field">
              <span>开始日期</span>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label className="field">
              <span>坚持天数</span>
              <select value={persistence} onChange={(event) => setPersistence(event.target.value as HabitPersistence)}>
                <option value="forever">永远</option>
                <option value="30">30 天</option>
                <option value="60">60 天</option>
                <option value="90">90 天</option>
              </select>
            </label>
          </div>

          <label className="field">
            <span>所属分组</span>
            <select value={group} onChange={(event) => setGroup(event.target.value)}>
              {HABIT_GROUPS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>

          <label className="checkbox-line">
            <input type="checkbox" checked={autoLog} onChange={(event) => setAutoLog(event.target.checked)} />
            自动弹出打卡日志
          </label>

          {error && <p className="form-error">{error}</p>}
        </div>

        <footer className="modal-foot">
          {habit && onDelete && (
            <button className="ghost-button danger" onClick={() => { onDelete(habit.id); onClose() }}>删除习惯</button>
          )}
          <span className="modal-foot-spacer" />
          <button className="ghost-button" onClick={onClose}>取消</button>
          <button className="primary-button" onClick={submit}>保存</button>
        </footer>
      </div>
    </div>
  )
}
