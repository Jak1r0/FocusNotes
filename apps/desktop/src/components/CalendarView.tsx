import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { addDays, dateKey, startOfDay, type TodoItem, type TodoList } from '@focusnotes/core'
import { TaskRow } from './TaskRow'

interface CalendarViewProps {
  tasks: TodoItem[]
  lists: TodoList[]
  onToggle: (id: string) => void
  onEdit: (todo: TodoItem) => void
  onDelete: (id: string) => void
  onCreate: (day: Date) => void
}

type Mode = 'month' | 'week' | 'day'

const WEEK = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const HOURS = Array.from({ length: 18 }, (_, index) => index + 6)

function startOfWeek(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7))
}

function eventColor(todo: TodoItem, lists: TodoList[]): string {
  return lists.find((list) => list.id === todo.listId)?.color ?? 'var(--accent)'
}

export function CalendarView({ tasks, lists, onToggle, onEdit, onDelete, onCreate }: CalendarViewProps) {
  const [mode, setMode] = useState<Mode>(() => {
    const saved = window.localStorage.getItem('focusnotes.calendarView')
    return saved === 'week' || saved === 'day' || saved === 'month' ? saved : 'month'
  })
  const [cursor, setCursor] = useState(() => startOfDay(new Date()))
  const [selected, setSelected] = useState(() => startOfDay(new Date()))

  const byDay = useMemo(() => {
    const map = new Map<string, TodoItem[]>()
    for (const todo of tasks) {
      if (todo.deleted || !todo.dueAt) continue
      const key = dateKey(todo.dueAt)
      const list = map.get(key) ?? []
      list.push(todo)
      map.set(key, list)
    }
    for (const list of map.values()) list.sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!))
    return map
  }, [tasks])

  const todayKey = dateKey(new Date())
  const selectedKey = dateKey(selected)
  const dayTasks = byDay.get(selectedKey) ?? []
  const gridStart = startOfWeek(mode === 'month' ? new Date(cursor.getFullYear(), cursor.getMonth(), 1) : cursor)
  const cells = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(cursor), index))

  const heading = mode === 'month'
    ? `${cursor.getFullYear()} 年 ${cursor.getMonth() + 1} 月`
    : mode === 'week'
      ? `${weekDays[0]!.getMonth() + 1} 月 ${weekDays[0]!.getDate()} 日 — ${weekDays[6]!.getMonth() + 1} 月 ${weekDays[6]!.getDate()} 日`
      : `${cursor.getFullYear()} 年 ${cursor.getMonth() + 1} 月 ${cursor.getDate()} 日 · ${WEEK[(cursor.getDay() + 6) % 7]}`

  const shift = (delta: number) => {
    const next = mode === 'month'
      ? new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1)
      : addDays(cursor, delta * (mode === 'week' ? 7 : 1))
    setCursor(next)
    setSelected(next)
  }

  const goToday = () => {
    const now = startOfDay(new Date())
    setCursor(now)
    setSelected(now)
  }

  const chooseMode = (next: Mode) => {
    setMode(next)
    window.localStorage.setItem('focusnotes.calendarView', next)
    setCursor(selected)
  }

  return (
    <div className="calendar-view">
      <section className="calendar-main card">
        <header className="calendar-head">
          <div>
            <span className="modal-kicker">日历</span>
            <h2>{heading}</h2>
          </div>
          <div className="calendar-nav">
            <div className="view-switch" role="tablist" aria-label="日历视图">
              {(['month', 'week', 'day'] as Mode[]).map((item) => (
                <button key={item} role="tab" aria-selected={mode === item} className={mode === item ? 'active' : ''} onClick={() => chooseMode(item)}>
                  {item === 'month' ? '月' : item === 'week' ? '周' : '日'}
                </button>
              ))}
            </div>
            <button className="icon-button" onClick={() => shift(-1)} aria-label="上一段"><ChevronLeft size={17} /></button>
            <button className="ghost-button" onClick={goToday}>今天</button>
            <button className="icon-button" onClick={() => shift(1)} aria-label="下一段"><ChevronRight size={17} /></button>
          </div>
        </header>

        {mode === 'month' && <>
          <div className="calendar-week">
            {WEEK.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="calendar-grid">
            {cells.map((day) => {
              const key = dateKey(day)
              const items = byDay.get(key) ?? []
              const outside = mode === 'month' && day.getMonth() !== cursor.getMonth()
              const isToday = key === todayKey
              return (
                <button
                  key={key}
                  className={`calendar-cell${outside ? ' outside' : ''}${isToday ? ' today' : ''}${selectedKey === key ? ' selected' : ''}`}
                  onClick={() => { setSelected(startOfDay(day)); setCursor(startOfDay(day)) }}
                >
                  <span className="calendar-date">{day.getDate()}</span>
                  <div className="calendar-events">
                    {items.slice(0, 3).map((todo) => (
                      <span key={todo.id} className={`calendar-event${todo.completed ? ' completed' : ''}`} style={{ borderColor: eventColor(todo, lists) }}>
                        {todo.title}
                      </span>
                    ))}
                    {items.length > 3 && <span className="calendar-more">+{items.length - 3}</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </>}

        {mode === 'week' && <div className="calendar-week-grid">
          {weekDays.map((day, index) => {
            const key = dateKey(day)
            const items = byDay.get(key) ?? []
            const isToday = key === todayKey
            return (
              <section key={key} className={`calendar-week-day${isToday ? ' today' : ''}${selectedKey === key ? ' selected' : ''}`}>
                <header onClick={() => setSelected(startOfDay(day))}>
                  <small>{WEEK[index]}</small>
                  <strong>{day.getMonth() + 1}/{day.getDate()}</strong>
                </header>
                <div className="calendar-week-events">
                  {items.map((todo) => (
                    <button key={todo.id} className={`calendar-week-event${todo.completed ? ' completed' : ''}`}
                      style={{ borderColor: eventColor(todo, lists) }} onClick={() => onEdit(todo)} title={todo.title}>
                      <span>{todo.dueAt ? new Date(todo.dueAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '全天'}</span>
                      {todo.title}
                    </button>
                  ))}
                  <button className="calendar-week-add" onClick={() => onCreate(day)}><Plus size={11} /> 新建</button>
                </div>
              </section>
            )
          })}
        </div>}

        {mode === 'day' && <div className="calendar-day-view">
          <div className="calendar-day-timeline">
            {HOURS.map((hour) => {
              const items = (byDay.get(selectedKey) ?? []).filter((todo) => todo.dueAt && new Date(todo.dueAt).getHours() === hour)
              return <div className="timeline-row" key={hour}>
                <span className="timeline-hour">{String(hour).padStart(2, '0')}:00</span>
                <div className="timeline-slot">
                  {items.map((todo) => (
                    <button key={todo.id} className={`timeline-event${todo.completed ? ' completed' : ''}`}
                      style={{ borderColor: eventColor(todo, lists) }} onClick={() => onEdit(todo)}>
                      <strong>{new Date(todo.dueAt!).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</strong>
                      {todo.title}
                    </button>
                  ))}
                  <button className="timeline-add" onClick={() => onCreate(new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), hour, 0))}
                    aria-label={`在 ${hour} 点新建任务`}><Plus size={11} /></button>
                </div>
              </div>
            })}
          </div>
        </div>}
      </section>

      <aside className="calendar-side card">
        <header className="calendar-side-head">
          <div>
            <span className="modal-kicker">当天安排</span>
            <h3>{selected.getMonth() + 1} 月 {selected.getDate()} 日</h3>
          </div>
          <button className="primary-button small" onClick={() => onCreate(selected)}>
            <Plus size={14} /> 新建
          </button>
        </header>
        {dayTasks.length === 0 ? (
          <div className="empty-state small">
            <span className="empty-illustration"><CalendarDays size={26} /></span>
            <h3>这天还没有安排</h3>
            <p>留白也很好，或者加一件想做的事。</p>
          </div>
        ) : (
          <div className="calendar-side-list">
            {dayTasks.map((todo) => (
              <TaskRow key={todo.id} todo={todo} lists={lists} compact onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        )}
      </aside>
    </div>
  )
}
