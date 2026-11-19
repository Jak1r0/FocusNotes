import { createContext, useContext, type ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardAvoidingViewProps,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native'

interface ThemeValue {
  dark: boolean
  fontScale: number
}

const ThemeContext = createContext<ThemeValue>({ dark: false, fontScale: 1 })

export function ThemeProvider({ dark, fontScale, children }: ThemeValue & { children: ReactNode }) {
  return <ThemeContext.Provider value={{ dark, fontScale }}>{children}</ThemeContext.Provider>
}

const darkColors: Record<string, string> = {
  '#fff': '#1b1e24',
  '#ffffff': '#1b1e24',
  '#f5f5f7': '#242830',
  '#f2f2f7': '#262a32',
  '#ececf0': '#2b3038',
  '#fafafc': '#20242b',
  '#eef6ff': '#1c2b40',
  '#eaf3ff': '#1c2b40',
  '#edf5ff': '#1c2b40',
  '#eff6ff': '#1c2b40',
  '#edf8f1': '#1d3028',
  '#fff5df': '#382b1b',
  '#fff0ef': '#392323',
  '#e5e5ea': '#383d46',
  '#ebebef': '#353a43',
  '#f0f0f2': '#353a43',
  '#d1d1d6': '#414752',
  '#e9eef5': '#353d49',
  '#1d1d1f': '#f2f3f5',
  '#48484a': '#d2d6dc',
  '#6e6e73': '#aeb6c2',
  '#8e8d93': '#8993a2',
  '#a1a1aa': '#788292',
}

const darkBorders: Record<string, string> = {
  ...darkColors,
  '#e5e5ea': '#383d46',
  '#ebebef': '#383d46',
  '#f0f0f2': '#383d46',
  '#d1d1d6': '#414752',
}

const darkTextColors: Record<string, string> = {
  ...darkColors,
  '#fff': '#f5f5f7',
  '#ffffff': '#f5f5f7',
}

function themedStyle<T extends ViewStyle | TextStyle>(style: StyleProp<T>, fontScale: number, dark: boolean, kind: 'text' | 'view'): StyleProp<T> {
  const flattened = StyleSheet.flatten(style)
  if (!flattened) return flattened
  const next = { ...flattened } as Record<string, unknown>
  for (const [key, value] of Object.entries(next)) {
    if (typeof value !== 'string') {
      if ((key === 'fontSize' || key === 'lineHeight') && typeof value === 'number') next[key] = Math.round(value * fontScale)
      continue
    }
    if (!dark) continue
    const color = value.toLowerCase()
    if (key === 'color') next[key] = (kind === 'text' ? darkTextColors : darkColors)[color] ?? value
    else if (key === 'backgroundColor') next[key] = darkColors[color] ?? value
    else if (key.toLowerCase().includes('border') && key.toLowerCase().includes('color')) next[key] = darkBorders[color] ?? value
    else if (kind === 'view' && key === 'shadowColor' && color === '#000') next[key] = '#000'
  }
  return next as StyleProp<T>
}

export function ThemedText(props: TextProps) {
  const theme = useContext(ThemeContext)
  return <Text {...props} style={themedStyle(props.style, theme.fontScale, theme.dark, 'text')} />
}

export function ThemedTextInput(props: TextInputProps) {
  const theme = useContext(ThemeContext)
  const placeholderTextColor = theme.dark && (!props.placeholderTextColor || props.placeholderTextColor === '#8e8d93')
    ? '#8993a2'
    : props.placeholderTextColor
  return <TextInput {...props} placeholderTextColor={placeholderTextColor} style={themedStyle(props.style, theme.fontScale, theme.dark, 'text')} />
}

export function ThemedView(props: ViewProps) {
  const theme = useContext(ThemeContext)
  return <View {...props} style={themedStyle(props.style, theme.fontScale, theme.dark, 'view')} />
}

export function ThemedPressable({ style, ...props }: PressableProps) {
  const theme = useContext(ThemeContext)
  const resolvedStyle: PressableProps['style'] = typeof style === 'function'
    ? (state) => themedStyle(style(state), theme.fontScale, theme.dark, 'view')
    : themedStyle(style, theme.fontScale, theme.dark, 'view')
  return <Pressable {...props} style={resolvedStyle} />
}

export function ThemedSafeAreaView(props: ViewProps) {
  const theme = useContext(ThemeContext)
  return <SafeAreaView {...props} style={themedStyle(props.style, theme.fontScale, theme.dark, 'view')} />
}

export function ThemedKeyboardAvoidingView(props: KeyboardAvoidingViewProps) {
  const theme = useContext(ThemeContext)
  return <KeyboardAvoidingView {...props} style={themedStyle(props.style, theme.fontScale, theme.dark, 'view')} />
}

export function ThemedScrollView({ style, contentContainerStyle, ...props }: ScrollViewProps) {
  const theme = useContext(ThemeContext)
  return <ScrollView
    {...props}
    style={themedStyle(style, theme.fontScale, theme.dark, 'view')}
    contentContainerStyle={themedStyle(contentContainerStyle, theme.fontScale, theme.dark, 'view')}
  />
}
