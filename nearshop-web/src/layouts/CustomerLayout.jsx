import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import { Home, Search, Tag, Heart, User, MapPin, ChevronDown, Bell, ShoppingBag, ShoppingCart, LogOut, Settings, Repeat, Wallet, MessageSquare, Users, Trophy, Gift } from 'lucide-react'
import NotificationBell from '../components/NotificationBell'
import CartSidebar from '../components/CartSidebar'
import BackToTop from '../components/ui/BackToTop'
import SearchSuggestions from '../components/SearchSuggestions'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import { useLocationStore } from '../store/locationStore'
import { useThemeStore } from '../store/themeStore'
import ThemeToggle from '../components/ThemeToggle'
import client from '../api/client'

export default function CustomerLayout() {
  const navigate = useNavigate()
  const { user, logout, switchRole } = useAuthStore()
  const { address } = useLocationStore()
  const [profileOpen, setProfileOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const cartItemCount = useCartStore((s) => s.getItemCount)()
  const profileRef = useRef(null)
  const initial = user?.name?.charAt(0)?.toUpperCase() || '?'
  const locality = address?.split(',')[0] || 'Set location'

  useEffect(() => { useThemeStore.getState().initTheme() }, [])

  useEffect(() => {
    const handler = (e) => { if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const hasBusiness = Array.isArray(user?.roles) && user.roles.includes('business')

  const handleSwitchBiz = async () => {
    if (!hasBusiness) {
      navigate('/auth/onboard/business')
      return
    }
    try {
      await client.post('/auth/switch-role', { role: 'business' })
    } catch {}
    switchRole('business')
    navigate('/biz/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1117] flex flex-col">
      {/* ── TOP NAVBAR ───────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-8xl mx-auto px-4 lg:px-8">
          <div className="flex items-center h-16 gap-4 lg:gap-6">
            {/* Logo */}
            <Link to="/app/home" className="flex items-center gap-2 flex-shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-brand-purple to-brand-purple-dark rounded-lg flex items-center justify-center">
                <span className="text-sm">🛍️</span>
              </div>
              <span className="text-xl font-extrabold text-brand-purple hidden sm:block">NearShop</span>
            </Link>

            {/* Location (desktop) */}
            <button className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition max-w-[200px]">
              <MapPin className="w-3.5 h-3.5 text-brand-purple flex-shrink-0" />
              <span className="truncate">{locality}</span>
              <ChevronDown className="w-3 h-3 flex-shrink-0" />
            </button>

            {/* Search bar with suggestions (desktop) */}
            <div className="hidden md:flex flex-1 max-w-xl">
              <SearchSuggestions className="w-full" />
            </div>

            {/* Desktop nav links */}
            <nav className="hidden lg:flex items-center gap-1">
              {[
                { to: '/app/home',    label: 'Home' },
                { to: '/app/deals',   label: 'Deals' },
                { to: '/app/spin',    label: '🎰 Spin' },
                { to: '/app/community', label: 'Community' },
              ].map(n => (
                <NavLink key={n.to} to={n.to}
                  className={({ isActive }) => `px-3 py-2 rounded-lg text-sm font-medium transition ${isActive ? 'text-brand-purple bg-brand-purple-light' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'}`}>
                  {n.label}
                </NavLink>
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-1 ml-auto">
              <button onClick={() => setCartOpen(true)} className="hidden sm:flex relative p-2 text-gray-400 hover:text-brand-purple hover:bg-brand-purple-light rounded-lg transition">
                <ShoppingCart className="w-5 h-5" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-brand-red text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </span>
                )}
              </button>
              <Link to="/app/wishlist" className="hidden sm:flex relative p-2 text-gray-400 hover:text-brand-purple hover:bg-brand-purple-light rounded-lg transition">
                <Heart className="w-5 h-5" />
              </Link>
              <NotificationBell />

              {/* Profile dropdown (desktop) */}
              <div className="relative" ref={profileRef}>
                <button onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-50 transition">
                  <div className="w-8 h-8 bg-gradient-to-br from-brand-purple to-brand-purple-dark rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {initial}
                  </div>
                  <span className="hidden lg:block text-sm font-medium text-gray-700 max-w-[100px] truncate">{user?.name}</span>
                  <ChevronDown className="hidden lg:block w-3 h-3 text-gray-400" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                    <div className="px-4 py-2.5 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900">{user?.name || 'Guest'}</p>
                      <p className="text-xs text-gray-400">{user?.phone || user?.email}</p>
                    </div>
                    {[
                      { to: '/app/orders',       icon: ShoppingBag,  label: 'My Orders' },
                      { to: '/app/wishlist',      icon: Heart,        label: 'Wishlist' },
                      { to: '/app/wallet',        icon: Wallet,       label: 'Wallet & Coins' },
                      { to: '/app/achievements',  icon: Trophy,       label: 'Achievements' },
                      { to: '/app/spin',          icon: Gift,         label: 'Daily Spin' },
                      { to: '/app/haggle',        icon: MessageSquare, label: 'My Haggles' },
                      { to: '/app/community',     icon: Users,        label: 'Community' },
                      { to: '/app/profile',       icon: Settings,     label: 'Settings' },
                    ].map(item => (
                      <Link key={item.to} to={item.to} onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition">
                        <item.icon className="w-4 h-4" /> {item.label}
                      </Link>
                    ))}
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button onClick={handleSwitchBiz}
                        className="flex items-center gap-3 px-4 py-2 w-full text-sm text-brand-purple hover:bg-brand-purple-light transition">
                        {hasBusiness ? <Repeat className="w-4 h-4" /> : <span className="text-sm">🚀</span>}
                        {hasBusiness ? 'Switch to Business' : 'Register Business'}
                      </button>
                      <button onClick={() => { logout(); navigate('/auth/login') }}
                        className="flex items-center gap-3 px-4 py-2 w-full text-sm text-brand-red hover:bg-brand-red-light transition">
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile search (below nav on small screens) */}
          <div className="md:hidden pb-3" onClick={() => navigate('/app/search')}>
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl h-10 px-3 gap-2">
              <Search className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">Search products, shops...</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <main className="flex-1">
        <div className="max-w-8xl mx-auto px-4 lg:px-8 py-4 lg:py-6">
          <Outlet />
        </div>
      </main>

      {/* ── FOOTER (desktop) ─────────────────────────────────── */}
      <footer className="hidden md:block bg-white border-t border-gray-100 mt-auto">
        <div className="max-w-8xl mx-auto px-4 lg:px-8 py-10">
          <div className="grid grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🛍️</span>
                <span className="text-lg font-bold text-brand-purple">NearShop</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">Discover local shops near you. Support neighborhood businesses.</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 mb-3 text-sm">Shop</h4>
              <div className="space-y-2 text-sm text-gray-500">
                <Link to="/app/search" className="block hover:text-brand-purple transition">Browse Products</Link>
                <Link to="/app/deals" className="block hover:text-brand-purple transition">Live Deals</Link>
                <Link to="/app/community" className="block hover:text-brand-purple transition">Community</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 mb-3 text-sm">For Business</h4>
              <div className="space-y-2 text-sm text-gray-500">
                <Link to="/auth/login" className="block hover:text-brand-purple transition">List Your Shop</Link>
                <span className="block">Help Center</span>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 mb-3 text-sm">Company</h4>
              <div className="space-y-2 text-sm text-gray-500">
                <span className="block">About Us</span>
                <span className="block">Contact</span>
                <span className="block">Privacy Policy</span>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-100 mt-8 pt-6 text-center text-sm text-gray-400">
            2026 NearShop. All rights reserved.
          </div>
        </div>
      </footer>

      {/* ── MOBILE BOTTOM NAV (< md) ────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex justify-around py-1.5">
          {[
            { to: '/app/home',    icon: Home,   label: 'Home' },
            { to: '/app/search',  icon: Search, label: 'Search' },
            { to: '/app/deals',   icon: Tag,    label: 'Deals' },
            { to: '/app/wishlist', icon: Heart, label: 'Wishlist' },
            { to: '/app/profile', icon: User,   label: 'Profile' },
          ].map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => `flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[48px] transition ${isActive ? 'text-brand-purple' : 'text-gray-400'}`}>
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
      {/* Spacer for mobile bottom nav */}
      <div className="md:hidden h-16" />

      {/* ── FLOATING UI ──────────────────────────────────────── */}
      <BackToTop />
      <CartSidebar isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  )
}
