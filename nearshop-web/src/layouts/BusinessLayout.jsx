import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom'
import { LayoutDashboard, Package, ShoppingBag, BarChart2, Settings, Menu, X, Bell,
  Tag, BookOpen, MessageSquare, Receipt, Send, DollarSign, Warehouse, FileText,
  Sparkles, Megaphone, PartyPopper, Users, Star, CreditCard, Repeat,
  ChevronRight, Home, Box } from 'lucide-react'
import NotificationBell from '../components/NotificationBell'
import useMyShop from '../hooks/useMyShop'
import { useAuthStore } from '../store/authStore'
import client from '../api/client'

const NAV_MAIN = [
  { to: '/biz/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/biz/catalog',   icon: Package,         label: 'Products' },
  { to: '/biz/orders',    icon: ShoppingBag,     label: 'Orders' },
  { to: '/biz/billing',   icon: Receipt,         label: 'Billing' },
]
const NAV_MARKETING = [
  { to: '/biz/deals',      icon: Tag,           label: 'Deals & Offers' },
  { to: '/biz/stories',    icon: BookOpen,       label: 'Stories' },
  { to: '/biz/marketing',  icon: Send,           label: 'WhatsApp Studio' },
  { to: '/biz/broadcast',  icon: Megaphone,      label: 'Broadcasts' },
  { to: '/biz/festivals',  icon: PartyPopper,    label: 'Festivals' },
]
const NAV_INSIGHTS = [
  { to: '/biz/analytics',  icon: BarChart2,      label: 'Analytics' },
  { to: '/biz/advisor',    icon: Sparkles,       label: 'AI Advisor' },
  { to: '/biz/inventory',  icon: Warehouse,      label: 'Inventory' },
  { to: '/biz/expenses',   icon: DollarSign,     label: 'Expenses & P&L' },
  { to: '/biz/reports',    icon: FileText,       label: 'Daily Reports' },
]
const NAV_CUSTOMERS = [
  { to: '/biz/customers',  icon: Users,          label: 'Customers' },
  { to: '/biz/reviews',    icon: Star,           label: 'Reviews' },
  { to: '/biz/udhaar',     icon: CreditCard,     label: 'Udhaar / Credit' },
  { to: '/biz/haggle',     icon: MessageSquare,  label: 'Haggles' },
]

function SidebarLink({ to, icon: Icon, label }) {
  return (
    <NavLink to={to}
      className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
        isActive ? 'bg-brand-green-light text-[#1D9E75] font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
      }`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{label}</span>
    </NavLink>
  )
}

function SidebarSection({ title, items }) {
  return (
    <>
      <div className="pt-5 pb-1.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{title}</div>
      {items.map(item => <SidebarLink key={item.to} {...item} />)}
    </>
  )
}

function SidebarContent({ shop, onSwitchCustomer }) {
  return (
    <>
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1D9E75] to-[#2DB88A] flex items-center justify-center text-white font-bold text-sm">
            {shop?.name?.[0] || 'S'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{shop?.name || 'My Shop'}</p>
            <p className="text-xs text-gray-400">NearShop Business</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {NAV_MAIN.map(item => <SidebarLink key={item.to} {...item} />)}
        <SidebarSection title="Marketing" items={NAV_MARKETING} />
        <SidebarSection title="Insights" items={NAV_INSIGHTS} />
        <SidebarSection title="Customers" items={NAV_CUSTOMERS} />
      </nav>
      <div className="p-2 border-t border-gray-100 space-y-0.5">
        <SidebarLink to="/biz/settings" icon={Settings} label="Settings" />
        <button onClick={onSwitchCustomer}
          className="flex items-center gap-3 w-full px-3 py-2 text-sm text-[#1D9E75] hover:bg-brand-green-light rounded-lg transition">
          <Repeat className="w-4 h-4" /> Switch to Customer
        </button>
      </div>
    </>
  )
}

export default function BusinessLayout() {
  const navigate = useNavigate()
  const { user, switchRole } = useAuthStore()
  const { shop } = useMyShop()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  const handleSwitchCustomer = async () => {
    try { await client.post('/auth/switch-role', { role: 'customer' }) } catch {}
    switchRole('customer')
    navigate('/app/home')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-100 z-40">
        <SidebarContent shop={shop} onSwitchCustomer={handleSwitchCustomer} />
      </aside>

      {/* Main content */}
      <div className="lg:ml-64 min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
          <div className="flex items-center h-14 px-4 lg:px-6">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-2 mr-2 text-gray-500">
              <Menu className="w-5 h-5" />
            </button>
            {/* Mobile logo */}
            <Link to="/biz/dashboard" className="lg:hidden flex items-center gap-2 mr-3">
              <div className="w-7 h-7 bg-gradient-to-br from-[#1D9E75] to-[#2DB88A] rounded-lg flex items-center justify-center text-white text-xs font-bold">
                {shop?.name?.[0] || 'S'}
              </div>
            </Link>
            <div className="ml-auto flex items-center gap-2">
              <span className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${shop?.is_active !== false ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${shop?.is_active !== false ? 'bg-green-500' : 'bg-red-500'}`} />
                {shop?.is_active !== false ? 'Open' : 'Closed'}
              </span>
              <NotificationBell />
              <div className="w-8 h-8 bg-gradient-to-br from-[#1D9E75] to-[#2DB88A] rounded-full flex items-center justify-center text-white text-xs font-bold">
                {user?.name?.[0]?.toUpperCase() || 'B'}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 bg-white shadow-xl flex flex-col h-full">
            <div className="flex items-center justify-end p-2">
              <button onClick={() => setMobileOpen(false)} className="p-2 text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <SidebarContent shop={shop} onSwitchCustomer={handleSwitchCustomer} />
          </aside>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-40" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex justify-around py-1.5">
          {[
            { to: '/biz/dashboard', icon: Home, label: 'Home' },
            { to: '/biz/catalog', icon: Box, label: 'Products' },
            { to: '/biz/orders', icon: ShoppingBag, label: 'Orders' },
            { to: '/biz/analytics', icon: BarChart2, label: 'Insights' },
          ].map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => `flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[48px] transition ${isActive ? 'text-[#1D9E75]' : 'text-gray-400'}`}>
              {({ isActive }) => (
                <>
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                  <span className="text-[10px] font-semibold">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
