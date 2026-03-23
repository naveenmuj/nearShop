import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, X } from 'lucide-react'
import client from '../../api/client'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const PRIORITY_COLORS = {
  high: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700' },
  medium: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  low: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
}

const ACTION_LABELS = {
  discount_or_remove: { label: 'Apply Discount', to: '/biz/catalog' },
  reduce_price: { label: 'Edit Price', to: '/biz/catalog' },
  create_deal: { label: 'Create Deal', to: '/biz/deals/new' },
  add_product: { label: 'Add Product', to: '/biz/snap' },
  request_reviews: { label: 'Request Reviews', to: '/biz/broadcast' },
  update_catalog: { label: 'Update Catalog', to: '/biz/catalog' },
  share_shop: { label: 'Share Shop', to: '/biz/marketing' },
}

export default function AdvisorPage() {
  const navigate = useNavigate()
  const [suggestions, setSuggestions] = useState([])
  const [dismissed, setDismissed] = useState(new Set())
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await client.get('/advisor/suggestions')
      setSuggestions(Array.isArray(res.data) ? res.data : [])
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const visible = suggestions.filter((_, i) => !dismissed.has(i))

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">AI Business Advisor</h1>
            <p className="text-xs text-gray-400">{visible.length} suggestions for your shop</p>
          </div>
          <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100"><RefreshCw className="w-4 h-4 text-gray-500" /></button>
        </div>
      </div>

      <div className="px-4 mt-4 space-y-3">
        {visible.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-4xl">✨</span>
            <p className="text-gray-600 font-semibold mt-3">Looking good!</p>
            <p className="text-xs text-gray-400 mt-1">No suggestions right now. Check back later.</p>
          </div>
        ) : visible.map((s, i) => {
          const colors = PRIORITY_COLORS[s.priority] || PRIORITY_COLORS.low
          const action = ACTION_LABELS[s.action]
          return (
            <div key={i} className={`rounded-xl p-4 border shadow-sm ${colors.bg} ${colors.border}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <span className="text-xl flex-shrink-0">{s.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-gray-900">{s.title}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colors.badge}`}>{s.priority}</span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{s.body}</p>
                  </div>
                </div>
                <button onClick={() => setDismissed(p => new Set([...p, i]))} className="p-1 flex-shrink-0 ml-2">
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </div>
              {action && (
                <button onClick={() => navigate(action.to)}
                  className="mt-3 w-full bg-white/80 border border-gray-200 text-gray-700 py-2 rounded-lg text-xs font-bold hover:bg-white transition-colors">
                  {action.label} →
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
