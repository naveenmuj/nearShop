import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'light', // 'light', 'dark', 'system'
      resolvedTheme: 'light',

      setTheme: (theme) => {
        set({ theme })
        const resolved = theme === 'system'
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : theme
        set({ resolvedTheme: resolved })
        document.documentElement.classList.toggle('dark', resolved === 'dark')
      },

      initTheme: () => {
        const { theme } = get()
        const resolved = theme === 'system'
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : theme
        set({ resolvedTheme: resolved })
        document.documentElement.classList.toggle('dark', resolved === 'dark')

        // Listen for system changes
        if (theme === 'system') {
          window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            const { theme: current } = get()
            if (current === 'system') {
              const newResolved = e.matches ? 'dark' : 'light'
              set({ resolvedTheme: newResolved })
              document.documentElement.classList.toggle('dark', newResolved === 'dark')
            }
          })
        }
      },

      toggleTheme: () => {
        const { theme, setTheme } = get()
        const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
        setTheme(next)
      },
    }),
    {
      name: 'nearshop-theme',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
)
