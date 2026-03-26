import { Sun, Moon, Monitor } from 'lucide-react'
import { useThemeStore } from '../store/themeStore'

export default function ThemeToggle() {
  const { theme, toggleTheme, resolvedTheme } = useThemeStore()

  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  const label = theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System'

  return (
    <button
      onClick={toggleTheme}
      className="relative p-2 rounded-lg text-gray-400 hover:text-brand-purple hover:bg-brand-purple-light dark:text-gray-500 dark:hover:text-brand-purple dark:hover:bg-brand-purple/10 transition-all duration-200 group"
      title={`Theme: ${label}`}
    >
      <div className="relative w-5 h-5">
        <Icon className="w-5 h-5 transition-transform duration-300 group-hover:rotate-12" />
      </div>
      <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[10px] font-medium px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        {label}
      </span>
    </button>
  )
}
