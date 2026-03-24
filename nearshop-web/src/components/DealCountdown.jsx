import { useState, useEffect, useRef } from 'react'

function pad(n) { return String(Math.max(0, n)).padStart(2, '0') }

function getTimeLeft(dealEndsAt) {
  const diff = Math.max(0, new Date(dealEndsAt) - Date.now())
  const totalSeconds = Math.floor(diff / 1000)
  const days    = Math.floor(totalSeconds / 86400)
  const hours   = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600)  / 60)
  const seconds = totalSeconds % 60
  return { days, hours, minutes, seconds, expired: diff <= 0 }
}

function Digit({ value, urgent }) {
  const prevRef = useRef(value)
  const [flipping, setFlipping] = useState(false)

  useEffect(() => {
    if (prevRef.current !== value) {
      setFlipping(true)
      const t = setTimeout(() => setFlipping(false), 350)
      prevRef.current = value
      return () => clearTimeout(t)
    }
  }, [value])

  return (
    <div
      className={`inline-flex items-center justify-center font-bold tabular-nums rounded-lg min-w-[2rem] px-1.5 py-1
        ${urgent ? 'bg-brand-red text-white' : 'bg-gray-800 text-white'}
        ${flipping ? 'digit-flip' : ''}
        text-sm
      `}
      style={{ perspective: '200px' }}
    >
      {value}
    </div>
  )
}

export default function DealCountdown({ dealEndsAt, compact = false }) {
  const [time, setTime] = useState(() => getTimeLeft(dealEndsAt))

  useEffect(() => {
    if (time.expired) return
    const interval = setInterval(() => setTime(getTimeLeft(dealEndsAt)), 1000)
    return () => clearInterval(interval)
  }, [dealEndsAt, time.expired])

  if (time.expired) {
    return (
      <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg">
        Deal Ended
      </span>
    )
  }

  const urgent = time.days === 0 && time.hours < 1

  if (compact) {
    // HH:MM:SS
    return (
      <div className="flex items-center gap-0.5">
        <Digit value={pad(time.hours)}   urgent={urgent} />
        <span className={`font-bold text-sm ${urgent ? 'text-brand-red' : 'text-gray-500'}`}>:</span>
        <Digit value={pad(time.minutes)} urgent={urgent} />
        <span className={`font-bold text-sm ${urgent ? 'text-brand-red' : 'text-gray-500'}`}>:</span>
        <Digit value={pad(time.seconds)} urgent={urgent} />
        {urgent && (
          <span className="ml-1 text-[10px] font-bold text-brand-red animate-pulse">HURRY!</span>
        )}
      </div>
    )
  }

  // Full DD:HH:MM:SS
  return (
    <div className="flex items-center gap-1">
      {time.days > 0 && (
        <>
          <div className="flex flex-col items-center">
            <Digit value={pad(time.days)} urgent={false} />
            <span className="text-[9px] text-gray-400 mt-0.5">days</span>
          </div>
          <span className="text-gray-400 font-bold self-start mt-1.5">:</span>
        </>
      )}
      <div className="flex flex-col items-center">
        <Digit value={pad(time.hours)} urgent={urgent} />
        <span className="text-[9px] text-gray-400 mt-0.5">hrs</span>
      </div>
      <span className={`font-bold self-start mt-1.5 ${urgent ? 'text-brand-red' : 'text-gray-400'}`}>:</span>
      <div className="flex flex-col items-center">
        <Digit value={pad(time.minutes)} urgent={urgent} />
        <span className="text-[9px] text-gray-400 mt-0.5">min</span>
      </div>
      <span className={`font-bold self-start mt-1.5 ${urgent ? 'text-brand-red' : 'text-gray-400'}`}>:</span>
      <div className="flex flex-col items-center">
        <Digit value={pad(time.seconds)} urgent={urgent} />
        <span className="text-[9px] text-gray-400 mt-0.5">sec</span>
      </div>
      {urgent && (
        <span className="ml-1 text-[10px] font-bold text-brand-red animate-pulse self-center">HURRY!</span>
      )}
    </div>
  )
}
