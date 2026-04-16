import { useState } from 'react'
import { CreditCard, Smartphone, Wallet, ArrowRight, CheckCircle, AlertCircle, Loader2, Shield } from 'lucide-react'

const PaymentGatewaySelector = ({ selectedMethod, onMethodChange, amount, disabled = false }) => {
  const [hoveredCard, setHoveredCard] = useState(null)

  const paymentMethods = [
    {
      id: 'razorpay',
      name: 'Razorpay',
      description: 'Credit/Debit Card, UPI, Wallets',
      icon: CreditCard,
      color: 'from-purple-500 to-indigo-600',
      accentColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      features: ['Instant Payment', 'Secure', '200+ payment methods'],
      processingTime: 'Instant',
      fees: 'Included',
    },
    {
      id: 'phonepe',
      name: 'PhonePe',
      description: 'UPI, Cards, Wallet',
      icon: Smartphone,
      color: 'from-blue-500 to-cyan-600',
      accentColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      features: ['Instant Cashback', 'Safe & Secure', 'Fast payments'],
      processingTime: 'Instant',
      fees: 'Included',
    },
    {
      id: 'gpay',
      name: 'Google Pay',
      description: 'UPI, Cards, Google Account',
      icon: Wallet,
      color: 'from-blue-400 to-blue-600',
      accentColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      features: ['Saved cards', 'Transaction history', 'Secure'],
      processingTime: 'Instant',
      fees: 'Included',
    },
    {
      id: 'cod',
      name: 'Cash on Delivery',
      description: 'Pay when you receive',
      icon: CreditCard,
      color: 'from-green-500 to-emerald-600',
      accentColor: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      features: ['No online payment', 'Cancel anytime', 'Risk-free'],
      processingTime: 'On Delivery',
      fees: '₹10 (May apply)',
    },
  ]

  return (
    <div className="w-full">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Select Payment Method</h3>
        <p className="text-sm text-gray-600">Choose your preferred way to pay for your order</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {paymentMethods.map((method) => {
          const Icon = method.icon
          const isSelected = selectedMethod === method.id
          const isHovered = hoveredCard === method.id

          return (
            <div
              key={method.id}
              onClick={() => !disabled && onMethodChange(method.id)}
              onMouseEnter={() => setHoveredCard(method.id)}
              onMouseLeave={() => setHoveredCard(null)}
              className={`relative overflow-hidden rounded-2xl p-5 cursor-pointer transition-all duration-300 transform ${
                isSelected
                  ? `bg-gradient-to-br ${method.color} text-white shadow-xl scale-105`
                  : `${method.bgColor} border-2 ${method.borderColor} hover:shadow-lg ${isHovered ? 'scale-102' : ''}`
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {/* Background gradient overlay for selected */}
              {isSelected && (
                <div className="absolute inset-0 opacity-10 bg-white animate-pulse"></div>
              )}

              <div className="relative z-10">
                {/* Header with icon and check */}
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl ${isSelected ? 'bg-white/20' : method.bgColor} transition-all`}>
                    <Icon className={`w-6 h-6 ${isSelected ? 'text-white' : method.accentColor}`} />
                  </div>
                  {isSelected && (
                    <div className="animate-bounce">
                      <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>

                {/* Method name and description */}
                <h4 className={`font-bold text-lg mb-1 ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                  {method.name}
                </h4>
                <p className={`text-sm mb-4 ${isSelected ? 'text-white/80' : 'text-gray-600'}`}>
                  {method.description}
                </p>

                {/* Features */}
                <div className="space-y-2 mb-4">
                  {method.features.map((feature, idx) => (
                    <div key={idx} className={`flex items-center gap-2 text-xs ${isSelected ? 'text-white/90' : 'text-gray-700'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-gray-400'}`}></div>
                      {feature}
                    </div>
                  ))}
                </div>

                {/* Footer info */}
                <div className={`flex justify-between items-center pt-3 border-t ${isSelected ? 'border-white/20' : 'border-gray-200'}`}>
                  <div>
                    <p className={`text-xs font-medium ${isSelected ? 'text-white/70' : 'text-gray-500'}`}>Processing</p>
                    <p className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                      {method.processingTime}
                    </p>
                  </div>
                  {isSelected && (
                    <ArrowRight className="w-5 h-5 text-white animate-pulse" />
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Security badge */}
      <div className="mt-6 flex items-center justify-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
        <Shield className="w-5 h-5 text-green-600" />
        <span className="text-sm text-green-700 font-medium">
          All payments are secured and encrypted
        </span>
      </div>
    </div>
  )
}

export default PaymentGatewaySelector
