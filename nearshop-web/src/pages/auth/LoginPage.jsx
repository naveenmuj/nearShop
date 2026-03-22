import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  signInWithPopup,
  signInWithPhoneNumber,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  RecaptchaVerifier,
} from 'firebase/auth'
import { auth, googleProvider, appleProvider } from '../../config/firebase'
import { useAuthStore } from '../../store/authStore'
import api from '../../api/client'

const FRIENDLY_ERRORS = {
  'auth/user-not-found': 'No account found with this email. Try creating one!',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/email-already-in-use': 'This email is already registered. Try signing in instead.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Password must be at least 6 characters long.',
  'auth/too-many-requests': 'Too many failed attempts. Please wait a few minutes and try again.',
  'auth/invalid-credential': 'Invalid email or password. Please check and try again.',
  'auth/network-request-failed': 'Network error. Please check your internet connection.',
  'auth/popup-blocked': 'Pop-up was blocked. Please allow pop-ups for this site.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled.',
  'auth/invalid-phone-number': 'Invalid phone number format. Please check and try again.',
  'auth/missing-phone-number': 'Please enter a phone number.',
  'auth/quota-exceeded': 'Too many SMS messages sent. Please try again later.',
  'auth/captcha-check-failed': 'reCAPTCHA verification failed. Please try again.',
}

export default function LoginPage() {
  const [tab, setTab] = useState('phone')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('') // New: Success messages
  const [phoneValid, setPhoneValid] = useState(false) // New: Phone validation state
  const navigate = useNavigate()
  const { login } = useAuthStore()

  // Real-time phone validation
  const handlePhoneChange = (value) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 10)
    setPhone(cleaned)
    setPhoneValid(cleaned.length === 10)
    if (error) setError('') // Clear error on input change
  }

  // Real-time email validation
  const handleEmailChange = (value) => {
    setEmail(value)
    if (error) setError('') // Clear error on input change
  }

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {
          setSuccess('reCAPTCHA verified ✓')
          setTimeout(() => setSuccess(''), 2000)
        },
        'expired-callback': () => {
          setError('reCAPTCHA expired. Please try again.')
        }
      })
    }
    return window.recaptchaVerifier
  }

  const exchangeFirebaseToken = async (idToken) => {
    try {
      const { data } = await api.post('/auth/firebase-signin', { firebase_token: idToken })
      login(data.user, data.access_token)

      // Show success message before navigation
      setSuccess('✓ Signed in successfully!')

      // Small delay for better UX
      setTimeout(() => {
        if (data.is_new_user || !data.user.name) navigate('/auth/select-role')
        else if (data.user.active_role === 'business') navigate('/biz/dashboard')
        else navigate('/app/home')
      }, 500)
    } catch (err) {
      throw new Error(err.response?.data?.detail || 'Failed to complete sign-in')
    }
  }

  const handleSendOTP = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const appVerifier = setupRecaptcha()
      const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`
      setSuccess('Sending OTP via Firebase...')
      const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier)
      window.confirmationResult = confirmationResult
      sessionStorage.setItem('pendingPhone', formattedPhone)
      setSuccess('✓ OTP sent to your phone!')
      setTimeout(() => navigate('/auth/verify'), 800)
    } catch (err) {
      console.error('OTP Error:', err)
      setError(FRIENDLY_ERRORS[err.code] || err.message || 'Failed to send OTP. Please try again.')
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear()
        window.recaptchaVerifier = null
      }
    } finally {
      setLoading(false)
    }
  }

  const handleEmailAuth = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (isRegister && password !== confirmPassword) {
      setError('Passwords do not match. Please check and try again.')
      return
    }
    setLoading(true)
    try {
      setSuccess(isRegister ? 'Creating your account...' : 'Signing you in...')
      const result = isRegister
        ? await createUserWithEmailAndPassword(auth, email, password)
        : await signInWithEmailAndPassword(auth, email, password)
      await exchangeFirebaseToken(await result.user.getIdToken())
    } catch (err) {
      console.error('Email Auth Error:', err)
      setError(FRIENDLY_ERRORS[err.code] || err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSocial = async (provider, name) => {
    setError('')
    setSuccess('')
    setSocialLoading(name)
    try {
      setSuccess(`Opening ${name} sign-in...`)
      const result = await signInWithPopup(auth, provider)
      await exchangeFirebaseToken(await result.user.getIdToken())
    } catch (err) {
      console.error(`${name} Auth Error:`, err)
      if (err.code === 'auth/popup-closed-by-user') {
        setSuccess('') // Don't show error if user closed popup
      } else {
        setError(FRIENDLY_ERRORS[err.code] || err.message || `${name} sign-in failed`)
      }
    } finally {
      setSocialLoading('')
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — hero (desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#5B2BE7] via-[#7F77DD] to-[#38BDF8] flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute top-16 left-8 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-24 right-8 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
        <div className="relative text-center text-white z-10">
          <div className="text-8xl mb-6">🛍️</div>
          <h1 className="text-5xl font-extrabold mb-3 tracking-tight">NearShop</h1>
          <p className="text-xl text-white/75 mb-12 font-light">Your local marketplace, reimagined</p>
          <div className="space-y-5 text-left max-w-xs mx-auto">
            {[
              ['🏪', 'Discover shops around you'],
              ['🔥', 'Exclusive local deals & offers'],
              ['💬', 'Haggle prices with sellers'],
              ['📦', 'Real-time order tracking'],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-center gap-4">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">{icon}</span>
                </div>
                <span className="text-white/90 font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — auth */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4 sm:p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#5B2BE7] to-[#7F77DD] rounded-2xl shadow-lg mb-3">
              <span className="text-3xl">🛍️</span>
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900">NearShop</h1>
            <p className="text-gray-500 text-sm mt-0.5">Your local marketplace</p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              {tab === 'phone' ? 'Sign in with Phone' : isRegister ? 'Create account' : 'Welcome back'}
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              {tab === 'phone'
                ? "We'll send a one-time code to your number"
                : isRegister
                ? 'Fill in your details to get started'
                : 'Sign in to continue to NearShop'}
            </p>

            {/* Tab switcher */}
            <div className="flex bg-gray-100 rounded-2xl p-1 mb-5 gap-1">
              {[['phone', '📱 Phone OTP'], ['email', '✉️ Email']].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => { setTab(id); setError('') }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    tab === id ? 'bg-white shadow text-[#5B2BE7]' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Phone OTP form */}
            {tab === 'phone' && (
              <form onSubmit={handleSendOTP} className="mb-4">
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">Mobile Number</label>
                <div className="flex gap-2 mb-4">
                  <div className="flex items-center gap-2 px-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-600 text-sm font-semibold whitespace-nowrap">
                    🇮🇳 +91
                  </div>
                  <div className="relative flex-1">
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => handlePhoneChange(e.target.value)}
                      placeholder="98765 43210"
                      maxLength={10}
                      className={`w-full px-4 py-3 bg-gray-100 border rounded-xl focus:bg-white focus:ring-4 outline-none text-gray-900 transition-all ${
                        phone.length > 0
                          ? phoneValid
                            ? 'border-green-400 focus:border-green-500 focus:ring-green-100'
                            : 'border-amber-400 focus:border-amber-500 focus:ring-amber-100'
                          : 'border-transparent focus:border-[#5B2BE7] focus:ring-[#5B2BE7]/10'
                      }`}
                      required
                      autoComplete="tel"
                    />
                    {phone.length > 0 && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {phoneValid ? (
                          <span className="text-green-500 text-lg">✓</span>
                        ) : (
                          <span className="text-xs text-amber-600 font-medium">{10 - phone.length} more</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || !phoneValid}
                  className="w-full bg-gradient-to-r from-[#5B2BE7] to-[#7F77DD] text-white py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-purple-200 disabled:opacity-50 disabled:shadow-none hover:shadow-purple-300 hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed"
                >
                  {loading ? <SpinnerRow label="Sending OTP..." /> : 'Send OTP →'}
                </button>
                {!loading && phone.length > 0 && !phoneValid && (
                  <p className="mt-2 text-xs text-amber-600 flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>Please enter a valid 10-digit mobile number</span>
                  </p>
                )}
              </form>
            )}

            {/* Email form */}
            {tab === 'email' && (
              <form onSubmit={handleEmailAuth} className="mb-4">
                <div className="flex bg-gray-100 rounded-xl p-0.5 mb-4 gap-0.5">
                  {[['Sign In', false], ['Register', true]].map(([label, reg]) => (
                    <button key={label} type="button"
                      onClick={() => { setIsRegister(reg); setError(''); setSuccess('') }}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                        isRegister === reg ? 'bg-white shadow text-[#5B2BE7]' : 'text-gray-500'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="space-y-3 mb-4">
                  <input
                    type="email"
                    value={email}
                    onChange={e => handleEmailChange(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 bg-gray-100 border border-transparent rounded-xl focus:bg-white focus:border-[#5B2BE7] focus:ring-4 focus:ring-[#5B2BE7]/10 outline-none transition-all"
                    required
                    autoComplete="email"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); if (error) setError('') }}
                    placeholder="Password (min 6 chars)" minLength={6}
                    className="w-full px-4 py-3 bg-gray-100 border border-transparent rounded-xl focus:bg-white focus:border-[#5B2BE7] focus:ring-4 focus:ring-[#5B2BE7]/10 outline-none transition-all"
                    required
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                  />
                  {isRegister && (
                    <div className="relative">
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={e => { setConfirmPassword(e.target.value); if (error) setError('') }}
                        placeholder="Confirm password"
                        className={`w-full px-4 py-3 bg-gray-100 border rounded-xl focus:ring-4 outline-none transition-all ${
                          confirmPassword && confirmPassword !== password
                            ? 'border-red-400 focus:ring-red-100 bg-red-50'
                            : 'border-transparent focus:bg-white focus:border-[#5B2BE7] focus:ring-[#5B2BE7]/10'
                        }`}
                        required
                        autoComplete="new-password"
                      />
                      {confirmPassword && confirmPassword !== password && (
                        <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                          <span>⚠️</span>
                          <span>Passwords don't match</span>
                        </p>
                      )}
                      {confirmPassword && confirmPassword === password && confirmPassword.length >= 6 && (
                        <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                          <span>✓</span>
                          <span>Passwords match</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loading || !email || password.length < 6 || (isRegister && password !== confirmPassword)}
                  className="w-full bg-gradient-to-r from-[#5B2BE7] to-[#7F77DD] text-white py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-purple-200 disabled:opacity-50 disabled:shadow-none hover:shadow-purple-300 hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed"
                >
                  {loading
                    ? <SpinnerRow label={isRegister ? 'Creating account...' : 'Signing in...'} />
                    : isRegister ? 'Create Account →' : 'Sign In →'}
                </button>
              </form>
            )}

            {/* Divider */}
            <div className="flex items-center my-5">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="px-3 text-xs text-gray-400 font-medium">or continue with</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Social buttons */}
            <div className="space-y-3">
              <button
                onClick={() => handleSocial(googleProvider, 'Google')}
                disabled={!!socialLoading || loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border-2 border-gray-200 rounded-2xl hover:border-gray-300 hover:bg-gray-50 hover:-translate-y-0.5 transition-all font-semibold text-gray-700 text-sm disabled:opacity-60 active:scale-[0.98] shadow-sm"
              >
                {socialLoading === 'Google' ? <SpinnerRow label="Connecting..." color="text-gray-500" /> : (
                  <><GoogleIcon /> Continue with Google</>
                )}
              </button>

              <button
                onClick={() => handleSocial(appleProvider, 'Apple')}
                disabled={!!socialLoading || loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gray-900 text-white rounded-2xl hover:bg-black hover:-translate-y-0.5 transition-all font-semibold text-sm disabled:opacity-60 active:scale-[0.98] shadow-sm"
              >
                {socialLoading === 'Apple' ? <SpinnerRow label="Connecting..." /> : (
                  <><AppleIcon /> Continue with Apple</>
                )}
              </button>
            </div>

            {/* Success message */}
            {success && (
              <div className="mt-4 flex items-start gap-2.5 bg-green-50 border border-green-200 text-green-700 text-sm p-3.5 rounded-2xl animate-fade-in">
                <span className="mt-0.5">✓</span>
                <span className="font-medium">{success}</span>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="mt-4 flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-600 text-sm p-3.5 rounded-2xl animate-fade-in">
                <span className="mt-0.5">⚠️</span>
                <div className="flex-1">
                  <p className="font-medium">{error}</p>
                  {error.includes('network') && (
                    <p className="mt-1 text-xs text-red-500">Please check your internet connection and try again.</p>
                  )}
                  {error.includes('too many') && (
                    <p className="mt-1 text-xs text-red-500">For security, please wait a few minutes before trying again.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-gray-400 mt-5 leading-relaxed">
            By continuing, you agree to our{' '}
            <span className="text-[#5B2BE7] font-semibold cursor-pointer hover:underline">Terms</span>
            {' '}and{' '}
            <span className="text-[#5B2BE7] font-semibold cursor-pointer hover:underline">Privacy Policy</span>
          </p>
        </div>
      </div>

      <div id="recaptcha-container" />
    </div>
  )
}

function SpinnerRow({ label, color = 'text-white' }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <span className={`w-4 h-4 border-2 ${color} border-t-transparent rounded-full animate-spin`} />
      <span className={color}>{label}</span>
    </span>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  )
}
