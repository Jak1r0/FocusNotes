import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react-native'
import { StyleSheet } from 'react-native'
import { ThemedPressable as Pressable, ThemedText as Text, ThemedView as View } from '../theme'
import { addDays, dateKey, startOfDay, type TodoItem } from '@focusnotes/core'
import { formatDateTime } from '../date'

interface Props {
  tasks: TodoItem[]
  onCreate(day: Date): void
  onEdit(todo: TodoItem): void
  onToggle(id: string): void
}

type Mode = 'month' | 'week' | 'day'
const WEEK = ['一', '二', '三', '四', '五', '六', '日']
const MODES: Array<{ id: Mode; label: string }> = [
  { id: 'month', label: '月' },
  { id: 'week', label: '周' },
  { id: 'day', label: '日' },
]

function startOfWeek(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7))
}

export function CalendarView({ tasks, onCreate, onEdit, onToggle }: Props) {
  const [mode, setMode] = useState<Mode>('month')
  const [cursor, setCursor] = useState(() => startOfDay(new Date()))
  const [selected, setSelected] = useState(() => startOfDay(new Date()))
  const todayKey = dateKey(new Date())
  const selectedKey = dateKey(selected)
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const gridStart = startOfWeek(monthStart)
  const monthDays = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
  const weekStart = startOfWeek(selected)
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
  const weekEnd = weekDays[6]!
  const dayTasks = useMemo(() => tasks
    .filter((task) => !task.deleted && task.dueAt && dateKey(task.dueAt) === selectedKey)
    .sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!)), [tasks, selectedKey])

  function changeMode(next: Mode) {
    setMode(next)
    if (next === 'week') setCursor(weekStart)
    else if (next === 'day') setCursor(selected)
  }

  function shift(amount: number) {
    if (mode === 'month') {
      const next = new Date(cursor.getFullYear(), cursor.getMonth() + amount, 1)
      setCursor(next)
      setSelected(startOfDay(next))
      return
    }
    if (mode === 'week') {
      const next = addDays(weekStart, amount * 7)
      setCursor(next)
      setSelected(next)
      return
    }
    const next = addDays(selected, amount)
    setCursor(next)
    setSelected(next)
  }

  function goToday() {
    const now = startOfDay(new Date())
    setCursor(now)
    setSelected(now)
  }

  const headerLabel = mode === 'month'
    ? `${cursor.getFullYear()} 年 ${cursor.getMonth() + 1} 月`
    : mode === 'week'
      ? `${weekStart.getMonth() + 1} 月 ${weekStart.getDate()} 日 – ${weekEnd.getMonth() + 1} 月 ${weekEnd.getDate()} 日`
      : `${selected.getFullYear()} 年 ${selected.getMonth() + 1} 月 ${selected.getDate()} 日`

  const countFor = (key: string) => tasks.filter((task) => !task.deleted && task.dueAt && dateKey(task.dueAt) === key).length

  return <View style={styles.container}>
    <View style={styles.calendar}>
      <View style={styles.monthHeader}>
        <Text style={styles.month}>{headerLabel}</Text>
        <View style={styles.controls}>
          <Pressable style={styles.navButton} onPress={() => shift(-1)} accessibilityLabel={mode === 'day' ? '前一天' : '上一周期'}><ChevronLeft size={17} color="#6e6e73" /></Pressable>
          <Pressable style={styles.todayButton} onPress={goToday}><Text style={styles.todayText}>今天</Text></Pressable>
          <Pressable style={styles.navButton} onPress={() => shift(1)} accessibilityLabel={mode === 'day' ? '后一天' : '下一周期'}><ChevronRight size={17} color="#6e6e73" /></Pressable>
        </View>
      </View>

      <View style={styles.modeBar}>
        {MODES.map((item) => <Pressable key={item.id} style={[styles.modeButton, mode === item.id && styles.modeButtonActive]} onPress={() => changeMode(item.id)}>
          <Text style={[styles.modeText, mode === item.id && styles.modeTextActive]}>{item.label}</Text>
        </Pressable>)}
      </View>

      {mode === 'month' && <View style={styles.grid}>
        {WEEK.map((day) => <Text style={styles.weekday} key={day}>{day}</Text>)}
        {monthDays.map((day) => {
          const key = dateKey(day)
          const count = countFor(key)
          return <Pressable key={key} style={styles.dayCell} onPress={() => { setSelected(startOfDay(day)); setCursor(startOfDay(day)) }}>
            <Text style={[
              styles.dayNumber,
              day.getMonth() !== cursor.getMonth() && styles.outsideDay,
              key === todayKey && styles.todayNumber,
              key === selectedKey && styles.selectedNumber,
            ]}>{day.getDate()}</Text>
            <View style={[styles.dayDot, count > 0 && styles.hasTasks, count > 1 && styles.multipleTasks]} />
          </Pressable>
        })}
      </View>}

      {mode === 'week' && <View style={styles.weekRow}>
        {weekDays.map((day, index) => {
          const key = dateKey(day)
          const count = countFor(key)
          return <Pressable key={key} style={[styles.weekCell, key === selectedKey && styles.weekCellActive]} onPress={() => { setSelected(startOfDay(day)); setCursor(startOfDay(day)) }}>
            <Text style={styles.weekCellLabel}>周{WEEK[index]}</Text>
            <Text style={[styles.weekCellDay, key === todayKey && styles.weekCellToday]}>{day.getDate()}</Text>
            <Text style={styles.weekCellCount}>{count > 0 ? `${count} 项` : '—'}</Text>
          </Pressable>
        })}
      </View>}

      {mode === 'day' && <View style={styles.daySummary}>
        <View>
          <Text style={styles.eyebrow}>当天安排</Text>
          <Text style={styles.daySummaryTitle}>{selected.getMonth() + 1} 月 {selected.getDate()} 日</Text>
          <Text style={styles.daySummaryCount}>{dayTasks.length} 项任务</Text>
        </View>
        <Pressable style={styles.addButton} onPress={() => onCreate(selected)}><Plus size={15} color="#fff" /><Text style={styles.addText}>新建</Text></Pressable>
      </View>}
    </View>

    {mode !== 'day' && <View style={styles.dayHeader}>
      <View><Text style={styles.eyebrow}>当天安排</Text><Text style={styles.dayTitle}>{selected.getMonth() + 1} 月 {selected.getDate()} 日</Text></View>
      <Pressable style={styles.addButton} onPress={() => onCreate(selected)}><Plus size={15} color="#fff" /><Text style={styles.addText}>新建</Text></Pressable>
    </View>}

    {dayTasks.length ? dayTasks.map((task) => <View style={styles.taskCard} key={task.id}>
      <Pressable style={[styles.check, task.completed && styles.checked]} onPress={() => onToggle(task.id)}><Text style={styles.checkmark}>{task.completed ? '✓' : ''}</Text></Pressable>
      <Pressable style={styles.taskMain} onPress={() => onEdit(task)}>
        <Text style={[styles.taskTitle, task.completed && styles.completedTitle]} numberOfLines={2}>{task.title}</Text>
        <Text style={styles.taskDue}>{task.dueAt ? formatDateTime(task.dueAt) : ''}</Text>
      </Pressable>
    </View>) : <View style={styles.empty}>
      <CalendarDays size={28} color="#a1a1aa" />
      <Text style={styles.emptyTitle}>这天还没有安排</Text>
      <Text style={styles.emptyHint}>留白也很好，或者加一件想做的事。</Text>
    </View>}
  </View>
}

const styles = StyleSheet.create({
  container: { gap: 13 },
  calendar: { padding: 14, borderRadius: 16, backgroundColor: '#fff' },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  month: { flex: 1, color: '#1d1d1f', fontSize: 15, fontWeight: '600' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  navButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#f5f5f7' },
  todayButton: { height: 34, justifyContent: 'center', paddingHorizontal: 8 },
  todayText: { color: '#0071e3', fontSize: 12, fontWeight: '600' },
  modeBar: { flexDirection: 'row', gap: 6, marginBottom: 10, padding: 3, borderRadius: 12, backgroundColor: '#f5f5f7' },
  modeButton: { flex: 1, minHeight: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  modeButtonActive: { backgroundColor: '#fff' },
  modeText: { color: '#8e8d93', fontSize: 12, fontWeight: '600' },
  modeTextActive: { color: '#1d1d1f' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, paddingVertical: 8, color: '#8e8d93', fontSize: 11, textAlign: 'center' },
  dayCell: { width: `${100 / 7}%`, height: 47, alignItems: 'center', justifyContent: 'center', gap: 4 },
  dayNumber: { width: 28, height: 28, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', borderRadius: 14, color: '#1d1d1f', fontSize: 13, lineHeight: 28 },
  outsideDay: { color: '#c7c7cc' },
  todayNumber: { color: '#0071e3', fontWeight: '700' },
  selectedNumber: { color: '#fff', backgroundColor: '#0071e3', fontWeight: '700' },
  dayDot: { width: 4, height: 4, borderRadius: 2 },
  hasTasks: { backgroundColor: '#30a46c' },
  multipleTasks: { width: 6, height: 6, borderRadius: 3 },
  weekRow: { flexDirection: 'row', gap: 5 },
  weekCell: { flex: 1, minHeight: 72, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 12, backgroundColor: '#f7f7f9' },
  weekCellActive: { backgroundColor: '#eef6ff' },
  weekCellLabel: { color: '#8e8d93', fontSize: 9 },
  weekCellDay: { color: '#1d1d1f', fontSize: 17, fontWeight: '600' },
  weekCellToday: { color: '#0071e3' },
  weekCellCount: { color: '#8e8d93', fontSize: 9 },
  daySummary: { minHeight: 96, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 6 },
  daySummaryTitle: { marginTop: 4, color: '#1d1d1f', fontSize: 19, fontWeight: '600' },
  daySummaryCount: { marginTop: 4, color: '#8e8d93', fontSize: 11 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  eyebrow: { color: '#8e8d93', fontSize: 10, fontWeight: '600', letterSpacing: 1 },
  dayTitle: { marginTop: 3, color: '#1d1d1f', fontSize: 18, fontWeight: '600' },
  addButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 13, borderRadius: 19, backgroundColor: '#0071e3' },
  addText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  taskCard: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 13, backgroundColor: '#fff' },
  check: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#c7c7cc', borderRadius: 13 },
  checked: { borderColor: '#30a46c', backgroundColor: '#30a46c' },
  checkmark: { color: '#fff', fontSize: 15, fontWeight: '700' },
  taskMain: { flex: 1 },
  taskTitle: { color: '#1d1d1f', fontSize: 14, fontWeight: '500' },
  completedTitle: { color: '#8e8d93', textDecorationLine: 'line-through' },
  taskDue: { marginTop: 5, color: '#8e8d93', fontSize: 11 },
  empty: { minHeight: 145, alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 14, backgroundColor: '#fff' },
  emptyTitle: { marginTop: 10, color: '#48484a', fontSize: 14, fontWeight: '600' },
  emptyHint: { marginTop: 5, color: '#8e8d93', fontSize: 11, textAlign: 'center' },
})