import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { useAuth } from '../../hooks/useAuth'

export default function CustomerOnboard() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { completeProfile } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await completeProfile({ name, role: 'customer' })
      navigate('/app')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-8">Complete Your Profile</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Your Name" placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" className="w-full" disabled={loading || !name.trim()}>
            {loading ? 'Saving...' : 'Get Started'}
          </Button>
        </form>
      </div>
    </div>
  )
}
