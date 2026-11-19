import { useState } from 'react'
import { Modal, StyleSheet, Switch } from 'react-native'
import {
  ThemedPressable as Pressable,
  ThemedSafeAreaView as SafeAreaView,
  ThemedScrollView as ScrollView,
  ThemedText as Text,
  ThemedTextInput as TextInput,
  ThemedView as View,
} from '../theme'
import { dateKey, isDateKey, HABIT_EMOJIS, HABIT_GROUPS, type Habit, type HabitFrequency, type HabitPersistence } from '@focusnotes/core'

interface Props {
  habit?: Habit
  onClose(): void
  onSave(habit: Habit): void
}

const COLORS = ['#30d158', '#5b8cff', '#ff9f0a', '#bf5af2', '#ff453a', '#64d2ff']

export function HabitDialog({ habit, onClose, onSave }: Props) {
  const [name, setName] = useState(habit?.name ?? '')
  const [emoji, setEmoji] = useState(habit?.emoji ?? '🌱')
  const [color, setColor] = useState(habit?.color ?? COLORS[0]!)
  const [frequency, setFrequency] = useState<HabitFrequency>(habit?.frequency ?? 'daily')
  const [goal, setGoal] = useState(String(habit?.goal ?? 1))
  const [startDate, setStartDate] = useState(habit?.startDate ?? dateKey(new Date()))
  const [persistence, setPersistence] = useState<HabitPersistence>(habit?.persistence ?? 'forever')
  const [group, setGroup] = useState(habit?.group ?? '其他')
  const [reminder, setReminder] = useState(habit?.reminder ?? '')
  const [autoLog, setAutoLog] = useState(habit?.autoLog ?? false)
  const [error, setError] = useState('')

  function save() {
    const trimmed = name.trim()
    if (!trimmed) { setError('请输入习惯名称。'); return }
    if (!isDateKey(startDate)) { setError('开始日期格式应为 YYYY-MM-DD。'); return }
    if (reminder && !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminder)) { setError('提醒时间格式应为 HH:mm。'); return }
    onSave({
      id: habit?.id ?? `habit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmed.slice(0, 60),
      emoji,
      color,
      frequency,
      goal: Math.max(1, Math.min(20, Number(goal) || 1)),
      unit: '次',
      startDate,
      persistence,
      group,
      reminder: reminder || null,
      autoLog,
      archived: habit?.archived ?? false,
      createdAt: habit?.createdAt ?? new Date().toISOString(),
    })
  }

  return <Modal animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.headerAction} onPress={onClose}><Text style={styles.cancel}>取消</Text></Pressable>
        <Text style={styles.heading}>{habit ? '编辑习惯' : '新建习惯'}</Text>
        <Pressable style={styles.headerAction} onPress={save}><Text style={styles.save}>保存</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>名称</Text>
        <TextInput autoFocus style={styles.input} value={name} onChangeText={(value) => { setName(value); setError('') }} placeholder="例如：阅读 10 分钟" placeholderTextColor="#8e8d93" maxLength={60} />
        <Text style={styles.label}>图标</Text>
        <View style={styles.chips}>{HABIT_EMOJIS.map((item) => <Pressable key={item} style={[styles.emoji, emoji === item && styles.selectedEmoji]} onPress={() => setEmoji(item)}><Text style={styles.emojiText}>{item}</Text></Pressable>)}</View>
        <Text style={styles.label}>频率</Text>
        <View style={styles.chips}>{([
          ['daily', '每天'], ['weekdays', '工作日'], ['weekends', '周末'],
        ] as Array<[HabitFrequency, string]>).map(([id, label]) => <Pressable key={id} style={[styles.choice, frequency === id && styles.selectedChoice]} onPress={() => setFrequency(id)}><Text style={[styles.choiceText, frequency === id && styles.selectedChoiceText]}>{label}</Text></Pressable>)}</View>
        <Text style={styles.label}>目标次数</Text>
        <TextInput style={styles.input} value={goal} onChangeText={setGoal} keyboardType="number-pad" placeholder="1" placeholderTextColor="#8e8d93" />
        <Text style={styles.label}>开始日期（YYYY-MM-DD）</Text>
        <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="2026-01-01" placeholderTextColor="#8e8d93" maxLength={10} />
        <Text style={styles.label}>坚持天数</Text>
        <View style={styles.chips}>{([
          ['forever', '长期'], ['30', '30 天'], ['60', '60 天'], ['90', '90 天'],
        ] as Array<[HabitPersistence, string]>).map(([id, label]) => <Pressable key={id} style={[styles.choice, persistence === id && styles.selectedChoice]} onPress={() => setPersistence(id)}><Text style={[styles.choiceText, persistence === id && styles.selectedChoiceText]}>{label}</Text></Pressable>)}</View>
        <Text style={styles.label}>分组</Text>
        <View style={styles.chips}>{HABIT_GROUPS.map((item) => <Pressable key={item} style={[styles.choice, group === item && styles.selectedChoice]} onPress={() => setGroup(item)}><Text style={[styles.choiceText, group === item && styles.selectedChoiceText]}>{item}</Text></Pressable>)}</View>
        <Text style={styles.label}>提醒时间（可选）</Text>
        <TextInput style={styles.input} value={reminder} onChangeText={setReminder} placeholder="09:00" placeholderTextColor="#8e8d93" maxLength={5} keyboardType="numbers-and-punctuation" />
        <View style={styles.autoLogRow}><Text style={styles.autoLogText}>自动弹出打卡日志</Text><Switch value={autoLog} onValueChange={setAutoLog} trackColor={{ true: '#0071e3' }} /></View>
        <Text style={styles.label}>颜色</Text>
        <View style={styles.chips}>{COLORS.map((item) => <Pressable key={item} style={[styles.color, { backgroundColor: item }, color === item && styles.selectedColor]} onPress={() => setColor(item)} />)}</View>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Pressable style={styles.submit} onPress={save}><Text style={styles.submitText}>保存习惯</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  </Modal>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#d1d1d6' },
  headerAction: { minWidth: 54, minHeight: 44, justifyContent: 'center' },
  heading: { color: '#1d1d1f', fontSize: 17, fontWeight: '600' },
  cancel: { color: '#6e6e73', fontSize: 14 },
  save: { color: '#0071e3', fontSize: 14, fontWeight: '600', textAlign: 'right' },
  content: { padding: 22, paddingBottom: 44 },
  label: { marginTop: 18, marginBottom: 9, color: '#6e6e73', fontSize: 12, fontWeight: '600' },
  input: { minHeight: 48, paddingHorizontal: 14, color: '#1d1d1f', fontSize: 16, borderRadius: 10, backgroundColor: '#f5f5f7' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emoji: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#f5f5f7' },
  selectedEmoji: { borderWidth: 1.5, borderColor: '#0071e3', backgroundColor: '#eef6ff' },
  emojiText: { fontSize: 21 },
  choice: { minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#f5f5f7' },
  selectedChoice: { backgroundColor: '#eaf3ff' },
  choiceText: { color: '#6e6e73', fontSize: 13 },
  selectedChoiceText: { color: '#0071e3', fontWeight: '600' },
  autoLogRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 },
  autoLogText: { color: '#48484a', fontSize: 13 },
  color: { width: 30, height: 30, borderRadius: 15 },
  selectedColor: { borderWidth: 3, borderColor: '#1d1d1f' },
  error: { marginTop: 16, color: '#d70015', fontSize: 13 },
  submit: { minHeight: 50, marginTop: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#0071e3' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
