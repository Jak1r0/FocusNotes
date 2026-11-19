import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('apps/desktop/data-dev/profiles')
fs.mkdirSync(root, { recursive: true })
const now = new Date()
const iso = (d) => d.toISOString()
const at = (dayOffset, hour, minute = 0) => {
  const d = new Date(now)
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, minute, 0, 0)
  return iso(d)
}
const mk = (id, title, extra = {}) => ({
  id,
  title,
  notes: '',
  dueAt: null,
  important: false,
  urgent: false,
  completed: false,
  completedAt: null,
  listId: 'inbox',
  tags: [],
  createdAt: at(-2, 9),
  updatedAt: at(-2, 9),
  revision: 0,
  deleted: false,
  ...extra,
})

const todos = [
  mk('t1', '完成 FocusNotes 2.0 界面设计稿', { dueAt: at(0, 15), important: true, urgent: true, listId: 'work', tags: ['设计', '重点'] }),
  mk('t2', '整理本周会议纪要并同步给团队', { dueAt: at(0, 18, 30), important: true, listId: 'work', tags: ['工作'] }),
  mk('t3', '买牛奶、咖啡豆和燕麦', { dueAt: at(0, 20), urgent: true, listId: 'shopping', tags: ['生活'] }),
  mk('t4', '预约下周的牙医复查', { dueAt: at(1, 10), urgent: true, listId: 'personal', tags: ['健康'] }),
  mk('t5', '读完《深度工作》第三章', { dueAt: at(2, 21), important: true, listId: 'study', tags: ['阅读'] }),
  mk('t6', '晨跑 5 公里', { completed: true, completedAt: at(0, 7, 20), listId: 'fitness', tags: ['运动'] }),
  mk('t7', '给妈妈打电话', { completed: true, completedAt: at(-1, 20), listId: 'personal', tags: ['家人'] }),
  mk('t8', '整理上季度照片备份', { listId: 'personal', tags: ['生活'], notes: '把手机里的照片归档到移动硬盘' }),
  mk('t9', '项目 Alpha 正式上线', { dueAt: at(14, 9), important: true, listId: 'work', tags: ['纪念日', '里程碑'] }),
  mk('t10', '和小林吃火锅', { dueAt: at(3, 19), listId: 'personal', tags: ['朋友'] }),
  mk('t11', '更新简历与作品集', { dueAt: at(5, 20), important: true, listId: 'personal', tags: ['成长'] }),
  mk('t12', '缴纳本月水电费', { dueAt: at(-1, 12), urgent: true, listId: 'personal', tags: ['生活'] }),
]

const lists = [
  { id: 'inbox', name: '收集箱', color: '#8e8d93', createdAt: iso(now) },
  { id: 'work', name: '工作', color: '#0a84ff', createdAt: iso(now) },
  { id: 'personal', name: '个人', color: '#30d158', createdAt: iso(now) },
  { id: 'study', name: '学习', color: '#bf5af2', createdAt: iso(now) },
  { id: 'shopping', name: '购物', color: '#ff9f0a', createdAt: iso(now) },
  { id: 'fitness', name: '锻炼', color: '#ff375f', createdAt: iso(now) },
  { id: 'wish', name: '心愿', color: '#64d2ff', createdAt: iso(now) },
]

const dayKey = (offset) => {
  const d = new Date(now)
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const habitLogs = {
  h1: [dayKey(-1), dayKey(-2), dayKey(-3), dayKey(-4), dayKey(-6), dayKey(-7), dayKey(-8)],
  h2: [dayKey(-2), dayKey(-3), dayKey(-5), dayKey(-6), dayKey(-7)],
  h3: [dayKey(-1), dayKey(-2), dayKey(-3)],
}

const habits = [
  { id: 'h1', name: '早起 7:00', emoji: '🌅', color: '#ff9f0a', frequency: 'daily', goal: 1, unit: '次', startDate: dayKey(-20), persistence: 'forever', group: '健康', reminder: '07:00', autoLog: false, archived: false, createdAt: iso(now) },
  { id: 'h2', name: '阅读 30 分钟', emoji: '📖', color: '#bf5af2', frequency: 'daily', goal: 1, unit: '次', startDate: dayKey(-15), persistence: 'forever', group: '学习', reminder: '21:30', autoLog: true, archived: false, createdAt: iso(now) },
  { id: 'h3', name: '喝水 8 杯', emoji: '💧', color: '#0a84ff', frequency: 'daily', goal: 8, unit: '杯', startDate: dayKey(-10), persistence: 'forever', group: '健康', reminder: null, autoLog: false, archived: false, createdAt: iso(now) },
]

const focusSessions = [
  { id: 'f1', startedAt: at(0, 9), endedAt: at(0, 9, 25), seconds: 1500, mode: 'focus', taskId: 't1' },
  { id: 'f2', startedAt: at(0, 10), endedAt: at(0, 10, 25), seconds: 1500, mode: 'focus', taskId: 't2' },
  { id: 'f3', startedAt: at(0, 11), endedAt: at(0, 11, 25), seconds: 1500, mode: 'focus', taskId: null },
  { id: 'f4', startedAt: at(-1, 14), endedAt: at(-1, 14, 50), seconds: 3000, mode: 'focus', taskId: 't5' },
]

const extras = {
  version: 2,
  lists,
  habits,
  habitLogs,
  focusSessions,
  preferences: { pomodoroMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, dailyGoal: 8, sound: true },
  widgets: ['tasks', 'calendar', 'quadrant', 'habits', 'countdown', 'assistant'],
}

const doc = {
  id: 'default',
  name: '我的待办',
  createdAt: iso(now),
  updatedAt: iso(now),
  todos,
  extras,
}

fs.writeFileSync(path.join(root, 'default.json'), JSON.stringify(doc, null, 2))
fs.writeFileSync(path.join(root, 'profiles.json'), JSON.stringify({ activeId: 'default' }, null, 2))
console.log('seeded', todos.length, 'todos at', root)
