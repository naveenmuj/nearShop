import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, Search, RefreshCw, AlertTriangle } from 'lucide-react'
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

function getSlaTone(level) {
  if (level === 'high') return 'bg-rose-50 text-rose-700 border-rose-100'
  if (level === 'medium') return 'bg-amber-50 text-amber-700 border-amber-100'
  return 'bg-emerald-50 text-emerald-700 border-emerald-100'
}

export default function BusinessMessagesPage() {
  const navigate = useNavigate()
  const [conversations, setConversations] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [slaFilter, setSlaFilter] = useState('all')

  const loadConversations = useCallback(async () => {
    setBusy(true)
    try {
      const data = await getConversations(100, 0, { slaRiskLevel: slaFilter === 'all' ? null : slaFilter })
      setConversations(data?.items || [])
    } catch {
      setConversations([])
    } finally {
      setLoading(false)
      setBusy(false)
    }
  }, [slaFilter])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const filtered = useMemo(() => conversations.filter((item) => {
    if (!query) return true
    const source = `${item.other_party_name || ''} ${item.last_message_preview || ''} ${item.product_name || ''}`.toLowerCase()
    return source.includes(query.toLowerCase())
  }), [conversations, query])

  if (loading) {
    return <div className="flex items-center justify-center py-20"><LoadingSpinner size="lg" /></div>
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Customer Inbox</h1>
            <p className="text-sm text-gray-500">Operational chat queue with SLA priority.</p>
          </div>
          <button
            onClick={loadConversations}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {['all', 'high', 'medium', 'low'].map((level) => (
            <button
              key={level}
              onClick={() => setSlaFilter(level)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${slaFilter === level ? 'bg-gray-900 text-white' : 'border border-gray-300 bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {level.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex h-11 max-w-xl items-center rounded-lg border border-gray-300 bg-white px-3">
          <Search className="mr-2 h-4 w-4 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by customer or product"
            className="w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-500"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-14 text-center">
          <MessageSquare className="mx-auto h-9 w-9 text-gray-300" />
          <h3 className="mt-3 text-lg font-bold text-gray-900">No chats found</h3>
          <p className="mt-1 text-sm text-gray-500">Customer conversations will appear here when they message your shop.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[930px] grid-cols-[1.2fr_1fr_130px_120px_130px] border-b border-gray-200 bg-gray-50 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <div>Customer</div>
            <div>Latest Message</div>
            <div>SLA</div>
            <div>Unread</div>
            <div className="text-right">Updated</div>
          </div>
          {filtered.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(`/biz/chat/${item.id}`)}
              className="grid w-full min-w-[930px] grid-cols-[1.2fr_1fr_130px_120px_130px] items-center border-b border-gray-100 px-6 py-3 text-left transition hover:bg-teal-50/40"
            >
              <div className="min-w-0 pr-4">
                <p className="truncate text-sm font-semibold text-gray-900">{item.other_party_name || 'Customer'}</p>
                {item.product_name ? <p className="truncate text-xs text-indigo-700">Re: {item.product_name}</p> : <p className="text-xs text-gray-400">No product tag</p>}
              </div>
              <div className="min-w-0 pr-4">
                <p className={`truncate text-sm ${item.unread_count > 0 ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                  {item.last_message_preview || 'No messages yet'}
                </p>
              </div>
              <div>
                {item.sla_risk_level ? (
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getSlaTone(item.sla_risk_level)}`}>
                    <AlertTriangle className="h-3 w-3" />
                    {item.sla_risk_level.toUpperCase()}
                  </span>
                ) : <span className="text-xs text-gray-400">-</span>}
              </div>
              <div>
                {item.unread_count > 0 ? (
                  <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs font-semibold text-white">
                    {item.unread_count > 9 ? '9+' : item.unread_count}
                  </span>
                ) : <span className="text-xs text-gray-400">0</span>}
              </div>
              <div className="text-right text-xs text-gray-500">
                {formatTime(item.last_message_at)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
