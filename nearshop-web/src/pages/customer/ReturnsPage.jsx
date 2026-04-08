import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { getMyReturns } from '../../api/returns'

const STATUS = ['all', 'pending', 'approved', 'processing', 'rejected', 'completed']
const tone = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  processing: 'bg-blue-50 text-blue-700',
  rejected: 'bg-red-50 text-red-700',
  completed: 'bg-emerald-50 text-emerald-700',
}

export default function ReturnsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await getMyReturns(status === 'all' ? null : status)
      setItems(data?.items || data || [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => { load() }, [load])

  const countByStatus = useMemo(() => STATUS.reduce((acc, s) => {
    acc[s] = s === 'all' ? items.length : items.filter((i) => i.status === s).length
    return acc
  }, {}), [items])

  return (
    <div className="desktop-panel overflow-hidden">
      <div className="desktop-toolbar px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Returns</h1>
            <p className="text-sm text-gray-500">Track return approvals and refunds.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/app/returns/request')} className="rounded-lg bg-[#3f5efb] px-4 py-2 text-sm font-semibold text-white hover:bg-[#334ed4]">Request Return</button>
            <button onClick={load} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"><RefreshCw className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {STATUS.map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${status === s ? 'bg-gray-900 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {s.toUpperCase()} ({countByStatus[s] || 0})
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="p-8 text-sm text-gray-500">Loading returns...</div> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Shop</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Refund</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No returns found.</td></tr>
              ) : items.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/70">
                  <td className="px-4 py-3 font-semibold text-gray-900">{r.item_name}</td>
                  <td className="px-4 py-3 text-gray-700">{String(r.reason || '').replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-gray-700">{r.shop_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.requested_at ? new Date(r.requested_at).toLocaleDateString('en-IN') : '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{r.refund_amount ? `₹${r.refund_amount}` : '-'}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${tone[r.status] || 'bg-gray-100 text-gray-600'}`}>{r.status || 'pending'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
