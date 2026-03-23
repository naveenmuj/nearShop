import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Send } from 'lucide-react'
import { getFestivals } from '../../api/marketing'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function FestivalCalendarPage() {
  const navigate = useNavigate()
  const [festivals, setFestivals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getFestivals().then(res => {
      setFestivals(Array.isArray(res.data) ? res.data : [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const happening = festivals.filter(f => f.status === 'happening_now')
  const upcoming = festivals.filter(f => f.status === 'upcoming')

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">Festival Calendar</h1>
        <p className="text-xs text-gray-400">Plan promotions around upcoming festivals</p>
      </div>

      <div className="px-4 mt-4 space-y-4">
        {festivals.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No upcoming festivals</p>
            <p className="text-xs text-gray-400 mt-1">Check back later for festival promotion ideas</p>
          </div>
        ) : (
          <>
            {happening.length > 0 && (
              <div>
                <p className="text-xs font-bold text-red-500 uppercase mb-2">Happening Now!</p>
                {happening.map((f, i) => (
                  <FestivalCard key={i} festival={f} urgency="now" navigate={navigate} />
                ))}
              </div>
            )}
            {upcoming.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Upcoming</p>
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
  return (
    <div className={`rounded-xl p-4 border shadow-sm mb-3 ${borderColor}`}>
      <div className="flex items-start gap-3">
        <span className="text-3xl">{f.emoji}</span>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900">{f.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {f.status === 'happening_now' ? 'Happening now!' : `${f.days_away} days away · ${f.date}`}
          </p>
          <p className="text-xs text-[#1D9E75] font-medium mt-1">{f.suggestion}</p>
        </div>
        {urgency === 'now' && <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">LIVE</span>}
        {urgency === 'week' && <span className="text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">SOON</span>}
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={() => navigate('/biz/deals/new')} className="flex-1 bg-[#1D9E75] text-white py-2 rounded-lg text-xs font-bold">Create Deal</button>
        <button onClick={() => navigate('/biz/marketing')} className="flex-1 bg-white border border-gray-200 text-gray-700 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1">
          <Send className="w-3 h-3" /> Share Post
        </button>
        <button onClick={() => navigate('/biz/broadcast')} className="bg-white border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-xs font-bold">Notify</button>
      </div>
    </div>
  )
}
