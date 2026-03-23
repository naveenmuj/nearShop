import { useState, useEffect, useCallback } from 'react'
import { Send, Users, Clock, Zap, Heart } from 'lucide-react'
import toast from 'react-hot-toast'
import { sendBroadcast, getSegments, getBroadcastHistory } from '../../api/broadcast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const SEGMENTS = [
  { key: 'all', label: 'All Customers', icon: '👥', desc: 'Everyone who ordered or follows you' },
  { key: 'recent', label: 'Recent (30d)', icon: '🕐', desc: 'Ordered in the last 30 days' },
  { key: 'inactive', label: 'Inactive', icon: '😴', desc: "Haven't ordered in 30+ days" },
  { key: 'followers', label: 'Followers', icon: '❤️', desc: 'People following your shop' },
]

const TEMPLATES = [
  { label: 'New Stock Alert', title: 'New Stock Alert!', body: 'Fresh stock just arrived! Come visit us today for great deals.' },
  { label: 'Flash Sale', title: 'Flash Sale!', body: 'Limited time offers at our shop. Hurry before stocks run out!' },
  { label: 'We Miss You', title: 'We miss you!', body: "It's been a while since your last visit. Come back for special returning customer offers!" },
  { label: 'Festival Greeting', title: 'Happy Festival!', body: 'Wishing you joy and happiness! Visit us for special festive deals and offers.' },
]

export default function BroadcastPage() {
  const [tab, setTab] = useState('compose')
  const [counts, setCounts] = useState({})
  const [segment, setSegment] = useState('all')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [segRes, histRes] = await Promise.allSettled([getSegments(), getBroadcastHistory()])
      if (segRes.status === 'fulfilled') setCounts(segRes.value.data || {})
      if (histRes.status === 'fulfilled') setHistory(Array.isArray(histRes.value.data) ? histRes.value.data : [])
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return toast.error('Title and message are required')
    setSending(true)
    try {
      const res = await sendBroadcast({ title: title.trim(), body: body.trim(), segment })
      toast.success(`Sent to ${res.data.sent} customers!`)
      setTitle(''); setBody('')
      await load()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to send')
    } finally { setSending(false) }
  }

  const applyTemplate = (t) => { setTitle(t.title); setBody(t.body) }

  const countForSegment = (key) => {
    const map = { all: 'all', recent: 'recent_30d', inactive: 'inactive_30d', followers: 'followers' }
    return counts[map[key]] ?? 0
  }

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">Broadcast Messages</h1>
        <p className="text-xs text-gray-400">Notify your customers</p>
        <div className="flex gap-2 mt-2">
          {[['compose', 'Compose'], ['history', 'History']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === k ? 'bg-[#1D9E75] text-white' : 'bg-gray-100 text-gray-500'}`}>{l}</button>
          ))}
        </div>
      </div>

      {tab === 'compose' && (
        <div className="px-4 mt-4 space-y-4">
          {/* Segment selector */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Target Audience</p>
            <div className="grid grid-cols-2 gap-2">
              {SEGMENTS.map(s => (
                <button key={s.key} onClick={() => setSegment(s.key)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${segment === s.key ? 'border-[#1D9E75] bg-[#1D9E75]/5' : 'border-gray-200 bg-white'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-lg">{s.icon}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${segment === s.key ? 'bg-[#1D9E75] text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {countForSegment(s.key)}
                    </span>
                  </div>
                  <p className={`text-xs font-semibold mt-1.5 ${segment === s.key ? 'text-[#1D9E75]' : 'text-gray-700'}`}>{s.label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Templates */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Quick Templates</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {TEMPLATES.map((t, i) => (
                <button key={i} onClick={() => applyTemplate(t)}
                  className="flex-shrink-0 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:border-[#1D9E75] hover:text-[#1D9E75] transition-colors">
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Compose */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm space-y-3">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Notification title"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#1D9E75]/20" />
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Your message..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#1D9E75]/20 resize-none min-h-[100px]" />
          </div>

          <button onClick={handleSend} disabled={sending || !title.trim() || !body.trim()}
            className="w-full bg-[#1D9E75] text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-[#178a65] transition-colors">
            <Send className="w-4 h-4" /> {sending ? 'Sending...' : `Send to ${countForSegment(segment)} customers`}
          </button>
        </div>
      )}

      {tab === 'history' && (
        <div className="px-4 mt-4 space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-12"><Send className="w-10 h-10 text-gray-200 mx-auto mb-3" /><p className="text-gray-500 font-medium">No broadcasts sent yet</p></div>
          ) : history.map(msg => (
            <div key={msg.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-start justify-between mb-1">
                <p className="text-sm font-bold text-gray-900">{msg.title}</p>
                <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                  {new Date(msg.sent_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{msg.body}</p>
              <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {msg.recipients} sent</span>
                <span className="capitalize">{msg.segment}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
