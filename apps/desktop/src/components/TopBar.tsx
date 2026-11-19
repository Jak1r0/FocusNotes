import { Maximize2, Minus, NotebookPen, PanelLeftClose, Search, Settings2, X } from 'lucide-react'

interface TopBarProps {
  title: string
  subtitle: string
  onSearch: () => void
  onSettings: () => void
  onMinimize: () => void
  onClose: () => void
  onMini: () => void
}

export function TopBar({ title, subtitle, onSearch, onSettings, onMinimize, onClose, onMini }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="topbar-actions">
        <button className="icon-button" onClick={onSearch} title="搜索（Ctrl+K）" aria-label="搜索">
          <Search size={17} />
        </button>
        <button className="icon-button" onClick={onSettings} title="设置" aria-label="设置">
          <Settings2 size={17} />
        </button>
        <button className="icon-button" onClick={onMini} title="切换到迷你窗口" aria-label="切换到迷你窗口">
          <PanelLeftClose size={17} />
        </button>
        <span className="topbar-divider" />
        <button className="icon-button" onClick={onMinimize} title="最小化到托盘" aria-label="最小化到托盘">
          <Minus size={17} />
        </button>
        <button className="icon-button danger-hover" onClick={onClose} title="关闭" aria-label="关闭">
          <X size={17} />
        </button>
      </div>
    </header>
  )
}

export function MiniTopBar({ onExpand, onMinimize, onClose }: { onExpand: () => void; onMinimize: () => void; onClose: () => void }) {
  return (
    <header className="mini-topbar">
      <span className="mini-brand">
        <span className="brand-mark small"><NotebookPen size={12} /></span>
        FocusNotes
      </span>
      <div className="mini-actions">
        <button className="icon-button" onClick={onExpand} title="展开完整窗口" aria-label="展开完整窗口">
          <Maximize2 size={15} />
        </button>
        <button className="icon-button" onClick={onMinimize} title="最小化" aria-label="最小化">
          <Minus size={15} />
        </button>
        <button className="icon-button danger-hover" onClick={onClose} title="关闭" aria-label="关闭">
          <X size={15} />
        </button>
      </div>
    </header>
  )
}
