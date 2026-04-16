import { useState } from 'react'
import { ChevronDown, TrendingDown, Gift, Truck, Tag } from 'lucide-react'

const PaymentSummary = ({ items, subtotal, deliveryFee, discount, coupon, paymentMethod, onDetailsToggle }) => {
  const [showDetails, setShowDetails] = useState(false)

  const handleToggle = () => {
    setShowDetails(!showDetails)
    onDetailsToggle?.()
  }

  const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN')
  const grandTotal = subtotal + deliveryFee - discount

  const paymentColors = {
    razorpay: { icon: '💳', name: 'Razorpay' },
    phonepe: { icon: '📱', name: 'PhonePe' },
    gpay: { icon: '💰', name: 'Google Pay' },
    cod: { icon: '🚚', name: 'Cash on Delivery' },
  }

  const methodInfo = paymentColors[paymentMethod] || paymentColors.razorpay

  return (
    <div className="w-full bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl overflow-hidden shadow-sm border border-gray-200 transition-all duration-300">
      {/* Collapsible Header */}
      <button
        onClick={handleToggle}
        className="w-full p-5 flex items-center justify-between hover:bg-gray-100 active:scale-98 transition-all duration-200"
      >
        <div className="flex items-center gap-3 text-left">
          <div className="text-2xl">{methodInfo.icon}</div>
          <div>
            <p className="text-xs text-gray-600 font-medium">Order Summary</p>
            <p className="text-xl font-bold text-gray-900">{formatPrice(grandTotal)}</p>
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-600 transition-transform duration-300 ${showDetails ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expandable Details */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          showDetails ? 'max-h-96' : 'max-h-0'
        }`}
      >
        <div className="px-5 pb-5 border-t border-gray-200 space-y-4">
          {/* Items breakdown */}
          {items && items.length > 0 && (
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm font-semibold text-gray-900 mb-3">Items ({items.length})</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="text-gray-700">{item.name || 'Item'} x {item.quantity}</span>
                    <span className="font-medium text-gray-900">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Price breakdown with icons */}
          <div className="space-y-3">
            {/* Subtotal */}
            <div className="flex justify-between items-center p-3 bg-white rounded-lg hover:bg-blue-50 transition-colors">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <Tag className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-sm text-gray-700 font-medium">Subtotal</span>
              </div>
              <span className="font-semibold text-gray-900">{formatPrice(subtotal)}</span>
            </div>

            {/* Delivery Fee */}
            {deliveryFee > 0 && (
              <div className="flex justify-between items-center p-3 bg-white rounded-lg hover:bg-green-50 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <Truck className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-sm text-gray-700 font-medium">Delivery Fee</span>
                </div>
                <span className="font-semibold text-gray-900">+ {formatPrice(deliveryFee)}</span>
              </div>
            )}

            {/* Discount */}
            {discount > 0 && (
              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200 hover:shadow-md transition-all">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center animate-bounce">
                    <TrendingDown className="w-4 h-4 text-green-700" />
                  </div>
                  <div>
                    <span className="text-sm text-gray-700 font-medium block">Discount Applied</span>
                    {coupon && <span className="text-xs text-green-700 font-semibold">{coupon.code}</span>}
                  </div>
                </div>
                <span className="font-bold text-green-700">- {formatPrice(discount)}</span>
              </div>
            )}

            {/* Payment Method Badge */}
            <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center">
                  <Gift className="w-4 h-4 text-purple-700" />
                </div>
                <span className="text-sm text-gray-700 font-medium">Payment Method</span>
              </div>
              <span className="font-semibold text-purple-700">{methodInfo.name}</span>
            </div>
          </div>

          {/* Grand Total */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center p-4 bg-gradient-to-r from-gray-900 to-gray-800 rounded-lg text-white">
              <span className="text-lg font-bold">Total Amount</span>
              <div className="text-right">
                <p className="text-sm opacity-80 mb-1">You pay</p>
                <p className="text-2xl font-bold">{formatPrice(grandTotal)}</p>
              </div>
            </div>
          </div>

          {/* Savings badge */}
          {discount > 0 && (
            <div className="px-4 py-2 bg-green-100 border border-green-300 rounded-lg text-center">
              <p className="text-sm font-bold text-green-700">
                ✨ You saved {formatPrice(discount)}!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PaymentSummary
