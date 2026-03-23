import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Star, Phone, MapPin, Clock, ExternalLink } from 'lucide-react'
import client from '../../api/client'

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN')

export default function ShopWebsite() {
  const { slug } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [catFilter, setCatFilter] = useState('All')

  useEffect(() => {
    client.get(`/shops/public/${slug}`)
      .then(res => setData(res.data))
      .catch(() => setError('Shop not found'))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="animate-spin w-8 h-8 border-4 border-[#1D9E75] border-t-transparent rounded-full" />
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-white text-center px-6">
      <div>
        <p className="text-6xl mb-4">🏪</p>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Shop Not Found</h1>
        <p className="text-sm text-gray-500">This shop may be closed or the link is incorrect.</p>
      </div>
    </div>
  )

  const { shop, products, reviews, deals } = data
  const categories = ['All', ...new Set(products.map(p => p.category).filter(Boolean))]
  const filtered = catFilter === 'All' ? products : products.filter(p => p.category === catFilter)

  return (
    <div className="min-h-screen bg-white max-w-lg mx-auto">
      {/* Cover */}
      <div className="relative h-48 bg-gradient-to-br from-[#1D9E75] to-[#2DB88A]">
        {shop.cover_image && <img src={shop.cover_image} alt="" className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      {/* Shop info */}
      <div className="px-5 -mt-12 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg p-5 border border-gray-100">
          <div className="flex items-start gap-3">
            {shop.logo_url ? (
              <img src={shop.logo_url} alt="" className="w-16 h-16 rounded-xl object-cover border-2 border-white shadow-sm" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-[#1D9E75] flex items-center justify-center text-white text-2xl font-bold shadow-sm">
                {shop.name[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-gray-900">{shop.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                {shop.is_verified && <span className="text-[10px] bg-[#1D9E75]/10 text-[#1D9E75] px-1.5 py-0.5 rounded font-bold">Verified</span>}
                <span className="text-xs text-gray-500">{shop.category}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                {shop.avg_rating > 0 && (
                  <>
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-semibold text-gray-700">{shop.avg_rating.toFixed(1)}</span>
                    <span className="text-xs text-gray-400">({shop.total_reviews} reviews)</span>
                  </>
                )}
              </div>
            </div>
          </div>
          {shop.description && <p className="text-sm text-gray-600 mt-3 leading-relaxed">{shop.description}</p>}

          {/* Contact buttons */}
          <div className="flex gap-2 mt-4">
            {shop.whatsapp && (
              <a href={`https://wa.me/${shop.whatsapp}`} target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 text-white py-2.5 rounded-xl text-sm font-bold">
                WhatsApp
              </a>
            )}
            {shop.phone && (
              <a href={`tel:${shop.phone}`}
                className="flex items-center justify-center gap-1.5 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold">
                <Phone className="w-4 h-4" /> Call
              </a>
            )}
            {shop.address && (
              <a href={`https://maps.google.com/?q=${encodeURIComponent(shop.address)}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold">
                <MapPin className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Deals */}
      {deals.length > 0 && (
        <div className="px-5 mt-5">
          <h2 className="text-sm font-bold text-gray-900 mb-2">Active Deals</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {deals.map((d, i) => (
              <div key={i} className="flex-shrink-0 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-center">
                <p className="text-lg font-extrabold text-red-600">{d.discount_pct}% OFF</p>
                <p className="text-xs text-gray-600 mt-0.5">{d.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Products */}
      <div className="px-5 mt-5">
        <h2 className="text-sm font-bold text-gray-900 mb-2">Products ({products.length})</h2>
        {categories.length > 2 && (
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2">
            {categories.map(c => (
              <button key={c} onClick={() => setCatFilter(c)}
                className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-semibold ${catFilter === c ? 'bg-[#1D9E75] text-white' : 'bg-gray-100 text-gray-500'}`}>{c}</button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          {filtered.map(p => {
            const disc = p.compare_price && p.compare_price > p.price ? Math.round((1 - p.price / p.compare_price) * 100) : null
            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="aspect-square bg-gray-50 relative">
                  {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : (
                    <div className="w-full h-full flex items-center justify-center text-3xl text-gray-200">📦</div>
                  )}
                  {disc && <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{disc}% OFF</span>}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-gray-900 line-clamp-2">{p.name}</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-sm font-bold text-gray-900">{formatPrice(p.price)}</span>
                    {p.compare_price && p.compare_price > p.price && (
                      <span className="text-[10px] text-gray-400 line-through">{formatPrice(p.compare_price)}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Reviews */}
      {reviews.length > 0 && (
        <div className="px-5 mt-6">
          <h2 className="text-sm font-bold text-gray-900 mb-2">Customer Reviews</h2>
          <div className="space-y-2.5">
            {reviews.map((r, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="flex gap-0.5 mb-1">
                  {[1,2,3,4,5].map(s => <Star key={s} className={`w-3 h-3 ${s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />)}
                </div>
                {r.comment && <p className="text-xs text-gray-600 leading-relaxed">{r.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Address + hours */}
      {shop.address && (
        <div className="px-5 mt-6">
          <div className="flex items-start gap-2.5 text-sm text-gray-600">
            <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <p>{shop.address}</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 py-6 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-400">Powered by <span className="font-bold text-[#1D9E75]">NearShop</span></p>
        <p className="text-[10px] text-gray-300 mt-1">Hyperlocal commerce platform</p>
      </div>
    </div>
  )
}
