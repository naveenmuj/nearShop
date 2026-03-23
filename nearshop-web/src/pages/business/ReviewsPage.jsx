import { useState, useEffect, useCallback } from 'react'
import { Star, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'
import useMyShop from '../../hooks/useMyShop'
import client from '../../api/client'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function ReviewsPage() {
  const { shopId } = useMyShop()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState({})
  const [replying, setReplying] = useState(null)

  const load = useCallback(async () => {
    if (!shopId) return
    try {
      const res = await client.get(`/shops/${shopId}/reviews`)
      const d = res.data
      setReviews(Array.isArray(d) ? d : d?.items ?? d?.reviews ?? [])
    } catch {} finally { setLoading(false) }
  }, [shopId])

  useEffect(() => { load() }, [load])

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
            {review.reply && (
              <div className="mt-2.5 bg-gray-50 rounded-lg p-3 border-l-2 border-[#1D9E75]">
                <p className="text-xs font-semibold text-[#1D9E75] mb-1">Your reply</p>
                <p className="text-xs text-gray-600">{review.reply}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
