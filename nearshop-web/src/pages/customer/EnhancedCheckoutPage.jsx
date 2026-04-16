import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ShoppingCart, MapPin, Truck, Store, CreditCard, FileText, ArrowLeft, CheckCircle, Loader2, Package, Tag, Plus, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCartStore } from '../../store/cartStore'
import { useLocationStore } from '../../store/locationStore'
import { createOrder, createPaymentOrder, confirmPayment } from '../../api/orders'
import { checkDeliveryEligibility } from '../../api/delivery'
import { validateCoupon, useCoupon as recordCouponUse } from '../../api/deals'
import { listAddresses, createAddress } from '../../api/auth'
import PaymentGatewaySelector from '../../components/PaymentGatewaySelector'
import PaymentProcessing from '../../components/PaymentProcessing'
import PaymentSummary from '../../components/PaymentSummary'
import { PageTransition } from '../../components/ui/PageTransition'

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN')

// Load Razorpay script dynamically
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

export default function EnhancedCheckoutPage() {
  const navigate = useNavigate()
  const items = useCartStore((s) => s.items)
  const getShopGroups = useCartStore((s) => s.getShopGroups)
  const getSubtotal = useCartStore((s) => s.getSubtotal)
  const clearShopItems = useCartStore((s) => s.clearShopItems)
  const { latitude, longitude, locationName } = useLocationStore()

  const [shopSettings, setShopSettings] = useState({})
  const [deliveryChecks, setDeliveryChecks] = useState({})
  const [placing, setPlacing] = useState(false)
  const [placedOrders, setPlacedOrders] = useState([])
  
  // Payment state
  const [paymentMethod, setPaymentMethod] = useState('razorpay')
  const [processingPayment, setProcessingPayment] = useState(false)
  
  // Coupon state
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [validatingCoupon, setValidatingCoupon] = useState(false)
  
  // Address state
  const [addresses, setAddresses] = useState([])
  const [selectedAddressId, setSelectedAddressId] = useState(null)
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [newAddress, setNewAddress] = useState({
    label: 'home',
    address_line1: '',
    city: '',
    pincode: '',
    landmark: '',
  })

  const [activeStep, setActiveStep] = useState('review') // 'review' -> 'shipping' -> 'payment'
  const [showPaymentPage, setShowPaymentPage] = useState(false)

  const shopGroups = getShopGroups()
  const grandSubtotal = getSubtotal()

  // Load saved addresses
  useEffect(() => {
    const loadAddresses = async () => {
      try {
        const { data } = await listAddresses()
        setAddresses(data || [])
        const defaultAddr = data?.find(a => a.is_default)
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id)
        }
      } catch (err) {
        console.error('Failed to load addresses:', err)
      }
    }
    loadAddresses()
  }, [])

  useEffect(() => {
    const initial = {}
    shopGroups.forEach((g) => {
      if (!shopSettings[g.shop_id]) {
        initial[g.shop_id] = {
          delivery_type: 'pickup',
          delivery_address: locationName || '',
          notes: '',
          delivery_fee: 0,
          delivery_eligible: null,
        }
      }
    })
    if (Object.keys(initial).length > 0) {
      setShopSettings((prev) => ({ ...prev, ...initial }))
    }
  }, [locationName, shopGroups, shopSettings])

  const handleDeliveryTypeChange = async (shopId, type) => {
    setShopSettings((prev) => ({
      ...prev,
      [shopId]: { ...prev[shopId], delivery_type: type },
    }))

    if (type === 'delivery' && latitude && longitude && !deliveryChecks[shopId]) {
      try {
        const { data } = await checkDeliveryEligibility(shopId, latitude, longitude)
        setDeliveryChecks((prev) => ({ ...prev, [shopId]: data }))
        setShopSettings((prev) => ({
          ...prev,
          [shopId]: {
            ...prev[shopId],
            delivery_eligible: data.eligible !== false,
            delivery_fee: data.delivery_fee || 0,
          },
        }))
      } catch {
        setDeliveryChecks((prev) => ({ ...prev, [shopId]: { eligible: true, delivery_fee: 0 } }))
        setShopSettings((prev) => ({
          ...prev,
          [shopId]: { ...prev[shopId], delivery_eligible: true, delivery_fee: 0 },
        }))
      }
    }
  }

  const updateShopSetting = (shopId, field, value) => {
    setShopSettings((prev) => ({
      ...prev,
      [shopId]: { ...prev[shopId], [field]: value },
    }))
  }

  const getDeliveryFee = (shopId) => {
    const settings = shopSettings[shopId]
    if (!settings || settings.delivery_type !== 'delivery') return 0
    return settings.delivery_fee || 0
  }

  const getTotalDeliveryFees = () => {
    return shopGroups.reduce((sum, g) => sum + getDeliveryFee(g.shop_id), 0)
  }

  const getGrandTotal = () => grandSubtotal + getTotalDeliveryFees() - couponDiscount

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error('Please enter a coupon code')
      return
    }
    
    setValidatingCoupon(true)
    try {
      const shopId = shopGroups.length === 1 ? shopGroups[0].shop_id : null
      const { data } = await validateCoupon(couponCode, shopId, grandSubtotal + getTotalDeliveryFees())
      
      if (data.valid) {
        setAppliedCoupon(data.coupon)
        setCouponDiscount(data.discount_amount)
        toast.success(data.message)
      } else {
        toast.error(data.message)
        setAppliedCoupon(null)
        setCouponDiscount(0)
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to validate coupon')
      setAppliedCoupon(null)
      setCouponDiscount(0)
    } finally {
      setValidatingCoupon(false)
    }
  }

  const handleRemoveCoupon = () => {
    setCouponCode('')
    setAppliedCoupon(null)
    setCouponDiscount(0)
  }

  const handleSaveAddress = async () => {
    if (!newAddress.address_line1 || !newAddress.city || !newAddress.pincode) {
      toast.error('Please fill in all required address fields')
      return
    }
    
    try {
      const { data } = await createAddress({
        ...newAddress,
        latitude,
        longitude,
        is_default: addresses.length === 0,
      })
      setAddresses(prev => [...prev, data])
      setSelectedAddressId(data.id)
      setShowAddressForm(false)
      setNewAddress({ label: 'home', address_line1: '', city: '', pincode: '', landmark: '' })
      toast.success('Address saved!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save address')
    }
  }

  const handleRazorpayPayment = async (orderId, orderNumber) => {
    const scriptLoaded = await loadRazorpayScript()
    if (!scriptLoaded) {
      toast.error('Failed to load payment gateway. Please try again.')
      return false
    }

    try {
      const { data: paymentOrder } = await createPaymentOrder(orderId)
      
      return new Promise((resolve) => {
        const options = {
          key: paymentOrder.razorpay_key_id,
          amount: paymentOrder.amount,
          currency: paymentOrder.currency,
          name: 'NearShop',
          description: `Order ${orderNumber}`,
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
              resolve(true)
            } catch {
              toast.error('Payment verification failed')
              resolve(false)
            }
          },
          prefill: {
            contact: '',
          },
          theme: {
            color: '#7C3AED',
          },
          modal: {
            ondismiss: function() {
              resolve(false)
            }
          }
        }

        const razorpay = new window.Razorpay(options)
        razorpay.open()
      })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to initiate payment')
      return false
    }
  }

  const handlePlaceOrders = async () => {
    if (shopGroups.length === 0) return

    for (const group of shopGroups) {
      const settings = shopSettings[group.shop_id]
      if (settings?.delivery_type === 'delivery') {
        if (!selectedAddressId && !settings.delivery_address?.trim()) {
          toast.error(`Please select or enter a delivery address for ${group.shop_name}`)
          return
        }
      }
    }

    setPlacing(true)
    const results = []
    const selectedAddress = addresses.find(a => a.id === selectedAddressId)

    try {
      for (const group of shopGroups) {
        const settings = shopSettings[group.shop_id] || {}
        const deliveryAddr = settings.delivery_type === 'delivery' 
          ? (selectedAddress?.formatted_address || settings.delivery_address)
          : null
        
        const orderData = {
          shop_id: group.shop_id,
          delivery_type: settings.delivery_type || 'pickup',
          delivery_address: deliveryAddr,
          notes: settings.notes || '',
          payment_method: paymentMethod === 'online' ? 'razorpay' : 'cod',
          items: group.items.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
            price: item.price,
          })),
        }

        const { data: order } = await createOrder(orderData)
        results.push(order)

        if (paymentMethod === 'online') {
          const paymentSuccess = await handleRazorpayPayment(order.id, order.order_number)
          if (!paymentSuccess) {
            toast.error('Payment failed. Order cancelled.')
            setPlacing(false)
            return
          }
        }

        clearShopItems(group.shop_id)
      }

      setPlacedOrders(results)
      toast.success('Orders placed successfully!')
      setTimeout(() => {
        navigate('/orders')
      }, 2000)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to place order')
    } finally {
      setPlacing(false)
    }
  }

  // Redirect to new payment page
  const handleProceedToPayment = () => {
    // Validate shipping details first
    let allValid = true
    for (const group of shopGroups) {
      const settings = shopSettings[group.shop_id]
      if (settings?.delivery_type === 'delivery') {
        if (!selectedAddressId && !settings.delivery_address?.trim()) {
          toast.error(`Please select a delivery address for ${group.shop_name}`)
          allValid = false
          break
        }
      }
    }

    if (allValid) {
      // Navigate to payment page with checkout context
      navigate('/app/payment', {
        state: {
          checkoutData: {
            subtotal: grandSubtotal,
            deliveryFee: getTotalDeliveryFees(),
            discount: couponDiscount,
            coupon: appliedCoupon,
            items: items,
            shopGroups: shopGroups,
            shopSettings: shopSettings,
            selectedAddressId: selectedAddressId,
          }
        }
      })
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
          <p className="text-gray-600 mb-6">Add items to proceed to checkout</p>
          <button
            onClick={() => navigate('/shops')}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    )
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 hover-lift smooth-transition"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
          <div className="w-12"></div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Items Review */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Order Review</h2>
              {shopGroups.map((group) => (
                <div key={group.shop_id} className="mb-6 pb-6 border-b last:border-b-0">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Store className="w-5 h-5" />
                    {group.shop_name}
                  </h3>
                  <div className="space-y-2 mb-4">
                    {group.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm text-gray-700">
                        <span>{item.name} x {item.quantity}</span>
                        <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Delivery Options */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Delivery Options</h2>
              <div className="space-y-4">
                {shopGroups.map((group) => {
                  const settings = shopSettings[group.shop_id] || {}
                  return (
                    <div key={group.shop_id} className="border border-gray-200 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-3">{group.shop_name}</h3>
                      <div className="space-y-2">
                        <label className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="radio"
                            checked={settings.delivery_type === 'pickup'}
                            onChange={() => handleDeliveryTypeChange(group.shop_id, 'pickup')}
                            className="w-4 h-4"
                          />
                          <span className="text-gray-700">Pickup from shop</span>
                        </label>
                        <label className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="radio"
                            checked={settings.delivery_type === 'delivery'}
                            onChange={() => handleDeliveryTypeChange(group.shop_id, 'delivery')}
                            className="w-4 h-4"
                          />
                          <span className="text-gray-700">Delivery at home</span>
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Address Selection */}
            {shopGroups.some((g) => shopSettings[g.shop_id]?.delivery_type === 'delivery') && (
              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Delivery Address
                </h2>
                {addresses.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {addresses.map((addr) => (
                      <label key={addr.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50">
                        <input
                          type="radio"
                          checked={selectedAddressId === addr.id}
                          onChange={() => setSelectedAddressId(addr.id)}
                          className="w-4 h-4"
                        />
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 capitalize">{addr.label}</p>
                          <p className="text-sm text-gray-600">{addr.formatted_address}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setShowAddressForm(!showAddressForm)}
                  className="flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium"
                >
                  <Plus className="w-4 h-4" />
                  {addresses.length > 0 ? 'Add another address' : 'Add delivery address'}
                </button>
                {showAddressForm && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
                    <input
                      type="text"
                      placeholder="House no, street name"
                      value={newAddress.address_line1}
                      onChange={(e) => setNewAddress({ ...newAddress, address_line1: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="City"
                      value={newAddress.city}
                      onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Pincode"
                      value={newAddress.pincode}
                      onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                    <button
                      onClick={handleSaveAddress}
                      className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      Save Address
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Coupon Section */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Promo Code
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter coupon code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  disabled={appliedCoupon !== null}
                  className="flex-1 px-4 py-2 border rounded-lg"
                />
                {appliedCoupon ? (
                  <button
                    onClick={handleRemoveCoupon}
                    className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    onClick={handleApplyCoupon}
                    disabled={validatingCoupon}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {validatingCoupon ? 'Checking...' : 'Apply'}
                  </button>
                )}
              </div>
              {appliedCoupon && (
                <p className="text-sm text-green-600 mt-2">✓ {appliedCoupon.description}</p>
              )}
            </div>

            {/* Proceed Button */}
            <button
              onClick={handleProceedToPayment}
              disabled={placing}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg hover:shadow-lg disabled:opacity-50"
            >
              {placing ? 'Processing...' : 'Proceed to Payment'}
            </button>
          </div>

          {/* Summary Sidebar */}
          <div>
            <PaymentSummary
              items={items}
              subtotal={grandSubtotal}
              deliveryFee={getTotalDeliveryFees()}
              discount={couponDiscount}
              coupon={appliedCoupon}
              paymentMethod={paymentMethod}
            />

            {/* Additional Info */}
            <div className="mt-6 space-y-4">
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-600 font-medium mb-2">ESTIMATED DELIVERY</p>
                <p className="text-lg font-bold text-gray-900">1-2 Days</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-600 font-medium mb-2">EASY RETURNS</p>
                <p className="text-sm text-gray-700">7 days easy return policy</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </PageTransition>
  )
}
