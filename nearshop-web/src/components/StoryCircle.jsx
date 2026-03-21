import { Store } from 'lucide-react'

export default function StoryCircle({ story, onClick, className = '' }) {
  const { shop_name, shop_logo_url, has_unseen } = story

  return (
    <button
      onClick={() => onClick?.(story)}
      className={`flex flex-col items-center gap-1 flex-shrink-0 w-[72px] ${className}`}
    >
      <div className={`rounded-full p-0.5 ${has_unseen ? 'bg-gradient-to-br from-primary-500 to-secondary-400' : 'bg-gray-200'}`}>
        <div className="rounded-full bg-white p-0.5">
          <div className="h-14 w-14 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center">
            {shop_logo_url ? (
              <img src={shop_logo_url} alt={shop_name} className="h-full w-full object-cover" />
            ) : (
              <Store className="h-6 w-6 text-gray-400" />
            )}
          </div>
        </div>
      </div>
      <span className="text-[11px] text-gray-700 text-center leading-tight truncate w-full">
        {shop_name}
      </span>
    </button>
  )
}
