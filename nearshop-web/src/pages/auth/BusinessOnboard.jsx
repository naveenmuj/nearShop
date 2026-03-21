import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { useAuth } from '../../hooks/useAuth'

export default function BusinessOnboard() {
  const [form, setForm] = useState({ name: '', shopName: '', category: '' })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { completeProfile } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await completeProfile({ ...form, role: 'business' })
      navigate('/biz')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-8">Set Up Your Shop</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Your Name" placeholder="Owner name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Shop Name" placeholder="Your shop name" value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} />
          <Input label="Category" placeholder="e.g. Electronics, Grocery" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <Button type="submit" className="w-full" disabled={loading || !form.name.trim() || !form.shopName.trim()}>
            {loading ? 'Creating...' : 'Create Shop'}
          </Button>
        </form>
      </div>
    </div>
  )
}
