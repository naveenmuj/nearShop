import { useState, useEffect } from 'react'
import { Trophy } from 'lucide-react'
import { getUserAchievements } from '../../api/engagement'
import AchievementBadge from '../../components/AchievementBadge'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    getUserAchievements()
      .then(({ data }) => setAchievements(data.achievements ?? data ?? []))
      .catch(err => setError(err.message || 'Failed to load achievements'))
      .finally(() => setLoading(false))
  }, [])

  const unlocked = achievements.filter(a => !a.locked)
  const locked   = achievements.filter(a =>  a.locked)

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>
  if (error) return <EmptyState icon={Trophy} title="Could not load achievements" message={error} />

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Achievements</h1>
        {unlocked.length > 0 && (
          <span className="bg-amber-400 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
            {unlocked.length} unlocked
          </span>
        )}
      </div>

      {achievements.length === 0 ? (
        <EmptyState
          type="default"
          title="No achievements yet"
          message="Complete actions in the app to earn achievement badges and coins."
        />
      ) : (
        <>
          {unlocked.length > 0 && (
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Unlocked</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-6">
                {unlocked.map(a => <AchievementBadge key={a.id} achievement={a} />)}
              </div>
            </section>
          )}

          {locked.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Locked</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-6">
                {locked.map(a => <AchievementBadge key={a.id} achievement={a} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
