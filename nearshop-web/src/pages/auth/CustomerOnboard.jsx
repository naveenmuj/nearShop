import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Camera, X, ChevronRight, Store } from 'lucide-react'
import { updateProfile } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'
import api from '../../api/client'

const INTERESTS = [
  'Clothing & Fashion', 'Electronics', 'Grocery & Daily Needs',
  'Food & Bakery', 'Home & Kitchen', 'Beauty & Personal Care',
  'Books & Stationery', 'Sports & Fitness', 'Jewelry & Accessories', 'Toys & Games',
]

export default function CustomerOnboard() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuthStore()

  const [name, setName] = useState(user?.name || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '')
  const [interests, setInterests] = useState([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef(null)

  const showPhone = !user?.phone

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'avatars')
      const { data } = await api.post('/upload', formData)
      setAvatarUrl(data.url)
    } catch {
      toast.error('Photo upload failed — you can add it later')
    } finally {
      setUploading(false)
    }
  }

  const toggleInterest = (item) => {
    setInterests(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('Please enter your name'); return }
    setLoading(true)
    try {
      const payload = {
        name: name.trim(),
        interests,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        ...(showPhone && phone.trim() ? { phone: phone.trim() } : {}),
      }
      const { data } = await updateProfile(payload)
      updateUser(data)
      toast.success(`Welcome to NearShop, ${name.trim()}! 🎉`)
      navigate('/app/home')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save profile')
    } finally {
      setLoading(false)
    }
  }

  const initials = name.trim() ? name.trim()[0].toUpperCase() : '?'

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-brand-purple to-brand-purple-dark rounded-2xl shadow-lg shadow-purple-200 mb-4">
            <span className="text-3xl">👋</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Welcome to NearShop!</h1>
          <p className="text-gray-500 text-sm">Set up your profile to get a personalised experience</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-24 h-24 rounded-full object-cover ring-4 ring-brand-purple/20" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-purple to-brand-purple-dark flex items-center justify-center text-white text-3xl font-bold ring-4 ring-brand-purple/20">
                  {initials}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </div>
              {avatarUrl && (
                <button type="button" onClick={(e) => { e.stopPropagation(); setAvatarUrl('') }}
                  className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition">
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <p className="text-xs text-gray-400">Click to add a photo (optional)</p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Your name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/10 outline-none transition text-gray-900"
            />
          </div>

          {/* Phone (only if not already set) */}
          {showPhone && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Phone number <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/10 outline-none transition text-gray-900"
              />
            </div>
          )}

          {/* Interests */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              What do you love? <span className="text-gray-400 font-normal">(optional — helps us personalise)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleInterest(item)}
                  className={`px-3.5 py-2 rounded-full text-sm font-medium transition border ${
                    interests.includes(item)
                      ? 'bg-brand-purple text-white border-brand-purple'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-brand-purple hover:text-brand-purple'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || uploading || !name.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-purple text-white rounded-xl font-bold text-base hover:bg-brand-purple-dark disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-purple-200"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>Start Shopping <ChevronRight className="w-5 h-5" /></>
            )}
          </button>

          {/* Register business link */}
          <button
            type="button"
            onClick={() => navigate('/auth/onboard/business')}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-500 hover:text-brand-green transition"
          >
            <Store className="w-4 h-4" />
            I also own a business — register it
          </button>
        </form>
      </div>
    </div>
  )
}
