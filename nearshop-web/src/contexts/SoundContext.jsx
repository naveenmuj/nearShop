import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { useSound as useSoundHook } from '../hooks/useSound'
import { updateUserSettings } from '../api/engagement'

const SoundContext = createContext(null)

export function SoundProvider({ children }) {
  const [soundEnabled, setSoundEnabledState] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('nearshop_settings') || '{}')
      return s.sound_enabled !== false // default true
    } catch {
      return true
    }
  })
  const { playSound: rawPlay } = useSoundHook()
  const syncTimer = useRef(null)

  const setSoundEnabled = useCallback((enabled) => {
    setSoundEnabledState(enabled)
    try {
      const s = JSON.parse(localStorage.getItem('nearshop_settings') || '{}')
      s.sound_enabled = enabled
      localStorage.setItem('nearshop_settings', JSON.stringify(s))
    } catch {}

    // Debounce backend sync
    clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      updateUserSettings({ sound_enabled: enabled }).catch(() => {})
    }, 800)
  }, [])

  const playSound = useCallback((name) => {
    if (!soundEnabled) return
    rawPlay(name)
  }, [soundEnabled, rawPlay])

  return (
    <SoundContext.Provider value={{ soundEnabled, setSoundEnabled, playSound }}>
      {children}
    </SoundContext.Provider>
  )
}

export function useSoundContext() {
  return useContext(SoundContext)
}

export default SoundContext
