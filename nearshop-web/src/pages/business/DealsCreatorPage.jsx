import { useState, useEffect } from 'react'
import { Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { getShopProducts } from '../../api/shops'
import useMyShop from '../../hooks/useMyShop'
import client from '../../api/client'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'

export default function DealsCreatorPage() {
  const navigate = useNavigate()
  const { shopId } = useMyShop()
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    product_id: '',
    discount_pct: '',
    expires_in_hours: '24',
  })

  useEffect(() => {
    if (!shopId) return
    getShopProducts(shopId, { limit: 50 })
      .then(({ data }) => setProducts(data.items || data || []))
      .catch(() => {})
      .finally(() => setLoadingProducts(false))
  }, [shopId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title) {
      toast.error('Title is required')
      return
    }
    setSubmitting(true)
    try {
      await client.post(`/deals?shop_id=${shopId}`, {
        title: form.title,
        description: form.description || undefined,
        product_id: form.product_id || undefined,
        discount_pct: form.discount_pct ? parseInt(form.discount_pct) : undefined,
        duration_hours: parseInt(form.expires_in_hours),
      })
      toast.success('Deal created!')
      navigate('/biz')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create deal')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="px-4 py-4">
      <h1 className="text-2xl font-bold mb-4">Create Deal</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Deal Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="e.g. Flash Sale — 30% off!"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            placeholder="Tell customers about this deal"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Discount (%)</label>
          <input
            type="number"
            value={form.discount_pct}
            onChange={(e) => setForm((p) => ({ ...p, discount_pct: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="e.g. 30"
            min="1"
            max="100"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Link to Product (optional)</label>
          {loadingProducts ? (
            <div className="text-sm text-gray-400 py-1">Loading products...</div>
          ) : (
            <select
              value={form.product_id}
              onChange={(e) => setForm((p) => ({ ...p, product_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">No specific product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — ₹{p.price}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Expires In</label>
          <select
            value={form.expires_in_hours}
            onChange={(e) => setForm((p) => ({ ...p, expires_in_hours: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="2">2 hours</option>
            <option value="6">6 hours</option>
            <option value="12">12 hours</option>
            <option value="24">24 hours</option>
            <option value="48">48 hours</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-primary-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Zap className="h-4 w-4" />
          {submitting ? 'Creating...' : 'Create Deal'}
        </button>
      </form>
    </div>
  )
}
