import { useMemo, useState } from 'react'
import { Check, CalendarPlus, Flame, Plus, Sparkles } from 'lucide-react'
import {
  addDays,
  dateKey,
  habitStreak,
  isDateKey,
  isHabitScheduled,
  startOfDay,
  type Habit,
} from '@focusnotes/core'
import { HabitDialog } from './HabitDialog'

interface HabitsViewProps {
  habits: Habit[]
  habitLogs: Record<string, string[]>
  onToggle: (habitId: string, day: string) => void
  onMark: (habitId: string, day: string) => void
  onAdd: (habit: Habit) => void
  onUpdate: (habit: Habit) => void
  onDelete: (habitId: string) => void
}

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

export function HabitsView({ habits, habitLogs, onToggle, onMark, onAdd, onUpdate, onDelete }: HabitsViewProps) {
  const [editing, setEditing] = useState<Habit | null>(null)
  const [creating, setCreating] = useState(false)
  const [makeupFor, setMakeupFor] = useState<string | null>(null)
  const [makeupError, setMakeupError] = useState('')
  const now = new Date()
  const today = dateKey(now)
  const [makeupDate, setMakeupDate] = useState(dateKey(addDays(startOfDay(now), -1)))
  const monday = addDays(startOfDay(now), -((now.getDay() + 6) % 7))
  const week = Array.from({ length: 7 }, (_, index) => addDays(monday, index))

  const activeHabits = habits.filter((habit) => !habit.archived)
  const todayScheduled = activeHabits.filter((habit) => isHabitScheduled(habit, now))
  const doneToday = todayScheduled.filter((habit) => (habitLogs[habit.id] ?? []).includes(today)).length
  const rate = todayScheduled.length ? Math.round((doneToday / todayScheduled.length) * 100) : 0

  const groups = useMemo(() => {
    const map = new Map<string, Habit[]>()
    for (const habit of activeHabits) {
      const list = map.get(habit.group) ?? []
      list.push(habit)
      map.set(habit.group, list)
    }
    return [...map.entries()]
  }, [activeHabits])

  return (
    <div className="habits-view">
      <section className="habits-hero card">
        <div className="habits-hero-text">
          <span className="modal-kicker">习惯养成</span>
          <h2>今天完成 {doneToday} / {todayScheduled.length}</h2>
          <p>不必完美，只要每天向前一点点。</p>
          <div className="goal-bar wide"><span style={{ width: `${rate}%` }} /></div>
        </div>
        <button className="primary-button" onClick={() => setCreating(true)}>
          <Plus size={15} /> 添加习惯
        </button>
      </section>

      <section className="week-strip card">
        {week.map((day, index) => {
          const key = dateKey(day)
          const scheduled = activeHabits.filter((habit) => isHabitScheduled(habit, day))
          const done = scheduled.filter((habit) => (habitLogs[habit.id] ?? []).includes(key)).length
          const complete = scheduled.length > 0 && done === scheduled.length
          return (
            <div key={key} className={`week-day${key === today ? ' today' : ''}`}>
              <span>周{WEEK_LABELS[index]}</span>
              <strong>{day.getDate()}</strong>
              <span className={`week-ring${complete ? ' complete' : done > 0 ? ' partial' : ''}`}>
                {complete ? <Check size={11} strokeWidth={3} /> : done > 0 ? done : ''}
              </span>
            </div>
          )
        })}
      </section>

      {activeHabits.length === 0 ? (
        <div className="empty-state card">
          <span className="empty-illustration"><Sparkles size={30} /></span>
          <h3>还没有习惯</h3>
          <p>从一件小事开始，比如每天读 10 页书。</p>
          <button className="ghost-button" onClick={() => setCreating(true)}><Plus size={14} /> 创建第一个习惯</button>
        </div>
      ) : (
        groups.map(([group, items]) => (
          <section className="habit-group" key={group}>
            <div className="section-heading">
              <span>{group}</span>
              <small>{items.length} 个习惯</small>
            </div>
            <div className="habit-grid">
              {items.map((habit) => {
                const logs = habitLogs[habit.id] ?? []
                const streak = habitStreak(habit, logs, now)
                const scheduledToday = isHabitScheduled(habit, now)
                const done = logs.includes(today)
                return (
                  <article className={`habit-card${done ? ' done' : ''}`} key={habit.id}>
                    <button className="habit-card-head" onClick={() => setEditing(habit)}>
                      <span className="habit-emoji" style={{ background: `${habit.color}22`, color: habit.color }}>{habit.emoji}</span>
                      <span className="habit-title">
                        <strong>{habit.name}</strong>
                        <small>
                          {habit.frequency === 'daily' ? '每天' : habit.frequency === 'weekdays' ? '工作日' : '周末'}
                          {habit.goal > 1 ? ` · ${habit.goal} ${habit.unit}` : ' · 当天完成打卡'}
                        </small>
                      </span>
                    </button>

                    <div className="habit-week">
                      {week.map((day) => {
                        const key = dateKey(day)
                        const scheduled = isHabitScheduled(habit, day)
                        const checked = logs.includes(key)
                        return (
                          <button
                            key={key}
                            className={`habit-dot${checked ? ' checked' : ''}${!scheduled ? ' off' : ''}${key === today ? ' today' : ''}`}
                            onClick={() => scheduled && onToggle(habit.id, key)}
                            title={`${day.getMonth() + 1}月${day.getDate()}日${scheduled ? (checked ? ' · 已打卡' : ' · 待打卡') : ' · 休息'}`}
                            aria-label={`${habit.name} ${day.getMonth() + 1}月${day.getDate()}日`}
                          >
                            {checked ? <Check size={10} strokeWidth={3} /> : day.getDate()}
                          </button>
                        )
                      })}
                    </div>

                    <div className="habit-foot">
                      <span className="habit-streak"><Flame size={13} /> 连续 {streak} 天{habit.bestStreak > streak ? ` · 最佳 ${habit.bestStreak} 天` : ''}</span>
                      <div className="habit-foot-actions">
                        <button
                          className={`habit-check${done ? ' done' : ''}`}
                          onClick={() => scheduledToday && onToggle(habit.id, today)}
                          disabled={!scheduledToday}
                        >
                          {done ? <><Check size={14} /> 今日已打卡</> : scheduledToday ? '今日打卡' : '今天休息'}
                        </button>
                        <button className="habit-makeup-toggle"
                          onClick={() => {
                            setMakeupFor((current) => current === habit.id ? null : habit.id)
                            setMakeupError('')
                            setMakeupDate(dateKey(addDays(startOfDay(now), -1)))
                          }}>
                          <CalendarPlus size={12} /> 补卡
                        </button>
                      </div>
                    </div>
                    {makeupFor === habit.id && (
                      <div className="habit-makeup">
                        <input type="date" max={today} min={habit.startDate} value={makeupDate}
                          aria-label={`${habit.name} 补卡日期`}
                          onChange={(event) => { setMakeupDate(event.target.value); setMakeupError('') }} />
                        <button className="secondary-button" disabled={logs.includes(makeupDate)}
                          onClick={() => {
                            if (!isDateKey(makeupDate) || makeupDate > today) { setMakeupError('请选择今天或更早的有效日期。'); return }
                            if (!isHabitScheduled(habit, new Date(`${makeupDate}T00:00:00`))) { setMakeupError('该日期不是习惯计划日。'); return }
                            if (logs.includes(makeupDate)) { setMakeupError('该日期已打卡。'); return }
                            onMark(habit.id, makeupDate)
                            setMakeupFor(null)
                            setMakeupError('')
                          }}>
                          {logs.includes(makeupDate) ? '已打卡' : '登记'}
                        </button>
                        <button className="secondary-button" onClick={() => setMakeupFor(null)}>取消</button>
                        {makeupError && <span className="habit-makeup-error" role="alert">{makeupError}</span>}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        ))
      )}

      {(creating || editing) && (
        <HabitDialog
          habit={editing}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSave={(habit) => { if (editing) onUpdate(habit); else onAdd(habit); setCreating(false); setEditing(null) }}
          onDelete={editing ? onDelete : undefined}
        />
      )}
    </div>
  )
}
