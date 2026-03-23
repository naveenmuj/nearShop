import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { addExpense, getExpenses, getProfitLoss, deleteExpense } from '../../api/expenses'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN')

const CATEGORIES = [
  { key: 'rent', icon: '🏠', label: 'Rent' },
  { key: 'electricity', icon: '⚡', label: 'Electricity' },
  { key: 'salary', icon: '👤', label: 'Salary' },
  { key: 'stock_purchase', icon: '📦', label: 'Stock' },
  { key: 'transport', icon: '🚗', label: 'Transport' },
  { key: 'misc', icon: '💰', label: 'Other' },
]

const PERIODS = [
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' },
]

export default function ExpensesPage() {
  const [period, setPeriod] = useState('30d')
  const [pnl, setPnl] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  // Add form
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('misc')
  const [description, setDescription] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pnlRes, expRes] = await Promise.allSettled([
        getProfitLoss(period),
        getExpenses({ period, per_page: 50 }),
      ])
      if (pnlRes.status === 'fulfilled') setPnl(pnlRes.value.data)
      if (expRes.status === 'fulfilled') setExpenses(expRes.value.data?.expenses ?? [])
    } catch {} finally { setLoading(false) }
  }, [period])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return toast.error('Enter a valid amount')
    setAdding(true)
    try {
      await addExpense({ amount: Number(amount), category, description: description || undefined })
      toast.success('Expense added')
      setAmount(''); setDescription('')
      await load()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add expense')
    } finally { setAdding(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this expense?')) return
    try {
      await deleteExpense(id)
      toast.success('Deleted')
      await load()
    } catch { toast.error('Failed to delete') }
  }

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>

  const isProfit = pnl && pnl.profit >= 0

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">Expenses & P&L</h1>
        <div className="flex gap-2 mt-2">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${period === p.key ? 'bg-[#1D9E75] text-white' : 'bg-gray-100 text-gray-500'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">
        {/* P&L Summary */}
        {pnl && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
                <TrendingUp className="w-4 h-4 text-green-600 mx-auto mb-1" />
                <p className="text-base font-extrabold text-green-600">{formatPrice(pnl.total_revenue)}</p>
                <p className="text-[10px] text-gray-400 font-medium">Revenue</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
                <TrendingDown className="w-4 h-4 text-red-500 mx-auto mb-1" />
                <p className="text-base font-extrabold text-red-500">{formatPrice(pnl.total_expenses)}</p>
                <p className="text-[10px] text-gray-400 font-medium">Expenses</p>
              </div>
              <div className={`rounded-xl p-3 border shadow-sm text-center ${isProfit ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <p className={`text-base font-extrabold ${isProfit ? 'text-green-700' : 'text-red-600'}`}>{formatPrice(pnl.profit)}</p>
                <p className="text-[10px] text-gray-500 font-medium">Profit ({pnl.profit_margin}%)</p>
              </div>
            </div>

            {/* Revenue breakdown */}
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">Revenue Sources</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">From Bills</span><span className="font-semibold">{formatPrice(pnl.bill_revenue)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">From Orders</span><span className="font-semibold">{formatPrice(pnl.order_revenue)}</span></div>
              </div>
            </div>

            {/* Expense breakdown */}
            {pnl.expense_breakdown?.length > 0 && (
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Expense Categories</p>
                <div className="space-y-2">
                  {pnl.expense_breakdown.map(cat => {
                    const info = CATEGORIES.find(c => c.key === cat.category) || { icon: '💰', label: cat.category }
                    const pct = pnl.total_expenses > 0 ? Math.round(cat.total / pnl.total_expenses * 100) : 0
                    return (
                      <div key={cat.category} className="flex items-center gap-2">
                        <span className="text-sm">{info.icon}</span>
                        <span className="text-xs font-medium text-gray-600 w-16">{info.label}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full">
                          <div className="h-2 bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-bold text-gray-900 w-16 text-right">{formatPrice(cat.total)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Quick-add expense */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-sm font-bold text-gray-800 mb-3">Log Expense</p>
          <div className="flex gap-2 mb-3">
            <div className="flex-1">
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-lg font-bold outline-none focus:ring-2 focus:ring-[#1D9E75]/20" placeholder="₹ Amount" />
            </div>
            <input value={description} onChange={e => setDescription(e.target.value)}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#1D9E75]/20" placeholder="Description (optional)" />
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {CATEGORIES.map(c => (
              <button key={c.key} onClick={() => setCategory(c.key)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${category === c.key ? 'bg-[#1D9E75] text-white' : 'bg-gray-100 text-gray-500'}`}>
                <span>{c.icon}</span> {c.label}
              </button>
            ))}
          </div>
          <button onClick={handleAdd} disabled={adding}
            className="w-full bg-red-500 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-red-600 transition-colors">
            <Plus className="w-4 h-4" /> {adding ? 'Adding...' : 'Add Expense'}
          </button>
        </div>

        {/* Expense history */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase mb-2">Recent Expenses</p>
          {expenses.length === 0 ? (
            <div className="text-center py-8"><p className="text-gray-400 text-sm">No expenses recorded yet</p></div>
          ) : (
            <div className="space-y-2">
              {expenses.map(exp => {
                const info = CATEGORIES.find(c => c.key === exp.category) || { icon: '💰', label: exp.category }
                return (
                  <div key={exp.id} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex items-center gap-3">
                    <span className="text-xl">{info.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{info.label}</p>
                      {exp.description && <p className="text-xs text-gray-400 truncate">{exp.description}</p>}
                      <p className="text-[10px] text-gray-400">{new Date(exp.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                    </div>
                    <p className="text-sm font-bold text-red-500">{formatPrice(exp.amount)}</p>
                    <button onClick={() => handleDelete(exp.id)} className="p-1"><Trash2 className="w-3.5 h-3.5 text-gray-300 hover:text-red-500" /></button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
