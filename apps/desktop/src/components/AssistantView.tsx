import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Bot, CheckCircle2, MessageSquarePlus, Sparkles, Wand2 } from 'lucide-react'
import {
  HybridSmartParser,
  dateKey,
  isOverdue,
  type TodoDraft,
  type TodoItem,
} from '@focusnotes/core'
import type { ViewId } from '../navigation'

interface AssistantViewProps {
  tasks: TodoItem[]
  onAddTask: (draft: TodoDraft) => void
  onNavigate: (view: ViewId) => void
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  action?: { label: string; view: ViewId }
}

const parser = new HybridSmartParser()

const SUGGESTIONS = [
  '今天还有什么没做？',
  '添加任务 明天下午三点 提交周报',
  '帮我回顾这周的完成情况',
  '我想开始一个专注',
]

const uid = () => Math.random().toString(36).slice(2, 10)

export function AssistantView({ tasks, onAddTask, onNavigate }: AssistantViewProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: uid(),
      role: 'assistant',
      text: '你好，我是 FocusNotes 助手。可以帮你安排今天的任务、创建待办，或者直接开始一段专注。',
    },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [messages, typing])

  const open = tasks.filter((todo) => !todo.deleted && !todo.completed)
  const today = dateKey(new Date())

  const answer = async (text: string): Promise<{ reply: string; action?: Message['action'] }> => {
    const raw = text.trim()
    const command = raw
      .replace(/^(请|帮我|给我|我要)\s*/u, '')
      .replace(/^(添加任务|新建任务|记一下|提醒我)[:：,，\s]*/u, '')

    if (/添加|新建|记一下|提醒我/.test(raw)) {
      const parsed = await parser.parse(command)
      if (parsed.title.trim()) {
        onAddTask({
          title: parsed.title,
          notes: '',
          dueAt: parsed.dueAt,
          important: parsed.important,
          urgent: parsed.urgent,
          listId: 'inbox',
          tags: [],
        })
        const due = parsed.dueAt
          ? `，截止 ${new Date(parsed.dueAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
          : '，没有设置截止时间'
        return { reply: `已添加「${parsed.title}」${due}。需要的话我还能帮你调整优先级。`, action: { label: '去今天看看', view: 'today' } }
      }
    }

    if (/专注|番茄|开始工作/.test(raw)) {
      return { reply: '好，去专注页开一段 25 分钟的番茄钟。开始之后我会尽量不打扰你。', action: { label: '开始专注', view: 'pomodoro' } }
    }

    if (/习惯|打卡/.test(raw)) {
      const pending = open.length
      return { reply: `习惯页可以打卡、看连续天数。今天还有 ${pending} 件待办没完成，先挑一件最小的开始吧。`, action: { label: '打开习惯', view: 'habits' } }
    }

    if (/今天|今日|安排|还有什么|没做/.test(raw)) {
      const dueToday = open.filter((todo) => todo.dueAt && dateKey(todo.dueAt) === today)
      const overdue = open.filter((todo) => isOverdue(todo))
      if (dueToday.length === 0 && overdue.length === 0) {
        return { reply: `今天没有排期的任务，手头还有 ${open.length} 件待办。要不要挑一件安排到今天？`, action: { label: '查看四象限', view: 'quadrant' } }
      }
      const lines = [
        overdue.length ? `有 ${overdue.length} 件已经逾期：${overdue.slice(0, 3).map((todo) => `「${todo.title}」`).join('、')}。` : '',
        dueToday.length ? `今天到期 ${dueToday.length} 件：${dueToday.slice(0, 3).map((todo) => `「${todo.title}」`).join('、')}。` : '',
        '建议先处理最紧急的一件，其余的可以放进四象限里排优先级。',
      ].filter(Boolean)
      return { reply: lines.join(' '), action: { label: '打开四象限', view: 'quadrant' } }
    }

    if (/回顾|总结|完成|这周|本周/.test(raw)) {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      const done = tasks.filter((todo) => !todo.deleted && todo.completed && todo.completedAt && Date.parse(todo.completedAt) >= weekAgo)
      return {
        reply: `最近 7 天你完成了 ${done.length} 件任务。${done.length > 0 ? `包括「${done.slice(0, 3).map((todo) => todo.title).join('」「')}」。` : ''}保持这个节奏就很好。`,
        action: { label: '查看已完成', view: 'completed' },
      }
    }

    if (/你好|hi|hello|在吗/i.test(raw)) {
      return { reply: '在的。想让我帮你安排任务、创建待办，还是开始一段专注？' }
    }

    return {
      reply: `我还不确定怎么处理「${raw}」。你可以试试「添加任务 明天下午三点 提交周报」，或者问我「今天还有什么没做」。`,
      action: { label: '查看今天', view: 'today' },
    }
  }

  const send = (text: string) => {
    const value = text.trim()
    if (!value) return
    const userMessage: Message = { id: uid(), role: 'user', text: value }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setTyping(true)
    window.setTimeout(async () => {
      const result = await answer(value)
      setTyping(false)
      setMessages((prev) => [...prev, { id: uid(), role: 'assistant', text: result.reply, action: result.action }])
    }, 420)
  }

  return (
    <div className="assistant-view">
      <aside className="assistant-side card">
        <div className="assistant-brand">
          <span className="assistant-avatar"><Bot size={18} /></span>
          <div><strong>FocusNotes 助手</strong><small>本地运行 · 数据不出设备</small></div>
        </div>
        <button className="ghost-button wide" onClick={() => setMessages([{ id: uid(), role: 'assistant', text: '新会话开始了。今天想先做点什么？' }])}>
          <MessageSquarePlus size={14} /> 新会话
        </button>
        <div className="assistant-history">
          <span className="sidebar-label">当前会话</span>
          <div className="assistant-history-row active"><span>任务规划与专注建议</span><small>刚刚</small></div>
        </div>
        <div className="assistant-tip">
          <Sparkles size={13} />
          <p>我只读取本机任务数据，不会上传任何内容。</p>
        </div>
      </aside>

      <section className="assistant-main card">
        <div className="assistant-scroll" ref={scroller}>
          {messages.map((message) => (
            <div key={message.id} className={`chat-row ${message.role}`}>
              {message.role === 'assistant' && <span className="chat-avatar"><Bot size={14} /></span>}
              <div className="chat-bubble">
                <p>{message.text}</p>
                {message.action && (
                  <button className="chat-action" onClick={() => onNavigate(message.action!.view)}>
                    <CheckCircle2 size={12} /> {message.action.label}
                  </button>
                )}
              </div>
            </div>
          ))}
          {typing && (
            <div className="chat-row assistant">
              <span className="chat-avatar"><Bot size={14} /></span>
              <div className="chat-bubble typing"><i /><i /><i /></div>
            </div>
          )}
        </div>

        {messages.length <= 1 && (
          <div className="assistant-suggestions">
            <span className="sidebar-label"><Wand2 size={12} /> 试试这样问</span>
            <div className="suggestion-grid">
              {SUGGESTIONS.map((item) => (
                <button key={item} className="suggestion-chip" onClick={() => send(item)}>{item}</button>
              ))}
            </div>
          </div>
        )}

        <div className="assistant-input">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(input) } }}
            placeholder="问我今天该做什么，或直接说「添加任务 …」"
            aria-label="输入消息"
          />
          <button className="send-button" onClick={() => send(input)} disabled={!input.trim()} aria-label="发送">
            <ArrowUp size={17} />
          </button>
        </div>
      </section>
    </div>
  )
}
