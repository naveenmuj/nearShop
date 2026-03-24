import { useNavigate } from 'react-router-dom'

/* ── Inline SVG illustrations ── */
const SVG_CART = (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="38" fill="#F3F4F6" />
    <path d="M22 24h5l5 24h22l4-16H30" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="35" cy="52" r="3" fill="#D1D5DB" />
    <circle cx="52" cy="52" r="3" fill="#D1D5DB" />
  </svg>
)
const SVG_WISHLIST = (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="38" fill="#FEF2F2" />
    <path d="M40 55 C40 55 22 44 22 32a9 9 0 0 1 18-1.5A9 9 0 0 1 58 32C58 44 40 55 40 55Z" stroke="#FCA5A5" strokeWidth="2.5" fill="none" />
  </svg>
)
const SVG_ORDERS = (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="38" fill="#F0FDF4" />
    <rect x="25" y="22" width="30" height="36" rx="4" stroke="#86EFAC" strokeWidth="2.5" />
    <path d="M32 34h16M32 40h12M32 46h8" stroke="#86EFAC" strokeWidth="2" strokeLinecap="round" />
  </svg>
)
const SVG_SEARCH = (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="38" fill="#EEF2FF" />
    <circle cx="37" cy="36" r="12" stroke="#A5B4FC" strokeWidth="2.5" />
    <path d="M46 46l10 10" stroke="#A5B4FC" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M33 33l2-2M38 30h2" stroke="#A5B4FC" strokeWidth="2" strokeLinecap="round" />
  </svg>
)
const SVG_RECENTLY_VIEWED = (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="38" fill="#FFFBEB" />
    <circle cx="40" cy="40" r="14" stroke="#FCD34D" strokeWidth="2.5" />
    <path d="M40 32v8l5 4" stroke="#FCD34D" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
)
const SVG_NOTIFICATIONS = (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="38" fill="#F5F3FF" />
    <path d="M40 22a12 12 0 0 1 12 12v6l3 5H25l3-5v-6A12 12 0 0 1 40 22Z" stroke="#C4B5FD" strokeWidth="2.5" />
    <path d="M37 52a3 3 0 0 0 6 0" stroke="#C4B5FD" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
)
const SVG_DEFAULT = (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="38" fill="#F9FAFB" />
    <rect x="27" y="27" width="26" height="26" rx="6" stroke="#D1D5DB" strokeWidth="2.5" />
    <path d="M34 40h12M40 34v12" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
)

const EMPTY_STATE_CONFIGS = {
  cart: {
    svg: SVG_CART,
    title: 'Your cart is empty',
    subtitle: 'Add items from nearby shops to get started.',
    ctaText: 'Browse Products',
    ctaPath: '/app/search',
  },
  wishlist: {
    svg: SVG_WISHLIST,
    title: 'No saved items yet',
    subtitle: 'Tap the heart icon on any product to save it here.',
    ctaText: 'Discover Products',
    ctaPath: '/app/search',
  },
  orders: {
    svg: SVG_ORDERS,
    title: 'No orders yet',
    subtitle: 'Your orders will appear here once you make a purchase.',
    ctaText: 'Start Shopping',
    ctaPath: '/app/search',
  },
  search: {
    svg: SVG_SEARCH,
    title: 'Nothing found',
    subtitle: 'Try different keywords or browse by category.',
    ctaText: 'Browse Categories',
    ctaPath: '/app/categories',
  },
  'recently-viewed': {
    svg: SVG_RECENTLY_VIEWED,
    title: 'No recent views',
    subtitle: 'Products you browse will appear here.',
    ctaText: 'Start Browsing',
    ctaPath: '/app/search',
  },
  notifications: {
    svg: SVG_NOTIFICATIONS,
    title: 'All caught up!',
    subtitle: "You don't have any notifications right now.",
    ctaText: null,
    ctaPath: null,
  },
  default: {
    svg: SVG_DEFAULT,
    title: 'Nothing here yet',
    subtitle: '',
    ctaText: null,
    ctaPath: null,
  },
}

/**
 * Enhanced EmptyState component.
 * Props:
 *   type: keyof EMPTY_STATE_CONFIGS (overrides icon/title/message)
 *   icon: React component (used when no type given, for backward compat)
 *   title, message: string overrides
 *   action: CTA text override
 *   onAction: callback override (if omitted, uses ctaPath navigation)
 */
export default function EmptyState({
  type,
  icon: Icon,
  title,
  message,
  action,
  onAction,
}) {
  const navigate = useNavigate()
  const config = EMPTY_STATE_CONFIGS[type] || EMPTY_STATE_CONFIGS.default

  const displayTitle    = title   || config.title
  const displaySubtitle = message || config.subtitle
  const ctaText = action || config.ctaText
  const handleCta = onAction || (config.ctaPath ? () => navigate(config.ctaPath) : null)

  return (
    <div className="empty-state-fade flex flex-col items-center justify-center py-14 px-4 text-center">
      {/* SVG illustration or legacy icon */}
      {type ? (
        <div className="mb-5">{config.svg}</div>
      ) : Icon ? (
        <Icon className="h-16 w-16 text-gray-300 mb-4" />
      ) : (
        <div className="mb-5">{SVG_DEFAULT}</div>
      )}

      <h3 className="text-lg font-semibold text-gray-900 mb-1">{displayTitle}</h3>
      {displaySubtitle && (
        <p className="text-sm text-gray-500 max-w-xs leading-relaxed mb-5">{displaySubtitle}</p>
      )}

      {ctaText && handleCta && (
        <button
          onClick={handleCta}
          className="bg-brand-purple text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-brand-purple/90 transition"
        >
          {ctaText}
        </button>
      )}
    </div>
  )
}
