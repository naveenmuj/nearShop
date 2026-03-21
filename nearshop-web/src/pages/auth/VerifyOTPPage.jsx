import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import api from '../../api/client'

export default function VerifyOTPPage() {
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendTimer, setResendTimer] = useState(30)
  const inputs = useRef([])
  const navigate = useNavigate()
  const { login } = useAuthStore()

  const phone = sessionStorage.getItem('pendingPhone') || ''

  useEffect(() => {
    inputs.current[0]?.focus()
    if (!window.confirmationResult) navigate('/auth/login')
  }, [navigate])

  useEffect(() => {
    if (resendTimer <= 0) return
    const t = setTimeout(() => setResendTimer(v => v - 1), 1000)
    return () => clearTimeout(t)
  }, [resendTimer])

  const handleChange = (idx, val) => {
    if (!/^\d?$/.test(val)) return
    const next = [...otp]
    next[idx] = val
    setOtp(next)
    if (val && idx < 5) inputs.current[idx + 1]?.focus()
    if (next.every(d => d) && next.join('').length === 6) verifyOTP(next.join(''))
  }

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) inputs.current[idx - 1]?.focus()
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) { setOtp(text.split('')); verifyOTP(text) }
  }

  const verifyOTP = async (code) => {
    if (!window.confirmationResult) {
      setError('Session expired. Please go back and request a new OTP.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await window.confirmationResult.confirm(code)
      const idToken = await result.user.getIdToken()
      const { data } = await api.post('/auth/firebase-signin', { firebase_token: idToken })
      login(data.user, data.access_token)
      sessionStorage.removeItem('pendingPhone')
      window.confirmationResult = null
      if (data.is_new_user || !data.user.name) navigate('/auth/select-role')
      else if (data.user.active_role === 'business') navigate('/biz/dashboard')
      else navigate('/app/home')
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Invalid OTP. Please try again.')
      setOtp(['', '', '', '', '', ''])
      inputs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = () => {
    sessionStorage.removeItem('pendingPhone')
    window.confirmationResult = null
    if (window.recaptchaVerifier) { window.recaptchaVerifier.clear(); window.recaptchaVerifier = null }
    navigate('/auth/login')
  }

  const filled = otp.filter(Boolean).length

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <button
          onClick={() => navigate('/auth/login')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm font-medium mb-8 transition-colors group"
        >
          <span className="w-8 h-8 rounded-full bg-white shadow-sm border border-gray-200 flex items-center justify-center group-hover:shadow-md transition-all">←</span>
          Change number
        </button>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-[#5B2BE7] to-[#7F77DD] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-200">
              <span className="text-3xl">📱</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Verify OTP</h1>
            <p className="text-gray-400 text-sm mt-1.5">
              Code sent to <span className="font-semibold text-gray-700">{phone}</span>
            </p>
          </div>

          <div className="flex gap-2.5 justify-center mb-6" onPaste={handlePaste}>
            {otp.map((digit, idx) => (
              <input
                key={idx}
                ref={el => inputs.current[idx] = el}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(idx, e.target.value)}
                onKeyDown={e => handleKeyDown(idx, e)}
                disabled={loading}
                className={`w-12 h-14 text-center text-2xl font-bold border-2 rounded-2xl outline-none transition-all duration-200 ${
                  digit
                    ? 'border-[#5B2BE7] bg-[#5B2BE7]/5 text-[#5B2BE7]'
                    : 'border-gray-200 bg-gray-50 text-gray-900 focus:border-[#5B2BE7] focus:bg-white focus:ring-4 focus:ring-[#5B2BE7]/10'
                } ${loading ? 'opacity-60' : ''}`}
              />
            ))}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-6">
            <div
              className="bg-gradient-to-r from-[#5B2BE7] to-[#7F77DD] h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${(filled / 6) * 100}%` }}
            />
          </div>

          {loading && (
            <div className="text-center mb-4">
              <span className="inline-flex items-center gap-2 bg-[#5B2BE7]/5 text-[#5B2BE7] px-4 py-2 rounded-full text-sm font-semibold">
                <span className="w-4 h-4 border-2 border-[#5B2BE7] border-t-transparent rounded-full animate-spin" />
                Verifying OTP...
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-600 text-sm p-3.5 rounded-2xl mb-4">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="text-center">
            {resendTimer > 0 ? (
              <p className="text-sm text-gray-400">
                Resend in <span className="font-bold text-[#5B2BE7]">{resendTimer}s</span>
              </p>
            ) : (
              <button onClick={handleResend} className="text-[#5B2BE7] text-sm font-bold hover:underline">
                Resend OTP
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          Didn't receive it?{' '}
          <button onClick={handleResend} className="text-[#5B2BE7] font-semibold hover:underline">
            Go back
          </button>{' '}
          and try again
        </p>
      </div>
    </div>
  )
}
