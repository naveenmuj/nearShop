import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useEffect, lazy, Suspense } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './config/firebase'
import api from './api/client'

// Layouts
const CustomerLayout = lazy(() => import('./layouts/CustomerLayout'))
const BusinessLayout = lazy(() => import('./layouts/BusinessLayout'))

// Auth pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const VerifyOTPPage = lazy(() => import('./pages/auth/VerifyOTPPage'))
const RoleSelectPage = lazy(() => import('./pages/auth/RoleSelectPage'))
const CustomerOnboard = lazy(() => import('./pages/auth/CustomerOnboard'))
const BusinessOnboard = lazy(() => import('./pages/auth/BusinessOnboard'))

// Customer pages
const HomePage = lazy(() => import('./pages/customer/HomePage'))
const SearchPage = lazy(() => import('./pages/customer/SearchPage'))
const ShopDetailPage = lazy(() => import('./pages/customer/ShopDetailPage'))
const ProductDetailPage = lazy(() => import('./pages/customer/ProductDetailPage'))
const DealsPage = lazy(() => import('./pages/customer/DealsPage'))
const WishlistPage = lazy(() => import('./pages/customer/WishlistPage'))
const OrdersPage = lazy(() => import('./pages/customer/OrdersPage'))
const ProfilePage = lazy(() => import('./pages/customer/ProfilePage'))
const CommunityPage = lazy(() => import('./pages/customer/CommunityPage'))
const WalletPage = lazy(() => import('./pages/customer/WalletPage'))
const HagglePage = lazy(() => import('./pages/customer/HagglePage'))
const ShopsMapPage = lazy(() => import('./pages/customer/ShopsMapPage'))
const CategoriesPage = lazy(() => import('./pages/customer/CategoriesPage'))
const NotificationsPage  = lazy(() => import('./pages/customer/NotificationsPage'))
const AchievementsPage  = lazy(() => import('./pages/customer/AchievementsPage'))
const SpinWheelPage     = lazy(() => import('./pages/customer/SpinWheelPage'))

// Admin
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))

// Business pages
const DashboardPage = lazy(() => import('./pages/business/DashboardPage'))
const CatalogPage = lazy(() => import('./pages/business/CatalogPage'))
const SnapListPage = lazy(() => import('./pages/business/SnapListPage'))
const BizOrdersPage = lazy(() => import('./pages/business/OrdersPage'))
const DealsCreatorPage = lazy(() => import('./pages/business/DealsCreatorPage'))
const StoriesPage = lazy(() => import('./pages/business/StoriesPage'))
const HaggleInboxPage = lazy(() => import('./pages/business/HaggleInboxPage'))
const AnalyticsPage = lazy(() => import('./pages/business/AnalyticsPage'))
const SettingsPage = lazy(() => import('./pages/business/SettingsPage'))
const ReviewsPage = lazy(() => import('./pages/business/ReviewsPage'))
const CustomersPage = lazy(() => import('./pages/business/CustomersPage'))
const UdhaarPage = lazy(() => import('./pages/business/UdhaarPage'))
const BillingPage = lazy(() => import('./pages/business/BillingPage'))
const MarketingPage = lazy(() => import('./pages/business/MarketingPage'))
const ExpensesPage = lazy(() => import('./pages/business/ExpensesPage'))
const InventoryPage = lazy(() => import('./pages/business/InventoryPage'))
const ReportsPage = lazy(() => import('./pages/business/ReportsPage'))
const BroadcastPage = lazy(() => import('./pages/business/BroadcastPage'))
const AdvisorPage = lazy(() => import('./pages/business/AdvisorPage'))
const FestivalCalendarPage = lazy(() => import('./pages/business/FestivalCalendarPage'))
const ShopWebsite = lazy(() => import('./pages/public/ShopWebsite'))

function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, authReady, user } = useAuthStore()

  // Wait for Firebase to confirm auth state before making any redirect decision.
  // Without this check the app flashes to /auth/login on every hard refresh
  // while Firebase is async-loading its session from IndexedDB.
  if (!authReady) return <Loading />

  if (!isAuthenticated) return <Navigate to="/auth/login" replace />
  if (requiredRole && user?.active_role !== requiredRole) {
    return <Navigate to={user?.active_role === 'business' ? '/biz/dashboard' : '/app/home'} replace />
  }
  return children
}

function Loading() {
  return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
}

export default function App() {
  const { isAuthenticated, user } = useAuthStore()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const { user, login, setAuthReady } = useAuthStore.getState()

      if (!firebaseUser) {
        // Firebase has definitively no session — clear local store without calling signOut again
        useAuthStore.setState({ user: null, isAuthenticated: false, authReady: true })
        return
      }

      // Firebase session is valid.
      if (user) {
        // Store already has user (from localStorage) — just mark auth as ready.
        setAuthReady()
        return
      }

      // Firebase session exists but store is empty (first load on a new tab, cleared storage, etc.)
      // Exchange the Firebase token for a NearShop JWT + user profile.
      try {
        const idToken = await firebaseUser.getIdToken()
        const { data } = await api.post('/auth/firebase-signin', { firebase_token: idToken })
        login(data.user, data.access_token) // also sets authReady: true
      } catch (err) {
        const status = err?.response?.status
        if (status === 401 || status === 403 || status === 404) {
          // Account missing from our DB — sign out cleanly
          await auth.signOut()
          useAuthStore.setState({ user: null, isAuthenticated: false, authReady: true })
        } else {
          // Backend down / network error — keep Firebase session, mark ready so UI doesn't hang
          useAuthStore.setState({ authReady: true })
        }
      }
    })

    return () => unsubscribe()
  }, [])

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* Auth */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/verify" element={<VerifyOTPPage />} />
        <Route path="/auth/select-role" element={<RoleSelectPage />} />
        <Route path="/auth/onboard/customer" element={<CustomerOnboard />} />
        <Route path="/auth/onboard/business" element={<BusinessOnboard />} />

        {/* Customer */}
        <Route path="/app" element={<ProtectedRoute requiredRole="customer"><CustomerLayout /></ProtectedRoute>}>
          <Route index element={<HomePage />} />
          <Route path="home" element={<HomePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="shop/:shopId" element={<ShopDetailPage />} />
          <Route path="product/:productId" element={<ProductDetailPage />} />
          <Route path="deals" element={<DealsPage />} />
          <Route path="wishlist" element={<WishlistPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="community" element={<CommunityPage />} />
          <Route path="wallet" element={<WalletPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="haggle" element={<HagglePage />} />
          <Route path="shops/map" element={<ShopsMapPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="notifications"  element={<NotificationsPage />} />
          <Route path="achievements"   element={<AchievementsPage />} />
          <Route path="spin"           element={<SpinWheelPage />} />
        </Route>

        {/* Business */}
        <Route path="/biz" element={<ProtectedRoute requiredRole="business"><BusinessLayout /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="catalog/new" element={<SnapListPage />} />
          <Route path="snap" element={<SnapListPage />} />
          <Route path="orders" element={<BizOrdersPage />} />
          <Route path="deals" element={<DealsCreatorPage />} />
          <Route path="deals/new" element={<DealsCreatorPage />} />
          <Route path="stories" element={<StoriesPage />} />
          <Route path="stories/new" element={<StoriesPage />} />
          <Route path="haggle" element={<HaggleInboxPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="reviews" element={<ReviewsPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="udhaar" element={<UdhaarPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="marketing" element={<MarketingPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="broadcast" element={<BroadcastPage />} />
          <Route path="advisor" element={<AdvisorPage />} />
          <Route path="festivals" element={<FestivalCalendarPage />} />
        </Route>

        {/* Admin */}
        <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />

        {/* Public shop page — no auth required */}
        <Route path="/shop/:slug" element={<ShopWebsite />} />

        {/* Default redirect */}
        <Route path="/" element={
          isAuthenticated
            ? <Navigate to={user?.active_role === 'business' ? '/biz/dashboard' : '/app/home'} replace />
            : <Navigate to="/auth/login" replace />
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
