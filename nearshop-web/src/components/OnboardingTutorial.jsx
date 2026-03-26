import { useState, useEffect, useCallback, useRef } from 'react'
import {
  LayoutDashboard,
  Camera,
  Truck,
  Tag,
  BarChart3,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  Package,
  MapPin,
  Percent,
  TrendingUp,
  Rocket,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Onboarding step definitions
// ---------------------------------------------------------------------------
const STEPS = [
  {
    id: 'welcome',
    emoji: '🏪',
    icon: LayoutDashboard,
    accentIcon: Sparkles,
    title: 'Welcome to Your Dashboard',
    subtitle: 'Your command center for everything',
    description:
      'Your dashboard gives you a bird\'s-eye view of sales, orders, and insights — all in one place. Track daily revenue, monitor pending orders, and see what\'s trending.',
    features: [
      'Real-time sales & order tracking',
      'Quick-action shortcuts for every task',
      'AI-powered business advisor at your fingertips',
    ],
    gradient: 'from-brand-green via-emerald-500 to-teal-500',
    bgPattern: 'radial-gradient(circle at 20% 80%, rgba(29,158,117,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(93,202,165,0.12) 0%, transparent 50%)',
  },
  {
    id: 'products',
    emoji: '📸',
    icon: Camera,
    accentIcon: Package,
    title: 'Add Your Products',
    subtitle: 'Snap, list, and sell in seconds',
    description:
      'Use Snap & List to photograph products and let AI auto-fill names, prices, and categories. Or add products manually through the catalog — your choice.',
    features: [
      'AI-powered Snap & List for instant cataloging',
      'Bulk upload via CSV for large inventories',
      'Smart category & pricing suggestions',
    ],
    gradient: 'from-brand-purple via-violet-500 to-indigo-500',
    bgPattern: 'radial-gradient(circle at 70% 70%, rgba(127,119,221,0.15) 0%, transparent 50%), radial-gradient(circle at 30% 30%, rgba(139,92,246,0.12) 0%, transparent 50%)',
  },
  {
    id: 'delivery',
    emoji: '🚚',
    icon: Truck,
    accentIcon: MapPin,
    title: 'Set Up Delivery',
    subtitle: 'Reach customers near and far',
    description:
      'Define your delivery zones by radius, set fees per zone, and configure pickup options. Customers will instantly see if you deliver to their area.',
    features: [
      'Radius-based delivery zone configuration',
      'Flexible per-zone delivery fees',
      'In-store pickup and self-collect options',
    ],
    gradient: 'from-brand-blue via-sky-500 to-cyan-500',
    bgPattern: 'radial-gradient(circle at 60% 80%, rgba(59,139,212,0.15) 0%, transparent 50%), radial-gradient(circle at 40% 20%, rgba(56,189,248,0.12) 0%, transparent 50%)',
  },
  {
    id: 'deals',
    emoji: '🎉',
    icon: Tag,
    accentIcon: Percent,
    title: 'Create Deals',
    subtitle: 'Attract customers with irresistible offers',
    description:
      'Launch flash deals, festival specials, and combo offers to drive traffic. Set time-limited promotions and watch your orders grow.',
    features: [
      'Flash deals with countdown timers',
      'Festival & seasonal promotion templates',
      'Buy-one-get-one and combo deals',
    ],
    gradient: 'from-brand-amber via-orange-500 to-rose-500',
    bgPattern: 'radial-gradient(circle at 30% 70%, rgba(239,159,39,0.15) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(251,146,60,0.12) 0%, transparent 50%)',
  },
  {
    id: 'analytics',
    emoji: '📊',
    icon: BarChart3,
    accentIcon: TrendingUp,
    title: 'Track Analytics',
    subtitle: 'Data-driven decisions made simple',
    description:
      'Understand your customers, top-selling products, and revenue trends. AI insights surface opportunities you might miss — like demand gaps and optimal pricing.',
    features: [
      'Revenue, orders & customer analytics',
      'AI-powered insights and recommendations',
      'Exportable reports for any time period',
    ],
    gradient: 'from-brand-coral via-rose-500 to-pink-500',
    bgPattern: 'radial-gradient(circle at 80% 60%, rgba(216,90,48,0.15) 0%, transparent 50%), radial-gradient(circle at 20% 40%, rgba(244,63,94,0.12) 0%, transparent 50%)',
  },
]

const STORAGE_KEY = 'nearshop-onboarding-seen'

// ---------------------------------------------------------------------------
// Floating particle component for background animation
// ---------------------------------------------------------------------------
function FloatingParticles({ gradient }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full opacity-20 blur-sm"
          style={{
            width: `${20 + i * 12}px`,
            height: `${20 + i * 12}px`,
            left: `${10 + i * 15}%`,
            top: `${15 + (i % 3) * 25}%`,
            background: `linear-gradient(135deg, white, transparent)`,
            animation: `float-particle ${3 + i * 0.7}s ease-in-out infinite alternate`,
            animationDelay: `${i * 0.4}s`,
          }}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step card illustration area
// ---------------------------------------------------------------------------
function StepIllustration({ step, isActive }) {
  const Icon = step.icon
  const AccentIcon = step.accentIcon

  return (
    <div
      className={`
        relative w-full aspect-[16/9] sm:aspect-[2/1] rounded-2xl overflow-hidden
        bg-gradient-to-br ${step.gradient}
        transition-all duration-700
        ${isActive ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
      `}
      style={{ backgroundImage: step.bgPattern }}
    >
      <FloatingParticles />

      {/* Central emoji */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          {/* Glow ring */}
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-40"
            style={{
              background: 'rgba(255,255,255,0.3)',
              transform: 'scale(2.5)',
              animation: 'pulse-glow 2.5s ease-in-out infinite',
            }}
          />

          {/* Emoji circle */}
          <div
            className={`
              relative w-28 h-28 sm:w-32 sm:h-32 rounded-full
              bg-white/20 backdrop-blur-sm border border-white/30
              flex items-center justify-center
              shadow-2xl
              transition-transform duration-700
              ${isActive ? 'scale-100 rotate-0' : 'scale-50 rotate-12'}
            `}
          >
            <span className="text-5xl sm:text-6xl select-none" role="img">{step.emoji}</span>
          </div>

          {/* Orbiting accent icon */}
          <div
            className="absolute -top-2 -right-2 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/25 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-lg"
            style={{ animation: 'orbit-bounce 3s ease-in-out infinite' }}
          >
            <AccentIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>

          {/* Secondary orbiting icon */}
          <div
            className="absolute -bottom-1 -left-3 w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg"
            style={{ animation: 'orbit-bounce 3.5s ease-in-out infinite reverse' }}
          >
            <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white/90" />
          </div>
        </div>
      </div>

      {/* Corner decorations */}
      <div className="absolute top-4 left-4 w-2 h-2 rounded-full bg-white/30" style={{ animation: 'twinkle 2s ease-in-out infinite' }} />
      <div className="absolute top-8 right-8 w-1.5 h-1.5 rounded-full bg-white/25" style={{ animation: 'twinkle 2.5s ease-in-out infinite 0.5s' }} />
      <div className="absolute bottom-6 left-10 w-1 h-1 rounded-full bg-white/30" style={{ animation: 'twinkle 1.8s ease-in-out infinite 1s' }} />
      <div className="absolute bottom-4 right-6 w-2 h-2 rounded-full bg-white/20" style={{ animation: 'twinkle 2.2s ease-in-out infinite 0.3s' }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Progress dots
// ---------------------------------------------------------------------------
function ProgressDots({ current, total, onDotClick }) {
  return (
    <div className="flex items-center gap-2 justify-center">
      {[...Array(total)].map((_, i) => (
        <button
          key={i}
          onClick={() => onDotClick(i)}
          aria-label={`Go to step ${i + 1}`}
          className={`
            rounded-full transition-all duration-500 ease-out
            ${i === current
              ? 'w-8 h-2.5 bg-brand-green shadow-md shadow-brand-green/30'
              : 'w-2.5 h-2.5 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
            }
          `}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Feature checklist item
// ---------------------------------------------------------------------------
function FeatureItem({ text, index, isActive }) {
  return (
    <div
      className={`
        flex items-start gap-3 transition-all duration-500
        ${isActive ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}
      `}
      style={{ transitionDelay: `${300 + index * 120}ms` }}
    >
      <div className="mt-0.5 w-5 h-5 rounded-full bg-brand-green/10 dark:bg-brand-green/20 flex items-center justify-center flex-shrink-0">
        <svg className="w-3 h-3 text-brand-green" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{text}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main OnboardingTutorial component
// ---------------------------------------------------------------------------
export default function OnboardingTutorial({ onComplete, onSkip }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState(0) // -1 = left, 0 = initial, 1 = right
  const [isAnimating, setIsAnimating] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const containerRef = useRef(null)
  const touchStartX = useRef(null)

  const step = STEPS[currentStep]
  const isLastStep = currentStep === STEPS.length - 1
  const isFirstStep = currentStep === 0

  // Entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') goNext()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'Escape') handleSkip()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  const animateStep = useCallback((newStep, dir) => {
    if (isAnimating || newStep < 0 || newStep >= STEPS.length) return
    setIsAnimating(true)
    setDirection(dir)
    setTimeout(() => {
      setCurrentStep(newStep)
      setDirection(0)
      setTimeout(() => setIsAnimating(false), 400)
    }, 250)
  }, [isAnimating])

  const goNext = useCallback(() => {
    if (isLastStep) {
      handleComplete()
    } else {
      animateStep(currentStep + 1, 1)
    }
  }, [currentStep, isLastStep, animateStep])

  const goPrev = useCallback(() => {
    animateStep(currentStep - 1, -1)
  }, [currentStep, animateStep])

  const goToStep = useCallback((i) => {
    if (i === currentStep) return
    animateStep(i, i > currentStep ? 1 : -1)
  }, [currentStep, animateStep])

  const handleComplete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setIsVisible(false)
    setTimeout(() => {
      onComplete?.()
    }, 400)
  }, [onComplete])

  const handleSkip = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setIsVisible(false)
    setTimeout(() => {
      onSkip?.()
    }, 400)
  }, [onSkip])

  // Touch / swipe support
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    touchStartX.current = null
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext()
      else goPrev()
    }
  }

  // Compute slide transform for the content card
  const getSlideStyle = () => {
    if (direction === 1) return { transform: 'translateX(-30px)', opacity: 0 }
    if (direction === -1) return { transform: 'translateX(30px)', opacity: 0 }
    return { transform: 'translateX(0)', opacity: 1 }
  }

  // Detect dark mode via prefers-color-scheme
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mq.matches)
    const handler = (e) => setIsDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <>
      {/* Inject keyframe animations */}
      <style>{`
        @keyframes float-particle {
          0% { transform: translateY(0) rotate(0deg); }
          100% { transform: translateY(-15px) rotate(10deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { transform: scale(2.2); opacity: 0.3; }
          50% { transform: scale(2.8); opacity: 0.5; }
        }
        @keyframes orbit-bounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(5deg); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.5); }
        }
        @keyframes shimmer-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      {/* Full-screen overlay */}
      <div
        className={`
          fixed inset-0 z-[9999] flex items-center justify-center
          transition-all duration-500 ease-out
          ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
          ${isDark ? 'dark' : ''}
        `}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Backdrop */}
        <div
          className={`
            absolute inset-0 transition-all duration-500
            ${isDark
              ? 'bg-gray-950/95 backdrop-blur-xl'
              : 'bg-white/80 backdrop-blur-xl'
            }
          `}
        />

        {/* Subtle background gradient that shifts with each step */}
        <div
          className="absolute inset-0 transition-all duration-1000 opacity-30"
          style={{ backgroundImage: step.bgPattern }}
        />

        {/* Content container */}
        <div
          ref={containerRef}
          className={`
            relative z-10 w-full max-w-lg mx-auto px-4 sm:px-6
            transition-all duration-500 ease-out
            ${isVisible ? 'translate-y-0 scale-100' : 'translate-y-8 scale-95'}
          `}
        >
          {/* Card */}
          <div
            className={`
              relative overflow-hidden rounded-3xl shadow-2xl
              ${isDark
                ? 'bg-gray-900 border border-gray-800'
                : 'bg-white border border-gray-100'
              }
            `}
          >
            {/* Skip button in top-right */}
            <button
              onClick={handleSkip}
              className={`
                absolute top-4 right-4 z-20
                w-8 h-8 rounded-full flex items-center justify-center
                transition-all duration-200
                ${isDark
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-600'
                }
              `}
              aria-label="Skip tutorial"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Step counter badge */}
            <div className="absolute top-4 left-4 z-20">
              <span
                className={`
                  inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold
                  bg-white/20 backdrop-blur-sm text-white border border-white/20
                `}
              >
                {currentStep + 1} / {STEPS.length}
              </span>
            </div>

            {/* Animated content area */}
            <div
              className="transition-all duration-400 ease-out"
              style={getSlideStyle()}
            >
              {/* Illustration */}
              <div className="p-4 pb-0">
                <StepIllustration step={step} isActive={direction === 0} />
              </div>

              {/* Text content */}
              <div className="px-6 pt-6 pb-4">
                {/* Title */}
                <h2
                  className={`
                    text-2xl sm:text-[1.65rem] font-bold leading-tight mb-1
                    transition-all duration-500
                    ${direction === 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}
                    ${isDark ? 'text-white' : 'text-gray-900'}
                  `}
                  style={{ transitionDelay: '100ms' }}
                >
                  {step.title}
                </h2>

                {/* Subtitle */}
                <p
                  className={`
                    text-sm font-medium mb-4
                    transition-all duration-500
                    ${direction === 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}
                    bg-gradient-to-r ${step.gradient} bg-clip-text text-transparent
                  `}
                  style={{ transitionDelay: '150ms' }}
                >
                  {step.subtitle}
                </p>

                {/* Description */}
                <p
                  className={`
                    text-sm leading-relaxed mb-5
                    transition-all duration-500
                    ${direction === 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}
                    ${isDark ? 'text-gray-400' : 'text-gray-500'}
                  `}
                  style={{ transitionDelay: '200ms' }}
                >
                  {step.description}
                </p>

                {/* Feature list */}
                <div className="space-y-2.5 mb-6">
                  {step.features.map((feature, i) => (
                    <FeatureItem
                      key={feature}
                      text={feature}
                      index={i}
                      isActive={direction === 0}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom controls — always visible, not part of the sliding area */}
            <div
              className={`
                px-6 pb-6 flex items-center justify-between gap-3
                ${isDark ? 'border-gray-800' : ''}
              `}
            >
              {/* Back button */}
              <button
                onClick={goPrev}
                disabled={isFirstStep || isAnimating}
                className={`
                  flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-200
                  ${isFirstStep
                    ? 'opacity-0 pointer-events-none'
                    : isDark
                      ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>

              {/* Progress dots */}
              <ProgressDots
                current={currentStep}
                total={STEPS.length}
                onDotClick={goToStep}
              />

              {/* Next / Get Started button */}
              <button
                onClick={goNext}
                disabled={isAnimating}
                className={`
                  relative flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold
                  text-white overflow-hidden
                  transition-all duration-300 ease-out
                  hover:shadow-lg hover:shadow-brand-green/25 hover:scale-105
                  active:scale-95
                  bg-gradient-to-r ${isLastStep ? 'from-brand-green to-emerald-600' : 'from-brand-green to-brand-green'}
                  disabled:opacity-60
                `}
              >
                {/* Shimmer effect on last step */}
                {isLastStep && (
                  <div
                    className="absolute inset-0 opacity-30"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                      animation: 'shimmer-slide 2s ease-in-out infinite',
                    }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {isLastStep ? (
                    <>
                      <Rocket className="w-4 h-4" />
                      Get Started
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>

          {/* Skip text below the card */}
          <p
            className={`
              text-center mt-4 text-xs transition-all duration-300
              ${isDark ? 'text-gray-500' : 'text-gray-400'}
            `}
          >
            <button
              onClick={handleSkip}
              className={`
                underline underline-offset-2 decoration-dotted
                transition-colors duration-200
                ${isDark
                  ? 'hover:text-gray-300'
                  : 'hover:text-gray-600'
                }
              `}
            >
              Skip tutorial
            </button>
            {' '}&middot; You can revisit this anytime from Settings
          </p>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Wrapper: shows the tutorial only once (checks localStorage)
// ---------------------------------------------------------------------------
export function OnboardingGuard({ children }) {
  const [showTutorial, setShowTutorial] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY)
    if (!seen) {
      setShowTutorial(true)
    }
    setChecked(true)
  }, [])

  const handleComplete = useCallback(() => {
    setShowTutorial(false)
  }, [])

  const handleSkip = useCallback(() => {
    setShowTutorial(false)
  }, [])

  if (!checked) return null

  return (
    <>
      {children}
      {showTutorial && (
        <OnboardingTutorial onComplete={handleComplete} onSkip={handleSkip} />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Utility: reset onboarding so it shows again (for Settings page usage)
// ---------------------------------------------------------------------------
export function resetOnboarding() {
  localStorage.removeItem(STORAGE_KEY)
}
