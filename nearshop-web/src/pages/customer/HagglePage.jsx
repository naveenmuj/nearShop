import { useState, useEffect } from 'react'
import { Tag, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { getMyHaggles, sendOffer, acceptHaggle } from '../../api/haggle'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import { PageTransition } from '../../components/ui/PageTransition'

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  active: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  completed: 'bg-green-100 text-green-700',
}

export default function HagglePage() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [counterAmounts, setCounterAmounts] = useState({})
  const [acting, setActing] = useState(null)

  const fetchSessions = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await getMyHaggles()
      setSessions(data.items || data || [])
    } catch (err) {
      setError(err.message || 'Failed to load haggle sessions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  const handleSendOffer = async (sessionId) => {
    const amount = counterAmounts[sessionId]
    if (!amount || isNaN(parseFloat(amount))) {
      toast.error('Enter a valid counter offer')
      return
    }
    setActing(sessionId)
    try {
      await sendOffer(sessionId, { offer_amount: parseFloat(amount), message: `Counter offer: ₹${amount}` })
      toast.success('Counter offer sent!')
      setCounterAmounts((prev) => ({ ...prev, [sessionId]: '' }))
      fetchSessions()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send offer')
    } finally {
      setActing(null)
    }
  }

  const handleAccept = async (sessionId) => {
    setActing(sessionId)
    try {
      await acceptHaggle(sessionId)
      toast.success('Accepted!')
      fetchSessions()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to accept')
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
        <h1 className="text-2xl font-bold mb-4">My Haggle Sessions</h1>
        <EmptyState icon={Tag} title="Could not load sessions" message={error} action="Retry" onAction={fetchSessions} />
      </div>
    )
  }

  return (
    <PageTransition>
      <div className="px-4 py-4">
      <h1 className="mb-4 text-2xl font-bold">My Haggle Sessions</h1>

      {sessions.length === 0 ? (
        <EmptyState icon={Tag} title="No haggle sessions" message="Make an offer on a product to start negotiating" />
      ) : (
        <>
        <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white lg:block">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Shop</th>
                <th className="px-4 py-3">Your Offer</th>
                <th className="px-4 py-3">Counter</th>
                <th className="px-4 py-3">Listed</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sessions.map((session) => {
                const myOffer = session.messages?.find((m) => m.sender_role === 'customer')?.offer_amount
                const shopCounter = [...(session.messages || [])].reverse().find((m) => m.sender_role === 'shop')?.offer_amount
                return (
                  <tr key={session.id} className="align-top hover:bg-gray-50/70">
                    <td className="px-4 py-3 font-semibold text-gray-900">{session.product?.name || 'Product'}</td>
                    <td className="px-4 py-3 text-gray-700">{session.shop?.name || session.product?.shop?.name || '-'}</td>
                    <td className="px-4 py-3 text-indigo-700">{myOffer ? `₹${myOffer}` : '-'}</td>
                    <td className="px-4 py-3 text-orange-700">{shopCounter ? `₹${shopCounter}` : '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{session.listed_price ? `₹${session.listed_price}` : '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[session.status] || 'bg-gray-100 text-gray-700'}`}>
                        {session.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {['active', 'pending'].includes(session.status) ? (
                        <div className="space-y-2">
                          {shopCounter ? (
                            <button
                              onClick={() => handleAccept(session.id)}
                              disabled={acting === session.id}
                              className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              Accept ₹{shopCounter}
                            </button>
                          ) : null}
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={counterAmounts[session.id] || ''}
                              onChange={(e) => setCounterAmounts((prev) => ({ ...prev, [session.id]: e.target.value }))}
                              placeholder="Counter"
                              className="w-28 rounded-md border border-gray-300 px-2 py-1 text-xs"
                            />
                            <button
                              onClick={() => handleSendOffer(session.id)}
                              disabled={acting === session.id}
                              className="inline-flex items-center gap-1 rounded-md bg-primary-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              <Send className="h-3.5 w-3.5" /> Send
                            </button>
                          </div>
                        </div>
                      ) : <span className="text-xs text-gray-400">No actions</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 lg:hidden stagger-list">
          {sessions.map((session, idx) => (
            <div key={session.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-fade-in-up hover-lift smooth-transition"
              style={{animationDelay: `${idx * 50}ms`}}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold">{session.product?.name || 'Product'}</p>
                  <p className="text-sm text-gray-500">Shop: {session.shop?.name || session.product?.shop?.name || '—'}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[session.status] || 'bg-gray-100 text-gray-700'}`}>
                  {session.status}
                </span>
              </div>

              {/* Offer history */}
              {session.messages && session.messages.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-2 mb-3 space-y-1">
                  {session.messages.map((msg, idx) => (
                    <div key={idx} className={`text-sm ${msg.sender_role === 'customer' ? 'text-right' : 'text-left'}`}>
                      <span className={`inline-block px-2 py-1 rounded-lg ${msg.sender_role === 'customer' ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-700'}`}>
                        {msg.message || `₹${msg.offer_amount}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {(() => {
                const myOffer = session.messages?.find((m) => m.sender_role === 'customer')?.offer_amount
                const shopCounter = [...(session.messages || [])].reverse().find((m) => m.sender_role === 'shop')?.offer_amount
                return (
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                    {myOffer && <span>Your offer: <strong className="text-primary-600">₹{myOffer}</strong></span>}
                    {shopCounter && <span>| Counter: <strong className="text-orange-600">₹{shopCounter}</strong></span>}
                    {session.listed_price && <span className="ml-auto text-xs text-gray-400">Listed: ₹{session.listed_price}</span>}
                  </div>
                )
              })()}

              {/* Actions for active sessions */}
              {['active', 'pending'].includes(session.status) && (
                <div className="space-y-2">
                  {(() => {
                    const shopCounter = [...(session.messages || [])].reverse().find((m) => m.sender_role === 'shop')?.offer_amount
                    return shopCounter ? (
                      <button
                        onClick={() => handleAccept(session.id)}
                        disabled={acting === session.id}
                        className="w-full bg-green-500 text-white py-2 rounded-lg text-sm disabled:opacity-50 hover-scale smooth-transition"
                      >
                        Accept ₹{shopCounter}
                      </button>
                    ) : null
                  })()}
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={counterAmounts[session.id] || ''}
                      onChange={(e) => setCounterAmounts((prev) => ({ ...prev, [session.id]: e.target.value }))}
                      placeholder="Counter offer"
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                    />
                    <button
                      onClick={() => handleSendOffer(session.id)}
                      disabled={acting === session.id}
                      className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm flex items-center gap-1 disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send
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
    </PageTransition>
  )
}
