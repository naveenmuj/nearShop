import { useState, useEffect, useCallback } from 'react'
import { Star, MessageSquare, Brain } from 'lucide-react'
import toast from 'react-hot-toast'
import useMyShop from '../../hooks/useMyShop'
import client from '../../api/client'
import { getReviewSentiment } from '../../api/ai'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function ReviewsPage() {
  const { shopId } = useMyShop()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState({})
  const [replying, setReplying] = useState(null)
  const [sentiment, setSentiment] = useState(null)
  const [sentimentLoading, setSentimentLoading] = useState(false)

  const handleReply = async (reviewId) => {
    const text = replyText[reviewId]?.trim()
    if (!text) { toast.error('Enter a reply'); return }
    setReplying(reviewId)
    try {
      await client.post(`/reviews/${reviewId}/reply`, { reply: text })
      toast.success('Reply posted!')
      setReplyText(prev => ({ ...prev, [reviewId]: '' }))
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reply')
    } finally {
      setReplying(null)
    }
  }

  const load = useCallback(async () => {
    if (!shopId) return
    try {
      const res = await client.get(`/reviews/shop/${shopId}`)
      const d = res.data
      setReviews(Array.isArray(d) ? d : d?.items ?? d?.reviews ?? [])
    } catch {} finally { setLoading(false) }
  }, [shopId])

  const loadSentiment = useCallback(async () => {
    if (!shopId) return
    setSentimentLoading(true)
    try {
      const res = await getReviewSentiment(shopId)
      setSentiment(res.data)
    } catch {} finally { setSentimentLoading(false) }
  }, [shopId])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadSentiment() }, [loadSentiment])

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1) : '0'

  const distribution = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => Math.round(r.rating) === star).length,
    pct: reviews.length > 0 ? Math.round((reviews.filter(r => Math.round(r.rating) === star).length / reviews.length) * 100) : 0,
  }))

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <div className="bg-white px-4 py-3 border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">Reviews</h1>
        <p className="text-xs text-gray-400">{reviews.length} total reviews</p>
      </div>

      <div className="px-4 mt-4 space-y-4">
        {/* Rating summary */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-4xl font-extrabold text-gray-900">{avgRating}</p>
              <div className="flex gap-0.5 mt-1 justify-center">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className={`w-4 h-4 ${i <= Math.round(avgRating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">{reviews.length} reviews</p>
            </div>
            <div className="flex-1 space-y-1.5">
              {distribution.map(d => (
                <div key={d.star} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-3">{d.star}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full">
                    <div className="h-2 bg-amber-400 rounded-full" style={{ width: `${d.pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 w-6 text-right">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Sentiment Insights */}
        {sentiment && sentiment.analysed_reviews > 0 && (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-100">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-5 h-5 text-indigo-600" />
              <p className="text-sm font-bold text-indigo-800">AI Sentiment Analysis</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                sentiment.overall_sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                sentiment.overall_sentiment === 'negative' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}>{sentiment.overall_sentiment}</span>
            </div>

            {sentiment.summary && (
              <p className="text-xs text-gray-600 leading-relaxed mb-3">{sentiment.summary}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sentiment.key_positives?.length > 0 && (
                <div className="bg-white rounded-lg p-3">
                  <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-1">Positives</p>
                  {sentiment.key_positives.map((p, i) => (
                    <p key={i} className="text-xs text-gray-700 py-0.5">✅ {p}</p>
                  ))}
                </div>
              )}
              {sentiment.key_negatives?.length > 0 && (
                <div className="bg-white rounded-lg p-3">
                  <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1">Needs Attention</p>
                  {sentiment.key_negatives.map((n, i) => (
                    <p key={i} className="text-xs text-gray-700 py-0.5">⚠️ {n}</p>
                  ))}
                </div>
              )}
            </div>

            {sentiment.improvement_suggestions?.length > 0 && (
              <div className="mt-3 bg-white rounded-lg p-3">
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">Suggestions</p>
                {sentiment.improvement_suggestions.map((s, i) => (
                  <p key={i} className="text-xs text-gray-700 py-0.5">💡 {s}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reviews list */}
        {reviews.length === 0 ? (
          <div className="text-center py-12">
            <Star className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No reviews yet</p>
            <p className="text-xs text-gray-400 mt-1">Reviews will appear here when customers leave feedback</p>
          </div>
        ) : reviews.map(review => (
          <div key={review.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#7F77DD] flex items-center justify-center text-white text-sm font-bold">
                  {(review.customer_name || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{review.customer_name || 'Customer'}</p>
                  <div className="flex gap-0.5 mt-0.5">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} className={`w-3 h-3 ${i <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
                    ))}
                  </div>
                </div>
              </div>
              <span className="text-xs text-gray-400">
                {review.created_at ? new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
              </span>
            </div>
            {review.comment && <p className="text-sm text-gray-600 mt-2.5 leading-relaxed">{review.comment}</p>}
            {(review.reply || review.shop_reply) ? (
              <div className="mt-2.5 bg-gray-50 rounded-lg p-3 border-l-2 border-[#1D9E75]">
                <p className="text-xs font-semibold text-[#1D9E75] mb-1">Your reply</p>
                <p className="text-xs text-gray-600">{review.reply || review.shop_reply}</p>
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={replyText[review.id] || ''}
                  onChange={(e) => setReplyText(prev => ({ ...prev, [review.id]: e.target.value }))}
                  placeholder="Write a reply..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand-purple focus:outline-none transition"
                />
                <button
                  onClick={() => handleReply(review.id)}
                  disabled={replying === review.id}
                  className="px-4 py-2 bg-brand-purple text-white rounded-lg text-sm font-semibold hover:bg-brand-purple-dark transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  {replying === review.id ? '...' : 'Reply'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
