import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { approveReturn, getShopReturns, markReturnCompleted, markReturnProcessing, rejectReturn } from '../../api/returns'

const STATUSES = ['pending', 'approved', 'processing', 'rejected', 'completed']

export default function BusinessReturnsPage() {
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await getShopReturns(status, 100, 0)
      setItems(data?.items || data || [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => { load() }, [load])

  const action = async (id, type) => {
    setActing(id + type)
    try {
      if (type === 'approve') await approveReturn(id)
      if (type === 'reject') await rejectReturn(id, 'Rejected by shop')
      if (type === 'process') await markReturnProcessing(id)
      if (type === 'complete') await markReturnCompleted(id)
      toast.success('Return updated')
      await load()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to update return')
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="desktop-panel overflow-hidden">
      <div className="desktop-toolbar px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Return Requests</h1>
        <p className="text-sm text-gray-500">Handle customer return workflows with status actions. {items.length} requests in {status}.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${status === s ? 'bg-gray-900 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="p-6 text-sm text-gray-500">Loading returns...</div> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr><th className="px-4 py-3">Item</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Requested</th><th className="px-4 py-3">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No returns in this status.</td></tr>
              ) : items.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/70">
                  <td className="px-4 py-3 font-semibold text-gray-900">{r.item_name}</td>
                  <td className="px-4 py-3 text-gray-700">{String(r.reason || '').replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-gray-700">{r.item_quantity || 1}</td>
                  <td className="px-4 py-3 text-gray-700">₹{r.item_price || 0}</td>
                  <td className="px-4 py-3 text-gray-500">{r.requested_at ? new Date(r.requested_at).toLocaleDateString('en-IN') : '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {r.status === 'pending' ? (
                        <>
                          <button onClick={() => action(r.id, 'approve')} disabled={acting === r.id + 'approve'} className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Approve</button>
                          <button onClick={() => action(r.id, 'reject')} disabled={acting === r.id + 'reject'} className="rounded-md bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-200 disabled:opacity-50">Reject</button>
                        </>
                      ) : null}
                      {r.status === 'approved' ? <button onClick={() => action(r.id, 'process')} disabled={acting === r.id + 'process'} className="rounded-md border border-blue-300 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">Mark Processing</button> : null}
                      {r.status === 'processing' ? <button onClick={() => action(r.id, 'complete')} disabled={acting === r.id + 'complete'} className="rounded-md border border-emerald-300 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">Mark Completed</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
