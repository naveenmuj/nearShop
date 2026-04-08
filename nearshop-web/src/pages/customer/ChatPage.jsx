import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Send, Reply, Copy, CheckCheck, RefreshCw, Forward } from 'lucide-react'
import {
  createMessagingConnection,
  getConversation,
  markConversationRead,
  reactToMessage,
  sendMessage,
  unreactToMessage,
} from '../../api/messaging'
import { useAuthStore } from '../../store/authStore'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const QUICK_REACTIONS = ['👍', '❤️', '🙏', '🔥', '😂']

function formatTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

function normalizeReactionMap(message) {
  if (!message) return {}
  if (message.reaction_counts && typeof message.reaction_counts === 'object') return message.reaction_counts
  if (Array.isArray(message.reactions)) {
    return message.reactions.reduce((acc, r) => {
      if (!r?.emoji) return acc
      acc[r.emoji] = (acc[r.emoji] || 0) + 1
      return acc
    }, {})
  }
  return {}
}

export default function CustomerChatPage() {
  const navigate = useNavigate()
  const { conversationId } = useParams()
  const user = useAuthStore((s) => s.user)

  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [replyTarget, setReplyTarget] = useState(null)
  const [actionSheet, setActionSheet] = useState(null)

  const scrollRef = useRef(null)
  const wsRef = useRef(null)
  const touchTimerRef = useRef(null)

  const loadConversation = useCallback(async ({ silent = false } = {}) => {
    if (!conversationId) return
    if (!silent) setLoading(true)
    try {
      const data = await getConversation(conversationId, { limit: 100 })
      setConversation(data)
      setMessages(data?.messages || [])
      await markConversationRead(conversationId)
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    loadConversation()
  }, [loadConversation])

  useEffect(() => {
    wsRef.current = createMessagingConnection(conversationId, {
      onMessage: (msg) => {
        setMessages((prev) => {
          if (prev.some((item) => String(item.id) === String(msg.id))) return prev
          return [...prev, msg]
        })
      },
      onReaction: (messageWithReaction) => {
        setMessages((prev) => prev.map((msg) => (
          String(msg.id) === String(messageWithReaction.id) ? { ...msg, ...messageWithReaction } : msg
        )))
      },
      onRead: () => markConversationRead(conversationId),
    })

    const interval = window.setInterval(() => {
      loadConversation({ silent: true })
    }, 30000)

    return () => {
      window.clearInterval(interval)
      wsRef.current?.close?.()
      wsRef.current = null
    }
  }, [conversationId, loadConversation])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  const sortedMessages = useMemo(() => [...messages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)), [messages])

  const submit = async () => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const metadata = replyTarget ? { reply_to_message_id: replyTarget.id } : null
      const created = await sendMessage(conversationId, body, 'text', null, metadata)
      setMessages((prev) => [...prev, created])
      setText('')
      setReplyTarget(null)
      setActionSheet(null)
      await markConversationRead(conversationId)
    } finally {
      setSending(false)
    }
  }

  const toggleReaction = async (message, emoji) => {
    const map = normalizeReactionMap(message)
    const hasEmoji = Boolean(map[emoji])
    if (hasEmoji) {
      await unreactToMessage(conversationId, message.id, emoji)
    } else {
      await reactToMessage(conversationId, message.id, emoji)
    }
    await loadConversation({ silent: true })
  }

  const copyMessage = async (content) => {
    try {
      await navigator.clipboard.writeText(content || '')
    } catch {
      // ignore clipboard failures
    }
  }

  const forwardMessage = async (message) => {
    const content = message?.content || message?.message || ''
    const payload = `Forwarded from NearShop chat:\n\n${content}`
    try {
      if (navigator.share) {
        await navigator.share({ text: payload })
      } else {
        await navigator.clipboard.writeText(payload)
      }
    } catch {
      // ignore forward cancellation
    }
  }

  const openActionSheet = (message, x = null, y = null) => {
    setActionSheet({
      message,
      x: typeof x === 'number' ? x : window.innerWidth / 2,
      y: typeof y === 'number' ? y : window.innerHeight / 2,
    })
  }

  const clearTouchTimer = () => {
    if (touchTimerRef.current) {
      window.clearTimeout(touchTimerRef.current)
      touchTimerRef.current = null
    }
  }

  useEffect(() => {
    if (!actionSheet) return
    const close = () => setActionSheet(null)
    window.addEventListener('scroll', close, { passive: true })
    return () => window.removeEventListener('scroll', close)
  }, [actionSheet])

  if (loading) {
    return <div className="flex items-center justify-center py-20"><LoadingSpinner size="lg" /></div>
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
        <button onClick={() => navigate('/app/messages')} className="rounded-lg p-2 hover:bg-gray-100">
          <ArrowLeft className="h-4 w-4 text-gray-700" />
        </button>
        <div className="text-center">
          <h1 className="text-sm font-bold text-gray-900">{conversation?.shop_name || conversation?.other_party_name || 'Chat Workspace'}</h1>
          <p className="text-xs text-gray-500">Desktop chat console</p>
        </div>
        <button onClick={() => loadConversation({ silent: true })} className="rounded-lg p-2 hover:bg-gray-100">
          <RefreshCw className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      <div className="h-[66vh] overflow-y-auto bg-gradient-to-b from-[#f7f8fc] to-white px-4 py-4 lg:h-[72vh]">
        <div className="space-y-2">
          {sortedMessages.map((msg) => {
            const isMe = msg.sender_role === 'customer' || String(msg.sender_id) === String(user?.id)
            const reactionMap = normalizeReactionMap(msg)
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${isMe ? 'bg-[#5b54c8] text-white' : 'border border-gray-200 bg-white text-gray-900'}`}>
                  {msg.metadata?.reply_to_preview ? (
                    <div className={`mb-1 rounded-lg px-2 py-1 text-xs ${isMe ? 'bg-[#6f69d7] text-white/90' : 'bg-gray-100 text-gray-600'}`}>
                      {msg.metadata.reply_to_preview}
                    </div>
                  ) : null}

                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content || msg.message || ''}</p>
                  <div className={`mt-1 flex items-center justify-between gap-2 text-[11px] ${isMe ? 'text-white/80' : 'text-gray-400'}`}>
                    <span>{formatTime(msg.created_at)}</span>
                    {isMe ? <CheckCheck className="h-3.5 w-3.5" /> : null}
                  </div>

                  {Object.keys(reactionMap).length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(reactionMap).map(([emoji, count]) => (
                        <button
                          key={`${msg.id}-${emoji}`}
                          onClick={() => toggleReaction(msg, emoji)}
                          className={`rounded-full px-2 py-0.5 text-xs ${isMe ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}
                        >
                          {emoji} {count}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <button
                    className={`mt-2 rounded-lg px-2 py-1 text-[11px] font-semibold ${isMe ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-500'}`}
                    onClick={(e) => openActionSheet(msg, e.clientX, e.clientY)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      openActionSheet(msg, e.clientX, e.clientY)
                    }}
                    onTouchStart={(e) => {
                      clearTouchTimer()
                      const touch = e.touches?.[0]
                      touchTimerRef.current = window.setTimeout(() => {
                        openActionSheet(msg, touch?.clientX, touch?.clientY)
                      }, 450)
                    }}
                    onTouchEnd={clearTouchTimer}
                    onTouchMove={clearTouchTimer}
                    onTouchCancel={clearTouchTimer}
                  >
                    Right-click or hold for actions
                  </button>
                </div>
              </div>
            )
          })}
          <div ref={scrollRef} />
        </div>
      </div>

      <div className="border-t border-gray-200 p-4">
        {replyTarget ? (
          <div className="mb-2 flex items-center justify-between rounded-xl bg-gray-100 px-3 py-2 text-xs text-gray-700">
            <div className="truncate">Replying: {replyTarget.content || replyTarget.message || 'Message'}</div>
            <button onClick={() => setReplyTarget(null)} className="font-bold text-gray-500">Clear</button>
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="Type your message"
            rows={2}
            className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#7F77DD]"
          />
          <button
            onClick={submit}
            disabled={!text.trim() || sending}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#7F77DD] text-white hover:bg-[#6b63d2] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
      </div>

      <aside className="hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:block">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Conversation Details</h2>
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500">Shop</p>
            <p className="text-sm font-semibold text-gray-900">{conversation?.shop_name || conversation?.other_party_name || 'Unknown'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">Product Context</p>
            <p className="text-sm text-gray-700">{conversation?.product_name || 'General enquiry'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">Message Count</p>
            <p className="text-sm text-gray-700">{sortedMessages.length}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500">Quick Tips</p>
            <ul className="mt-1 space-y-1 text-xs text-gray-600">
              <li>Use right-click on a bubble for reactions and actions.</li>
              <li>Press Enter to send, Shift+Enter for new line.</li>
            </ul>
          </div>
        </div>
      </aside>

      {actionSheet ? (
        <div className="fixed inset-0 z-40" onClick={() => setActionSheet(null)}>
          <div
            className="absolute z-50 w-[270px] max-w-[92vw] rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl"
            style={{ left: Math.min(actionSheet.x, window.innerWidth - 290), top: Math.min(actionSheet.y, window.innerHeight - 240) }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex flex-wrap gap-1">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={`sheet-${emoji}`}
                  className="rounded-full bg-gray-100 px-2.5 py-1 text-sm hover:bg-gray-200"
                  onClick={async () => {
                    await toggleReaction(actionSheet.message, emoji)
                    setActionSheet(null)
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => {
                setReplyTarget(actionSheet.message)
                setActionSheet(null)
              }}
            >
              <Reply className="h-4 w-4" /> Reply
            </button>
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={async () => {
                await forwardMessage(actionSheet.message)
                setActionSheet(null)
              }}
            >
              <Forward className="h-4 w-4" /> Forward
            </button>
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={async () => {
                await copyMessage(actionSheet.message.content || actionSheet.message.message)
                setActionSheet(null)
              }}
            >
              <Copy className="h-4 w-4" /> Copy
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
