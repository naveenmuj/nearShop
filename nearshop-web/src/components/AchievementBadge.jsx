import { Lock } from 'lucide-react'

export default function AchievementBadge({ achievement, size = 'md' }) {
  const { locked = false, icon, name, description, coins } = achievement

  const sizeMap = {
    sm: { wrap: 'w-16 h-16', icon: 'text-2xl', name: 'text-xs' },
    md: { wrap: 'w-20 h-20', icon: 'text-3xl', name: 'text-sm' },
    lg: { wrap: 'w-28 h-28', icon: 'text-5xl', name: 'text-base' },
  }
  const s = sizeMap[size] || sizeMap.md

  return (
    <div className={`flex flex-col items-center gap-2 ${locked ? 'opacity-50' : ''}`}>
      <div className={`relative ${s.wrap} rounded-2xl flex items-center justify-center shadow-md
        ${locked
          ? 'bg-gray-100 border-2 border-dashed border-gray-300'
          : 'bg-gradient-to-br from-yellow-400 to-amber-500 border-2 border-amber-300'
        }`}
        style={!locked ? { boxShadow: '0 4px 16px rgba(239,159,39,0.4)' } : {}}
      >
        <span className={`${s.icon} ${locked ? 'grayscale' : ''}`}>{icon || '🏆'}</span>
        {locked && (
          <div className="absolute inset-0 rounded-2xl bg-gray-100/70 flex items-center justify-center">
            <Lock className="w-5 h-5 text-gray-400" />
          </div>
        )}
      </div>
      <div className="text-center">
        <p className={`${s.name} font-semibold ${locked ? 'text-gray-400' : 'text-gray-800'} leading-tight`}>
          {name}
        </p>
        {description && size !== 'sm' && (
          <p className="text-[10px] text-gray-400 mt-0.5 max-w-[120px] mx-auto line-clamp-2">{description}</p>
        )}
        {coins > 0 && !locked && (
          <p className="text-[10px] font-bold text-amber-600 mt-0.5">🪙 {coins} coins</p>
        )}
      </div>
    </div>
  )
}
