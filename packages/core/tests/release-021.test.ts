import { describe, expect, it } from 'vitest'
import {
  checkInHabit,
  habitCount,
  habitDayCount,
  isAnniversary,
  LocalSmartParser,
  markHabitCount,
  mergeSyncPayload,
  normalizeExtras,
  type Habit,
  type TodoItem,
} from '../src/index'

function makeTodo(patch: Partial<TodoItem> = {}): TodoItem {
  return {
    id: 'a', title: '任务', notes: '', dueAt: null, important: false, urgent: false,
    completed: false, completedAt: null, listId: 'inbox', tags: [],
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    revision: 1, deleted: false, ...patch,
  }
}

function makeHabit(goal: number): Habit {
  return {
    id: 'h1', name: '喝水', emoji: '💧', color: '#30d158', frequency: 'daily', goal,
    unit: '杯', startDate: '2026-01-01', persistence: 'forever', group: '健康',
    reminder: null, autoLog: false, archived: false, createdAt: '2026-01-01T00:00:00.000Z',
    streak: 0, bestStreak: 0,
  }
}

describe('0.2.1 回归：纪念日与待办分离', () => {
  it('纪念日任务有独立判定，不会被当成普通待办', () => {
    expect(isAnniversary(makeTodo({ tags: ['纪念日'] }))).toBe(true)
    expect(isAnniversary(makeTodo({ tags: ['生活'] }))).toBe(false)
    expect(isAnniversary(makeTodo({ tags: [] }))).toBe(false)
  })
})

describe('0.2.1 回归：中文日期智能识别', () => {
  const now = new Date(2026, 10, 26, 10, 0, 0)

  it('识别“明年十月一是我生日”为明年 10 月 1 日的纪念日', async () => {
    const result = await new LocalSmartParser().parse('明年十月一是我生日', now)
    expect(result.dueAt).not.toBeNull()
    const due = new Date(result.dueAt!)
    expect(due.getFullYear()).toBe(2027)
    expect(due.getMonth()).toBe(9)
    expect(due.getDate()).toBe(1)
    expect(result.tags).toContain('纪念日')
    expect(result.title).toContain('生日')
    expect(result.title).not.toContain('明年')
    expect(result.title).not.toContain('十月一')
    expect(result.recognizedTerms).toContain('明年十月一')
  })

  it('识别“今年五月二十号结婚纪念日”', async () => {
    const result = await new LocalSmartParser().parse('今年五月二十号结婚纪念日', now)
    expect(new Date(result.dueAt!).getMonth()).toBe(4)
    expect(new Date(result.dueAt!).getDate()).toBe(20)
    expect(result.tags).toContain('纪念日')
    expect(result.title).toContain('结婚纪念日')
  })
})

describe('0.2.1 回归：每日多次习惯', () => {
  it('打卡按目标次数累计，满额后再次点击回到 0', () => {
    const goal = 3
    let logs = checkInHabit({}, 'h1', '2026-11-26', goal)
    expect(habitDayCount(logs, 'h1', '2026-11-26')).toBe(1)
    logs = checkInHabit(logs, 'h1', '2026-11-26', goal)
    expect(habitDayCount(logs, 'h1', '2026-11-26')).toBe(2)
    logs = checkInHabit(logs, 'h1', '2026-11-26', goal)
    expect(habitDayCount(logs, 'h1', '2026-11-26')).toBe(3)
    logs = checkInHabit(logs, 'h1', '2026-11-26', goal)
    expect(habitDayCount(logs, 'h1', '2026-11-26')).toBe(0)
    logs = markHabitCount(logs, 'h1', '2026-11-26', 2, goal)
    expect(habitDayCount(logs, 'h1', '2026-11-26')).toBe(2)
  })

  it('旧版日期数组日志迁移为次数映射', () => {
    const extras = normalizeExtras({
      habits: [{ id: 'h1', name: '喝水', goal: 3 }],
      habitLogs: { h1: ['2026-11-25', 'bad', '2026-11-26', '2026-11-26'] },
    }, new Date(2026, 10, 26))
    expect(habitDayCount(extras.habitLogs, 'h1', '2026-11-25')).toBe(1)
    expect(habitDayCount(extras.habitLogs, 'h1', '2026-11-26')).toBe(1)
    expect(habitDayCount(extras.habitLogs, 'h1', 'bad')).toBe(0)
  })

  it('同步合并按每天较大次数保留', () => {
    const stamp = '2026-11-26T00:00:00.000Z'
    const base = {
      version: 1, syncedAt: stamp, todos: [],
      extras: normalizeExtras({ habits: [makeHabit(3)] }, new Date(2026, 10, 26)),
    }
    const local = { ...base, extras: { ...base.extras, habitLogs: { h1: { '2026-11-26': 1 } } } }
    const remote = { ...base, extras: { ...base.extras, habitLogs: { h1: { '2026-11-26': 3, '2026-11-25': 2 } } } }
    const merged = mergeSyncPayload(local, remote)
    expect(habitDayCount(merged.extras.habitLogs, 'h1', '2026-11-26')).toBe(3)
    expect(habitDayCount(merged.extras.habitLogs, 'h1', '2026-11-25')).toBe(2)
  })
})
