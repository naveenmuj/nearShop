import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Send, Plus, Tag, Bell } from 'lucide-react'
import { getFestivals } from '../../api/marketing'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function FestivalCalendarPage() {
  const navigate = useNavigate()
  const [festivals, setFestivals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getFestivals().then(res => {
      const data = res.data?.festivals ?? res.data
      setFestivals(Array.isArray(data) ? data : [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const happening = festivals.filter(f => f.status === 'happening_now')
  const upcoming = festivals.filter(f => f.status === 'upcoming')

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-amber-500" /> Festival Calendar
        </h1>
        <p className="text-xs text-gray-400">Plan promotions around upcoming festivals</p>
      </div>

      <div className="px-4 mt-4 space-y-4">
        {festivals.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-5xl block mb-3">🎪</span>
            <p className="text-gray-500 font-medium">No upcoming festivals</p>
            <p className="text-xs text-gray-400 mt-1">Check back later for festival promotion ideas</p>
          </div>
        ) : (
          <>
            {happening.length > 0 && (
              <div>
                <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2">Happening Now!</p>
                {happening.map((f, i) => (
                  <FestivalCard key={i} festival={f} urgency="now" navigate={navigate} />
                ))}
              </div>
            )}
            {upcoming.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Upcoming</p>
                <div className="space-y-3">
                  {upcoming.map((f, i) => (
                    <FestivalCard key={i} festival={f} urgency={f.days_away <= 7 ? 'week' : 'month'} navigate={navigate} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function FestivalCard({ festival: f, urgency, navigate }) {
  const borderColor = urgency === 'now' ? 'border-red-300 bg-red-50' : urgency === 'week' ? 'border-amber-300 bg-amber-50' : 'border-gray-100 bg-white'
  const hasProducts = f.suggested_products?.length > 0
  const hasMissing = f.missing_categories?.length > 0

  return (
    <div className={`rounded-xl p-4 border shadow-sm mb-3 ${borderColor}`}>
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
          <span className="text-2xl">{f.emoji}</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900">{f.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {f.status === 'happening_now' ? 'Happening now!' : `${f.days_away} days away · ${new Date(f.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`}
          </p>
        </div>
        {urgency === 'now' && <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">LIVE</span>}
        {urgency === 'week' && <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">SOON</span>}
      </div>

      {/* AI Suggestion */}
      {f.deal_suggestion && (
        <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-start gap-2">
          <span className="text-sm">🤖</span>
          <p className="text-xs font-semibold text-indigo-700 leading-relaxed">{f.deal_suggestion}</p>
        </div>
      )}

      {/* Your matching products */}
      {hasProducts && (
        <div className="mt-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Your products for this festival</p>
          <div className="space-y-1">
            {f.suggested_products.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                <span className="text-gray-700">{p.name}</span>
                <span className="font-bold text-green-600">₹{Number(p.price).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missing categories opportunity */}
      {hasMissing && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs font-bold text-amber-800 mb-1">💡 Opportunity</p>
          <p className="text-xs text-amber-700">
            Add {f.missing_categories.join(', ')} products for {f.name} sales
          </p>
          <button onClick={() => navigate('/biz/snap')}
            className="mt-2 text-xs font-bold text-amber-800 bg-amber-200 px-3 py-1 rounded-md hover:bg-amber-300 transition-colors flex items-center gap-1 w-fit">
            <Plus className="w-3 h-3" /> Add Products
          </button>
        </div>
      )}

      {/* Category tags */}
      {f.suggested_categories?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {f.suggested_categories.map((cat, ci) => (
            <span key={ci} className="text-[10px] font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-md">{cat}</span>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mt-3">
        <button onClick={() => navigate('/biz/deals/new')} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-1">
          <Tag className="w-3 h-3" /> Create Deal
        </button>
        <button onClick={() => navigate('/biz/marketing')} className="flex-1 bg-white border border-gray-200 text-gray-700 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-gray-50 transition-colors">
          <Send className="w-3 h-3" /> WhatsApp
        </button>
        <button onClick={() => navigate('/biz/broadcast')} className="bg-white border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-gray-50 transition-colors">
          <Bell className="w-3 h-3" /> Notify
        </button>
      </div>
    </div>
  )
}
