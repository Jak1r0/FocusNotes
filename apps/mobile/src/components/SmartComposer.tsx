import { useState } from 'react'
import { ActivityIndicator, StyleSheet } from 'react-native'
import {
  ThemedPressable as Pressable,
  ThemedText as Text,
  ThemedTextInput as TextInput,
  ThemedView as View,
} from '../theme'
import { ArrowUp, Check, Sparkles, X } from 'lucide-react-native'
import { HybridSmartParser, type ParsedTodoDraft, type TodoDraft } from '@focusnotes/core'
import { DueField } from './DueField'

const parser = new HybridSmartParser()

export function SmartComposer({ onAdd }: { onAdd(draft: TodoDraft): Promise<void> }) {
  const [input, setInput] = useState('')
  const [preview, setPreview] = useState<ParsedTodoDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function recognize() {
    if (!input.trim()) { setError('请输入待办内容。'); return }
    setBusy(true); setError('')
    try { setPreview(await parser.parse(input)) }
    catch { setError('识别暂时失败，请重试。') }
    finally { setBusy(false) }
  }

  async function confirm() {
    if (!preview?.title.trim()) { setError('标题不能为空。'); return }
    setBusy(true)
    try { await onAdd(preview); setInput(''); setPreview(null) }
    catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败。') }
    finally { setBusy(false) }
  }

  return <View style={styles.card}>
    <View style={styles.labelRow}><Sparkles size={15} color="#0071e3" /><Text style={styles.label}>智能创建</Text><Text style={styles.badge}>本地识别</Text></View>
    <View style={styles.inputRow}>
      <TextInput style={styles.input} value={input} onChangeText={(value) => { setInput(value); setError('') }} placeholder="例如：明天下午3点提交重要报告" placeholderTextColor="#8e8d93" multiline />
      <Pressable style={styles.send} onPress={() => void recognize()} disabled={busy} accessibilityLabel="智能识别">{busy ? <ActivityIndicator color="#fff" size="small" /> : <ArrowUp size={21} color="#fff" />}</Pressable>
    </View>
    {preview && <View style={styles.preview}>
      <View style={styles.previewHead}><View style={styles.previewTitle}><Check size={15} color="#248a3d" /><Text style={styles.previewTitleText}>确认识别结果</Text></View><Pressable style={styles.close} onPress={() => setPreview(null)}><X size={17} color="#6e6e73" /></Pressable></View>
      <Text style={styles.fieldLabel}>标题</Text><TextInput style={styles.field} value={preview.title} onChangeText={(title) => setPreview({ ...preview, title })} />
      <Text style={styles.fieldLabel}>截止时间</Text><DueField value={preview.dueAt ?? null} onChange={(dueAt) => setPreview({ ...preview, dueAt })} />
      <View style={styles.priorities}>
        <Pressable style={[styles.chip, preview.important && styles.important]} onPress={() => setPreview({ ...preview, important: !preview.important })}><Text style={[styles.chipText, preview.important && styles.importantText]}>重要</Text></Pressable>
        <Pressable style={[styles.chip, preview.urgent && styles.urgent]} onPress={() => setPreview({ ...preview, urgent: !preview.urgent })}><Text style={[styles.chipText, preview.urgent && styles.urgentText]}>紧急</Text></Pressable>
        <Pressable style={styles.confirm} onPress={() => void confirm()} disabled={busy}><Text style={styles.confirmText}>确认添加</Text></Pressable>
      </View>
      {preview.warnings.map((warning) => <Text key={warning} style={styles.warning}>{warning}</Text>)}
    </View>}
    {!!error && <Text style={styles.error}>{error}</Text>}
  </View>
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 14, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: .05, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { color: '#424245', fontSize: 13, fontWeight: '600' },
  badge: { marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden', borderRadius: 10, color: '#6e6e73', backgroundColor: '#f5f5f7', fontSize: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 8 },
  input: { flex: 1, minHeight: 52, paddingVertical: 6, color: '#1d1d1f', fontSize: 14, lineHeight: 21 },
  send: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#0071e3' },
  preview: { marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#d1d1d6' },
  previewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewTitle: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  previewTitleText: { color: '#248a3d', fontSize: 12, fontWeight: '600' },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { marginTop: 10, marginBottom: 6, color: '#6e6e73', fontSize: 11 },
  field: { minHeight: 44, paddingHorizontal: 12, color: '#1d1d1f', fontSize: 14, borderRadius: 10, backgroundColor: '#f5f5f7' },
  priorities: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  chip: { minWidth: 58, minHeight: 36, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: '#d1d1d6', borderRadius: 18 },
  chipText: { color: '#6e6e73', fontSize: 12 },
  important: { borderColor: '#ff9f0a', backgroundColor: '#fff5df' },
  importantText: { color: '#b25000' },
  urgent: { borderColor: '#ff6961', backgroundColor: '#fff0ef' },
  urgentText: { color: '#d70015' },
  confirm: { minHeight: 38, marginLeft: 'auto', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, borderRadius: 10, backgroundColor: '#0071e3' },
  confirmText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  warning: { marginTop: 9, color: '#8a6500', fontSize: 11, lineHeight: 17 },
  error: { marginTop: 8, color: '#d70015', fontSize: 12 },
})
