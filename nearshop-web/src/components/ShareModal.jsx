import { Fragment, useState, useEffect, useCallback, useRef } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, Copy, Check, ExternalLink, Link2, QrCode, Share2 } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Share channel definitions                                         */
/* ------------------------------------------------------------------ */

const SHARE_CHANNELS = [
  {
    name: 'WhatsApp',
    color: '#25D366',
    bgClass: 'bg-[#25D366]',
    hoverClass: 'hover:bg-[#1ebe59]',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
    getUrl: (text, url) =>
      `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
  },
  {
    name: 'Telegram',
    color: '#0088cc',
    bgClass: 'bg-[#0088cc]',
    hoverClass: 'hover:bg-[#006daa]',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.492-1.302.48-.428-.012-1.252-.242-1.865-.442-.751-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
    getUrl: (text, url) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    name: 'Twitter',
    color: '#000000',
    bgClass: 'bg-black',
    hoverClass: 'hover:bg-gray-800',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    getUrl: (text, url) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    name: 'Facebook',
    color: '#1877F2',
    bgClass: 'bg-[#1877F2]',
    hoverClass: 'hover:bg-[#1466d1]',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    getUrl: (_text, url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
]

/* ------------------------------------------------------------------ */
/*  Entity-specific message formatters                                */
/* ------------------------------------------------------------------ */

function buildShareText({ title, text, entityType }) {
  const prefix =
    entityType === 'product' ? 'Check out this product'
    : entityType === 'deal'  ? 'Amazing deal alert'
    : entityType === 'shop'  ? 'Discover this shop'
    : 'Check this out'

  if (text) return `${prefix}: ${text}`
  if (title) return `${prefix}: ${title}`
  return prefix + ' on NearShop!'
}

/* ------------------------------------------------------------------ */
/*  Mini QR placeholder (SVG-based)                                   */
/* ------------------------------------------------------------------ */

function QrPlaceholder({ url }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="w-36 h-36 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-600 flex items-center justify-center relative overflow-hidden">
        {/* Decorative QR-like grid */}
        <div className="absolute inset-3 grid grid-cols-7 grid-rows-7 gap-[2px] opacity-20">
          {Array.from({ length: 49 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[1px]"
              style={{
                backgroundColor:
                  /* Corner finder patterns */
                  (i < 3 || (i >= 7 && i < 10) || (i >= 14 && i < 17) ||
                   (i >= 4 && i <= 6) || (i >= 11 && i <= 13) || (i >= 18 && i <= 20) ||
                   i === 42 || i === 43 || i === 44 || i === 35 || i === 36 || i === 37 ||
                   i === 28 || i === 29 || i === 30)
                    ? '#7F77DD'
                    : Math.random() > 0.5 ? '#7F77DD' : 'transparent',
              }}
            />
          ))}
        </div>
        <QrCode className="w-10 h-10 text-brand-purple relative z-10" />
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center max-w-[200px] leading-relaxed">
        Scan to open on another device
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  ShareModal component                                              */
/* ------------------------------------------------------------------ */

export default function ShareModal({
  isOpen,
  onClose,
  title = '',
  text = '',
  url = '',
  image = '',
  entityType = '',   // 'product' | 'deal' | 'shop'
  entityId = null,
}) {
  const [copied, setCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [nativeShareAvailable] = useState(() =>
    typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  )
  const copyTimeoutRef = useRef(null)

  // Resolve the shareable URL
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '')
  const shareText = buildShareText({ title, text, entityType })

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCopied(false)
      setShowQr(false)
    }
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [isOpen])

  /* ---- Copy to clipboard ---- */
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea')
      ta.value = shareUrl
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2500)
    }
  }, [shareUrl])

  /* ---- Native share ---- */
  const handleNativeShare = useCallback(async () => {
    try {
      const data = { title: title || 'NearShop', text: shareText, url: shareUrl }
      await navigator.share(data)
    } catch {
      // User cancelled or share failed silently
    }
  }, [title, shareText, shareUrl])

  /* ---- Open share channel in new tab ---- */
  const openChannel = useCallback(
    (channel) => {
      const href = channel.getUrl(shareText, shareUrl)
      window.open(href, '_blank', 'noopener,noreferrer,width=600,height=500')
    },
    [shareText, shareUrl],
  )

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[9999]" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        {/* Panel container */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-end sm:items-center justify-center sm:p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-full sm:translate-y-8 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-full sm:translate-y-8 sm:scale-95"
            >
              <Dialog.Panel className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-2xl transform transition-all overflow-hidden">
                {/* Drag handle (mobile) */}
                <div className="sm:hidden flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-4 pb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-brand-purple/10 dark:bg-brand-purple/20 flex items-center justify-center">
                      <Share2 className="w-4.5 h-4.5 text-brand-purple" />
                    </div>
                    <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-white">
                      Share
                    </Dialog.Title>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Preview card */}
                {(title || image) && (
                  <div className="mx-6 mt-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl flex items-center gap-3">
                    {image && (
                      <img
                        src={image}
                        alt=""
                        className="w-14 h-14 rounded-lg object-cover flex-shrink-0 ring-1 ring-gray-200 dark:ring-gray-700"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      {entityType && (
                        <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-brand-purple mb-0.5">
                          {entityType}
                        </span>
                      )}
                      {title && (
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">
                          {title}
                        </p>
                      )}
                      {text && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {text}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Share channels grid */}
                <div className="px-6 pt-5 pb-2">
                  <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                    Share via
                  </p>
                  <div className="grid grid-cols-4 gap-3">
                    {SHARE_CHANNELS.map((channel) => (
                      <button
                        key={channel.name}
                        onClick={() => openChannel(channel)}
                        className="group flex flex-col items-center gap-2 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                      >
                        <div
                          className={`w-12 h-12 rounded-2xl ${channel.bgClass} ${channel.hoverClass} flex items-center justify-center text-white shadow-lg transition-all duration-200 group-hover:scale-110 group-hover:shadow-xl group-active:scale-95`}
                          style={{
                            boxShadow: `0 4px 14px ${channel.color}40`,
                          }}
                        >
                          {channel.icon}
                        </div>
                        <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                          {channel.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="mx-6 my-3 border-t border-gray-100 dark:border-gray-800" />

                {/* Action buttons row */}
                <div className="px-6 pb-2 flex gap-2">
                  {/* Copy Link button */}
                  <button
                    onClick={handleCopy}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                      copied
                        ? 'bg-brand-green/10 text-brand-green dark:bg-brand-green/20 ring-1 ring-brand-green/30'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="relative w-4 h-4">
                      <Copy
                        className={`w-4 h-4 absolute inset-0 transition-all duration-300 ${
                          copied ? 'opacity-0 scale-50 rotate-90' : 'opacity-100 scale-100 rotate-0'
                        }`}
                      />
                      <Check
                        className={`w-4 h-4 absolute inset-0 transition-all duration-300 ${
                          copied ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'
                        }`}
                      />
                    </span>
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>

                  {/* QR Code toggle */}
                  <button
                    onClick={() => setShowQr((v) => !v)}
                    className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      showQr
                        ? 'bg-brand-purple/10 text-brand-purple dark:bg-brand-purple/20 ring-1 ring-brand-purple/30'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                    title="Show QR Code"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>

                  {/* Native Share (if available) */}
                  {nativeShareAvailable && (
                    <button
                      onClick={handleNativeShare}
                      className="px-4 py-3 rounded-xl bg-brand-purple text-white text-sm font-semibold hover:bg-brand-purple-dark transition-colors shadow-md hover:shadow-lg"
                      style={{ boxShadow: '0 4px 14px #7F77DD40' }}
                      title="More sharing options"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* QR Code Section (animated) */}
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    showQr ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-6">
                    <QrPlaceholder url={shareUrl} />
                  </div>
                </div>

                {/* URL preview */}
                <div className="px-6 pb-5 pt-1">
                  <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/60 rounded-lg px-3 py-2.5">
                    <Link2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-400 dark:text-gray-500 truncate flex-1 font-mono">
                      {shareUrl}
                    </span>
                  </div>
                </div>

                {/* Safe area spacer for mobile */}
                <div className="sm:hidden h-2" />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
