import { useState } from 'react'
import { Modal, StyleSheet } from 'react-native'
import {
  ThemedPressable as Pressable,
  ThemedSafeAreaView as SafeAreaView,
  ThemedScrollView as ScrollView,
  ThemedText as Text,
  ThemedTextInput as TextInput,
  ThemedView as View,
} from '../theme'
import { LIST_COLORS, type TodoList } from '@focusnotes/core'

interface Props {
  list?: TodoList
  onClose(): void
  onSave(name: string, color: string): void
  onDelete?(): void
}

export function TodoListDialog({ list, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState(list?.name ?? '')
  const [color, setColor] = useState(list?.color ?? LIST_COLORS[0]!)
  const [error, setError] = useState('')

  function save() {
    const trimmed = name.trim()
    if (!trimmed) { setError('请输入清单名称。'); return }
    if (trimmed.length > 40) { setError('清单名称最多 40 个字符。'); return }
    onSave(trimmed, color)
  }

  return <Modal animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.headerAction} onPress={onClose}><Text style={styles.cancel}>取消</Text></Pressable>
        <Text style={styles.heading}>{list ? '编辑清单' : '新建清单'}</Text>
        <Pressable style={styles.headerAction} onPress={save}><Text style={styles.save}>保存</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>清单名称</Text>
        <TextInput autoFocus style={styles.input} value={name} onChangeText={(value) => { setName(value); setError('') }} placeholder="例如：工作、阅读计划" placeholderTextColor="#8e8d93" maxLength={40} />
        <Text style={styles.label}>颜色</Text>
        <View style={styles.colors}>{LIST_COLORS.map((item) => <Pressable key={item} style={[styles.color, { backgroundColor: item }, item === color && styles.selectedColor]} onPress={() => setColor(item)} />)}</View>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Pressable style={styles.submit} onPress={save}><Text style={styles.submitText}>保存清单</Text></Pressable>
        {onDelete && <Pressable style={styles.delete} onPress={onDelete}><Text style={styles.deleteText}>删除清单</Text></Pressable>}
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
  content: { padding: 22 },
  label: { marginTop: 18, marginBottom: 9, color: '#6e6e73', fontSize: 12, fontWeight: '600' },
  input: { minHeight: 48, paddingHorizontal: 14, color: '#1d1d1f', fontSize: 16, borderRadius: 10, backgroundColor: '#f5f5f7' },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  color: { width: 34, height: 34, borderRadius: 17 },
  selectedColor: { borderWidth: 3, borderColor: '#1d1d1f' },
  error: { marginTop: 14, color: '#d70015', fontSize: 13 },
  submit: { minHeight: 50, marginTop: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#0071e3' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  delete: { minHeight: 46, marginTop: 10, alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: '#d70015', fontSize: 14 },
})
