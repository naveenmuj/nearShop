import { Outlet, NavLink } from 'react-router-dom'
import { Home, Search, Tag, Heart, User } from 'lucide-react'
import NotificationBell from '../components/NotificationBell'
import { useAuthStore } from '../store/authStore'

const NAV = [
  { to: '/app/home',     icon: Home,   label: 'Home'    },
  { to: '/app/search',   icon: Search, label: 'Search'  },
  { to: '/app/deals',    icon: Tag,    label: 'Deals'   },
  { to: '/app/wishlist', icon: Heart,  label: 'Wishlist'},
  { to: '/app/profile',  icon: User,   label: 'Profile' },
]

export default function CustomerLayout() {
  const { user } = useAuthStore()
  const initial = user?.name?.charAt(0)?.toUpperCase() || '?'

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 max-w-lg mx-auto">
      {/* Top header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-[#5B2BE7] to-[#7F77DD] rounded-lg flex items-center justify-center">
              <span className="text-sm">🛍️</span>
            </div>
            <span className="text-base font-extrabold text-[#5B2BE7] tracking-tight">NearShop</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="w-8 h-8 bg-gradient-to-br from-[#5B2BE7] to-[#7F77DD] rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
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
                  `flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl min-w-[56px] transition-all duration-200 ${
                    isActive
                      ? 'bg-[#5B2BE7]/10 text-[#5B2BE7]'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`transition-all duration-200 ${isActive ? 'w-5 h-5 stroke-[2.5]' : 'w-5 h-5 stroke-[1.8]'}`}
                    />
                    <span className={`text-[10px] font-semibold transition-all ${isActive ? 'text-[#5B2BE7]' : ''}`}>
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
