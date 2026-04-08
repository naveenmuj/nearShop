import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { getShopFollowers } from '../../api/shops'
import { startConversationAsBusiness } from '../../api/messaging'
import useMyShop from '../../hooks/useMyShop'

const timeAgo = (d) => {
  if (!d) return '-'
  const days = Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function FollowersPage() {
  const navigate = useNavigate()
  const { shopId } = useMyShop()
  const [followers, setFollowers] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    if (!shopId) return
    setLoading(true)
    try {
      const { data } = await getShopFollowers(shopId, { page: 1, per_page: 200 })
      setFollowers(data?.items || data || [])
    } catch {
      setFollowers([])
    } finally {
      setLoading(false)
    }
  }, [shopId])

  useEffect(() => { load() }, [load])

  const newCount = useMemo(() => followers.filter((f) => f.is_new).length, [followers])

  const openChat = async (follower) => {
    if (!shopId || busy) return
    setBusy(follower.id)
    try {
      const convo = await startConversationAsBusiness(follower.id, { shopId })
      navigate(`/biz/chat/${convo.id}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="desktop-panel overflow-hidden">
      <div className="desktop-toolbar px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Followers</h1>
            <p className="text-sm text-gray-500">{followers.length} total followers • {newCount} new this cycle</p>
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>
      {loading ? <div className="p-6 text-sm text-gray-500">Loading followers...</div> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr><th className="px-4 py-3">Follower</th><th className="px-4 py-3">Since</th><th className="px-4 py-3">Tag</th><th className="px-4 py-3">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {followers.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">No followers yet.</td></tr>
              ) : followers.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50/70">
                  <td className="px-4 py-3 font-semibold text-gray-900">{f.name || 'Follower'}</td>
                  <td className="px-4 py-3 text-gray-600">{timeAgo(f.followed_at)}</td>
                  <td className="px-4 py-3">{f.is_new ? <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">NEW</span> : <span className="text-xs text-gray-400">-</span>}</td>
                  <td className="px-4 py-3"><button onClick={() => openChat(f)} disabled={busy === f.id} className="rounded-md border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">{busy === f.id ? 'Opening...' : 'Message'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
