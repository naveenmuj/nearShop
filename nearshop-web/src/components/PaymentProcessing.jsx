import { useState, useEffect } from 'react'
import { Loader2, CheckCircle, AlertCircle, Clock, TrendingUp, Zap, ShieldAlert } from 'lucide-react'

const PaymentProcessing = ({ isProcessing, method, amount, orderNumber, onCancel }) => {
  const [step, setStep] = useState(1)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isProcessing) {
      setStep(1)
      setProgress(0)
      return
    }

    // Simulate payment processing steps
    const stepTimings = [1000, 2000, 3000]
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval)
          setStep(4) // Success
          return 100
        }
        return p + Math.random() * 30
      })
    }, 500)

    return () => clearInterval(interval)
  }, [isProcessing])

  if (!isProcessing) return null

  const methodColors = {
    razorpay: { text: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-300' },
    phonepe: { text: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-300' },
    gpay: { text: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-300' },
    cod: { text: 'text-green-600', bg: 'bg-green-100', border: 'border-green-300' },
  }

  const colors = methodColors[method] || methodColors.razorpay

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className={`${colors.bg} ${colors.text} p-6 text-center relative overflow-hidden`}>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-40 h-40 bg-gradient-to-r from-current to-transparent rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-gradient-to-l from-current to-transparent rounded-full blur-3xl"></div>
          </div>
          <div className="relative z-10">
            <p className="text-sm font-medium opacity-80 mb-1">Processing Payment</p>
            <h3 className="text-3xl font-bold">₹{Number(amount || 0).toLocaleString('en-IN')}</h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Order details */}
          <div className={`${colors.bg} rounded-lg p-4 mb-8 border ${colors.border}`}>
            <p className="text-xs text-gray-600 font-medium mb-1">Order Number</p>
            <p className={`${colors.text} font-bold text-lg`}>{orderNumber}</p>
          </div>

          {/* Payment method with animation */}
          <div className="mb-8">
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className={`w-12 h-12 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center animate-pulse`}>
                <Zap className="w-6 h-6" />
              </div>
              <div className="text-2xl">→</div>
              <div className={`w-12 h-12 rounded-full ${colors.bg} flex items-center justify-center`}>
                <div className="relative w-6 h-6">
                  <Loader2 className={`w-6 h-6 ${colors.text} animate-spin`} />
                </div>
              </div>
            </div>
          </div>

          {/* Progress bar with steps */}
          <div className="mb-8">
            <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
              <div
                className={`h-full bg-gradient-to-r ${colors.bg} to-opacity-50 rounded-full transition-all duration-300`}
                style={{ width: `${progress}%`, background: `linear-gradient(to right, #7c3aed, #ec4899)` }}
              />
            </div>
            <p className="text-xs text-gray-600 text-center font-medium">{Math.round(progress)}% Completed</p>
          </div>

          {/* Status messages with animations */}
          <div className="space-y-3">
            <PaymentStep icon={TrendingUp} label="Verifying payment details" isActive={progress > 0} isComplete={progress > 30} />
            <PaymentStep icon={ShieldAlert} label="Securing transaction" isActive={progress > 20} isComplete={progress > 60} />
            <PaymentStep icon={Clock} label="Confirming with gateway" isActive={progress > 40} isComplete={progress > 90} />
          </div>

          {/* Cancel button */}
          <button
            onClick={onCancel}
            disabled={progress > 80}
            className={`w-full mt-8 py-3 rounded-lg font-medium transition-all duration-200 ${
              progress > 80
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95'
            }`}
          >
            {progress > 80 ? 'Processing...' : 'Cancel Payment'}
          </button>
        </div>

        {/* Bottom accent bar */}
        <div className="h-1 bg-gradient-to-r from-purple-400 via-pink-500 to-blue-600"></div>
      </div>
    </div>
  )
}

const PaymentStep = ({ icon: Icon, label, isActive, isComplete }) => (
  <div className={`flex items-center gap-3 transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
    <div className="relative">
      {isComplete ? (
        <CheckCircle className="w-5 h-5 text-green-500 animate-bounce" />
      ) : isActive ? (
        <div className="relative w-5 h-5 animate-spin">
          <Loader2 className="w-5 h-5 text-purple-600" />
        </div>
      ) : (
        <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>
      )}
    </div>
    <p className={`text-sm font-medium ${isComplete ? 'text-green-600' : isActive ? 'text-purple-600' : 'text-gray-500'}`}>
      {label}
    </p>
  </div>
)

export default PaymentProcessing
