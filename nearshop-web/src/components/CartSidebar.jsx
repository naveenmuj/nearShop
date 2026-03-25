import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Plus, Minus, Trash2, ShoppingCart, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCartStore } from '../store/cartStore'

const formatPrice = (v) => '\u20B9' + Number(v || 0).toLocaleString('en-IN')

export default function CartSidebar({ isOpen, onClose }) {
  const navigate = useNavigate()
  const items = useCartStore((s) => s.items)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const getItemCount = useCartStore((s) => s.getItemCount)
  const getSubtotal = useCartStore((s) => s.getSubtotal)
  const getShopGroups = useCartStore((s) => s.getShopGroups)
  const clearCart = useCartStore((s) => s.clearCart)

  // Prevent body scroll when sidebar open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const handleRemove = (productId, productName) => {
    removeItem(productId)
    toast.success(`${productName} removed from cart`)
  }

  const handleCheckout = () => {
    onClose()
    navigate('/app/checkout')
  }

  const shopGroups = getShopGroups()
  const itemCount = getItemCount()
  const grandTotal = getSubtotal()

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-[60] transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white z-[70] shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-brand-purple" />
            <h2 className="text-lg font-bold text-gray-900">Your Cart</h2>
            {itemCount > 0 && (
              <span className="bg-brand-purple text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {itemCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <ShoppingCart className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Cart is empty</h3>
              <p className="text-sm text-gray-500 mb-6">
                Browse products and add items to your cart
              </p>
              <button
                onClick={() => { onClose(); navigate('/app/search') }}
                className="flex items-center gap-2 px-5 py-2.5 bg-brand-purple text-white rounded-xl text-sm font-semibold hover:bg-brand-purple-dark transition"
              >
                Start Shopping <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="p-4 space-y-5">
              {shopGroups.map((group) => (
                <div key={group.shop_id} className="bg-gray-50 rounded-xl overflow-hidden">
                  {/* Shop header */}
                  <div className="flex items-center gap-2.5 px-4 py-3 bg-gray-100/80">
                    {group.shop_logo ? (
                      <img
                        src={group.shop_logo}
                        alt=""
                        className="w-7 h-7 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-7 h-7 bg-brand-purple-light rounded-lg flex items-center justify-center">
                        <span className="text-xs font-bold text-brand-purple">
                          {group.shop_name?.charAt(0)?.toUpperCase() || 'S'}
                        </span>
                      </div>
                    )}
                    <span className="text-sm font-semibold text-gray-800 truncate">
                      {group.shop_name}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="divide-y divide-gray-100">
                    {group.items.map((item) => {
                      const image = item.images?.[0] || item.image || null
                      return (
                        <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                          {/* Thumbnail */}
                          <div className="w-14 h-14 rounded-lg bg-white border border-gray-200 overflow-hidden flex-shrink-0">
                            {image ? (
                              <img src={image} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ShoppingCart className="w-5 h-5 text-gray-200" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {item.name}
                            </p>
                            <p className="text-sm font-bold text-gray-900 mt-0.5">
                              {formatPrice(item.price)}
                            </p>

                            {/* Quantity controls */}
                            <div className="flex items-center gap-2 mt-1.5">
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:border-gray-300 transition"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-sm font-semibold text-gray-800 w-6 text-center">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:border-gray-300 transition"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Line total + remove */}
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <p className="text-sm font-bold text-gray-900">
                              {formatPrice(item.price * item.quantity)}
                            </p>
                            <button
                              onClick={() => handleRemove(item.id, item.name)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Shop subtotal */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-100/50 text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-bold text-gray-800">{formatPrice(group.subtotal)}</span>
                  </div>
                </div>
              ))}

              {/* Clear cart */}
              <button
                onClick={() => { clearCart(); toast.success('Cart cleared') }}
                className="text-sm text-red-500 hover:text-red-600 font-medium transition"
              >
                Clear entire cart
              </button>
            </div>
          )}
        </div>

        {/* Footer - Checkout */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-4 bg-white">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">Grand Total</span>
              <span className="text-xl font-extrabold text-gray-900">
                {formatPrice(grandTotal)}
              </span>
            </div>
            <button
              onClick={handleCheckout}
              className="w-full flex items-center justify-center gap-2 bg-brand-purple text-white py-3.5 rounded-xl text-sm font-bold hover:bg-brand-purple-dark transition"
            >
              Proceed to Checkout <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </>
  )
}
