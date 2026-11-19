import { StyleSheet } from 'react-native'
import { ThemedPressable as Pressable, ThemedText as Text, ThemedView as View } from '../theme'
import { Check, Clock3, Pencil, Trash2 } from 'lucide-react-native'
import { getQuadrant, isOverdue, QUADRANTS, type TodoItem } from '@focusnotes/core'
import { formatDue } from '../date'

interface Props {
  todo: TodoItem
  onToggle(id: string): void
  onEdit(todo: TodoItem): void
  onDelete(todo: TodoItem): void
}

export function TodoItemCard({ todo, onToggle, onEdit, onDelete }: Props) {
  const quadrant = QUADRANTS[getQuadrant(todo)]
  return <View style={[styles.card, todo.completed && styles.completedCard]}>
    <View style={[styles.line, { backgroundColor: quadrant.color }]} />
    <Pressable style={[styles.check, todo.completed && styles.checked]} onPress={() => onToggle(todo.id)} accessibilityLabel={todo.completed ? '恢复待办' : '完成待办'}>
      {todo.completed && <Check size={14} color="#fff" strokeWidth={3} />}
    </Pressable>
    <Pressable style={styles.content} onPress={() => onEdit(todo)}>
      <Text style={[styles.title, todo.completed && styles.completedTitle]} numberOfLines={2}>{todo.title}</Text>
      {!!todo.notes && <Text style={styles.notes} numberOfLines={2}>{todo.notes}</Text>}
      <View style={styles.meta}>
        <View style={styles.due}><Clock3 size={12} color={isOverdue(todo) ? '#d70015' : '#8e8d93'} /><Text style={[styles.metaText, isOverdue(todo) && styles.overdue]}>{formatDue(todo)}</Text></View>
        <Text style={[styles.metaText, { color: quadrant.color }]}>{quadrant.shortLabel}</Text>
      </View>
    </Pressable>
    <View style={styles.actions}>
      <Pressable style={styles.action} onPress={() => onEdit(todo)} accessibilityLabel="编辑待办"><Pencil size={17} color="#6e6e73" /></Pressable>
      <Pressable style={styles.action} onPress={() => onDelete(todo)} accessibilityLabel="删除待办"><Trash2 size={17} color="#aeaeb2" /></Pressable>
    </View>
  </View>
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingVertical: 14, paddingHorizontal: 13, overflow: 'hidden', borderRadius: 12, backgroundColor: '#fff' },
  completedCard: { opacity: .7 },
  line: { position: 'absolute', left: 0, top: 16, bottom: 16, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  check: { width: 24, height: 24, marginTop: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#c7c7cc', borderRadius: 12 },
  checked: { borderColor: '#30a46c', backgroundColor: '#30a46c' },
  content: { flex: 1, minHeight: 44 },
  title: { color: '#1d1d1f', fontSize: 15, fontWeight: '600', lineHeight: 21, letterSpacing: -.2 },
  completedTitle: { color: '#8e8d93', textDecorationLine: 'line-through' },
  notes: { marginTop: 4, color: '#6e6e73', fontSize: 12, lineHeight: 18 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 7 },
  due: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: '#8e8d93', fontSize: 10 },
  overdue: { color: '#d70015', fontWeight: '600' },
  actions: { marginRight: -8, marginTop: -8 },
  action: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
})
