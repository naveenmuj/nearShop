import SpinWheel from '../../components/SpinWheel'
import { useToast } from '../../components/ui/Toast/useToast'

export default function SpinWheelPage() {
  const { showCoinToast } = useToast() || {}

  const handleWin = (data) => {
    if (data?.coins > 0 && showCoinToast) {
      showCoinToast(data.coins, 'Coins added to your wallet!')
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Daily Spin</h1>
        <p className="text-gray-500 text-sm">Spin once every day to win coins and rewards!</p>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
        <SpinWheel onWin={handleWin} />
      </div>

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <h3 className="text-sm font-bold text-amber-800 mb-2">How it works</h3>
        <ul className="space-y-1 text-xs text-amber-700">
          <li>• Spin the wheel once every 24 hours</li>
          <li>• Win coins that can be redeemed on purchases</li>
          <li>• 2× Boost doubles your next order's coin reward</li>
          <li>• Check your wallet to see your coin balance</li>
        </ul>
      </div>
    </div>
  )
}
