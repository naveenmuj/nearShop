import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUnreadCount } from '../api/notifications'

export default function NotificationBell() {
  const [count, setCount] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const { data } = await getUnreadCount()
        setCount(data.count || data.unread_count || 0)
      } catch {}
    }
    fetchCount()
    const interval = setInterval(fetchCount, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <button onClick={() => navigate('/app/notifications')} className="relative p-2">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}
