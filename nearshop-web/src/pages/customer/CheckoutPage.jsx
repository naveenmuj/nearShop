import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ShoppingCart, MapPin, Truck, Store, CreditCard, FileText, ArrowLeft, CheckCircle, Loader2, Package, Tag, Plus, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCartStore } from '../../store/cartStore'
import { useLocationStore } from '../../store/locationStore'
import { createOrder, createPaymentOrder, confirmPayment } from '../../api/orders'
import { checkDeliveryEligibility } from '../../api/delivery'
import { validateCoupon, useCoupon as recordCouponUse } from '../../api/deals'
import { listAddresses, createAddress } from '../../api/auth'

const formatPrice = (v) => '\u20B9' + Number(v || 0).toLocaleString('en-IN')

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

export default function CheckoutPage() {
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
  const [paymentMethod, setPaymentMethod] = useState('cod') // 'cod' or 'online'
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

  const shopGroups = getShopGroups()
  const grandSubtotal = getSubtotal()

  // Load saved addresses
  useEffect(() => {
    const loadAddresses = async () => {
      try {
        const { data } = await listAddresses()
        setAddresses(data || [])
        // Auto-select default address
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

  // Initialize per-shop settings
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

  // Check delivery eligibility when delivery_type changes to 'delivery'
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

  // Coupon validation
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

  // Save new address
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

  // Handle Razorpay payment
  const handleRazorpayPayment = async (orderId, orderNumber) => {
    const scriptLoaded = await loadRazorpayScript()
    if (!scriptLoaded) {
      toast.error('Failed to load payment gateway. Please try again.')
      return false
    }

    try {
      // Create Razorpay order
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
              // Verify payment on backend
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

    // Validate delivery addresses
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
          ranking_context: item.ranking_context || null,
        })),
        delivery_fee: getDeliveryFee(group.shop_id),
        subtotal: group.subtotal,
        total: group.subtotal + getDeliveryFee(group.shop_id) - (couponDiscount / shopGroups.length),
      }

      if (latitude && longitude) {
        orderData.customer_lat = latitude
        orderData.customer_lng = longitude
      }

      try {
        const { data } = await createOrder(orderData)
        
        // Handle online payment
        if (paymentMethod === 'online') {
          setProcessingPayment(true)
          const paymentSuccess = await handleRazorpayPayment(data.id, data.order_number)
          setProcessingPayment(false)
          
          if (!paymentSuccess) {
            results.push({ shop_id: group.shop_id, shop_name: group.shop_name, success: false, error: 'Payment cancelled or failed' })
            continue
          }
        }
        
        // Record coupon usage if applied
        if (appliedCoupon) {
          try {
            await recordCouponUse(appliedCoupon.id, data.id, couponDiscount / shopGroups.length)
          } catch (e) {
            console.error('Failed to record coupon usage:', e)
          }
        }
        
        results.push({ shop_id: group.shop_id, shop_name: group.shop_name, success: true, order: data })
        clearShopItems(group.shop_id)
      } catch (err) {
        const msg = err.response?.data?.detail || 'Order failed'
        results.push({ shop_id: group.shop_id, shop_name: group.shop_name, success: false, error: msg })
      }
    }

    setPlacing(false)

    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success).length

    if (successCount > 0) {
      setPlacedOrders(results.filter((r) => r.success))
      toast.success(
        successCount === shopGroups.length
          ? 'All orders placed successfully!'
          : `${successCount} order(s) placed successfully`
      )
    }

    if (failCount > 0) {
      results
        .filter((r) => !r.success)
        .forEach((r) => toast.error(`${r.shop_name}: ${r.error}`))
    }

    if (failCount === 0) {
      setTimeout(() => navigate('/app/orders'), 1500)
    }
  }

  // Empty cart state
  if (items.length === 0 && placedOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <ShoppingCart className="w-10 h-10 text-gray-300" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Your cart is empty</h2>
        <p className="text-sm text-gray-500 mb-6">Add products to your cart before checkout</p>
        <Link
          to="/app/search"
          className="flex items-center gap-2 px-6 py-3 bg-brand-purple text-white rounded-xl text-sm font-bold hover:bg-brand-purple-dark transition"
        >
          Browse Products
        </Link>
      </div>
    )
  }

  // Success state after all orders placed
  if (items.length === 0 && placedOrders.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Orders Placed!</h2>
        <p className="text-sm text-gray-500 mb-6">
          {placedOrders.length} order(s) placed successfully. You will be redirected shortly.
        </p>
        <Link
          to="/app/orders"
          className="flex items-center gap-2 px-6 py-3 bg-brand-purple text-white rounded-xl text-sm font-bold hover:bg-brand-purple-dark transition"
        >
          View My Orders
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
      </div>

      <div className="lg:flex lg:gap-6">
        {/* Left: Order details */}
        <div className="lg:flex-1 space-y-5">
          {/* Saved Addresses Section */}
          {shopGroups.some(g => shopSettings[g.shop_id]?.delivery_type === 'delivery') && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-brand-purple" />
                  Delivery Address
                </h3>
                <button
                  onClick={() => setShowAddressForm(!showAddressForm)}
                  className="text-xs text-brand-purple font-semibold flex items-center gap-1 hover:underline"
                >
                  <Plus className="w-3 h-3" /> Add New
                </button>
              </div>
              
              {/* Address list */}
              {addresses.length > 0 && (
                <div className="space-y-2 mb-4">
                  {addresses.map((addr) => (
                    <label
                      key={addr.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
                        selectedAddressId === addr.id
                          ? 'border-brand-purple bg-brand-purple-light'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="address"
                        checked={selectedAddressId === addr.id}
                        onChange={() => setSelectedAddressId(addr.id)}
                        className="mt-1 accent-brand-purple"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-600 uppercase bg-gray-100 px-2 py-0.5 rounded">
                            {addr.label}
                          </span>
                          {addr.is_default && (
                            <span className="text-xs font-semibold text-brand-purple bg-brand-purple-light px-2 py-0.5 rounded">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700">{addr.formatted_address}</p>
                        {addr.phone && <p className="text-xs text-gray-500 mt-1">📞 {addr.phone}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* New address form */}
              {showAddressForm && (
                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={newAddress.label}
                      onChange={(e) => setNewAddress(prev => ({ ...prev, label: e.target.value }))}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    >
                      <option value="home">Home</option>
                      <option value="work">Work</option>
                      <option value="other">Other</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Pincode *"
                      value={newAddress.pincode}
                      onChange={(e) => setNewAddress(prev => ({ ...prev, pincode: e.target.value }))}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Address Line 1 *"
                    value={newAddress.address_line1}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, address_line1: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="City *"
                    value={newAddress.city}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Landmark (optional)"
                    value={newAddress.landmark}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, landmark: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                  <button
                    onClick={handleSaveAddress}
                    className="w-full py-2 bg-brand-purple text-white rounded-lg text-sm font-semibold hover:bg-brand-purple-dark transition"
                  >
                    Save Address
                  </button>
                </div>
              )}
            </div>
          )}

          {shopGroups.map((group) => {
            const settings = shopSettings[group.shop_id] || {}
            const deliveryCheck = deliveryChecks[group.shop_id]
            const deliveryFee = getDeliveryFee(group.shop_id)

            return (
              <div key={group.shop_id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {/* Shop header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                  {group.shop_logo ? (
                    <img src={group.shop_logo} alt="" className="w-10 h-10 rounded-xl object-cover" />
                  ) : (
                    <div className="w-10 h-10 bg-brand-purple-light rounded-xl flex items-center justify-center">
                      <span className="text-sm font-bold text-brand-purple">
                        {group.shop_name?.charAt(0)?.toUpperCase() || 'S'}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-gray-900">{group.shop_name}</p>
                    <p className="text-xs text-gray-500">{group.items.length} item(s)</p>
                  </div>
                </div>

                {/* Items list */}
                <div className="divide-y divide-gray-50 px-5">
                  {group.items.map((item) => {
                    const image = item.images?.[0] || item.image || null
                    return (
                      <div key={item.id} className="flex items-center gap-3 py-3">
                        <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0">
                          {image ? (
                            <img src={image} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-5 h-5 text-gray-200" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                          <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                        </div>
                        <p className="text-sm font-bold text-gray-900 flex-shrink-0">
                          {formatPrice(item.price * item.quantity)}
                        </p>
                      </div>
                    )
                  })}
                </div>

                {/* Delivery type selector */}
                <div className="px-5 py-4 border-t border-gray-100">
                  <p className="text-sm font-semibold text-gray-800 mb-3">Delivery Method</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleDeliveryTypeChange(group.shop_id, 'pickup')}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition ${
                        settings.delivery_type === 'pickup'
                          ? 'border-brand-purple bg-brand-purple-light'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Store className={`w-5 h-5 ${settings.delivery_type === 'pickup' ? 'text-brand-purple' : 'text-gray-400'}`} />
                      <div className="text-left">
                        <p className={`text-sm font-semibold ${settings.delivery_type === 'pickup' ? 'text-brand-purple' : 'text-gray-700'}`}>
                          Pickup
                        </p>
                        <p className="text-xs text-gray-500">Collect from shop</p>
                      </div>
                    </button>
                    <button
                      onClick={() => handleDeliveryTypeChange(group.shop_id, 'delivery')}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition ${
                        settings.delivery_type === 'delivery'
                          ? 'border-brand-purple bg-brand-purple-light'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Truck className={`w-5 h-5 ${settings.delivery_type === 'delivery' ? 'text-brand-purple' : 'text-gray-400'}`} />
                      <div className="text-left">
                        <p className={`text-sm font-semibold ${settings.delivery_type === 'delivery' ? 'text-brand-purple' : 'text-gray-700'}`}>
                          Delivery
                        </p>
                        <p className="text-xs text-gray-500">To your address</p>
                      </div>
                    </button>
                  </div>

                  {/* Delivery info */}
                  {settings.delivery_type === 'delivery' && (
                    <div className="mt-4 space-y-3">
                      {deliveryCheck && deliveryCheck.eligible === false && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
                          This shop does not deliver to your area. Please choose pickup instead.
                        </div>
                      )}
                      {deliveryFee > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-600">
                          Delivery fee: {formatPrice(deliveryFee)}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="px-5 pb-4">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    <FileText className="w-3.5 h-3.5 inline mr-1" />
                    Order Notes (optional)
                  </label>
                  <input
                    type="text"
                    value={settings.notes || ''}
                    onChange={(e) => updateShopSetting(group.shop_id, 'notes', e.target.value)}
                    placeholder="Any special instructions..."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-purple transition"
                  />
                </div>

                {/* Shop subtotal */}
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Items subtotal</span>
                    <span className="font-semibold text-gray-800">{formatPrice(group.subtotal)}</span>
                  </div>
                  {deliveryFee > 0 && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-500">Delivery fee</span>
                      <span className="font-semibold text-gray-800">{formatPrice(deliveryFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold mt-1.5 pt-1.5 border-t border-gray-200">
                    <span className="text-gray-800">Shop Total</span>
                    <span className="text-gray-900">{formatPrice(group.subtotal + deliveryFee)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Right: Order summary sidebar */}
        <div className="lg:w-80 mt-5 lg:mt-0">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 lg:sticky lg:top-24">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h3>

            {/* Coupon Section */}
            <div className="mb-4 pb-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Tag className="w-4 h-4 text-green-600" />
                Have a coupon?
              </p>
              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-3">
                  <div>
                    <p className="text-sm font-bold text-green-700">{appliedCoupon.code}</p>
                    <p className="text-xs text-green-600">You save {formatPrice(couponDiscount)}</p>
                  </div>
                  <button
                    onClick={handleRemoveCoupon}
                    className="text-xs text-red-500 font-semibold hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Enter code"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-purple"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    disabled={validatingCoupon}
                    className="px-4 py-2 bg-brand-purple text-white rounded-xl text-sm font-semibold hover:bg-brand-purple-dark transition disabled:opacity-50"
                  >
                    {validatingCoupon ? '...' : 'Apply'}
                  </button>
                </div>
              )}
            </div>

            {/* Payment method */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Payment Method</p>
              <div className="space-y-2">
                <button
                  onClick={() => setPaymentMethod('cod')}
                  className={`w-full flex items-center gap-3 p-3 border-2 rounded-xl transition ${
                    paymentMethod === 'cod'
                      ? 'border-brand-purple bg-brand-purple-light'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <CreditCard className={`w-5 h-5 ${paymentMethod === 'cod' ? 'text-brand-purple' : 'text-gray-400'}`} />
                  <div className="text-left">
                    <p className={`text-sm font-semibold ${paymentMethod === 'cod' ? 'text-brand-purple' : 'text-gray-700'}`}>
                      Cash on Delivery
                    </p>
                    <p className="text-xs text-gray-500">Pay when you receive</p>
                  </div>
                </button>
                <button
                  onClick={() => setPaymentMethod('online')}
                  className={`w-full flex items-center gap-3 p-3 border-2 rounded-xl transition ${
                    paymentMethod === 'online'
                      ? 'border-brand-purple bg-brand-purple-light'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Wallet className={`w-5 h-5 ${paymentMethod === 'online' ? 'text-brand-purple' : 'text-gray-400'}`} />
                  <div className="text-left">
                    <p className={`text-sm font-semibold ${paymentMethod === 'online' ? 'text-brand-purple' : 'text-gray-700'}`}>
                      Pay Online
                    </p>
                    <p className="text-xs text-gray-500">UPI, Card, NetBanking</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-2">
              {shopGroups.map((g) => (
                <div key={g.shop_id} className="flex justify-between text-sm">
                  <span className="text-gray-500 truncate mr-2">{g.shop_name}</span>
                  <span className="text-gray-700 font-medium flex-shrink-0">{formatPrice(g.subtotal)}</span>
                </div>
              ))}

              {getTotalDeliveryFees() > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Delivery Fees</span>
                  <span className="text-gray-700 font-medium">{formatPrice(getTotalDeliveryFees())}</span>
                </div>
              )}

              {couponDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Coupon Discount</span>
                  <span className="font-medium">-{formatPrice(couponDiscount)}</span>
                </div>
              )}

              <div className="flex justify-between text-base font-bold pt-3 border-t border-gray-100">
                <span className="text-gray-900">Grand Total</span>
                <span className="text-gray-900">{formatPrice(getGrandTotal())}</span>
              </div>
            </div>

            <button
              onClick={handlePlaceOrders}
              disabled={placing || processingPayment}
              className="w-full flex items-center justify-center gap-2 bg-brand-purple text-white py-3.5 rounded-xl text-sm font-bold hover:bg-brand-purple-dark transition mt-5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {placing || processingPayment ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> 
                  {processingPayment ? 'Processing Payment...' : 'Placing Orders...'}
                </>
              ) : (
                <>
                  {paymentMethod === 'online' ? 'Pay & Place Order' : 'Place Order'}{shopGroups.length > 1 ? 's' : ''} ({shopGroups.length})
                </>
              )}
            </button>

            <p className="text-xs text-gray-400 text-center mt-3">
              By placing your order, you agree to our Terms of Service
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
