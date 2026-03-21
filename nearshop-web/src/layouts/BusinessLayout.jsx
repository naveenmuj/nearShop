import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, Package, ShoppingBag, BarChart2, Settings } from 'lucide-react'
import NotificationBell from '../components/NotificationBell'
import { useAuthStore } from '../store/authStore'

const NAV = [
  { to: '/biz/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/biz/catalog',   icon: Package,         label: 'Catalog'   },
  { to: '/biz/orders',    icon: ShoppingBag,     label: 'Orders'    },
  { to: '/biz/analytics', icon: BarChart2,       label: 'Analytics' },
  { to: '/biz/settings',  icon: Settings,        label: 'Settings'  },
]

export default function BusinessLayout() {
  const { user } = useAuthStore()
  const initial = user?.name?.charAt(0)?.toUpperCase() || 'B'

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 max-w-lg mx-auto">
      {/* Top header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-[#1D9E75] to-[#5DCAA5] rounded-lg flex items-center justify-center">
              <span className="text-sm">🏪</span>
            </div>
            <div>
              <span className="text-base font-extrabold text-gray-900 tracking-tight">NearShop </span>
              <span className="text-xs font-bold text-[#1D9E75] bg-[#1D9E75]/10 px-1.5 py-0.5 rounded-md">BIZ</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="w-8 h-8 bg-gradient-to-br from-[#1D9E75] to-[#5DCAA5] rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {initial}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20 overflow-auto">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto">
        <div className="bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-2xl">
          <div className="flex items-center justify-around px-1 py-2">
            {NAV.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-2xl min-w-[52px] transition-all duration-200 ${
                    isActive
                      ? 'bg-[#1D9E75]/10 text-[#1D9E75]'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-5 h-5 transition-all ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                    <span className={`text-[9px] font-semibold transition-all ${isActive ? 'text-[#1D9E75]' : ''}`}>
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </div>
  )
}
