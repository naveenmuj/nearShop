import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, Search, RefreshCw, Store } from 'lucide-react'
import { getConversations } from '../../api/messaging'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

function formatTime(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date
  if (diff < 60000) return 'Now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function CustomerMessagesPage() {
  const navigate = useNavigate()
  const [conversations, setConversations] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const loadConversations = useCallback(async () => {
    setBusy(true)
    try {
      const data = await getConversations(100, 0)
      const items = data?.items || []
      setConversations(items)
    } catch {
      setConversations([])
    } finally {
      setLoading(false)
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const filtered = conversations.filter((item) => {
    if (!query) return true
    const source = `${item.shop_name || ''} ${item.other_party_name || ''} ${item.last_message_preview || ''}`.toLowerCase()
    return source.includes(query.toLowerCase())
  })

  if (loading) {
    return <div className="flex items-center justify-center py-20"><LoadingSpinner size="lg" /></div>
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Messages</h1>
            <p className="text-sm text-gray-500">{conversations.length} active conversations</p>
          </div>
          <button
            onClick={loadConversations}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="flex h-11 max-w-xl items-center rounded-lg border border-gray-300 bg-white px-3">
          <Search className="mr-2 h-4 w-4 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by shop, message, or product"
            className="w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-500"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-14 text-center">
          <MessageSquare className="mx-auto h-9 w-9 text-gray-300" />
          <h3 className="mt-3 text-lg font-bold text-gray-900">No conversations yet</h3>
          <p className="mt-1 text-sm text-gray-500">Start a conversation from product or shop pages.</p>
          <button
            onClick={() => navigate('/app/search')}
            className="mt-4 rounded-lg bg-[#5b54c8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4d47b1]"
          >
            Browse Shops
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[860px] grid-cols-[52px_1.2fr_1fr_180px_100px] border-b border-gray-200 bg-gray-50 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <div />
            <div>Shop</div>
            <div>Latest Message</div>
            <div>Product</div>
            <div className="text-right">Updated</div>
          </div>
          {filtered.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(`/app/chat/${item.id}`)}
              className="grid w-full min-w-[860px] grid-cols-[52px_1.2fr_1fr_180px_100px] items-center border-b border-gray-100 px-6 py-3 text-left transition hover:bg-indigo-50/40"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEEDFE] text-[#534AB7]">
                <Store className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">{item.shop_name || item.other_party_name || 'Shop'}</p>
                <p className="truncate text-xs text-gray-500">Conversation #{item.id}</p>
              </div>
              <div className="min-w-0 pr-4">
                <p className={`truncate text-sm ${item.unread_count > 0 ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                  {item.last_message_preview || 'No messages yet'}
                </p>
              </div>
              <div className="min-w-0">
                {item.product_name ? <p className="truncate text-sm text-indigo-700">{item.product_name}</p> : <p className="text-sm text-gray-400">-</p>}
              </div>
              <div className="flex items-center justify-end gap-3">
                {item.unread_count > 0 ? <span className="rounded-full bg-[#5b54c8] px-2 py-0.5 text-xs font-semibold text-white">{item.unread_count > 9 ? '9+' : item.unread_count}</span> : null}
                <span className="text-xs text-gray-500">{formatTime(item.last_message_at)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
