import { useCallback, useRef } from 'react'

/**
 * Programmatic sound generation using Web Audio API.
 * No MP3 files needed — all sounds synthesized via oscillators.
 */
function createAudioContext() {
  try {
    return new (window.AudioContext || window.webkitAudioContext)()
  } catch {
    return null
  }
}

function playTone(ctx, { frequency, endFrequency, duration, type = 'sine', volume = 0.15, attack = 0.01 }) {
  if (!ctx) return
  const now = ctx.currentTime

  const osc  = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.type      = type
  osc.frequency.setValueAtTime(frequency, now)
  if (endFrequency) {
    osc.frequency.linearRampToValueAtTime(endFrequency, now + duration)
  }

  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(volume, now + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  osc.start(now)
  osc.stop(now + duration + 0.05)
}

const SOUND_DEFS = {
  success:   () => [
    { frequency: 440, endFrequency: 880, duration: 0.15, type: 'sine',     volume: 0.12 },
    { frequency: 660, endFrequency: 880, duration: 0.12, type: 'sine',     volume: 0.08, _delay: 0.08 },
  ],
  error:     () => [
    { frequency: 440, endFrequency: 220, duration: 0.2,  type: 'sawtooth', volume: 0.08 },
  ],
  coin:      () => [
    { frequency: 880, endFrequency: 1200, duration: 0.1, type: 'sine',     volume: 0.12, attack: 0.005 },
    { frequency: 1200, duration: 0.08,   type: 'sine',   volume: 0.08,     attack: 0.005, _delay: 0.08 },
  ],
  'add-cart': () => [
    { frequency: 523, endFrequency: 659, duration: 0.12, type: 'sine',     volume: 0.10 },
  ],
  wishlist:  () => [
    { frequency: 587, endFrequency: 784, duration: 0.18, type: 'sine',     volume: 0.10 },
  ],
  'spin-tick': () => [
    { frequency: 300, duration: 0.04,   type: 'triangle', volume: 0.06, attack: 0.002 },
  ],
  'spin-win': () => [
    { frequency: 523, duration: 0.12,  type: 'sine', volume: 0.12 },
    { frequency: 659, duration: 0.12,  type: 'sine', volume: 0.12, _delay: 0.1 },
    { frequency: 784, duration: 0.12,  type: 'sine', volume: 0.12, _delay: 0.2 },
    { frequency: 1047, duration: 0.3,  type: 'sine', volume: 0.15, _delay: 0.32 },
  ],
}

export function useSound() {
  const ctxRef = useRef(null)

  const getCtx = () => {
    if (!ctxRef.current) {
      ctxRef.current = createAudioContext()
    }
    // Resume if suspended (autoplay policy)
    if (ctxRef.current?.state === 'suspended') {
      ctxRef.current.resume().catch(() => {})
    }
    return ctxRef.current
  }

  const playSound = useCallback((name) => {
    // Check sound_enabled from localStorage
    try {
      const settings = JSON.parse(localStorage.getItem('nearshop_settings') || '{}')
      if (settings.sound_enabled === false) return
    } catch {}

    const def = SOUND_DEFS[name]
    if (!def) return

    const ctx   = getCtx()
    const tones = def()

    tones.forEach(({ _delay = 0, ...tone }) => {
      if (_delay > 0) {
        setTimeout(() => playTone(ctx, tone), _delay * 1000)
      } else {
        playTone(ctx, tone)
      }
    })
  }, [])

  return { playSound }
}
