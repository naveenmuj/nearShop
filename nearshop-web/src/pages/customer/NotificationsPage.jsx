import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellRing, CheckCheck, RefreshCw, ShoppingBag, MessageSquare, Trophy } from 'lucide-react'
import { getNotifications, markAllRead } from '../../api/notifications'
import { PageTransition } from '../../components/ui/PageTransition'

const timeAgo = (date) => {
  if (!date) return ''
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function iconForNotification(item) {
  const type = `${item?.type || ''}`.toLowerCase()
  if (type.includes('order')) return ShoppingBag
  if (type.includes('message') || type.includes('chat')) return MessageSquare
  if (type.includes('achievement') || type.includes('reward')) return Trophy
  return Bell
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('all')

  const fetchNotifications = useCallback(async () => {
    setBusy(true)
    try {
      const { data } = await getNotifications()
      const list = data?.items || data || []
      const sorted = [...list].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      setItems(sorted)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleMarkAllRead = async () => {
    try {
      await markAllRead()
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch {
      // no-op
    }
  }

  const unreadCount = useMemo(() => items.filter((item) => !item.is_read).length, [items])
  const filtered = useMemo(() => {
    if (filter === 'unread') return items.filter((item) => !item.is_read)
    return items
  }, [filter, items])

  const resolveNotificationTarget = (item) => {
    const type = `${item?.type || ''}`.toLowerCase()
    const metadata = item?.metadata || {}
    const conversationId = metadata.conversation_id || metadata.conversationId || item?.conversation_id
    const orderId = metadata.order_id || metadata.orderId || item?.order_id

    if ((type.includes('message') || type.includes('chat')) && conversationId) {
      return `/app/chat/${conversationId}`
    }
    if (type.includes('message') || type.includes('chat')) {
      return '/app/messages'
    }
    if (type.includes('order') && orderId) {
      return `/app/orders?highlight=${orderId}`
    }
    if (type.includes('order')) {
      return '/app/orders'
    }
    return null
  }

  const handleNotificationClick = (item) => {
    const target = resolveNotificationTarget(item)
    if (!target) return
    if (!item.is_read) {
      setItems((prev) => prev.map((n) => (String(n.id) === String(item.id) ? { ...n, is_read: true } : n)))
    }
    navigate(target)
  }

  return (
    <PageTransition>
      <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-extrabold text-gray-900">
              <BellRing className="h-5 w-5 text-[#7F77DD]" /> Notifications
            </h1>
            <p className="text-xs text-gray-500">{items.length} total · {unreadCount} unread</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchNotifications}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} /> Refresh
            </button>
            {unreadCount > 0 ? (
              <button
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 rounded-xl border border-[#7F77DD]/30 bg-[#EEEDFE] px-3 py-2 text-xs font-bold text-[#534AB7] hover:bg-[#e5e3ff]"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex gap-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'unread', label: 'Unread' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold hover-scale smooth-transition ${
                filter === tab.key ? 'bg-[#7F77DD] text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">Loading notifications...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm">
          <div className="mb-2 text-4xl">🔔</div>
          <h3 className="text-lg font-bold text-gray-900">No notifications</h3>
          <p className="mt-1 text-sm text-gray-500">You are all caught up.</p>
        </div>
      ) : (
        <div className="space-y-2 stagger-list">
          {filtered.map((item, idx) => {
            const Icon = iconForNotification(item)
            return (
              <button
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                className={`rounded-xl border p-3 shadow-sm transition animate-fade-in-up hover-lift smooth-transition ${
                  item.is_read ? 'border-gray-100 bg-white' : 'border-[#cfc9ff] bg-[#f5f3ff]'
                } ${resolveNotificationTarget(item) ? 'w-full text-left hover:border-[#b8b0ff]' : 'w-full text-left cursor-default'}`}
                style={{animationDelay: `${idx * 50}ms`}}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg ${item.is_read ? 'bg-gray-100 text-gray-600' : 'bg-white text-[#6b63d2]'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{item.title || item.message || 'Notification'}</p>
                    {item.message && item.title ? <p className="mt-0.5 text-sm text-gray-600">{item.message}</p> : null}
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
                      <span>{timeAgo(item.created_at)}</span>
                      {item.type ? <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-600">{String(item.type).replace(/_/g, ' ')}</span> : null}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
    </PageTransition>
  )
}
