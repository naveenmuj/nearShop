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
      await updateShop(shopId, form)
      toast.success('Settings saved!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

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
