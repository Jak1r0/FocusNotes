import { useMemo, useState } from 'react'
import { Alert, StyleSheet } from 'react-native'
import { ThemedPressable as Pressable, ThemedText as Text, ThemedView as View } from '../theme'
import { addDays, dateKey, habitStreak, isHabitScheduled, startOfDay, type Habit } from '@focusnotes/core'
import { HabitDialog } from './HabitDialog'

interface Props {
  habits: Habit[]
  habitLogs: Record<string, string[]>
  onToggle(habitId: string, day: string): void
  onAdd(habit: Habit): void
  onUpdate(habit: Habit): void
  onDelete(habitId: string): void
}

const WEEK = ['一', '二', '三', '四', '五', '六', '日']

export function HabitsView({ habits, habitLogs, onToggle, onAdd, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState<Habit | null>(null)
  const [creating, setCreating] = useState(false)
  const todayDate = new Date()
  const today = dateKey(todayDate)
  const monday = addDays(startOfDay(todayDate), -((todayDate.getDay() + 6) % 7))
  const week = Array.from({ length: 7 }, (_, index) => addDays(monday, index))
  const active = habits.filter((habit) => !habit.archived)
  const scheduledToday = active.filter((habit) => isHabitScheduled(habit, todayDate))
  const doneToday = scheduledToday.filter((habit) => (habitLogs[habit.id] ?? []).includes(today)).length
  const rate = scheduledToday.length ? Math.round((doneToday / scheduledToday.length) * 100) : 0
  const groups = useMemo(() => {
    const map = new Map<string, Habit[]>()
    for (const habit of active) {
      const list = map.get(habit.group) ?? []
      list.push(habit)
      map.set(habit.group, list)
    }
    return [...map.entries()]
  }, [habits])

  function remove(habit: Habit) {
    Alert.alert('删除习惯？', `“${habit.name}”及其打卡记录将从本机移除。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => onDelete(habit.id) },
    ])
  }

  return <View style={styles.container}>
    <View style={styles.hero}>
      <View style={styles.heroRow}>
        <View><Text style={styles.kicker}>习惯养成</Text><Text style={styles.heroTitle}>今天完成 {doneToday} / {scheduledToday.length}</Text></View>
        <Pressable style={styles.addButton} onPress={() => setCreating(true)}><Text style={styles.addText}>＋ 添加</Text></Pressable>
      </View>
      <Text style={styles.hint}>不必完美，只要每天向前一点点。</Text>
      <View style={styles.progress}><View style={[styles.progressFill, { width: `${rate}%` }]} /></View>
    </View>

    {active.length === 0 ? <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>🌱</Text><Text style={styles.emptyTitle}>还没有习惯</Text>
      <Text style={styles.emptyHint}>从一件小事开始，比如每天读 10 页书。</Text>
      <Pressable style={styles.emptyButton} onPress={() => setCreating(true)}><Text style={styles.emptyButtonText}>创建第一个习惯</Text></Pressable>
    </View> : groups.map(([group, items]) => <View key={group} style={styles.group}>
      <View style={styles.groupHeader}><Text style={styles.groupTitle}>{group}</Text><Text style={styles.groupCount}>{items.length} 个习惯</Text></View>
      {items.map((habit) => {
        const logs = habitLogs[habit.id] ?? []
        const done = logs.includes(today)
        const scheduled = isHabitScheduled(habit, todayDate)
        return <View key={habit.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Pressable style={styles.habitInfo} onPress={() => setEditing(habit)}>
              <View style={[styles.habitIcon, { backgroundColor: `${habit.color}22` }]}><Text style={styles.habitEmoji}>{habit.emoji}</Text></View>
              <View style={styles.habitText}><Text style={styles.habitName} numberOfLines={1}>{habit.name}</Text><Text style={styles.frequency}>{habit.frequency === 'daily' ? '每天' : habit.frequency === 'weekdays' ? '工作日' : '周末'} · {habit.goal > 1 ? `${habit.goal} ${habit.unit}` : '当天完成打卡'}</Text></View>
            </Pressable>
            <Pressable onPress={() => remove(habit)} style={styles.more}><Text style={styles.moreText}>•••</Text></Pressable>
          </View>
          <View style={styles.week}>
            {week.map((day, index) => {
              const key = dateKey(day)
              const isScheduled = isHabitScheduled(habit, day)
              const checked = logs.includes(key)
              return <Pressable key={key} style={styles.weekday} disabled={!isScheduled} onPress={() => onToggle(habit.id, key)}>
                <Text style={[styles.weekLabel, key === today && styles.currentDay]}>{WEEK[index]}</Text>
                <View style={[styles.weekDot, checked && { backgroundColor: habit.color, borderColor: habit.color }, !isScheduled && styles.restDay]}>
                  {checked ? <Text style={styles.tick}>✓</Text> : <Text style={[styles.dayNumber, !isScheduled && styles.restText]}>{day.getDate()}</Text>}
                </View>
              </Pressable>
            })}
          </View>
          <View style={styles.cardFooter}>
            <Text style={styles.streak}>🔥 连续 {habitStreak(habit, logs, todayDate)} 天</Text>
            <Pressable style={[styles.checkButton, done && styles.doneButton, !scheduled && styles.disabledButton]} disabled={!scheduled} onPress={() => onToggle(habit.id, today)}>
              <Text style={[styles.checkButtonText, done && styles.doneText]}>{done ? '✓ 今日已打卡' : scheduled ? '今日打卡' : '今天休息'}</Text>
            </Pressable>
          </View>
        </View>
      })}
    </View>)}

    {(creating || editing) && <HabitDialog
      habit={editing ?? undefined}
      onClose={() => { setCreating(false); setEditing(null) }}
      onSave={(habit) => { if (editing) onUpdate(habit); else onAdd(habit); setCreating(false); setEditing(null) }}
    />}
  </View>
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  hero: { padding: 18, borderRadius: 16, backgroundColor: '#fff' },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { color: '#0071e3', fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  heroTitle: { marginTop: 6, color: '#1d1d1f', fontSize: 19, fontWeight: '600' },
  addButton: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 20, backgroundColor: '#0071e3' },
  addText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  hint: { marginTop: 7, color: '#8e8d93', fontSize: 11 },
  progress: { height: 5, marginTop: 15, overflow: 'hidden', borderRadius: 3, backgroundColor: '#f0f0f2' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#30a46c' },
  empty: { minHeight: 210, alignItems: 'center', justifyContent: 'center', padding: 20, borderRadius: 16, backgroundColor: '#fff' },
  emptyEmoji: { fontSize: 28 },
  emptyTitle: { marginTop: 10, color: '#1d1d1f', fontSize: 16, fontWeight: '600' },
  emptyHint: { marginTop: 6, color: '#8e8d93', fontSize: 12, textAlign: 'center' },
  emptyButton: { marginTop: 14, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#eef6ff' },
  emptyButtonText: { color: '#0071e3', fontSize: 12, fontWeight: '600' },
  group: { gap: 9 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 3 },
  groupTitle: { color: '#48484a', fontSize: 12, fontWeight: '600' },
  groupCount: { color: '#a1a1aa', fontSize: 10 },
  card: { padding: 14, borderRadius: 15, backgroundColor: '#fff' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  habitInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  habitIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  habitEmoji: { fontSize: 21 },
  habitText: { flex: 1 },
  habitName: { color: '#1d1d1f', fontSize: 14, fontWeight: '600' },
  frequency: { marginTop: 4, color: '#8e8d93', fontSize: 10 },
  more: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  moreText: { color: '#8e8d93', letterSpacing: 2 },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  weekday: { alignItems: 'center', gap: 5 },
  weekLabel: { color: '#a1a1aa', fontSize: 10 },
  currentDay: { color: '#0071e3', fontWeight: '700' },
  weekDot: { width: 29, height: 29, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e5ea', borderRadius: 15, backgroundColor: '#fff' },
  restDay: { borderColor: '#f0f0f2', backgroundColor: '#f5f5f7' },
  dayNumber: { color: '#6e6e73', fontSize: 10 },
  restText: { color: '#c7c7cc' },
  tick: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 13, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e5ea' },
  streak: { color: '#e67e22', fontSize: 11, fontWeight: '500' },
  checkButton: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 18, backgroundColor: '#0071e3' },
  doneButton: { backgroundColor: '#e9f7ef' },
  disabledButton: { backgroundColor: '#f2f2f7' },
  checkButtonText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  doneText: { color: '#248a52' },
})
