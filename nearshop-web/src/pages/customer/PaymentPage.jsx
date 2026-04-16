import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCartStore } from '../store/cartStore'
import { createOrder, createPaymentOrder, confirmPayment } from '../api/orders'
import PaymentGatewaySelector from '../components/PaymentGatewaySelector'
import PaymentProcessing from '../components/PaymentProcessing'
import PaymentSummary from '../components/PaymentSummary'
import { PageTransition } from '../components/ui/PageTransition'

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

const loadPhonePeScript = () => {
  return new Promise((resolve) => {
    if (window.PhonePe) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://mercury.phonepe.com/web/init' // PhonePe SDK URL
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

const loadGooglePayScript = () => {
  return new Promise((resolve) => {
    if (window.google?.payments?.api?.PaymentsClient) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://pay.google.com/gp/p/js/pay.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export default function PaymentPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const items = useCartStore((s) => s.items)
  const getSubtotal = useCartStore((s) => s.getSubtotal)

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('razorpay')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingMethod, setProcessingMethod] = useState(null)
  const [orderData, setOrderData] = useState(null)
  const [error, setError] = useState(null)
  const [showSummary, setShowSummary] = useState(false)

  // Get order data from previous checkout step
  const checkoutData = location.state?.checkoutData || {}
  const subtotal = checkoutData.subtotal ?? getSubtotal()
  const deliveryFee = checkoutData.deliveryFee ?? 0
  const discount = checkoutData.discount ?? 0
  const coupon = checkoutData.coupon ?? null
  const orderId = checkoutData.orderId // Optional: if order already created

  useEffect(() => {
    if (items.length === 0) {
      toast.error('No items in cart')
      navigate('/cart')
    }
  }, [items, navigate])

  // Handle Razorpay payment
  const handleRazorpayPayment = async () => {
    const scriptLoaded = await loadRazorpayScript()
    if (!scriptLoaded) {
      setError('Failed to load Razorpay. Please try again.')
      toast.error('Failed to load payment gateway')
      return
    }

    setIsProcessing(true)
    setProcessingMethod('razorpay')

    try {
      // Create order in your backend
      const orderResponse = await createOrder({
        items: items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
        })),
        payment_method: 'razorpay',
        delivery_fee: deliveryFee,
        discount: discount,
      })

      const orderId = orderResponse.data.id

      // Create Razorpay order
      const { data: paymentOrder } = await createPaymentOrder(orderId)

      const options = {
        key: paymentOrder.razorpay_key_id,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: 'NearShop',
        description: `Order #${paymentOrder.order_id}`,
        order_id: paymentOrder.razorpay_order_id,
        handler: async function (response) {
          try {
            await confirmPayment({
              order_id: orderId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            })
            
            toast.success('Payment successful!')
            setTimeout(() => {
              navigate('/orders')
            }, 2000)
          } catch (err) {
            setError('Payment verification failed. Please contact support.')
            toast.error('Payment verification failed')
            setIsProcessing(false)
          }
        },
        prefill: {
          contact: '',
        },
        theme: {
          color: '#7C3AED',
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false)
          },
        },
      }

      const razorpay = new window.Razorpay(options)
      razorpay.open()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to initiate payment')
      toast.error('Payment initiation failed')
      setIsProcessing(false)
    }
  }

  // Handle PhonePe payment
  const handlePhonePePayment = async () => {
    setIsProcessing(true)
    setProcessingMethod('phonepe')

    try {
      const phonePeKeyId = process.env.REACT_APP_PHONEPE_KEY_ID
      if (!phonePeKeyId) {
        throw new Error('PhonePe is not configured. Please add REACT_APP_PHONEPE_KEY_ID to .env')
      }

      // Create order first
      const orderResponse = await createOrder({
        items: items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
        })),
        payment_method: 'phonepe',
        delivery_fee: deliveryFee,
        discount: discount,
      })

      const phonePeOrderId = orderResponse.data.id

      // TODO: Integrate actual PhonePe SDK when credentials are available
      // const phonePeResponse = await initializePhonePePayment({ ... })
      // Verify payment response with backend before confirming

      // For now, show message to implement later
      toast.error('PhonePe integration pending. Please use Razorpay or UPI for now.')
      setIsProcessing(false)
      return
    } catch (err) {
      setError(err.message || 'PhonePe payment failed. Please try again.')
      toast.error(err.message || 'PhonePe payment failed')
      setIsProcessing(false)
    }
  }

  // Handle Google Pay payment
  const handleGooglePayPayment = async () => {
    setIsProcessing(true)
    setProcessingMethod('gpay')

    try {
      const googlePayKey = process.env.REACT_APP_GOOGLE_PAY_KEY
      if (!googlePayKey) {
        throw new Error('Google Pay is not configured. Please add REACT_APP_GOOGLE_PAY_KEY to .env')
      }

      // Create order first
      const orderResponse = await createOrder({
        items: items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
        })),
        payment_method: 'gpay',
        delivery_fee: deliveryFee,
        discount: discount,
      })

      const googlePayOrderId = orderResponse.data.id

      // TODO: Integrate actual Google Pay SDK when credentials are available
      // const gpayResponse = await initializeGooglePay({ ... })
      // Verify payment token with backend

      // For now, show message to implement later
      toast.error('Google Pay integration pending. Please use Razorpay or UPI for now.')
      setIsProcessing(false)
      return
    } catch (err) {
      setError(err.message || 'Google Pay payment failed. Please try again.')
      toast.error(err.message || 'Google Pay payment failed')
      setIsProcessing(false)
    }
  }

  // Handle payment based on selected method
  const handlePayment = async () => {
    setError(null)

    switch (selectedPaymentMethod) {
      case 'razorpay':
        await handleRazorpayPayment()
        break
      case 'phonepe':
        await handlePhonePePayment()
        break
      case 'gpay':
        await handleGooglePayPayment()
        break
      case 'cod':
        await handleCashOnDelivery()
        break
      default:
        setError('Invalid payment method selected')
    }
  }

  // Handle Cash on Delivery
  const handleCashOnDelivery = async () => {
    setIsProcessing(true)
    setProcessingMethod('cod')

    try {
      // Create order with COD payment method
      const orderResponse = await createOrder({
        items: items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
        })),
        payment_method: 'cod',
        delivery_fee: deliveryFee,
        discount: discount,
      })

      toast.success('Order placed successfully! Pay on delivery.')
      setTimeout(() => {
        navigate('/orders')
      }, 2000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to place order')
      toast.error('Order placement failed')
      setIsProcessing(false)
    }
  }

  if (items.length === 0) {
    return null
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors hover-lift smooth-transition"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Secure Payment</h1>
          <div className="w-12"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Payment Methods */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
              <PaymentGatewaySelector
                selectedMethod={selectedPaymentMethod}
                onMethodChange={setSelectedPaymentMethod}
                amount={subtotal + deliveryFee}
                disabled={isProcessing}
              />

              {/* Error Alert */}
              {error && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Security Info */}
              <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>🔒 Secure Payment:</strong> Your payment information is encrypted and secure. We never store your card details.
                </p>
              </div>

              {/* Pay Button */}
              <button
                onClick={handlePayment}
                disabled={isProcessing}
                className={`w-full mt-8 py-4 px-6 rounded-lg font-bold text-lg transition-all duration-300 transform ${
                  isProcessing
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg hover:scale-105 active:scale-95'
                }`}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing Payment...
                  </span>
                ) : (
                  `Pay ₹${Number(subtotal + deliveryFee).toLocaleString('en-IN')} Now`
                )}
              </button>

              {/* Alternative Options */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-600 text-center">
                  💡 <strong>Tip:</strong> Using digital payment methods is faster and safer than COD!
                </p>
              </div>
            </div>
          </div>

          {/* Right: Order Summary */}
          <div className="lg:col-span-1">
            <PaymentSummary
              items={items}
              subtotal={subtotal}
              deliveryFee={deliveryFee}
              discount={discount}
              coupon={coupon}
              paymentMethod={selectedPaymentMethod}
              onDetailsToggle={() => setShowSummary(!showSummary)}
            />

            {/* Additional Info Cards */}
            <div className="mt-6 space-y-4">
              {/* Estimated Delivery */}
              <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                <p className="text-xs text-gray-600 font-medium mb-2">ESTIMATED DELIVERY</p>
                <p className="text-lg font-bold text-gray-900">1-2 Days</p>
              </div>

              {/* Money Back Guarantee */}
              <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                <p className="text-xs text-gray-600 font-medium mb-2">MONEY BACK GUARANTEE</p>
                <p className="text-sm text-gray-700">If items are not as described, we offer 100% refund.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Processing Modal */}
      <PaymentProcessing
        isProcessing={isProcessing && selectedPaymentMethod !== 'cod'}
        method={processingMethod}
        amount={subtotal + deliveryFee}
        orderNumber={`ORD-${Date.now()}`}
        onCancel={() => setIsProcessing(false)}
      />
    </div>
    </PageTransition>
  )
}
