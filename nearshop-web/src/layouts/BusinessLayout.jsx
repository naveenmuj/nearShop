import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Package, ShoppingBag, BarChart2, MoreHorizontal, X,
  Settings, Users, Star, CreditCard, Tag, BookOpen, MessageSquare, Receipt, Send, DollarSign,
  Warehouse, FileText, Sparkles, Megaphone, PartyPopper } from 'lucide-react'
import NotificationBell from '../components/NotificationBell'
import useMyShop from '../hooks/useMyShop'
import { useAuthStore } from '../store/authStore'

const NAV = [
  { to: '/biz/dashboard', icon: LayoutDashboard, label: 'Home' },
  { to: '/biz/catalog',   icon: Package,         label: 'Products' },
  { to: '/biz/orders',    icon: ShoppingBag,     label: 'Orders' },
  { to: '/biz/analytics', icon: BarChart2,       label: 'Insights' },
]

const MORE_ITEMS = [
  { to: '/biz/billing',   icon: Receipt,        label: 'Billing',        desc: 'Generate invoices & bills' },
  { to: '/biz/inventory', icon: Warehouse,      label: 'Inventory',      desc: 'Stock levels & margins' },
  { to: '/biz/expenses',  icon: DollarSign,     label: 'Expenses & P&L', desc: 'Track costs, see profit' },
  { to: '/biz/reports',   icon: FileText,       label: 'Daily Reports',  desc: 'EOD summary & share' },
  { to: '/biz/advisor',   icon: Sparkles,       label: 'AI Advisor',     desc: 'Smart suggestions' },
  { to: '/biz/broadcast', icon: Megaphone,      label: 'Broadcast',      desc: 'Message your customers' },
  { to: '/biz/marketing', icon: Send,           label: 'Marketing',      desc: 'WhatsApp catalogs & promos' },
  { to: '/biz/festivals', icon: PartyPopper,    label: 'Festivals',      desc: 'Seasonal promotions' },
  { to: '/biz/deals',     icon: Tag,            label: 'Deals & Offers', desc: 'Create promotions' },
  { to: '/biz/haggle',    icon: MessageSquare,  label: 'Haggle Inbox',   desc: 'Customer offers' },
  { to: '/biz/reviews',   icon: Star,           label: 'Reviews',        desc: 'Customer feedback' },
  { to: '/biz/customers', icon: Users,          label: 'Customers',      desc: 'Order history' },
  { to: '/biz/udhaar',    icon: CreditCard,     label: 'Udhaar',         desc: 'Credit management' },
  { to: '/biz/stories',   icon: BookOpen,       label: 'Stories',        desc: 'Post updates' },
  { to: '/biz/settings',  icon: Settings,       label: 'Shop Settings',  desc: 'Hours, delivery, contact' },
]

export default function BusinessLayout() {
  const { user } = useAuthStore()
  const { shop } = useMyShop()
  const navigate = useNavigate()
  const [showMore, setShowMore] = useState(false)
  const initial = shop?.name?.charAt(0)?.toUpperCase() || user?.name?.charAt(0)?.toUpperCase() || 'B'

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 max-w-lg mx-auto">
      {/* Top header — shop owner's brand */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-[#1D9E75] to-[#5DCAA5] rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm">
              {shop?.logo_url ? (
                <img src={shop.logo_url} alt="" className="w-full h-full object-cover rounded-xl" />
              ) : initial}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate max-w-[180px]">{shop?.name || 'My Shop'}</p>
              <div className="flex items-center gap-1.5">
                {shop?.is_active !== false ? (
                  <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Open</span>
                ) : (
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Closed</span>
                )}
                {shop?.avg_rating > 0 && (
                  <span className="text-[10px] text-gray-400">⭐ {Number(shop.avg_rating).toFixed(1)}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <NotificationBell />
            <button
              onClick={() => navigate('/biz/settings')}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <Settings className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20 overflow-auto">
        <Outlet />
      </main>

      {/* Bottom nav — 4 tabs + More */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto">
        <div className="bg-white border-t border-gray-100 shadow-2xl" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="flex items-center justify-around px-1 py-1.5">
            {NAV.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[52px] transition-all duration-200 ${
                    isActive
                      ? 'bg-[#1D9E75]/10 text-[#1D9E75]'
                      : 'text-gray-400 hover:text-gray-600'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                    <span className={`text-[9px] font-semibold ${isActive ? 'text-[#1D9E75]' : ''}`}>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
            {/* More button */}
            <button
              onClick={() => setShowMore(true)}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[52px] text-gray-400 hover:text-gray-600 transition-all"
            >
              <MoreHorizontal className="w-5 h-5 stroke-[1.8]" />
              <span className="text-[9px] font-semibold">More</span>
            </button>
          </div>
        </div>
      </nav>

      {/* More menu overlay */}
      {showMore && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowMore(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl animate-slide-up pb-8" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}>
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h3 className="text-lg font-bold text-gray-900">More</h3>
              <button onClick={() => setShowMore(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="px-3 space-y-0.5">
              {MORE_ITEMS.map(({ to, icon: Icon, label, desc }) => (
                <button
                  key={to}
                  onClick={() => { setShowMore(false); navigate(to) }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#1D9E75]/8 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-[#1D9E75]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{label}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
