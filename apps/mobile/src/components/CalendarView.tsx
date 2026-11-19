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

const WEEK = ['一', '二', '三', '四', '五', '六', '日']

function startOfWeek(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7))
}

export function CalendarView({ tasks, onCreate, onEdit, onToggle }: Props) {
  const [cursor, setCursor] = useState(() => startOfDay(new Date()))
  const [selected, setSelected] = useState(() => startOfDay(new Date()))
  const todayKey = dateKey(new Date())
  const selectedKey = dateKey(selected)
  const gridStart = startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1))
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
  const dayTasks = useMemo(() => tasks
    .filter((task) => !task.deleted && task.dueAt && dateKey(task.dueAt) === selectedKey)
    .sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!)), [tasks, selectedKey])

  function shiftMonth(amount: number) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + amount, 1)
    setCursor(next)
    setSelected(startOfDay(next))
  }

  function goToday() {
    const now = startOfDay(new Date())
    setCursor(now)
    setSelected(now)
  }

  return <View style={styles.container}>
    <View style={styles.calendar}>
      <View style={styles.monthHeader}>
        <Text style={styles.month}>{cursor.getFullYear()} 年 {cursor.getMonth() + 1} 月</Text>
        <View style={styles.controls}>
          <Pressable style={styles.navButton} onPress={() => shiftMonth(-1)} accessibilityLabel="上个月"><ChevronLeft size={17} color="#6e6e73" /></Pressable>
          <Pressable style={styles.todayButton} onPress={goToday}><Text style={styles.todayText}>今天</Text></Pressable>
          <Pressable style={styles.navButton} onPress={() => shiftMonth(1)} accessibilityLabel="下个月"><ChevronRight size={17} color="#6e6e73" /></Pressable>
        </View>
      </View>
      <View style={styles.grid}>
        {WEEK.map((day) => <Text style={styles.weekday} key={day}>{day}</Text>)}
        {days.map((day) => {
          const key = dateKey(day)
          const count = tasks.filter((task) => !task.deleted && task.dueAt && dateKey(task.dueAt) === key).length
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
      </View>
    </View>

    <View style={styles.dayHeader}>
      <View><Text style={styles.eyebrow}>当天安排</Text><Text style={styles.dayTitle}>{selected.getMonth() + 1} 月 {selected.getDate()} 日</Text></View>
      <Pressable style={styles.addButton} onPress={() => onCreate(selected)}><Plus size={15} color="#fff" /><Text style={styles.addText}>新建</Text></Pressable>
    </View>
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
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  month: { color: '#1d1d1f', fontSize: 16, fontWeight: '600' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  navButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#f5f5f7' },
  todayButton: { height: 34, justifyContent: 'center', paddingHorizontal: 10 },
  todayText: { color: '#0071e3', fontSize: 12, fontWeight: '600' },
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
