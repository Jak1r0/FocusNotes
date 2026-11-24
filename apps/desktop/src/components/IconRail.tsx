import {
  CalendarDays,
  ListTodo,
  NotebookPen,
  Flame,
  LayoutGrid,
  Search,
  Settings,
  Sparkles,
  Sun,
  Moon,
  Timer,
  Gauge,
} from 'lucide-react'
import type { NavId } from '@focusnotes/core'
import { isTaskView, type ViewId } from '../navigation'
import { updateGlassPointer } from '../glassInteraction'

interface IconRailProps {
  view: ViewId
  theme: 'light' | 'dark'
  profileName: string
  expanded: boolean
  onNavigate: (view: ViewId) => void
  onSearch: () => void
  onSettings: () => void
  onProfile: () => void
  onToggleTheme: () => void
  navOrder: NavId[]
  navHidden: NavId[]
}

const NAV_DEFS: Record<NavId, { id: NavId; label: string; icon: typeof CalendarDays }> = {
  today: { id: 'today', label: '待办', icon: ListTodo },
  memos: { id: 'memos', label: '备忘录', icon: NotebookPen },
  pomodoro: { id: 'pomodoro', label: '番茄钟', icon: Timer },
  habits: { id: 'habits', label: '习惯', icon: Flame },
  calendar: { id: 'calendar', label: '日历', icon: CalendarDays },
  quadrant: { id: 'quadrant', label: '四象限', icon: LayoutGrid },
  widgets: { id: 'widgets', label: '概览', icon: Gauge },
  search: { id: 'search', label: '搜索', icon: Search },
  assistant: { id: 'assistant', label: 'AI 助手', icon: Sparkles },
}

export function IconRail({ view, theme, profileName, expanded, onNavigate, onSearch, onSettings, onProfile, onToggleTheme, navOrder, navHidden }: IconRailProps) {
  const isActive = (id: NavId) => view === id || (id === 'today' && isTaskView(view))
  // 渲染层兜底：navOrder 缺失的导航项也要显示，避免旧数据导致新功能不可见。
  const orderedNav = [
    ...navOrder.filter((id) => NAV_DEFS[id]),
    ...(Object.keys(NAV_DEFS) as NavId[]).filter((id) => !navOrder.includes(id)),
  ]
  const items = orderedNav.filter((id) => !navHidden.includes(id)).map((id) => NAV_DEFS[id]).filter(Boolean)
  const handle = (id: NavId) => id === 'search' ? onSearch() : onNavigate(id as ViewId)
  return (
    <nav className={`icon-rail${expanded ? ' expanded' : ''}`} aria-label="主导航">
      <button className="rail-avatar glass-nav-control" onClick={onProfile} onPointerMove={updateGlassPointer}
        data-tooltip={`记录档案：${profileName}`} aria-label="切换记录档案">
        <span>{(profileName || 'F').slice(0, 1).toUpperCase()}</span>
      </button>
      <div className="rail-group rail-navigation">
        {items.map((item) => {
          const Icon = item.icon
          const active = isActive(item.id)
          return (
            <button
              key={item.id}
              className={`rail-button glass-nav-control${active ? ' active' : ''}`}
              onClick={() => handle(item.id)}
              onPointerMove={updateGlassPointer}
              data-tooltip={expanded ? undefined : item.label}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={20} strokeWidth={1.8} />
              <span className="rail-label">{item.label}</span>
            </button>
          )
        })}
      </div>
      <div className="rail-spacer" />
      <div className="rail-group rail-bottom">
        <button className="rail-button glass-nav-control" onClick={onToggleTheme} onPointerMove={updateGlassPointer}
          data-tooltip={expanded ? undefined : '切换明暗'} aria-label="切换明暗">
          {theme === 'dark' ? <Sun size={19} strokeWidth={1.8} /> : <Moon size={19} strokeWidth={1.8} />}
          <span className="rail-label">{theme === 'dark' ? '浅色模式' : '深色模式'}</span>
        </button>
        <button className="rail-button glass-nav-control" onClick={onSettings} onPointerMove={updateGlassPointer}
          data-tooltip={expanded ? undefined : '设置'} aria-label="设置">
          <Settings size={19} strokeWidth={1.8} />
          <span className="rail-label">设置</span>
        </button>
      </div>
    </nav>
  )
}
