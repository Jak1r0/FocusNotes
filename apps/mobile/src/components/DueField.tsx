import { Alert, StyleSheet } from 'react-native'
import { ThemedPressable as Pressable, ThemedText as Text, ThemedView as View } from '../theme'
import { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { Calendar, X } from 'lucide-react-native'
import { formatDateTime } from '../date'

export function DueField({ value, onChange }: { value: string | null; onChange(value: string | null): void }) {
  function showTimePicker(date: Date) {
    try {
      DateTimePickerAndroid.open({
        value: date,
        mode: 'time',
        // Android 原生只接受 'default' / 'spinner'；'clock' 是 iOS 值，
        // 传下去会触发 Enum.valueOf("CLOCK") 异常导致时间选择器打不开。
        display: 'default',
        is24Hour: true,
        onChange: (event: DateTimePickerEvent, selectedTime?: Date) => {
          if (event.type !== 'set' || !selectedTime || Number.isNaN(selectedTime.getTime())) return
          const next = new Date(date)
          next.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0)
          if (!Number.isNaN(next.getTime())) onChange(next.toISOString())
        },
      })
    } catch (reason) {
      Alert.alert('无法设置时间', reason instanceof Error ? reason.message : '请稍后重试。')
    }
  }

  function openPicker() {
    const parsed = value ? new Date(value) : new Date()
    const initial = Number.isNaN(parsed.getTime()) ? new Date() : parsed
    try {
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'date',
        // Android 原生只接受 'default' / 'spinner'；'calendar' 是 iOS 值，
        // 传下去会触发 Enum.valueOf("CALENDAR") 异常导致日历打不开。
        display: 'default',
        onChange: (event: DateTimePickerEvent, selected?: Date) => {
          if (event.type !== 'set' || !selected || Number.isNaN(selected.getTime())) return
          showTimePicker(selected)
        },
      })
    } catch (reason) {
      Alert.alert('无法设置日期', reason instanceof Error ? reason.message : '请稍后重试。')
    }
  }

  return <View>
    <View style={styles.row}>
      <Pressable style={styles.button} onPress={openPicker}>
        <Calendar size={17} color="#0071e3" /><Text style={[styles.text, !value && styles.placeholder]}>{formatDateTime(value)}</Text>
      </Pressable>
      {value && <Pressable style={styles.clear} onPress={() => onChange(null)} accessibilityLabel="清除截止时间"><X size={17} color="#6e6e73" /></Pressable>}
    </View>
  </View>
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  button: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, borderRadius: 10, backgroundColor: '#f5f5f7' },
  text: { color: '#1d1d1f', fontSize: 14 },
  placeholder: { color: '#8e8d93' },
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
})
