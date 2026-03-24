import { useState, useEffect } from 'react'
import { getOrderTracking } from '../api/engagement'

const STEPS = [
  { key: 'placed',    label: 'Order Placed',   icon: '📋' },
  { key: 'confirmed', label: 'Confirmed',       icon: '✅' },
  { key: 'packed',    label: 'Packed',          icon: '📦' },
  { key: 'shipped',   label: 'Shipped',         icon: '🚚' },
  { key: 'delivered', label: 'Delivered',       icon: '🏠' },
]

function stepIndex(status) {
  const s = (status || '').toLowerCase()
  if (s === 'placed' || s === 'pending')  return 0
  if (s === 'confirmed')                  return 1
  if (s === 'packed' || s === 'preparing') return 2
  if (s === 'shipped')                    return 3
  if (s === 'delivered' || s === 'completed') return 4
  return 0
}

export default function OrderTimeline({ orderId, status }) {
  const [tracking, setTracking] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orderId) { setLoading(false); return }
    getOrderTracking(orderId)
      .then(({ data }) => setTracking(data))
      .catch(() => setTracking(null))
      .finally(() => setLoading(false))
  }, [orderId])

  const current = stepIndex(tracking?.status || status)
  const estimatedDelivery = tracking?.estimated_delivery

  if (loading) {
    return (
      <div className="space-y-3 py-2">
        {STEPS.map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton-shimmer w-8 h-8 rounded-full flex-shrink-0" />
            <div className="skeleton-shimmer h-4 rounded-md w-32" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Estimated delivery banner */}
      {estimatedDelivery && (
        <div className="bg-brand-green/10 border border-brand-green/20 rounded-xl px-4 py-2.5 mb-5 flex items-center gap-2">
          <span className="text-lg">🚚</span>
          <div>
            <p className="text-xs font-semibold text-brand-green">Estimated Delivery</p>
            <p className="text-sm font-bold text-gray-800">
              {new Date(estimatedDelivery).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            </p>
          </div>
        </div>
      )}

      {/* Timeline steps */}
      <div className="space-y-0">
        {STEPS.map((step, i) => {
          const done    = i < current
          const active  = i === current
          const future  = i > current

          return (
            <div key={step.key} className="flex items-start gap-4">
              {/* Left: circle + connecting line */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-base transition-all
                    ${done   ? 'bg-brand-green text-white shadow-sm' : ''}
                    ${active ? 'bg-brand-purple text-white shadow-md timeline-pulse' : ''}
                    ${future ? 'bg-gray-100 text-gray-400 border-2 border-dashed border-gray-200' : ''}
                  `}
                >
                  {step.icon}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`w-0.5 h-8 mt-0.5 ${done ? 'bg-brand-green' : 'bg-gray-200 border-l-2 border-dashed border-gray-200 w-0'}`}
                    style={future ? { borderLeft: '2px dashed #e5e7eb', width: 0 } : {}}
                  >
                    {done && <div className="w-0.5 h-8 bg-brand-green" />}
                    {!done && <div className="w-0.5 h-8 bg-gray-200" style={{ borderLeft: '2px dashed #e5e7eb' }} />}
                  </div>
                )}
              </div>

              {/* Right: label */}
              <div className={`pb-6 ${i === STEPS.length - 1 ? 'pb-0' : ''}`}>
                <p className={`text-sm font-semibold transition-colors
                  ${done   ? 'text-brand-green' : ''}
                  ${active ? 'text-brand-purple' : ''}
                  ${future ? 'text-gray-400' : ''}
                `}>
                  {step.label}
                </p>
                {active && tracking?.updated_at && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(tracking.updated_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                {done && tracking?.steps?.[i]?.timestamp && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(tracking.steps[i].timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
