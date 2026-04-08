import { useState, useEffect, useCallback } from 'react'
import { MessageSquare, Send, Search, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { getShopHaggles, sendOffer, acceptHaggle, rejectHaggle } from '../../api/haggle'
import useMyShop from '../../hooks/useMyShop'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  active: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export default function HaggleInboxPage() {
  const { shopId } = useMyShop()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [counterAmounts, setCounterAmounts] = useState({})
  const [acting, setActing] = useState(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const fetchSessions = useCallback(async () => {
    if (!shopId) return
    try {
      const { data } = await getShopHaggles(shopId)
      setSessions(data.items || data || [])
    } catch (err) {
      setError(err.message || 'Failed to load haggle sessions')
    } finally {
      setLoading(false)
    }
  }, [shopId])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  // Poll every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchSessions, 30000)
    return () => clearInterval(interval)
  }, [fetchSessions])

  const handleAccept = async (sessionId) => {
    setActing(sessionId)
    try {
      await acceptHaggle(sessionId)
      toast.success('Offer accepted!')
      fetchSessions()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to accept')
    } finally {
      setActing(null)
    }
  }

  const handleReject = async (sessionId) => {
    setActing(sessionId)
    try {
      await rejectHaggle(sessionId)
      toast.success('Offer rejected')
      fetchSessions()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reject')
    } finally {
      setActing(null)
    }
  }

  const handleCounter = async (sessionId) => {
    const amount = counterAmounts[sessionId]
    if (!amount || isNaN(parseFloat(amount))) {
      toast.error('Enter a valid counter amount')
      return
    }
    setActing(sessionId)
    try {
      await sendOffer(sessionId, { offer_amount: parseFloat(amount), message: `Counter offer: ₹${amount}` })
      toast.success('Counter offer sent!')
      setCounterAmounts((prev) => ({ ...prev, [sessionId]: '' }))
      fetchSessions()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send counter offer')
    } finally {
      setActing(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-4">
        <h1 className="text-2xl font-bold mb-4">Haggle Inbox</h1>
        <EmptyState icon={MessageSquare} title="Could not load sessions" message={error} action="Retry" onAction={fetchSessions} />
      </div>
    )
  }

  const visibleSessions = sessions.filter((session) => {
    const matchesStatus = statusFilter === 'all' ? true : session.status === statusFilter
    const source = `${session.product?.name || ''} ${session.customer?.name || ''}`.toLowerCase()
    const matchesQuery = query ? source.includes(query.toLowerCase()) : true
    return matchesStatus && matchesQuery
  })

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold text-gray-900">Haggle Inbox</h1>
          <button
            onClick={() => fetchSessions()}
            className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        <div className="mb-2 flex h-10 items-center rounded-xl bg-gray-100 px-3">
          <Search className="mr-2 h-4 w-4 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by customer or product"
            className="w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {['all', 'pending', 'active', 'accepted', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                statusFilter === status ? 'bg-[#7F77DD] text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {status[0].toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {visibleSessions.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No haggle requests" message="Customer price negotiations will appear here" />
      ) : (
        <>
        <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white lg:block">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Listed</th>
                <th className="px-4 py-3">Offer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleSessions.map((session) => (
                <tr key={session.id} className="align-top hover:bg-gray-50/70">
                  <td className="px-4 py-3 font-semibold text-gray-900">{session.product?.name || 'Product'}</td>
                  <td className="px-4 py-3 text-gray-700">{session.customer?.name || 'Customer'}</td>
                  <td className="px-4 py-3 text-gray-600">₹{session.product?.price || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-orange-700">₹{session.offer_amount}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[session.status] || 'bg-gray-100 text-gray-700'}`}>
                      {session.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {['pending', 'active'].includes(session.status) ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAccept(session.id)}
                            disabled={acting === session.id}
                            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleReject(session.id)}
                            disabled={acting === session.id}
                            className="rounded-md bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={counterAmounts[session.id] || ''}
                            onChange={(e) => setCounterAmounts((prev) => ({ ...prev, [session.id]: e.target.value }))}
                            placeholder="Counter"
                            className="w-28 rounded-md border border-gray-300 px-2 py-1 text-xs"
                          />
                          <button
                            onClick={() => handleCounter(session.id)}
                            disabled={acting === session.id}
                            className="inline-flex items-center gap-1 rounded-md bg-primary-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            <Send className="h-3.5 w-3.5" /> Counter
                          </button>
                        </div>
                      </div>
                    ) : <span className="text-xs text-gray-400">No actions</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 lg:hidden">
          {visibleSessions.map((session) => (
            <div key={session.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold">{session.product?.name || 'Product'}</p>
                  <p className="text-sm text-gray-500">From: {session.customer?.name || 'Customer'}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[session.status] || 'bg-gray-100 text-gray-700'}`}>
                  {session.status}
                </span>
              </div>

              <div className="text-sm text-gray-600 mb-3">
                <span>Listed: <strong>₹{session.product?.price || '—'}</strong></span>
                <span className="mx-2">|</span>
                <span>Offer: <strong className="text-orange-600">₹{session.offer_amount}</strong></span>
              </div>

              {/* Message history */}
              {session.messages && session.messages.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-2 mb-3 space-y-1">
                  {session.messages.map((msg, idx) => (
                    <div key={idx} className={`text-sm ${msg.sender === 'shop' ? 'text-right' : 'text-left'}`}>
                      <span className={`inline-block px-2 py-1 rounded-lg ${msg.sender === 'shop' ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-700'}`}>
                        {msg.message || `₹${msg.offer_amount}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              {['pending', 'active'].includes(session.status) && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleAccept(session.id)}
                      disabled={acting === session.id}
                      className="bg-green-500 text-white py-2 rounded-lg text-sm disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleReject(session.id)}
                      disabled={acting === session.id}
                      className="bg-red-100 text-red-600 py-2 rounded-lg text-sm disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={counterAmounts[session.id] || ''}
                      onChange={(e) => setCounterAmounts((prev) => ({ ...prev, [session.id]: e.target.value }))}
                      placeholder="Counter amount"
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                    />
                    <button
                      onClick={() => handleCounter(session.id)}
                      disabled={acting === session.id}
                      className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm flex items-center gap-1 disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Counter
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  )
}
