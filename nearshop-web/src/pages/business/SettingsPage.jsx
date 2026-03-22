import { useState, useEffect } from 'react'
import { User, Store } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { getShop, updateShop, create as createShop } from '../../api/shops'
import useMyShop from '../../hooks/useMyShop'
import client from '../../api/client'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const CATEGORIES = [
  'grocery', 'electronics', 'clothing', 'footwear', 'pharmacy',
  'restaurant', 'furniture', 'jewellery', 'stationery', 'general',
]

function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ lat: 0, lng: 0 })
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: 0, lng: 0 }),
      { timeout: 5000 },
    )
  })
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, logout, switchRole } = useAuthStore()
  const { shop, shopId, loading: shopLoading } = useMyShop()
  const [switchingRole, setSwitchingRole] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    description: '',
    address: '',
    phone: '',
    whatsapp: '',
    category: 'general',
    delivery_options: ['pickup'],
    delivery_fee: '',
    free_delivery_above: '',
    delivery_radius: '',
    min_order: '',
  })

  // Populate form when shop loads
  useEffect(() => {
    if (shop) {
      setForm({
        name: shop.name || '',
        description: shop.description || '',
        address: shop.address || '',
        phone: shop.phone || '',
        whatsapp: shop.whatsapp || '',
        category: shop.category || 'general',
        delivery_options: shop.delivery_options || ['pickup'],
        delivery_fee: shop.delivery_fee ? String(shop.delivery_fee) : '',
        free_delivery_above: shop.free_delivery_above ? String(shop.free_delivery_above) : '',
        delivery_radius: shop.delivery_radius ? String(shop.delivery_radius) : '',
        min_order: shop.min_order ? String(shop.min_order) : '',
      })
    }
  }, [shop])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Shop name is required')
    setSaving(true)
    try {
      const { lat, lng } = await getLocation()
      await createShop({
        name: form.name.trim(),
        category: form.category,
        address: form.address || null,
        phone: form.phone || null,
        whatsapp: form.whatsapp || null,
        latitude: lat,
        longitude: lng,
      })
      toast.success('Shop created! You can now add products.')
      window.location.reload()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create shop')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        address: form.address || undefined,
        phone: form.phone || undefined,
        whatsapp: form.whatsapp || undefined,
        category: form.category,
        delivery_options: form.delivery_options,
        delivery_fee: form.delivery_fee ? Number(form.delivery_fee) : 0,
        free_delivery_above: form.free_delivery_above ? Number(form.free_delivery_above) : undefined,
        delivery_radius: form.delivery_radius ? Number(form.delivery_radius) : undefined,
        min_order: form.min_order ? Number(form.min_order) : undefined,
      }
      await updateShop(shopId, payload)
      toast.success('Settings saved!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const toggleDeliveryOpt = (key) => {
    setForm((p) => {
      const opts = p.delivery_options || []
      if (opts.includes(key)) {
        if (opts.length === 1) return p // keep at least one
        return { ...p, delivery_options: opts.filter((o) => o !== key) }
      }
      return { ...p, delivery_options: [...opts, key] }
    })
  }

  const hasDelivery = form.delivery_options?.includes('delivery')

  if (shopLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const inputClass = 'w-full bg-white border border-gray-200 rounded-xl h-12 px-4 text-sm outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-all'
  const selectClass = 'w-full bg-white border border-gray-200 rounded-xl h-12 px-4 text-sm outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-all'
  const textareaClass = 'w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-all resize-none min-h-[100px]'
  const labelClass = 'text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5'

  return (
    <div className="bg-gray-50 min-h-screen px-4 py-4 pb-12">
      <h1 className="text-xl font-bold text-gray-900 mb-5">⚙️ Settings</h1>

      {!shopId ? (
        /* CREATE SHOP */
        <div>
          <div className="bg-[#FAEEDA] border border-brand-amber rounded-2xl p-4 mb-5 flex items-start gap-3">
            <Store className="h-5 w-5 text-brand-amber flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-800">No shop yet</p>
              <p className="text-xs text-gray-500 mt-0.5">Create your shop to start listing products and accepting orders.</p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className={labelClass}>Shop Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className={inputClass}
                placeholder="e.g. Raj Electronics"
              />
            </div>
            <div>
              <label className={labelClass}>Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className={selectClass}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Address</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                className={inputClass}
                placeholder="Shop address"
              />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className={inputClass}
                placeholder="10-digit mobile number"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-brand-purple text-white rounded-xl h-12 px-8 font-semibold text-sm hover:bg-brand-purple-dark transition-colors disabled:opacity-60"
            >
              {saving ? 'Creating shop...' : 'Create My Shop'}
            </button>
          </form>
        </div>
      ) : (
        /* UPDATE SHOP */
        <>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Shop Details</p>
          <form onSubmit={handleUpdate} className="space-y-4 mb-6">
            <div>
              <label className={labelClass}>Shop Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className={selectClass}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className={textareaClass}
                placeholder="Describe your shop"
              />
            </div>
            <div>
              <label className={labelClass}>Address</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>WhatsApp Number</label>
              <input
                type="tel"
                value={form.whatsapp}
                onChange={(e) => setForm((p) => ({ ...p, whatsapp: e.target.value }))}
                className={inputClass}
              />
            </div>

            {/* Delivery Settings */}
            <div className="pt-4 mt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Delivery Settings</p>

              <div className="space-y-2 mb-4">
                {[
                  { key: 'pickup', label: 'Pickup', icon: '🏪', desc: 'Customer picks up from shop' },
                  { key: 'delivery', label: 'Delivery', icon: '🚚', desc: 'You deliver to customer' },
                ].map(({ key, label, icon, desc }) => {
                  const active = form.delivery_options?.includes(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleDeliveryOpt(key)}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${active ? 'border-[#5B2BE7]/40 bg-[#5B2BE7]/5' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                    >
                      <span className="text-xl">{icon}</span>
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${active ? 'text-[#5B2BE7]' : 'text-gray-700'}`}>{label}</p>
                        <p className="text-xs text-gray-400">{desc}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${active ? 'border-[#5B2BE7] bg-[#5B2BE7]' : 'border-gray-300'}`}>
                        {active && <span className="text-white text-xs">✓</span>}
                      </div>
                    </button>
                  )
                })}
              </div>

              {hasDelivery && (
                <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div>
                    <label className={labelClass}>Delivery Fee (₹)</label>
                    <input type="number" min="0" value={form.delivery_fee} onChange={(e) => setForm((p) => ({ ...p, delivery_fee: e.target.value }))} className={inputClass} placeholder="e.g. 30" />
                  </div>
                  <div>
                    <label className={labelClass}>Free Above (₹)</label>
                    <input type="number" min="0" value={form.free_delivery_above} onChange={(e) => setForm((p) => ({ ...p, free_delivery_above: e.target.value }))} className={inputClass} placeholder="e.g. 500" />
                  </div>
                  <div>
                    <label className={labelClass}>Radius (km)</label>
                    <input type="number" min="1" value={form.delivery_radius} onChange={(e) => setForm((p) => ({ ...p, delivery_radius: e.target.value }))} className={inputClass} placeholder="e.g. 5" />
                  </div>
                  <div>
                    <label className={labelClass}>Min. Order (₹)</label>
                    <input type="number" min="0" value={form.min_order} onChange={(e) => setForm((p) => ({ ...p, min_order: e.target.value }))} className={inputClass} placeholder="e.g. 100" />
                  </div>
                  {(form.delivery_fee || form.free_delivery_above) && (
                    <div className="col-span-2 bg-green-50 rounded-lg p-3 border border-green-100">
                      <p className="text-xs font-semibold text-green-700">
                        {form.delivery_fee && Number(form.delivery_fee) > 0 ? `₹${form.delivery_fee} delivery fee` : 'Free delivery'}
                        {form.free_delivery_above ? ` · Free above ₹${form.free_delivery_above}` : ''}
                        {form.delivery_radius ? ` · Within ${form.delivery_radius}km` : ''}
                        {form.min_order ? ` · Min order ₹${form.min_order}` : ''}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="bg-brand-purple text-white rounded-xl h-12 px-8 font-semibold text-sm hover:bg-brand-purple-dark transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>

          {shopId && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Shop QR Code</p>
              <div className="bg-white rounded-2xl shadow-card p-6 flex flex-col items-center">
                <img
                  src={`/api/v1/shops/${shopId}/qr-code`}
                  alt="QR Code"
                  className="w-48 h-48 rounded-2xl"
                  onError={(e) => { e.target.style.display = 'none' }}
                />
                <p className="text-xs text-gray-400 mt-3 text-center">Scan to visit your shop</p>
              </div>
            </div>
          )}
        </>
      )}

      <div className="pt-5 border-t border-gray-200 space-y-3 mt-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Account</p>
        <p className="text-sm text-gray-600">Owner: {user?.name || 'Not set'}</p>
        <Button
          variant="outline"
          disabled={switchingRole}
          onClick={async () => {
            setSwitchingRole(true)
            try {
              await client.post('/auth/switch-role', { role: 'customer' })
              switchRole('customer')
              navigate('/app/home')
            } catch (err) {
              toast.error(err.response?.data?.detail || 'Failed to switch role')
            } finally {
              setSwitchingRole(false)
            }
          }}
          className="w-full flex items-center justify-center gap-2"
        >
          <User className="h-4 w-4" />
          {switchingRole ? 'Switching...' : 'Switch to Customer'}
        </Button>
        <Button variant="danger" onClick={logout} className="w-full">Logout</Button>
      </div>
    </div>
  )
}
