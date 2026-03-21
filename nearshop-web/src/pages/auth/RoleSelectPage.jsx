import { useNavigate } from 'react-router-dom'
import { ShoppingBag, Store, ChevronRight } from 'lucide-react'

export default function RoleSelectPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#5B2BE7] to-[#7F77DD] rounded-2xl shadow-lg shadow-purple-200 mb-4">
            <span className="text-3xl">🛍️</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">How will you use NearShop?</h1>
          <p className="text-gray-500 text-sm">You can always switch your role later</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => navigate('/auth/onboard/customer')}
            className="w-full group bg-white rounded-3xl shadow-lg border-2 border-transparent hover:border-[#5B2BE7] hover:shadow-xl hover:shadow-purple-100 transition-all duration-200 p-6 text-left active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-[#5B2BE7] to-[#7F77DD] rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md shadow-purple-200">
                <ShoppingBag className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-gray-900 mb-0.5">Customer</h3>
                <p className="text-sm text-gray-500">Discover nearby shops, get deals &amp; track orders</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#5B2BE7] transition-colors flex-shrink-0" />
            </div>
            <div className="flex gap-2 mt-4 flex-wrap">
              {['🏪 Nearby shops', '🔥 Live deals', '📦 Order tracking'].map(tag => (
                <span key={tag} className="text-xs bg-[#5B2BE7]/5 text-[#5B2BE7] px-2.5 py-1 rounded-full font-medium">{tag}</span>
              ))}
            </div>
          </button>

          <button
            onClick={() => navigate('/auth/onboard/business')}
            className="w-full group bg-white rounded-3xl shadow-lg border-2 border-transparent hover:border-[#1D9E75] hover:shadow-xl hover:shadow-green-100 transition-all duration-200 p-6 text-left active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-[#1D9E75] to-[#5DCAA5] rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md shadow-green-200">
                <Store className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-gray-900 mb-0.5">Business Owner</h3>
                <p className="text-sm text-gray-500">List your shop and reach local customers</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#1D9E75] transition-colors flex-shrink-0" />
            </div>
            <div className="flex gap-2 mt-4 flex-wrap">
              {['📊 Analytics', '💬 Haggle inbox', '🎯 Deals creator'].map(tag => (
                <span key={tag} className="text-xs bg-[#1D9E75]/5 text-[#1D9E75] px-2.5 py-1 rounded-full font-medium">{tag}</span>
              ))}
            </div>
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          Need help?{' '}
          <span className="text-[#5B2BE7] font-semibold cursor-pointer hover:underline">Contact support</span>
        </p>
      </div>
    </div>
  )
}
