import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'
import { useLocationStore } from '../../store/locationStore'
import { create as createShop } from '../../api/shops'
import api from '../../api/client'
import { CATEGORIES } from '../../utils/constants'
import { Store, ChevronRight, ChevronLeft, Camera, MapPin, Phone, User, FileText, Truck, Upload } from 'lucide-react'

export default function BusinessOnboard() {
  const navigate = useNavigate()
  const { completeProfile } = useAuth()
  const { latitude, longitude, locationName, requestLocation } = useLocationStore()
  const fileInputRef = useRef(null)

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [logoPreview, setLogoPreview] = useState(null)
  const [logoFile, setLogoFile] = useState(null)

  const [form, setForm] = useState({
    name: '',
    shopName: '',
    category: '',
    phone: '',
    whatsapp: '',
    description: '',
    address: '',
    delivery: 'pickup', // pickup | delivery | both
  })

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const step1Valid = form.name.trim() && form.shopName.trim() && form.category && form.phone.trim()

  const handleLogoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return }
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setLogoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    if (!step1Valid) { toast.error('Please fill in all required fields'); return }
    setLoading(true)
    try {
      // Step 1: Complete user profile with business role
      await completeProfile({ name: form.name, role: 'business' })

      // Step 2: Upload logo if present
      let logoUrl = null
      if (logoFile) {
        try {
          const formData = new FormData()
          formData.append('file', logoFile)
          formData.append('folder', 'shops')
          const { data: uploadData } = await api.post('/upload', formData)
          logoUrl = uploadData.url || uploadData.file_url || null
        } catch {
          // Logo upload failed — continue without it
        }
      }

      // Step 3: Create shop with JSON payload
      const deliveryOpts = form.delivery === 'both' ? ['pickup', 'delivery'] : [form.delivery]
      const shopPayload = {
        name: form.shopName,
        category: form.category,
        phone: form.phone,
        latitude: latitude || 12.9352,
        longitude: longitude || 77.6245,
        description: form.description || undefined,
        address: form.address || undefined,
        whatsapp: form.whatsapp || undefined,
        logo_url: logoUrl || undefined,
        delivery_options: deliveryOpts,
      }

      await createShop(shopPayload)
      toast.success('Shop created successfully!')
      navigate('/biz')
    } catch (err) {
      const detail = err.response?.data?.detail
      const message = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail[0]?.msg || 'Validation error' : 'Failed to create shop'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-purple/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Store className="w-8 h-8 text-brand-purple" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Set Up Your Shop</h1>
          <p className="text-sm text-gray-500 mt-1">
            {step === 1 ? 'Start with the basics' : 'Add more details (optional)'}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={`h-2 w-12 rounded-full transition-colors ${step >= 1 ? 'bg-brand-purple' : 'bg-gray-200'}`} />
          <div className={`h-2 w-12 rounded-full transition-colors ${step >= 2 ? 'bg-brand-purple' : 'bg-gray-200'}`} />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {step === 1 && (
            <div className="space-y-4">
              {/* Owner Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Owner name"
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/40 focus:border-brand-purple transition"
                  />
                </div>
              </div>

              {/* Shop Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shop Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Your shop name"
                    value={form.shopName}
                    onChange={(e) => set('shopName', e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/40 focus:border-brand-purple transition"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.category}
                  onChange={(e) => set('category', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/40 focus:border-brand-purple transition bg-white appearance-none"
                >
                  <option value="">Select a category</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                  ))}
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/40 focus:border-brand-purple transition"
                  />
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!step1Valid}
                className="w-full flex items-center justify-center gap-2 bg-brand-purple text-white py-3 rounded-xl text-sm font-bold hover:bg-brand-purple-dark transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={handleSubmit}
                disabled={!step1Valid || loading}
                className="w-full text-sm text-gray-500 hover:text-brand-purple transition py-2"
              >
                Skip details &amp; create shop
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {/* Shop Logo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shop Logo</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-3 border-2 border-dashed border-gray-200 rounded-xl p-4 hover:border-brand-purple/40 transition"
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="w-14 h-14 rounded-xl object-cover" />
                  ) : (
                    <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center">
                      <Camera className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-700">{logoPreview ? 'Change logo' : 'Upload shop logo'}</p>
                    <p className="text-xs text-gray-400">JPG, PNG under 5 MB</p>
                  </div>
                </button>
              </div>

              {/* WhatsApp */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    placeholder="Same as phone or different"
                    value={form.whatsapp}
                    onChange={(e) => set('whatsapp', e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/40 focus:border-brand-purple transition"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <textarea
                    placeholder="Tell customers about your shop..."
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    rows={3}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/40 focus:border-brand-purple transition resize-none"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Shop address"
                    value={form.address}
                    onChange={(e) => set('address', e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/40 focus:border-brand-purple transition"
                  />
                </div>
                {!latitude && (
                  <button
                    type="button"
                    onClick={requestLocation}
                    className="mt-1.5 text-xs text-brand-purple font-medium hover:underline flex items-center gap-1"
                  >
                    <MapPin className="w-3 h-3" /> Use my current location
                  </button>
                )}
                {latitude && longitude && (
                  <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Location set{locationName ? `: ${locationName}` : ''}
                  </p>
                )}
              </div>

              {/* Delivery Option */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Option</label>
                <div className="flex gap-2">
                  {[
                    { value: 'pickup', label: 'Pickup Only' },
                    { value: 'delivery', label: 'Delivery Only' },
                    { value: 'both', label: 'Both' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set('delivery', opt.value)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition ${
                        form.delivery === opt.value
                          ? 'border-brand-purple bg-brand-purple/5 text-brand-purple'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center justify-center gap-1 px-5 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-brand-purple text-white py-3 rounded-xl text-sm font-bold hover:bg-brand-purple-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Creating...
                    </>
                  ) : (
                    <>Create Shop</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 mt-6">
          You can update all details later from your shop settings.
        </p>
      </div>
    </div>
  )
}
