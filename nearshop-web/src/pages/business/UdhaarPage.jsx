import { useState, useEffect, useCallback } from 'react'
import { CreditCard, Send, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import useMyShop from '../../hooks/useMyShop'
import client from '../../api/client'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN')

export default function UdhaarPage() {
  const { shopId } = useMyShop()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!shopId) return
    try {
      const res = await client.get(`/udhaar/shop/${shopId}`)
      const d = res.data
      setEntries(Array.isArray(d) ? d : d?.items ?? d?.entries ?? [])
    } catch {} finally { setLoading(false) }
  }, [shopId])

  useEffect(() => { load() }, [load])

  const totalOutstanding = entries.reduce((s, e) => s + Number(e.balance || e.amount || 0), 0)
  const customersOnCredit = new Set(entries.map(e => e.customer_id)).size

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <div className="bg-white px-4 py-3 border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">Udhaar / Credit</h1>
        <p className="text-xs text-gray-400">Manage customer credit</p>
      </div>

      <div className="px-4 mt-4 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <CreditCard className="w-5 h-5 text-amber-500 mb-2" />
            <p className="text-xl font-extrabold text-gray-900">{formatPrice(totalOutstanding)}</p>
            <p className="text-xs text-gray-400">Outstanding</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <span className="text-xl">👥</span>
            <p className="text-xl font-extrabold text-gray-900 mt-1">{customersOnCredit}</p>
            <p className="text-xs text-gray-400">Customers on credit</p>
          </div>
        </div>

        {/* Credit entries */}
        {entries.length === 0 ? (
          <div className="text-center py-16">
            <CreditCard className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No credit entries</p>
            <p className="text-xs text-gray-400 mt-1">Credit entries will appear here when you extend credit to customers</p>
          </div>
        ) : entries.map(entry => (
          <div key={entry.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{entry.customer_name || 'Customer'}</p>
                <p className="text-xs text-gray-400">{entry.description || 'Credit'}</p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-amber-600">{formatPrice(entry.balance || entry.amount)}</p>
                <p className="text-xs text-gray-400">
                  {entry.created_at ? new Date(entry.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
