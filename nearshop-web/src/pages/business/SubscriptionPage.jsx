import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getMySubscription, getSubscriptionInvoices, getSubscriptionTiers, getSubscriptionUsage, upgradeSubscription } from '../../api/subscriptions'

const gradient = {
  free: 'from-slate-500 to-slate-700',
  pro: 'from-sky-500 to-blue-700',
  business: 'from-emerald-500 to-teal-700',
}

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState(null)
  const [tiers, setTiers] = useState([])
  const [usage, setUsage] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: sub }, { data: tiersData }, { data: usageData }, { data: invoicesData }] = await Promise.all([
        getMySubscription(),
        getSubscriptionTiers(),
        getSubscriptionUsage(),
        getSubscriptionInvoices(10),
      ])
      setSubscription(sub)
      setTiers(tiersData || [])
      setUsage(usageData)
      setInvoices(invoicesData?.items || invoicesData || [])
    } catch {
      setSubscription(null)
      setTiers([])
      setUsage(null)
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const upgrade = async (tier) => {
    setUpgrading(tier)
    try {
      await upgradeSubscription(tier)
      toast.success(`Upgraded to ${tier}`)
      await load()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Upgrade failed')
    } finally {
      setUpgrading(null)
    }
  }

  if (loading) return <div className="desktop-panel p-8 text-sm text-gray-500">Loading subscription...</div>

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="space-y-4">
        {subscription ? (
          <div className={`desktop-panel bg-gradient-to-br ${gradient[subscription.tier] || 'from-gray-500 to-gray-700'} p-6 text-white`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Current Plan</p>
            <h1 className="mt-1 text-3xl font-bold">{subscription.tier_name || subscription.tier}</h1>
            {subscription.current_period_end ? <p className="mt-1 text-sm text-white/80">Renews: {new Date(subscription.current_period_end).toLocaleDateString('en-IN')}</p> : null}
          </div>
        ) : null}

        <div className="desktop-panel overflow-hidden">
          <div className="desktop-toolbar px-5 py-3">
            <h2 className="text-lg font-bold text-gray-900">Available Plans</h2>
            <p className="text-xs text-gray-500">Choose a plan that fits your growth stage.</p>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {tiers.map((tier) => {
              const key = tier.key || tier.tier || tier.name?.toLowerCase()
              const isCurrent = subscription?.tier === key
              return (
                <div key={key} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900">{tier.name || key}</h3>
                    {isCurrent ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Current</span> : null}
                  </div>
                  <p className="mt-2 text-2xl font-bold text-gray-900">₹{tier.price_monthly || 0}<span className="text-sm font-medium text-gray-500">/month</span></p>
                  <button disabled={isCurrent || upgrading === key} onClick={() => upgrade(key)} className="mt-3 w-full rounded-lg bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b5e58] disabled:opacity-50">{upgrading === key ? 'Upgrading...' : isCurrent ? 'Active Plan' : `Upgrade to ${tier.name || key}`}</button>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="desktop-panel p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Usage</h3>
          {!usage ? <p className="mt-3 text-xs text-gray-400">No usage data.</p> : (
            <div className="mt-3 space-y-2 text-sm text-gray-700">
              <div className="flex justify-between"><span>Products</span><span>{usage.products_count} / {usage.products_limit === -1 ? '∞' : usage.products_limit}</span></div>
              <div className="flex justify-between"><span>Orders</span><span>{usage.orders_count} / {usage.orders_limit === -1 ? '∞' : usage.orders_limit}</span></div>
              <div className="flex justify-between"><span>Broadcasts</span><span>{usage.broadcasts_count} / {usage.broadcasts_limit === -1 ? '∞' : usage.broadcasts_limit}</span></div>
            </div>
          )}
        </div>

        <div className="desktop-panel p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Recent Invoices</h3>
          <div className="mt-3 space-y-2">
            {invoices.length === 0 ? <p className="text-xs text-gray-400">No invoices.</p> : invoices.map((inv, idx) => (
              <div key={inv.id || idx} className="rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-xs">
                <p className="font-semibold text-gray-800">₹{inv.amount || inv.total || 0}</p>
                <p className="text-gray-500">{inv.created_at ? new Date(inv.created_at).toLocaleDateString('en-IN') : '-'}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}
