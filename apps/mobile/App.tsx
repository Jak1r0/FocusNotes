import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, NativeModules, PermissionsAndroid, Platform, StatusBar, StyleSheet, useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { CalendarDays, Check, Cloud, Database, Flame, ListTodo, Plus, Upload, Download, Pencil, Settings, Timer } from 'lucide-react-native'
import {
  createDefaultExtras,
  dateKey,
  habitStreak,
  isHabitScheduled,
  mergeSyncedTodos,
  normalizeExtras,
  normalizeTodos,
  QUADRANTS,
  TodoStore,
  toggleHabitLog,
  type FocusSession,
  type Quadrant,
  type TodoItem,
  type TodoList,
  type WorkspaceExtras,
} from '@focusnotes/core'
import { SmartComposer } from './src/components/SmartComposer'
import { TodoItemCard } from './src/components/TodoItemCard'
import { EditTodoModal } from './src/components/EditTodoModal'
import { CalendarView } from './src/components/CalendarView'
import { HabitsView } from './src/components/HabitsView'
import { PomodoroView } from './src/components/PomodoroView'
import { TodoListDialog } from './src/components/TodoListDialog'
import { usePomodoroTimer } from './src/usePomodoroTimer'
import {
  ThemeProvider,
  ThemedKeyboardAvoidingView as KeyboardAvoidingView,
  ThemedPressable as Pressable,
  ThemedSafeAreaView as SafeAreaView,
  ThemedScrollView as ScrollView,
  ThemedText as Text,
  ThemedView as View,
} from './src/theme'

const storage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: async (key: string, value: string) => { await AsyncStorage.setItem(key, value) },
}

type Filter = 'all' | Quadrant
type Page = 'tasks' | 'calendar' | 'habits' | 'pomodoro' | 'data'
type LayoutDensity = 'compact' | 'standard' | 'spacious'
interface WidgetModule {
  updateTodos(json: string): void
  updateHabits(json: string): void
  updatePrefs(json: string): void
  syncTimer(json: string): void
  startNoise(scenes: string, volume: number): void
  setNoiseScenes(scenes: string): void
  setNoiseVolume(volume: number): void
  setNoiseSleepTimer(minutes: number): void
  stopNoise(): void
  syncReminders(json: string): void
  addToCalendar(title: string, notes: string, dueAt: string): Promise<boolean>
  exportData(json: string): Promise<boolean>
  importData(): Promise<{ contents: string } | null>
  openSyncFile(): Promise<{ contents: string; uri: string } | null>
  saveSyncFile(uri: string, json: string): Promise<boolean>
}
interface DataDocument { todos: unknown[]; extras?: unknown }

function quadrantOf(todo: TodoItem): Quadrant {
  return todo.important ? (todo.urgent ? 'important-urgent' : 'important-not-urgent') : (todo.urgent ? 'not-important-urgent' : 'not-important-not-urgent')
}

function mergeExtras(local: WorkspaceExtras, incoming: unknown): WorkspaceExtras {
  const remote = normalizeExtras(incoming)
  const lists = new Map(local.lists.map((item) => [item.id, item]))
  for (const item of remote.lists) lists.set(item.id, item)
  const habits = new Map(local.habits.map((item) => [item.id, item]))
  for (const item of remote.habits) habits.set(item.id, item)
  const habitLogs: Record<string, string[]> = {}
  for (const habit of habits.values()) {
    habitLogs[habit.id] = [...new Set([...(local.habitLogs[habit.id] ?? []), ...(remote.habitLogs[habit.id] ?? [])])].sort()
  }
  const sessions = new Map(local.focusSessions.map((item) => [item.id, item]))
  for (const item of remote.focusSessions) sessions.set(item.id, item)
  const hasPreferences = Boolean(incoming && typeof incoming === 'object' && !Array.isArray(incoming) && 'preferences' in incoming)
  return normalizeExtras({
    ...local,
    lists: [...lists.values()],
    habits: [...habits.values()],
    habitLogs,
    focusSessions: [...sessions.values()],
    preferences: hasPreferences ? remote.preferences : local.preferences,
    widgets: [...new Set([...local.widgets, ...remote.widgets])],
  })
}

function documentFromJson(raw: string): DataDocument {
  const parsed: unknown = JSON.parse(raw)
  if (Array.isArray(parsed)) return { todos: parsed }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { todos?: unknown }).todos)) {
    throw new Error('文件格式不正确，找不到待办数据。')
  }
  return parsed as DataDocument
}

export default function App() {
  const store = useMemo(() => new TodoStore(storage), [])
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [extras, setExtras] = useState<WorkspaceExtras>(() => createDefaultExtras())
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState<Page>('tasks')
  const [selectedListId, setSelectedListId] = useState('all')
  const [editingList, setEditingList] = useState<TodoList | 'new' | null>(null)
  const [editing, setEditing] = useState<TodoItem | 'new' | null>(null)
  const [defaultDueAt, setDefaultDueAt] = useState<string | null>(null)
  const [layoutDensity, setLayoutDensity] = useState<LayoutDensity>('standard')
  const [defaultReminderMinutesBefore, setDefaultReminderMinutesBefore] = useState(10)
  const systemColorScheme = useColorScheme()
  const extrasRef = useRef(extras)
  extrasRef.current = extras
  const darkMode = extras.preferences.widget.darkMode
  const isDark = darkMode === 'dark' || (darkMode === 'system' && systemColorScheme === 'dark')
  const fontScale = extras.preferences.widget.fontSize / 100

  const updateExtras = useCallback(async (update: (current: WorkspaceExtras) => WorkspaceExtras) => {
    const next = normalizeExtras(update(extrasRef.current))
    extrasRef.current = next
    setExtras(next)
    await AsyncStorage.setItem('focusnotes.extras.v1', JSON.stringify(next))
  }, [])

  const saveFocusSession = useCallback((session: FocusSession) => updateExtras((current) => ({
    ...current,
    focusSessions: [...current.focusSessions, session].slice(-3000),
  })), [updateExtras])
  const timer = usePomodoroTimer(extras.preferences, saveFocusSession)

  useEffect(() => {
    const unsubscribe = store.subscribe(() => setTodos(store.all))
    Promise.all([store.load(), AsyncStorage.getItem('focusnotes.extras.v1')])
      .then(([, raw]) => setExtras(normalizeExtras(raw ? JSON.parse(raw) : null)))
      .catch((reason) => Alert.alert('读取失败', reason instanceof Error ? reason.message : '本地数据读取失败。'))
      .finally(() => setLoading(false))
    return unsubscribe
  }, [store])

  useEffect(() => {
    void AsyncStorage.getItem('focusnotes.mobileDensity')
      .then((value) => {
        if (value === 'compact' || value === 'standard' || value === 'spacious') setLayoutDensity(value)
      })
      .catch((reason) => Alert.alert('读取失败', reason instanceof Error ? reason.message : '无法读取界面布局设置。'))
  }, [])

  useEffect(() => {
    void AsyncStorage.getItem('focusnotes.mobileDefaultReminder')
      .then((value) => {
        const minutes = Number(value)
        if ([0, 5, 10, 15, 30, 60, 1440].includes(minutes)) setDefaultReminderMinutesBefore(minutes)
      })
      .catch((reason) => Alert.alert('读取失败', reason instanceof Error ? reason.message : '无法读取提醒设置。'))
  }, [])

  useEffect(() => {
    const widget = NativeModules.FocusNotesWidget as WidgetModule | undefined
    const payload = todos.filter((todo) => !todo.completed).slice(0, 3).map((todo) => ({ id: todo.id, title: todo.title, dueAt: todo.dueAt, color: QUADRANTS[quadrantOf(todo)].color }))
    widget?.updateTodos(JSON.stringify(payload))
  }, [todos])

  useEffect(() => {
    if (loading) return
    const widget = NativeModules.FocusNotesWidget as WidgetModule | undefined
    const reminders = todos
      .filter((todo) => !todo.completed && !todo.deleted && Boolean(todo.dueAt))
      .map((todo) => ({
        id: todo.id,
        title: todo.title,
        dueAt: todo.dueAt,
        reminderMinutesBefore: todo.reminderMinutesBefore === undefined
          ? defaultReminderMinutesBefore
          : todo.reminderMinutesBefore ?? 0,
      }))
      .filter((todo) => todo.reminderMinutesBefore > 0)
    widget?.syncReminders(JSON.stringify(reminders))
  }, [todos, loading, defaultReminderMinutesBefore])

  useEffect(() => {
    const widget = NativeModules.FocusNotesWidget as WidgetModule | undefined
    const now = new Date()
    const today = dateKey(now)
    const habits = extras.habits.filter((habit) => !habit.archived).slice(0, 3).map((habit) => {
      const logs = extras.habitLogs[habit.id] ?? []
      return { name: habit.name, emoji: habit.emoji, color: habit.color, streak: habitStreak(habit, logs, now), done: logs.includes(today), scheduled: isHabitScheduled(habit, now) }
    })
    widget?.updateHabits(JSON.stringify(habits))
    widget?.updatePrefs(JSON.stringify(extras.preferences.widget))
  }, [extras, systemColorScheme])

  useEffect(() => {
    const widget = NativeModules.FocusNotesWidget as WidgetModule | undefined
    if (!widget) return
    if (!timer.running) {
      widget.syncTimer(JSON.stringify({ running: false }))
      return
    }
    widget.syncTimer(JSON.stringify({
      running: true,
      mode: timer.mode,
      phase: timer.phase,
      remaining: timer.remaining,
      elapsed: timer.elapsed,
    }))
  }, [timer.running, timer.mode, timer.phase])

  useEffect(() => () => {
    const widget = NativeModules.FocusNotesWidget as WidgetModule | undefined
    widget?.syncTimer(JSON.stringify({ running: false }))
    widget?.stopNoise()
  }, [])

  function run(action: Promise<unknown>) {
    action.catch((reason) => Alert.alert('操作失败', reason instanceof Error ? reason.message : '请稍后重试。'))
  }

  function saveExtras(next: WorkspaceExtras) {
    return updateExtras(() => next)
  }

  async function requestNotificationPermission() {
    if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return
    try {
      const permission = 'android.permission.POST_NOTIFICATIONS'
      const status = await PermissionsAndroid.request(permission)
      if (status !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('通知权限未开启', '提醒和计时通知无法显示。可在系统设置中为 FocusNotes 开启通知权限。')
      }
    } catch (reason) {
      Alert.alert('通知权限请求失败', reason instanceof Error ? reason.message : '请在系统设置中允许 FocusNotes 显示通知。')
    }
  }

  async function toggleTimer() {
    if (!timer.running) await requestNotificationPermission()
    timer.toggle()
  }

  function changeLayoutDensity(value: LayoutDensity) {
    setLayoutDensity(value)
    void AsyncStorage.setItem('focusnotes.mobileDensity', value)
      .catch((reason) => Alert.alert('保存失败', reason instanceof Error ? reason.message : '无法保存界面布局设置。'))
  }

  function changeDefaultReminder(minutes: number) {
    setDefaultReminderMinutesBefore(minutes)
    void AsyncStorage.setItem('focusnotes.mobileDefaultReminder', String(minutes))
      .catch((reason) => Alert.alert('保存失败', reason instanceof Error ? reason.message : '无法保存提醒设置。'))
  }

  function changeAppearance(mode: 'system' | 'light' | 'dark') {
    run(updateExtras((current) => ({
      ...current,
      preferences: { ...current.preferences, widget: { ...current.preferences.widget, darkMode: mode } },
    })))
  }

  function changeFontSize(size: number) {
    run(updateExtras((current) => ({
      ...current,
      preferences: { ...current.preferences, widget: { ...current.preferences.widget, fontSize: size } },
    })))
  }

  async function saveList(name: string, color: string) {
    const selected = editingList !== 'new' ? editingList : null
    if (extras.lists.some((list) => list.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase() && list.id !== selected?.id)) {
      Alert.alert('清单名称已存在', '请使用一个尚未被占用的名称。')
      return
    }
    if (selected) {
      await updateExtras((current) => ({ ...current, lists: current.lists.map((list) => list.id === selected.id ? { ...list, name, color } : list) }))
    } else {
      const list: TodoList = {
        id: `list-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        color,
        createdAt: new Date().toISOString(),
      }
      await updateExtras((current) => ({ ...current, lists: [...current.lists, list] }))
      setSelectedListId(list.id)
    }
    setEditingList(null)
  }

  function deleteList(list: TodoList) {
    if (list.id === 'inbox') return
    Alert.alert('删除这个清单？', `“${list.name}”中的待办会移到“收集箱”。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => run((async () => {
        await Promise.all(store.all.filter((todo) => todo.listId === list.id).map((todo) => store.update(todo.id, { listId: 'inbox' })))
        await updateExtras((current) => ({ ...current, lists: current.lists.filter((item) => item.id !== list.id) }))
        if (selectedListId === list.id) setSelectedListId('inbox')
        setEditingList(null)
      })()) },
    ])
  }

  function confirmDelete(todo: TodoItem) {
    Alert.alert('删除这条待办？', `“${todo.title}”将从本机移除。`, [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: () => run(store.remove(todo.id)) }])
  }

  function openNew(dueAt: string | null = null) {
    setDefaultDueAt(dueAt)
    setEditing('new')
  }

  function withWidget(): WidgetModule {
    const widget = NativeModules.FocusNotesWidget as WidgetModule | undefined
    if (!widget) throw new Error('当前平台不支持文件操作，请在 Android 版本中使用。')
    return widget
  }

  async function exportData() {
    const doc = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), todos: store.all, extras }, null, 2)
    const saved = await withWidget().exportData(doc)
    if (saved) Alert.alert('导出完成', '完整备份已保存到你选择的位置。')
  }

  async function importData() {
    const picked = await withWidget().importData()
    if (!picked) return
    const incoming = documentFromJson(picked.contents)
    const mergedTodos = mergeSyncedTodos(store.all, normalizeTodos(incoming.todos))
    await store.replace(mergedTodos)
    await saveExtras(mergeExtras(extrasRef.current, incoming.extras))
    Alert.alert('导入完成', '文件中的待办、习惯记录和专注历史已合并到本机。')
  }

  async function syncFile() {
    const picked = await withWidget().openSyncFile()
    if (!picked) return
    const incoming = documentFromJson(picked.contents)
    const mergedTodos = mergeSyncedTodos(store.all, normalizeTodos(incoming.todos))
    const mergedExtras = mergeExtras(extrasRef.current, incoming.extras)
    await store.replace(mergedTodos)
    await saveExtras(mergedExtras)
    const updated = JSON.stringify({ version: 1, syncedAt: new Date().toISOString(), todos: mergedTodos, extras: mergedExtras }, null, 2)
    await withWidget().saveSyncFile(picked.uri, updated)
    Alert.alert('同步完成', '本机与所选 JSON 文件已合并。选择云盘中的同一文件即可在设备间同步。')
  }

  const visible = todos.filter((todo) => !todo.deleted && (filter === 'all' || quadrantOf(todo) === filter))
  const activeCount = todos.filter((todo) => !todo.completed && !todo.deleted && (selectedListId === 'all' || todo.listId === selectedListId)).length
  const activeLists = extras.lists
  const selectedList = activeLists.find((list) => list.id === selectedListId)

  return <ThemeProvider dark={isDark} fontScale={fontScale}>
  <SafeAreaView style={styles.safe}>
    <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#171a20' : '#f5f5f7'} />
    <KeyboardAvoidingView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.brand}><View style={styles.brandMark}><Check size={14} color="#fff" strokeWidth={3} /></View><Text style={styles.brandText}>FocusNotes</Text></View>
        <Pressable style={styles.cloudButton} onPress={() => setPage('data')}><Settings size={16} color={isDark ? '#aeb6c2' : '#6e6e73'} /><Text style={styles.cloudText}>设置</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={[
        styles.content,
        layoutDensity === 'compact' && styles.contentCompact,
        layoutDensity === 'spacious' && styles.contentSpacious,
      ]} keyboardShouldPersistTaps="handled">
        <View style={[styles.intro, layoutDensity === 'compact' && styles.introCompact, layoutDensity === 'spacious' && styles.introSpacious]}><View style={styles.introText}><Text style={styles.eyebrow}>MY FOCUS</Text><Text style={styles.title}>{page === 'calendar' ? '安排每一天。' : page === 'habits' ? '每天进步一点。' : page === 'pomodoro' ? '专注一件事。' : page === 'data' ? '设置，按你的习惯。' : '此刻，专注。'}</Text><Text style={styles.subtitle}>{page === 'tasks' ? (activeCount ? `${activeCount} 项待办，按截止时间有序推进。` : '一切安排妥当，保持从容。') : page === 'calendar' ? '按日期查看和安排待办。' : page === 'habits' ? '记录习惯，坚持看得见。' : page === 'pomodoro' ? '番茄时钟与可混搭的沉浸环境音。' : '外观、提醒、存储和同步。'}</Text></View></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[
          styles.tabs,
          layoutDensity === 'compact' && styles.tabsCompact,
          layoutDensity === 'spacious' && styles.tabsSpacious,
        ]}>
          {([
            ['tasks', ListTodo, '待办'], ['calendar', CalendarDays, '日历'], ['habits', Flame, '习惯'], ['pomodoro', Timer, '专注'], ['data', Settings, '设置'],
          ] as const).map(([key, Icon, label]) => <Pressable key={key} style={[styles.tab, page === key && styles.tabSelected]} onPress={() => setPage(key)}><Icon size={15} color={page === key ? '#0071e3' : '#6e6e73'} /><Text style={[styles.tabText, page === key && styles.tabTextSelected]}>{label}</Text></Pressable>)}
        </ScrollView>
        {page === 'tasks' && <>
          <View style={[styles.listPickerHeader, layoutDensity === 'compact' && styles.listPickerHeaderCompact]}>
            <Text style={styles.listPickerTitle}>清单</Text>
            {selectedList && <Pressable style={styles.manageList} onPress={() => setEditingList(selectedList)}><Pencil size={12} color="#6e6e73" /><Text style={styles.manageListText}>管理</Text></Pressable>}
            <Pressable style={styles.manageList} onPress={() => setEditingList('new')}><Plus size={14} color="#0071e3" /><Text style={styles.addListText}>新清单</Text></Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.listPills, layoutDensity === 'compact' && styles.listPillsCompact]}>
            <Pressable style={[styles.listPill, selectedListId === 'all' && styles.listPillSelected]} onPress={() => setSelectedListId('all')}>
              <Text style={[styles.listPillText, selectedListId === 'all' && styles.listPillTextSelected]}>全部</Text>
            </Pressable>
            {activeLists.map((list) => <Pressable key={list.id} style={[styles.listPill, selectedListId === list.id && styles.listPillSelected]} onPress={() => setSelectedListId(list.id)} onLongPress={() => setEditingList(list)}>
              <View style={[styles.listPillDot, { backgroundColor: list.color }]} />
              <Text numberOfLines={1} style={[styles.listPillText, selectedListId === list.id && styles.listPillTextSelected]}>{list.name}</Text>
              <Text style={styles.listPillCount}>{todos.filter((todo) => todo.listId === list.id && !todo.completed && !todo.deleted).length}</Text>
            </Pressable>)}
          </ScrollView>
          <SmartComposer onAdd={async (draft) => {
            if (draft.dueAt && defaultReminderMinutesBefore > 0) await requestNotificationPermission()
            await store.add({ ...draft, listId: selectedListId === 'all' ? (draft.listId ?? 'inbox') : selectedListId })
          }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {(['all', ...Object.keys(QUADRANTS)] as Filter[]).map((key) => <Pressable key={key} style={[styles.filter, filter === key && styles.filterSelected]} onPress={() => setFilter(key)}>{key !== 'all' && <View style={[styles.filterDot, { backgroundColor: QUADRANTS[key].color }]} />}<Text style={[styles.filterText, filter === key && styles.filterTextSelected]}>{key === 'all' ? '全部' : key === 'important-urgent' ? '紧急重要' : key === 'not-important-urgent' ? '紧急' : key === 'important-not-urgent' ? '重要' : '其他'}</Text></Pressable>)}
          </ScrollView>
          <View style={[styles.list, layoutDensity === 'spacious' && styles.listSpacious]}>
            {loading ? <View style={styles.empty}><ListTodo size={30} color="#8e8d93" /><Text style={styles.emptyTitle}>正在读取待办…</Text></View> : (() => {
              const listTodos = visible.filter((todo) => selectedListId === 'all' || todo.listId === selectedListId)
              return listTodos.length ? listTodos.map((todo) => <TodoItemCard key={todo.id} todo={todo} onToggle={(id) => run(store.toggle(id))} onEdit={setEditing} onDelete={confirmDelete} />) : <View style={styles.empty}><ListTodo size={32} color="#8e8d93" /><Text style={styles.emptyTitle}>{selectedList ? `“${selectedList.name}”还没有待办` : filter === 'all' ? '暂无待办' : '此象限暂无待办'}</Text><Text style={styles.emptyText}>用一句话，轻松安排下一件事。</Text></View>
            })()}
          </View>
          <Text style={styles.localStatus}><Text style={styles.savedDot}>●</Text> 已保存在本机</Text>
        </>}
        {page === 'calendar' && <CalendarView tasks={todos} onCreate={(day) => openNew(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9).toISOString())} onEdit={setEditing} onToggle={(id) => run(store.toggle(id))} />}
        {page === 'habits' && <HabitsView
          habits={extras.habits}
          habitLogs={extras.habitLogs}
          onToggle={(habitId, day) => run(updateExtras((current) => ({ ...current, habitLogs: { ...current.habitLogs, [habitId]: toggleHabitLog(current.habitLogs[habitId] ?? [], day) } })))}
          onAdd={(habit) => run(updateExtras((current) => ({ ...current, habits: [...current.habits, habit], habitLogs: { ...current.habitLogs, [habit.id]: [] } })))}
          onUpdate={(habit) => run(updateExtras((current) => ({ ...current, habits: current.habits.map((item) => item.id === habit.id ? habit : item) })))}
          onDelete={(habitId) => {
            run(updateExtras((current) => {
              const habitLogs = { ...current.habitLogs }
              delete habitLogs[habitId]
              return { ...current, habits: current.habits.filter((habit) => habit.id !== habitId), habitLogs }
            }))
          }}
        />}
        {page === 'pomodoro' && <PomodoroView
          preferences={extras.preferences}
          sessions={extras.focusSessions}
          tasks={todos}
          timer={timer}
          onAdjustFocusMinutes={(minutes) => run(updateExtras((current) => ({ ...current, preferences: { ...current.preferences, pomodoroMinutes: minutes } })))}
          onToggleTimer={() => run(toggleTimer())}
          onRequestNotification={() => requestNotificationPermission()}
        />}
        {page === 'data' && <View style={styles.dataCard}>
          <View style={styles.layoutSettings}>
            <View><Text style={styles.actionTitle}>外观模式</Text><Text style={styles.actionHint}>跟随系统，或手动选择明暗主题</Text></View>
            <View style={styles.optionRow}>{([
              ['system', '跟随系统'], ['light', '浅色'], ['dark', '深色'],
            ] as const).map(([value, label]) => <Pressable key={value} style={[styles.densityButton, darkMode === value && styles.densityButtonSelected]} onPress={() => changeAppearance(value)}><Text style={[styles.densityText, darkMode === value && styles.densityTextSelected]}>{label}</Text></Pressable>)}</View>
          </View>
          <View style={styles.layoutSettings}>
            <View><Text style={styles.actionTitle}>字体大小</Text><Text style={styles.actionHint}>当前 {extras.preferences.widget.fontSize}%</Text></View>
            <View style={styles.optionRow}>{[80, 90, 100, 110, 120, 140].map((size) => <Pressable key={size} style={[styles.densityButton, extras.preferences.widget.fontSize === size && styles.densityButtonSelected]} onPress={() => changeFontSize(size)}><Text style={[styles.densityText, extras.preferences.widget.fontSize === size && styles.densityTextSelected]}>{size}%</Text></Pressable>)}</View>
          </View>
          <View style={styles.layoutSettings}>
            <View><Text style={styles.actionTitle}>默认提前提醒</Text><Text style={styles.actionHint}>新待办可在截止前收到通知，也可单独设置</Text></View>
            <View style={styles.optionRow}>{([
              [0, '关闭'], [5, '5 分钟'], [10, '10 分钟'], [15, '15 分钟'], [30, '30 分钟'], [60, '1 小时'], [1440, '1 天'],
            ] as Array<[number, string]>).map(([minutes, label]) => <Pressable key={minutes} style={[styles.densityButton, defaultReminderMinutesBefore === minutes && styles.densityButtonSelected]} onPress={() => changeDefaultReminder(minutes)}><Text style={[styles.densityText, defaultReminderMinutesBefore === minutes && styles.densityTextSelected]}>{label}</Text></Pressable>)}</View>
          </View>
          <View style={styles.layoutSettings}>
            <View><Text style={styles.actionTitle}>界面高度</Text><Text style={styles.actionHint}>按屏幕大小调整页面疏密，适配全面屏</Text></View>
            <View style={styles.densityOptions}>{([
              ['compact', '紧凑'], ['standard', '标准'], ['spacious', '宽松'],
            ] as Array<[LayoutDensity, string]>).map(([value, label]) => <Pressable key={value} style={[styles.densityButton, layoutDensity === value && styles.densityButtonSelected]} onPress={() => changeLayoutDensity(value)}><Text style={[styles.densityText, layoutDensity === value && styles.densityTextSelected]}>{label}</Text></Pressable>)}</View>
          </View>
          <View style={styles.dataInfo}><Database size={20} color="#0071e3" /><View style={styles.dataInfoText}><Text style={styles.dataTitle}>本地数据存储</Text><Text style={styles.dataHint}>待办、习惯和专注记录保存在此设备的应用存储中。</Text></View></View>
          <Pressable style={styles.dataAction} onPress={() => run(exportData())}><Download size={17} color="#0071e3" /><View style={styles.actionText}><Text style={styles.actionTitle}>导出完整备份</Text><Text style={styles.actionHint}>保存为 JSON 文件，可用于迁移或恢复</Text></View></Pressable>
          <Pressable style={styles.dataAction} onPress={() => run(importData())}><Upload size={17} color="#0071e3" /><View style={styles.actionText}><Text style={styles.actionTitle}>导入并合并</Text><Text style={styles.actionHint}>选择备份文件，合并待办、习惯和历史</Text></View></Pressable>
          <Pressable style={styles.dataAction} onPress={() => run(syncFile())}><Cloud size={17} color="#0071e3" /><View style={styles.actionText}><Text style={styles.actionTitle}>同步云盘文件</Text><Text style={styles.actionHint}>选择云盘中的同一 JSON 文件，双向合并数据</Text></View></Pressable>
          <Text style={styles.syncNote}>云盘同步通过 Android 文件选择器访问你授权的云盘，不会把数据上传到 FocusNotes 服务器。</Text>
        </View>}
      </ScrollView>
      {page === 'tasks' && <Pressable style={styles.fab} onPress={() => openNew()} accessibilityLabel="新建待办"><Plus size={27} color="#fff" /></Pressable>}
    </KeyboardAvoidingView>
    {editing && <EditTodoModal
      todo={editing === 'new' ? undefined : editing}
      lists={activeLists}
      defaultListId={selectedListId === 'all' ? 'inbox' : selectedListId}
      defaultDueAt={defaultDueAt}
      defaultReminderMinutesBefore={defaultReminderMinutesBefore}
      onClose={() => { setEditing(null); setDefaultDueAt(null) }}
      onSave={async (draft) => {
        if (draft.dueAt && (draft.reminderMinutesBefore ?? 0) > 0) await requestNotificationPermission()
        if (editing === 'new') await store.add(draft)
        else await store.update(editing.id, draft)
      }}
      onAddToCalendar={(title, notes, dueAt) => withWidget().addToCalendar(title, notes, dueAt)}
    />}
    {editingList && <TodoListDialog
      list={editingList === 'new' ? undefined : editingList}
      onClose={() => setEditingList(null)}
      onSave={(name, color) => { run(saveList(name, color)) }}
      onDelete={editingList !== 'new' && editingList.id !== 'inbox' ? () => deleteList(editingList) : undefined}
    />}
  </SafeAreaView>
  </ThemeProvider>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f7' },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#0071e3' },
  brandText: { color: '#1d1d1f', fontSize: 14, fontWeight: '600', letterSpacing: -.2 },
  cloudButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 6 },
  cloudText: { color: '#6e6e73', fontSize: 11 },
  content: { paddingHorizontal: 18, paddingBottom: 100 },
  contentCompact: { paddingBottom: 76 },
  contentSpacious: { paddingBottom: 120 },
  intro: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 22 },
  introCompact: { marginVertical: 14 },
  introSpacious: { marginVertical: 30 },
  introText: { flex: 1 },
  eyebrow: { color: '#0071e3', fontSize: 10, fontWeight: '700', letterSpacing: 1.6 },
  title: { marginTop: 5, color: '#1d1d1f', fontSize: 32, fontWeight: '600', lineHeight: 38, letterSpacing: -1.1 },
  subtitle: { marginTop: 7, color: '#6e6e73', fontSize: 12, lineHeight: 18 },
  filters: { gap: 6, paddingVertical: 18 },
  tabs: { gap: 8, paddingVertical: 12 },
  tabsCompact: { paddingVertical: 6 },
  tabsSpacious: { paddingVertical: 18 },
  tab: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 15, borderRadius: 20, backgroundColor: '#ececf0' },
  tabSelected: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: .05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tabText: { color: '#6e6e73', fontSize: 12 },
  tabTextSelected: { color: '#0071e3', fontWeight: '600' },
  listPickerHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 1, marginBottom: 8 },
  listPickerHeaderCompact: { marginBottom: 3 },
  listPickerTitle: { color: '#8e8d93', fontSize: 11, fontWeight: '600', letterSpacing: .5 },
  manageList: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7 },
  manageListText: { color: '#6e6e73', fontSize: 10 },
  addListText: { color: '#0071e3', fontSize: 10, fontWeight: '600' },
  listPills: { gap: 7, paddingBottom: 14 },
  listPillsCompact: { paddingBottom: 8 },
  listPill: { minHeight: 35, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, borderWidth: 1, borderColor: '#e5e5ea', borderRadius: 18, backgroundColor: '#fff' },
  listPillSelected: { borderColor: '#a8ceff', backgroundColor: '#eef6ff' },
  listPillDot: { width: 7, height: 7, borderRadius: 4 },
  listPillText: { maxWidth: 112, color: '#6e6e73', fontSize: 11 },
  listPillTextSelected: { color: '#0071e3', fontWeight: '600' },
  listPillCount: { color: '#a1a1aa', fontSize: 9 },
  filter: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 14, borderRadius: 19 },
  filterSelected: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: .06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  filterDot: { width: 6, height: 6, borderRadius: 3 },
  filterText: { color: '#6e6e73', fontSize: 12 },
  filterTextSelected: { color: '#1d1d1f', fontWeight: '600' },
  list: { gap: 9 },
  listSpacious: { gap: 14 },
  empty: { minHeight: 180, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 12, color: '#48484a', fontSize: 15, fontWeight: '600' },
  emptyText: { marginTop: 7, color: '#8e8d93', fontSize: 12 },
  localStatus: { marginTop: 22, color: '#8e8d93', fontSize: 10, textAlign: 'center' },
  savedDot: { color: '#30a46c' },
  dataCard: { gap: 4, padding: 16, borderRadius: 16, backgroundColor: '#fff' },
  layoutSettings: { gap: 11, paddingBottom: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5ea' },
  densityOptions: { flexDirection: 'row', gap: 8 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  densityButton: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 17, backgroundColor: '#f5f5f7' },
  densityButtonSelected: { backgroundColor: '#eaf3ff' },
  densityText: { color: '#6e6e73', fontSize: 11 },
  densityTextSelected: { color: '#0071e3', fontWeight: '600' },
  dataInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5ea' },
  dataInfoText: { flex: 1 },
  dataTitle: { color: '#1d1d1f', fontSize: 14, fontWeight: '600' },
  dataHint: { marginTop: 4, color: '#8e8d93', fontSize: 11, lineHeight: 16 },
  dataAction: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f2' },
  actionText: { flex: 1 },
  actionTitle: { color: '#1d1d1f', fontSize: 13, fontWeight: '600' },
  actionHint: { marginTop: 4, color: '#8e8d93', fontSize: 10, lineHeight: 14 },
  syncNote: { marginTop: 12, color: '#8e8d93', fontSize: 10, lineHeight: 15 },
  fab: { position: 'absolute', right: 22, bottom: 28, width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: '#0071e3', shadowColor: '#0071e3', shadowOpacity: .3, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
})
