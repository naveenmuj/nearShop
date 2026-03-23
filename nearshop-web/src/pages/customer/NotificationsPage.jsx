import { useState, useEffect } from 'react'
import { getNotifications, markAllRead } from '../../api/notifications'

export default function NotificationsPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getNotifications()
      .then(({ data }) => setItems(data.items || data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleMarkAllRead = async () => {
    try {
      await markAllRead()
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch {}
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Notifications</h1>
        {items.some((n) => !n.is_read) && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-purple-600 font-medium"
          >
            Mark all read
          </button>
        )}
      </div>
      {loading && <p className="text-gray-500">Loading...</p>}
      {items.length === 0 && !loading && (
        <p className="text-gray-400 text-center mt-10">No notifications</p>
      )}
      {items.map((n) => (
        <div
          key={n.id}
          className={`p-3 mb-2 rounded-lg border ${
            n.is_read ? 'bg-white' : 'bg-purple-50 border-purple-200'
          }`}
        >
          <p className="text-sm">{n.message || n.title}</p>
          <p className="text-xs text-gray-400 mt-1">
            {n.created_at ? new Date(n.created_at).toLocaleDateString() : ""}
          </p>
        </div>
      ))}
    </div>
  )
}
