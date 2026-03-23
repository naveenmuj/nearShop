import { useState, useEffect, useCallback } from 'react'
import { Send, Copy, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import useMyShop from '../../hooks/useMyShop'
import client from '../../api/client'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN')

export default function ReportsPage() {
  const { shopId } = useMyShop()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!shopId) return
    setLoading(true)
    try {
      const res = await client.get(`/shops/${shopId}/eod-report`, { params: { report_date: date } })
      setReport(res.data)
    } catch { setReport(null) } finally { setLoading(false) }
  }, [shopId, date])

  useEffect(() => { load() }, [load])

  const prevDay = () => {
    const d = new Date(date)
    d.setDate(d.getDate() - 1)
    setDate(d.toISOString().split('T')[0])
  }
  const nextDay = () => {
    const d = new Date(date)
    d.setDate(d.getDate() + 1)
    if (d <= new Date()) setDate(d.toISOString().split('T')[0])
  }

  const shareWA = () => {
    if (report?.whatsapp_text) window.open(`https://wa.me/?text=${encodeURIComponent(report.whatsapp_text)}`)
  }
  const copyText = () => {
    if (report?.whatsapp_text) { navigator.clipboard?.writeText(report.whatsapp_text); toast.success('Copied!') }
  }

  const isToday = date === new Date().toISOString().split('T')[0]
  const profit = report ? report.profit : 0
  const isProfit = profit >= 0

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">Daily Reports</h1>
        <p className="text-xs text-gray-400">End-of-day performance summary</p>
      </div>

      {/* Date picker */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex items-center justify-between">
          <button onClick={prevDay} className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
          <div className="text-center">
            <p className="text-sm font-bold text-gray-900">
              {new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            {isToday && <span className="text-[10px] font-bold text-[#1D9E75] bg-[#1D9E75]/10 px-2 py-0.5 rounded">Today</span>}
          </div>
          <button onClick={nextDay} disabled={isToday} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : !report ? (
        <div className="text-center py-16 px-4">
          <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No report available</p>
        </div>
      ) : (
        <div className="px-4 mt-4 space-y-4">
          {/* Report card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Profit/Loss header */}
            <div className={`px-5 py-4 ${isProfit ? 'bg-gradient-to-r from-[#1D9E75] to-[#2DB88A]' : 'bg-gradient-to-r from-red-500 to-red-400'} text-white`}>
              <p className="text-sm opacity-80">{isProfit ? 'Day\'s Profit' : 'Day\'s Loss'}</p>
              <p className="text-3xl font-extrabold mt-1">{formatPrice(Math.abs(profit))}</p>
            </div>

            {/* Metrics grid */}
            <div className="p-4 space-y-3">
              {[
                { label: 'Orders', value: report.orders, sub: `${report.cancelled} cancelled`, icon: '🛍️' },
                { label: 'Order Revenue', value: formatPrice(report.order_revenue), icon: '💰' },
                { label: 'Bills', value: report.bills, sub: formatPrice(report.bill_revenue), icon: '🧾' },
                { label: 'Total Revenue', value: formatPrice(report.total_revenue), icon: '📈' },
                { label: 'Expenses', value: formatPrice(report.expenses), icon: '💸' },
                { label: 'Customers', value: report.unique_customers, icon: '👥' },
              ].map(m => (
                <div key={m.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-b-0">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{m.icon}</span>
                    <span className="text-sm text-gray-600">{m.label}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{m.value}</p>
                    {m.sub && <p className="text-[10px] text-gray-400">{m.sub}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Share buttons */}
          <div className="flex gap-2">
            <button onClick={shareWA} className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl font-bold text-sm">
              <Send className="w-4 h-4" /> Share on WhatsApp
            </button>
            <button onClick={copyText} className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-4 py-3 rounded-xl font-bold text-sm">
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
