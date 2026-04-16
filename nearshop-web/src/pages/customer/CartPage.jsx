import { useNavigate } from 'react-router-dom'
import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react'
import { useCartStore } from '../../store/cartStore'
import { PageTransition } from '../../components/ui/PageTransition'

const formatPrice = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`

export default function CartPage() {
  const navigate = useNavigate()
  const items = useCartStore((s) => s.items)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const clearCart = useCartStore((s) => s.clearCart)
  const getItemCount = useCartStore((s) => s.getItemCount)
  const getSubtotal = useCartStore((s) => s.getSubtotal)
  const getShopGroups = useCartStore((s) => s.getShopGroups)

  const groups = getShopGroups()
  const itemCount = getItemCount()
  const subtotal = getSubtotal()

  if (items.length === 0) {
    return (
      <PageTransition>
        <div className="desktop-panel p-14 text-center">
        <ShoppingCart className="mx-auto h-10 w-10 text-gray-300" />
        <h1 className="mt-3 text-2xl font-bold text-gray-900">Your cart is empty</h1>
        <p className="mt-1 text-sm text-gray-500">Browse products and add them to your cart.</p>
        <button onClick={() => navigate('/app/search')} className="mt-5 rounded-lg bg-[#3f5efb] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#334ed4]">
          Start Shopping
        </button>
      </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="desktop-panel overflow-hidden">
        <div className="desktop-toolbar flex items-center justify-between px-5 py-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cart Workspace</h1>
            <p className="text-xs text-gray-500">{itemCount} items across {groups.length} shop groups</p>
          </div>
          <button onClick={clearCart} className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Clear Cart</button>
        </div>
        <div className="divide-y divide-gray-100">
          {groups.map((group) => (
            <div key={group.shop_id} className="p-4 animate-fade-in-up">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">{group.shop_name}</h2>
                <p className="text-xs font-semibold text-gray-500">Subtotal {formatPrice(group.subtotal)}</p>
              </div>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <div key={item.id} className="grid items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 lg:grid-cols-[1fr_140px_120px_60px] hover-lift smooth-transition">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">{formatPrice(item.price)} each</p>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="rounded-md border border-gray-300 p-1.5 hover:bg-white"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="rounded-md border border-gray-300 p-1.5 hover:bg-white"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                    <p className="text-right text-sm font-bold text-gray-900">{formatPrice(item.quantity * item.price)}</p>
                    <button onClick={() => removeItem(item.id)} className="justify-self-end rounded-md p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <aside className="desktop-panel h-fit p-5 lg:sticky lg:top-24">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Summary</h3>
        <div className="mt-4 space-y-2 text-sm text-gray-600">
          <div className="flex justify-between"><span>Items</span><span>{itemCount}</span></div>
          <div className="flex justify-between"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
        </div>
        <div className="mt-4 border-t border-gray-200 pt-3">
          <div className="flex justify-between text-sm font-semibold text-gray-900"><span>Total</span><span>{formatPrice(subtotal)}</span></div>
        </div>
        <button onClick={() => navigate('/app/checkout')} className="mt-5 w-full rounded-lg bg-[#3f5efb] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#334ed4] hover-scale smooth-transition">
          Proceed to Checkout
        </button>
      </aside>
    </div>
    </PageTransition>
  )
}
