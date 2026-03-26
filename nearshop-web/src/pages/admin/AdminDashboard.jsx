import { useState, useEffect, useCallback, useRef } from 'react'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import * as api from '../../api/admin'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  primary: '#3B8BD4', purple: '#7F77DD', green: '#1D9E75', amber: '#EF9F27',
  red: '#E24B4A', gray: '#6B7280', coral: '#D85A30', pink: '#D4537E', teal: '#5DCAA5',
}
const CAT_CLR = {
  Electronics: '#3B8BD4', Clothing: '#7F77DD', Grocery: '#1D9E75', Food: '#D85A30',
  Home: '#EF9F27', Beauty: '#D4537E', Other: '#6B7280', Fashion: '#7F77DD',
  'Clothing & Fashion': '#7F77DD', 'Grocery & Daily Needs': '#1D9E75', 'Food & Bakery': '#D85A30',
}
const PIE = ['#3B8BD4', '#7F77DD', '#1D9E75', '#EF9F27', '#D85A30', '#D4537E', '#5DCAA5', '#6B7280']
const STS = {
  pending: '#EF9F27', confirmed: '#3B8BD4', preparing: '#7F77DD',
  ready: '#5DCAA5', completed: '#1D9E75', cancelled: '#E24B4A', delivered: '#1D9E75',
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtINR = v => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0)
const fmtNum = v => new Intl.NumberFormat('en-IN').format(v || 0)
const fmtDate = s => { if (!s) return '—'; try { return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return s } }
const fmtDateSh = s => { if (!s) return ''; try { return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) } catch { return s } }
const fmtPct = v => `${(parseFloat(v) || 0).toFixed(1)}%`

// ─── Count-up hook ────────────────────────────────────────────────────────────
function useCountUp(target, dur = 900) {
  const [val, setVal] = useState(0)
  const ref = useRef(0)
  useEffect(() => {
    const t = typeof target === 'number' ? target : parseFloat(target) || 0
    if (t === ref.current) return
    const from = ref.current
    const diff = t - from
    const start = Date.now()
    const id = setInterval(() => {
      const p = Math.min((Date.now() - start) / dur, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(from + diff * ease))
      if (p >= 1) { clearInterval(id); ref.current = t }
    }, 16)
    return () => clearInterval(id)
  }, [target, dur])
  return val
}

// ─── Tiny components ──────────────────────────────────────────────────────────
const Spin = ({ size = 'md' }) => {
  const s = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-10 w-10' : 'h-6 w-6'
  return <div className={`${s} animate-spin rounded-full border-2 border-blue-500 border-t-transparent`} />
}

const Bdg = ({ children, color }) => (
  <span style={{ backgroundColor: `${color || C.gray}18`, color: color || C.gray }}
    className="px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap">
    {children}
  </span>
)

const StsBdg = ({ status }) => <Bdg color={STS[status?.toLowerCase()] || C.gray}>{status}</Bdg>
const RolBdg = ({ role }) => <Bdg color={role === 'business' ? C.purple : C.primary}>{role}</Bdg>

const Avt = ({ name, size = 'md' }) => {
  const s = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-9 h-9 text-sm'
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const colors = [C.primary, C.purple, C.green, C.amber, C.coral, C.pink]
  const clr = colors[(name || '').charCodeAt(0) % colors.length]
  return (
    <div style={{ backgroundColor: clr }}
      className={`${s} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initials}
    </div>
  )
}

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 ${className}`}>{children}</div>
)

const SecTitle = ({ icon, children }) => (
  <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
    <span>{icon}</span>{children}
  </h2>
)

const StatPill = ({ label, value, fmt = 'num' }) => {
  const disp = fmt === 'currency' ? fmtINR(value) : fmt === 'pct' ? fmtPct(value) : fmtNum(value)
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <div className="text-xl font-bold text-gray-900">{disp}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

function KpiCard({ icon, label, value, sub, fmt = 'number', onClick }) {
  const n = useCountUp(typeof value === 'number' ? value : parseFloat(value) || 0)
  const disp = fmt === 'currency' ? fmtINR(n) : fmt === 'pct' ? fmtPct(n) : fmtNum(n)
  return (
    <div onClick={onClick}
      className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-start gap-3 transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''}`}>
      <div className="text-3xl leading-none flex-shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <div className="text-[28px] font-bold text-gray-900 leading-tight tabular-nums">{disp}</div>
        <div className="text-[13px] text-gray-500 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

const TTip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      {label && <div className="font-medium text-gray-600 mb-1">{fmtDateSh(label) || label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }} className="flex gap-2">
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold">{currency ? fmtINR(p.value) : fmtNum(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

const SortHd = ({ col, label, sortKey, sortDir, onSort }) => (
  <th onClick={() => onSort(col)}
    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-800 select-none whitespace-nowrap">
    {label} {sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : '⇅'}
  </th>
)

const Pages = ({ page, total, pp, onChange }) => {
  const tot = Math.ceil(total / pp)
  if (tot <= 1) return null
  return (
    <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-1">
      <span className="text-xs text-gray-400">{(page - 1) * pp + 1}–{Math.min(page * pp, total)} of {fmtNum(total)}</span>
      <div className="flex gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          className="px-3 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">← Prev</button>
        <button onClick={() => onChange(page + 1)} disabled={page >= tot}
          className="px-3 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors">Next →</button>
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const SECS = [
  { id: 'overview', icon: '🏠', label: 'Overview' },
  { id: 'users', icon: '👥', label: 'Users' },
  { id: 'shops', icon: '🏪', label: 'Shops' },
  { id: 'products', icon: '📦', label: 'Products' },
  { id: 'orders', icon: '🛒', label: 'Orders' },
  { id: 'engagement', icon: '💡', label: 'Engagement' },
  { id: 'financial', icon: '💰', label: 'Financial' },
  { id: 'ai_usage', icon: '🤖', label: 'AI Usage' },
]

const Sidebar = ({ section, setSection }) => (
  <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-gray-100 shadow-sm flex-shrink-0">
    <div className="p-5 border-b border-gray-100">
      <div className="text-xl font-bold text-gray-900">🛍️ NearShop</div>
      <div className="text-xs text-gray-400 mt-0.5">Admin Console</div>
    </div>
    <nav className="flex-1 p-3 space-y-0.5">
      {SECS.map(s => (
        <button key={s.id} onClick={() => setSection(s.id)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${section === s.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
          <span>{s.icon}</span>{s.label}
        </button>
      ))}
    </nav>
    <div className="p-4 text-xs text-gray-400 border-t border-gray-100">NearShop Platform · v1.0</div>
  </aside>
)

const MobileTabs = ({ section, setSection }) => (
  <div className="lg:hidden flex gap-2 overflow-x-auto px-4 py-2.5 bg-white border-b border-gray-100">
    {SECS.map(s => (
      <button key={s.id} onClick={() => setSection(s.id)}
        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${section === s.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
        {s.icon} {s.label}
      </button>
    ))}
  </div>
)

// ─── Slide-over detail panel ──────────────────────────────────────────────────
function SlideOver({ type, data, loading, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full sm:w-[480px] bg-white shadow-2xl z-50 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 flex items-center justify-between px-5 py-4 z-10">
          <div className="flex items-center gap-2">
            <span className="text-lg">{type === 'user' ? '👤' : type === 'shop' ? '🏪' : type === 'product' ? '📦' : '🛒'}</span>
            <h3 className="font-semibold text-gray-900 capitalize">{type} Details</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 text-lg">✕</button>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="flex justify-center py-20"><Spin size="lg" /></div>
          ) : !data ? (
            <div className="text-center py-20 text-gray-400">
              <div className="text-4xl mb-2">😕</div>No data available
            </div>
          ) : type === 'user' ? <UserDetail data={data} />
            : type === 'shop' ? <ShopDetail data={data} />
            : type === 'product' ? <ProductDetail data={data} />
            : type === 'order' ? <OrderDetail data={data} />
            : null}
        </div>
      </div>
    </>
  )
}

// ─── Detail views ─────────────────────────────────────────────────────────────
function UserDetail({ data }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avt name={data.name} size="lg" />
        <div>
          <div className="font-bold text-xl text-gray-900">{data.name || '—'}</div>
          <div className="text-sm text-gray-500">{data.phone || data.email || '—'}</div>
          <div className="flex gap-1 mt-1.5 flex-wrap">{(data.roles || []).map(r => <RolBdg key={r} role={r} />)}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatPill label="Orders" value={data.stats?.orders} />
        <StatPill label="Reviews" value={data.stats?.reviews} />
        <StatPill label="Wishlists" value={data.stats?.wishlists} />
        <StatPill label="Coins" value={data.stats?.coins} />
        <StatPill label="Haggles" value={data.stats?.haggles} />
        <StatPill label="Following" value={data.stats?.followed_shops} />
      </div>
      <div className="text-xs text-gray-400 flex items-center gap-1">
        📅 Joined {fmtDate(data.created_at)}
        {data.referral_code && <span className="ml-2 bg-gray-100 px-2 py-0.5 rounded font-mono">{data.referral_code}</span>}
      </div>
      {data.recent_orders?.length > 0 && (
        <div>
          <div className="font-semibold text-sm text-gray-700 mb-2">Recent Orders</div>
          <div className="space-y-2">
            {data.recent_orders.slice(0, 8).map(o => (
              <div key={o.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl text-xs">
                <div>
                  <div className="font-semibold text-gray-800">#{o.order_number}</div>
                  <div className="text-gray-500">{o.shop}</div>
                  <div className="text-gray-400">{fmtDate(o.date)}</div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <div className="font-bold text-gray-900">{fmtINR(o.total)}</div>
                  <StsBdg status={o.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.recent_reviews?.length > 0 && (
        <div>
          <div className="font-semibold text-sm text-gray-700 mb-2">Reviews Given</div>
          <div className="space-y-2">
            {data.recent_reviews.slice(0, 5).map((r, i) => (
              <div key={i} className="p-2.5 bg-gray-50 rounded-xl text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-800">{r.shop}</span>
                  <span className="text-amber-400 text-sm">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                </div>
                {r.comment && <div className="text-gray-500 mt-1 leading-relaxed">{r.comment}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ShopDetail({ data }) {
  return (
    <div className="space-y-5">
      {data.cover_image && (
        <img src={data.cover_image} alt="" className="w-full h-36 object-cover rounded-xl" />
      )}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-xl text-gray-900">{data.name}</h3>
          {data.is_verified && <span className="text-blue-500 text-sm font-medium">✓ Verified</span>}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Bdg color={CAT_CLR[data.category]}>{data.category}</Bdg>
          <span className="text-amber-400">{'★'.repeat(Math.round(data.avg_rating || 0))}</span>
          <span className="text-xs text-gray-500">{(data.avg_rating || 0).toFixed(1)} ({data.total_reviews} reviews)</span>
        </div>
        {data.address && <div className="text-sm text-gray-500 mt-1">📍 {data.address}</div>}
        {data.owner && <div className="text-xs text-gray-400 mt-1">👤 {data.owner.name} · {data.owner.phone}</div>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatPill label="Products" value={data.stats?.products} />
        <StatPill label="Orders" value={data.stats?.orders} />
        <StatPill label="Followers" value={data.stats?.followers} />
        <StatPill label="Deals" value={data.stats?.deals} />
      </div>
      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl text-center border border-blue-100">
        <div className="text-2xl font-bold text-blue-700">{fmtINR(data.stats?.revenue)}</div>
        <div className="text-xs text-blue-500 mt-0.5">Total Revenue</div>
        <div className="flex items-center justify-center gap-1.5 mt-2">
          <div className="bg-gray-200 rounded-full h-1.5 w-24">
            <div style={{ width: `${Math.min(data.score, 100)}%`, backgroundColor: data.score >= 70 ? C.green : data.score >= 40 ? C.amber : C.red }}
              className="h-1.5 rounded-full" />
          </div>
          <span className="text-xs text-gray-600 font-semibold">Score {data.score?.toFixed(0)}/100</span>
        </div>
      </div>
      {data.products?.length > 0 && (
        <div>
          <div className="font-semibold text-sm text-gray-700 mb-2">Top Products</div>
          <div className="space-y-2">
            {data.products.slice(0, 6).map(p => (
              <div key={p.id} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl text-xs">
                {p.image && <img src={p.image} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800 truncate">{p.name}</div>
                  <div className="text-gray-500">{fmtINR(p.price)} · {p.views} views · {p.wishlisted} wishlisted</div>
                </div>
                {p.ai_generated && <span className="text-purple-400 flex-shrink-0">✨</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {data.recent_orders?.length > 0 && (
        <div>
          <div className="font-semibold text-sm text-gray-700 mb-2">Recent Orders</div>
          <div className="space-y-1.5">
            {data.recent_orders.slice(0, 5).map(o => (
              <div key={o.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl text-xs">
                <div>
                  <div className="font-semibold">#{o.order_number}</div>
                  <div className="text-gray-500">{o.customer} · {fmtDate(o.date)}</div>
                </div>
                <div className="text-right flex flex-col items-end gap-0.5">
                  <span className="font-bold">{fmtINR(o.total)}</span>
                  <StsBdg status={o.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.reviews?.length > 0 && (
        <div>
          <div className="font-semibold text-sm text-gray-700 mb-2">Customer Reviews</div>
          <div className="space-y-2">
            {data.reviews.slice(0, 4).map((r, i) => (
              <div key={i} className="p-2.5 bg-gray-50 rounded-xl text-xs">
                <div className="flex justify-between">
                  <span className="font-semibold">{r.reviewer}</span>
                  <span className="text-amber-400">{'★'.repeat(r.rating)}</span>
                </div>
                {r.comment && <div className="text-gray-600 mt-1">{r.comment}</div>}
                {r.reply && <div className="text-blue-600 mt-1 italic border-l-2 border-blue-200 pl-2">💬 {r.reply}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      {data.deals?.length > 0 && (
        <div>
          <div className="font-semibold text-sm text-gray-700 mb-2">Deals</div>
          <div className="space-y-1.5">
            {data.deals.slice(0, 4).map(d => (
              <div key={d.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl text-xs">
                <div>
                  <div className="font-semibold">{d.title}</div>
                  <div className="text-gray-500">Expires {fmtDate(d.expires)}</div>
                </div>
                <div className="text-right">
                  <div className="text-green-600 font-bold">{d.discount}% off</div>
                  <div className="text-gray-400">{d.claims} claims</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ProductDetail({ data }) {
  return (
    <div className="space-y-5">
      {data.images?.[0] && (
        <img src={data.images[0]} alt="" className="w-full h-52 object-cover rounded-xl" />
      )}
      <div>
        <h3 className="font-bold text-xl text-gray-900">{data.name}</h3>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {data.category && <Bdg color={CAT_CLR[data.category]}>{data.category}</Bdg>}
          {data.subcategory && <Bdg color={C.gray}>{data.subcategory}</Bdg>}
          {data.ai_generated && <Bdg color={C.purple}>✨ AI Generated</Bdg>}
          {!data.is_available && <Bdg color={C.red}>Unavailable</Bdg>}
        </div>
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-2xl font-bold text-gray-900">{fmtINR(data.price)}</span>
          {data.compare_price > 0 && <span className="text-sm text-gray-400 line-through">{fmtINR(data.compare_price)}</span>}
        </div>
        {data.shop && <div className="text-sm text-gray-500 mt-1">by <span className="font-semibold">{data.shop.name}</span></div>}
        {data.description && <div className="text-sm text-gray-600 mt-2 leading-relaxed">{data.description.slice(0, 250)}{data.description.length > 250 ? '…' : ''}</div>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatPill label="Views" value={data.views} />
        <StatPill label="Wishlisted" value={data.wishlisted} />
        <StatPill label="Inquiries" value={data.inquiries} />
      </div>
      {data.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {data.tags.slice(0, 8).map((t, i) => (
            <span key={i} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{t}</span>
          ))}
        </div>
      )}
      {data.price_history?.length > 0 && (
        <div>
          <div className="font-semibold text-sm text-gray-700 mb-2">Price History</div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={[...data.price_history].reverse()}>
              <XAxis dataKey="date" tickFormatter={fmtDateSh} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${v}`} />
              <Tooltip formatter={v => fmtINR(v)} />
              <Line type="monotone" dataKey="new" stroke={C.primary} dot={{ r: 3 }} strokeWidth={2} name="Price" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="text-xs text-gray-400">📅 Added {fmtDate(data.created_at)}</div>
    </div>
  )
}

function OrderDetail({ data }) {
  const items = Array.isArray(data.items) ? data.items : []
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-bold text-2xl text-gray-900">#{data.order_number}</div>
          <div className="text-sm text-gray-500 mt-0.5">{fmtDate(data.created_at)}</div>
        </div>
        <StsBdg status={data.status} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 rounded-xl p-3">
          <div className="text-xs text-blue-500 font-semibold mb-1">Customer</div>
          <div className="font-semibold text-sm text-gray-900">{data.customer?.name || '—'}</div>
          <div className="text-xs text-gray-500">{data.customer?.phone || '—'}</div>
        </div>
        <div className="bg-purple-50 rounded-xl p-3">
          <div className="text-xs text-purple-500 font-semibold mb-1">Shop</div>
          <div className="font-semibold text-sm text-gray-900">{data.shop?.name || '—'}</div>
          <div className="text-xs text-gray-500">{data.delivery_type || '—'}</div>
        </div>
      </div>
      {items.length > 0 && (
        <div>
          <div className="font-semibold text-sm text-gray-700 mb-2">Order Items</div>
          <div className="space-y-1.5">
            {items.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl text-xs">
                <span className="font-medium text-gray-800">{item.name || item.product_name || `Item ${i + 1}`}</span>
                <span className="text-gray-600 font-semibold">
                  {item.qty || item.quantity || 1}× {fmtINR(item.price || item.unit_price || 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
        <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{fmtINR(data.subtotal)}</span></div>
        {data.delivery_fee > 0 && <div className="flex justify-between text-gray-600"><span>Delivery Fee</span><span>{fmtINR(data.delivery_fee)}</span></div>}
        {data.discount > 0 && <div className="flex justify-between text-green-600 font-medium"><span>Discount</span><span>−{fmtINR(data.discount)}</span></div>}
        <div className="flex justify-between font-bold text-lg text-gray-900 border-t border-gray-200 pt-2 mt-2">
          <span>Total</span><span>{fmtINR(data.total)}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-gray-50 rounded-lg p-2.5"><span className="text-gray-500">Payment</span><div className="font-semibold mt-0.5">{data.payment_method || '—'}</div></div>
        <div className="bg-gray-50 rounded-lg p-2.5"><span className="text-gray-500">Payment Status</span><div className="font-semibold mt-0.5">{data.payment_status || '—'}</div></div>
      </div>
      {data.delivery_address && (
        <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2.5">
          <span className="text-gray-500">Delivery Address</span>
          <div className="mt-0.5 font-medium">{data.delivery_address}</div>
        </div>
      )}
    </div>
  )
}

// ─── Section: Overview ────────────────────────────────────────────────────────
function OverviewSection({ data, openDetail, setSection }) {
  const o = data.overview || {}
  return (
    <div className="space-y-6">
      {/* KPI cards — click to navigate to the relevant section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon="👥" label="Total Users" value={o.total_users} sub={`+${o.new_users_7d || 0} this week`} onClick={() => setSection('users')} />
        <KpiCard icon="🏪" label="Active Shops" value={o.total_shops} sub={`${o.verified_shops || 0} verified`} onClick={() => setSection('shops')} />
        <KpiCard icon="📦" label="Products" value={o.total_products} sub={`${o.ai_percentage || 0}% AI generated`} onClick={() => setSection('products')} />
        <KpiCard icon="🛒" label="Total Orders" value={o.total_orders} sub={`+${o.orders_7d || 0} this week`} onClick={() => setSection('orders')} />
        <KpiCard icon="💰" label="Total GMV" value={o.gmv_total} fmt="currency" sub="all-time" onClick={() => setSection('financial')} />
        <KpiCard icon="⭐" label="Avg Rating" value={o.avg_platform_rating} sub={`${fmtNum(o.total_reviews)} reviews`} onClick={() => setSection('shops')} />
        <KpiCard icon="🔖" label="Wishlists" value={o.total_wishlists} onClick={() => setSection('products')} />
        <KpiCard icon="🤝" label="Haggles" value={o.total_haggles} onClick={() => setSection('engagement')} />
      </div>

      {/* Charts */}
      {data.userGrowth?.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <SecTitle icon="📈">User Growth</SecTitle>
            <button onClick={() => setSection('users')}
              className="text-xs text-blue-500 hover:text-blue-700 font-medium hover:underline transition-colors">
              View all users →
            </button>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.userGrowth}>
              <defs>
                <linearGradient id="ugC" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.primary} stopOpacity={0.2} /><stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ugB" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.purple} stopOpacity={0.2} /><stop offset="95%" stopColor={C.purple} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="period" tickFormatter={fmtDateSh} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<TTip />} />
              <Legend />
              <Area type="monotone" dataKey="customers" stroke={C.primary} fill="url(#ugC)" name="Customers" animationDuration={800} strokeWidth={2} />
              <Area type="monotone" dataKey="businesses" stroke={C.purple} fill="url(#ugB)" name="Businesses" animationDuration={800} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}
      {data.ordersTrend?.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <SecTitle icon="🛒">Orders & Revenue Trend</SecTitle>
            <button onClick={() => setSection('orders')}
              className="text-xs text-blue-500 hover:text-blue-700 font-medium hover:underline transition-colors">
              View all orders →
            </button>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.ordersTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tickFormatter={fmtDateSh} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
              <Tooltip content={<TTip />} />
              <Legend />
              <Line yAxisId="l" type="monotone" dataKey="orders" stroke={C.primary} dot={false} name="Orders" strokeWidth={2} animationDuration={800} />
              <Line yAxisId="r" type="monotone" dataKey="gmv" stroke={C.green} dot={false} name="GMV (₹)" strokeWidth={2} animationDuration={800} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Recent activity — side-by-side clickable tables */}
      {(data.recentUsers?.length > 0 || data.recentOrders?.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-4">
          {data.recentUsers?.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <SecTitle icon="🕐">Recent Users</SecTitle>
                <button onClick={() => setSection('users')}
                  className="text-xs text-blue-500 hover:text-blue-700 font-medium hover:underline transition-colors">
                  See all →
                </button>
              </div>
              <div className="space-y-1">
                {data.recentUsers.slice(0, 8).map(u => (
                  <div key={u.id} onClick={() => openDetail('user', u.id)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-blue-50 cursor-pointer transition-colors group">
                    <Avt name={u.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm truncate group-hover:text-blue-700 transition-colors">{u.name || '—'}</div>
                      <div className="text-xs text-gray-400">{u.phone || '—'}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <RolBdg role={u.active_role} />
                      <div className="text-xs text-gray-400">{fmtDate(u.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {data.recentOrders?.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <SecTitle icon="📋">Recent Orders</SecTitle>
                <button onClick={() => setSection('orders')}
                  className="text-xs text-blue-500 hover:text-blue-700 font-medium hover:underline transition-colors">
                  See all →
                </button>
              </div>
              <div className="space-y-1">
                {data.recentOrders.slice(0, 8).map(ord => (
                  <div key={ord.id} onClick={() => openDetail('order', ord.id)}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-blue-50 cursor-pointer transition-colors group">
                    <div className="min-w-0">
                      <div className="font-semibold text-blue-600 text-sm group-hover:text-blue-800 transition-colors">#{ord.order_number}</div>
                      <div className="text-xs text-gray-500 truncate">{ord.customer} · {ord.shop}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-3">
                      <div className="font-bold text-gray-800 text-sm">{fmtINR(ord.total)}</div>
                      <StsBdg status={ord.status} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Section: Users ───────────────────────────────────────────────────────────
function UsersSection({ data, openDetail }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pp = 15
  const seg = data.segmentation || {}
  const customers = (seg.customers_only || 0) + (seg.both_roles || 0)
  const businesses = (seg.businesses_only || 0) + (seg.both_roles || 0)
  const total = (seg.customers_only || 0) + (seg.businesses_only || 0) + (seg.both_roles || 0)

  const users = (data.recentUsers || []).filter(u =>
    !search || (u.name || '').toLowerCase().includes(search.toLowerCase()) || (u.phone || '').includes(search)
  )
  const paged = users.slice((page - 1) * pp, page * pp)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon="👤" label="Total Users" value={total} />
        <KpiCard icon="🛍️" label="Customers" value={customers} />
        <KpiCard icon="🏪" label="Business Owners" value={businesses} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        {Object.keys(seg).length > 0 && (
          <Card>
            <SecTitle icon="🥧">User Segmentation</SecTitle>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={[
                  { name: 'Customers only', value: seg.customers_only || 0 },
                  { name: 'Businesses only', value: seg.businesses_only || 0 },
                  { name: 'Both roles', value: seg.both_roles || 0 },
                ]} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {[C.primary, C.purple, C.teal].map((c, i) => <Cell key={i} fill={c} />)}
                </Pie>
                <Tooltip formatter={v => fmtNum(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}
        {data.userGrowth?.length > 0 && (
          <Card className="lg:col-span-2">
            <SecTitle icon="📈">User Growth Trend</SecTitle>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.userGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="period" tickFormatter={fmtDateSh} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<TTip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="customers" stroke={C.primary} fill={`${C.primary}20`} name="Customers" strokeWidth={2} />
                <Area type="monotone" dataKey="businesses" stroke={C.purple} fill={`${C.purple}20`} name="Businesses" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <SecTitle icon="🕐">Recent Users</SecTitle>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search name or phone…"
            className="text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 w-48" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Joined</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(u => (
                <tr key={u.id} onClick={() => openDetail('user', u.id)}
                  className="hover:bg-blue-50 cursor-pointer border-b border-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avt name={u.name} size="sm" />
                      <div>
                        <div className="font-medium text-gray-900">{u.name || '—'}</div>
                        <div className="text-xs text-gray-400">{u.phone || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><RolBdg role={u.active_role} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(u.created_at)}</td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-10 text-center text-gray-400">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pages page={page} total={users.length} pp={pp} onChange={setPage} />
      </Card>
    </div>
  )
}

// ─── Section: Shops ───────────────────────────────────────────────────────────
function ShopsSection({ data, openDetail }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('score')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [catFilter, setCatFilter] = useState(null)
  const pp = 15

  const handleSort = col => {
    if (sortKey === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(col); setSortDir('desc') }
    setPage(1)
  }

  const shops = (data.leaderboard || [])
    .filter(s => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
      if (catFilter && s.category !== catFilter) return false
      return true
    })
    .sort((a, b) => {
      const v = sortDir === 'asc' ? 1 : -1
      return (a[sortKey] > b[sortKey] ? 1 : -1) * v
    })

  const paged = shops.slice((page - 1) * pp, page * pp)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon="🏪" label="Total Shops" value={data.leaderboard?.length || 0} />
        <KpiCard icon="✅" label="Verified" value={(data.leaderboard || []).filter(s => s.verified).length} />
        <KpiCard icon="⚠️" label="Needs Attention" value={data.attention?.length || 0} />
      </div>
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <SecTitle icon="🏆">Shop Leaderboard</SecTitle>
            {catFilter && (
              <button onClick={() => { setCatFilter(null); setPage(1) }}
                className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium -mt-2 block">
                {catFilter} ✕
              </button>
            )}
          </div>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search shops…"
            className="text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 w-48" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[750px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Shop</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                <SortHd col="products" label="Products" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHd col="orders" label="Orders" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHd col="revenue" label="Revenue" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHd col="avg_rating" label="Rating" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHd col="score" label="Score" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">✓</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((s, i) => {
                const rowBg = s.score >= 80 ? 'bg-green-50' : s.score < 30 ? 'bg-red-50' : ''
                return (
                  <tr key={s.id} onClick={() => openDetail('shop', s.id)}
                    className={`cursor-pointer border-b border-gray-50 hover:bg-blue-50 transition-colors ${rowBg}`}>
                    <td className="px-4 py-3 text-gray-400 font-semibold text-sm">{(page - 1) * pp + i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900 max-w-[150px] truncate">{s.name}</div>
                    </td>
                    <td className="px-4 py-3"><Bdg color={CAT_CLR[s.category]}>{s.category}</Bdg></td>
                    <td className="px-4 py-3 text-gray-700">{fmtNum(s.products)}</td>
                    <td className="px-4 py-3 text-gray-700">{fmtNum(s.orders)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{fmtINR(s.revenue)}</td>
                    <td className="px-4 py-3">
                      <span className="text-amber-400">{'★'.repeat(Math.round(s.avg_rating))}</span>
                      <span className="text-xs text-gray-400 ml-1">{s.avg_rating.toFixed(1)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-14 bg-gray-200 rounded-full h-1.5">
                          <div style={{ width: `${Math.min(s.score, 100)}%`, backgroundColor: s.score >= 70 ? C.green : s.score >= 40 ? C.amber : C.red }}
                            className="h-1.5 rounded-full" />
                        </div>
                        <span className="text-xs font-semibold text-gray-700">{s.score.toFixed(0)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{s.verified ? '✅' : <span className="text-gray-300">—</span>}</td>
                  </tr>
                )
              })}
              {paged.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No shops found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pages page={page} total={shops.length} pp={pp} onChange={setPage} />
      </Card>
      <div className="grid lg:grid-cols-2 gap-4">
        {data.shopCategories?.length > 0 && (
          <Card>
            <SecTitle icon="🥧">Shop Categories</SecTitle>
            <p className="text-xs text-gray-400 mb-3 -mt-2">Click a slice to filter the leaderboard</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.shopCategories} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                  paddingAngle={3} dataKey="count" nameKey="category"
                  onClick={d => { setCatFilter(catFilter === d.category ? null : d.category); setPage(1) }}>
                  {data.shopCategories.map((d, i) => (
                    <Cell key={i} fill={CAT_CLR[d.category] || PIE[i % PIE.length]}
                      opacity={catFilter && catFilter !== d.category ? 0.35 : 1} cursor="pointer" />
                  ))}
                </Pie>
                <Tooltip formatter={v => fmtNum(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}
        {data.shopGrowth?.length > 0 && (
          <Card>
            <SecTitle icon="📈">Shop Growth</SecTitle>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.shopGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={fmtDateSh} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<TTip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="cumulative" stroke={C.primary} fill={`${C.primary}20`} name="Cumulative" strokeWidth={2} />
                <Area type="monotone" dataKey="new" stroke={C.green} fill={`${C.green}15`} name="New shops" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
      {data.attention?.length > 0 && (
        <Card>
          <SecTitle icon="⚠️">Shops Needing Attention</SecTitle>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.attention.slice(0, 9).map(s => (
              <div key={s.id} onClick={() => openDetail('shop', s.id)}
                className="border border-amber-200 bg-amber-50 rounded-xl p-3 cursor-pointer hover:shadow-md hover:border-amber-300 transition-all">
                <div className="font-semibold text-gray-900 truncate">{s.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.category}</div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {s.issues.map(issue => (
                    <span key={issue} className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-medium">{issue}</span>
                  ))}
                </div>
                <div className="text-xs text-gray-500 mt-2">Score: {s.score.toFixed(0)} · {s.products} products</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── Section: Products ────────────────────────────────────────────────────────
function ProductsSection({ data, openDetail }) {
  const [catFilter, setCatFilter] = useState(null)
  const [page, setPage] = useState(1)
  const pp = 15

  const viewed = data.topViewed || []
  const filtered = catFilter ? viewed.filter(p => p.category === catFilter) : viewed
  const paged = filtered.slice((page - 1) * pp, page * pp)

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <KpiCard icon="📦" label="Total Products" value={data.aiStats?.total || 0} />
        <KpiCard icon="✨" label="AI Generated" value={data.aiStats?.ai_generated || 0} sub={`${data.aiStats?.ai_percentage || 0}% of catalog`} />
        <KpiCard icon="📊" label="AI Adoption" value={data.aiStats?.ai_percentage || 0} fmt="pct" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {data.productsByCategory?.length > 0 && (
          <Card>
            <SecTitle icon="📊">Products by Category</SecTitle>
            <p className="text-xs text-gray-400 mb-3 -mt-2">Click a bar to filter the table below</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.productsByCategory} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="category" width={120} tick={{ fontSize: 10 }} />
                <Tooltip content={<TTip />} />
                <Bar dataKey="count" name="Products" radius={[0, 4, 4, 0]} animationDuration={800}
                  onClick={d => { setCatFilter(catFilter === d.category ? null : d.category); setPage(1) }}
                  cursor="pointer">
                  {(data.productsByCategory || []).map((d, i) => (
                    <Cell key={i} fill={CAT_CLR[d.category] || PIE[i % PIE.length]}
                      opacity={catFilter && catFilter !== d.category ? 0.35 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
        {data.priceDistribution?.length > 0 && (
          <Card>
            <SecTitle icon="💵">Price Distribution</SecTitle>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.priceDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<TTip />} />
                <Bar dataKey="count" name="Products" fill={C.primary} radius={[4, 4, 0, 0]} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
      <Card>
        <div className="flex items-center justify-between mb-4">
          <SecTitle icon="👁️">Top Viewed Products</SecTitle>
          {catFilter && (
            <button onClick={() => { setCatFilter(null); setPage(1) }}
              className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
              {catFilter} ✕
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Price</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Views</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Wishlisted</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((p, i) => (
                <tr key={p.id} onClick={() => openDetail('product', p.id)}
                  className="hover:bg-blue-50 cursor-pointer border-b border-gray-50 transition-colors">
                  <td className="px-3 py-2.5 text-gray-400 font-medium">{(page - 1) * pp + i + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {p.image && <img src={p.image} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />}
                      <div>
                        <div className="font-medium text-gray-900 max-w-[200px] truncate">{p.name}</div>
                        <div className="text-xs text-gray-400">{p.shop_name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5"><Bdg color={CAT_CLR[p.category]}>{p.category}</Bdg></td>
                  <td className="px-3 py-2.5 text-right font-semibold">{fmtINR(p.price)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{fmtNum(p.views)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700">{fmtNum(p.wishlisted)}</td>
                </tr>
              ))}
              {paged.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-400">No products found</td></tr>}
            </tbody>
          </table>
        </div>
        <Pages page={page} total={filtered.length} pp={pp} onChange={setPage} />
      </Card>
      {data.aiStats && (
        <Card>
          <SecTitle icon="✨">AI vs Manual Cataloging</SecTitle>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={[
                { name: 'AI Generated', value: data.aiStats.ai_generated || 0 },
                { name: 'Manual', value: data.aiStats.manual || 0 },
              ]} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                <Cell fill={C.purple} /><Cell fill={C.gray} />
              </Pie>
              <Tooltip formatter={v => fmtNum(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}

// ─── Section: Orders ──────────────────────────────────────────────────────────
function OrdersSection({ data, openDetail }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const pp = 15
  const o = data.overview || {}
  const funnel = data.orderFunnel || []
  const totalFunnel = funnel.reduce((s, f) => s + f.count, 0)
  const orders = (data.recentOrders || []).filter(ord => statusFilter === 'all' || ord.status === statusFilter)
  const paged = orders.slice((page - 1) * pp, page * pp)

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon="🛒" label="Total Orders" value={o.total_orders} />
        <KpiCard icon="💰" label="Total GMV" value={o.gmv_total} fmt="currency" />
        <KpiCard icon="📊" label="Avg Order Value" value={o.avg_order_value} fmt="currency" />
        <KpiCard icon="❌" label="Cancellation Rate" value={o.cancellation_rate} fmt="pct" />
      </div>
      {data.ordersTrend?.length > 0 && (
        <Card>
          <SecTitle icon="📈">Orders Trend</SecTitle>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.ordersTrend}>
              <defs>
                <linearGradient id="gOrd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.primary} stopOpacity={0.2} /><stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tickFormatter={fmtDateSh} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<TTip />} />
              <Area type="monotone" dataKey="orders" stroke={C.primary} fill="url(#gOrd)" name="Orders" strokeWidth={2} animationDuration={800} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}
      {funnel.length > 0 && (
        <Card>
          <SecTitle icon="🔽">Order Status Funnel</SecTitle>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {funnel.map(f => {
              const color = STS[f.status] || C.gray
              const pct = totalFunnel > 0 ? (f.count / totalFunnel * 100).toFixed(1) : 0
              const active = statusFilter === f.status
              return (
                <div key={f.status}
                  onClick={() => { setStatusFilter(active ? 'all' : f.status); setPage(1) }}
                  className="rounded-xl border-2 p-3 text-center cursor-pointer transition-all hover:shadow-md"
                  style={{ borderColor: color, backgroundColor: `${color}${active ? '25' : '10'}` }}>
                  <div style={{ color }} className="text-2xl font-bold">{fmtNum(f.count)}</div>
                  <div className="text-xs text-gray-600 mt-0.5 capitalize font-medium">{f.status}</div>
                  <div style={{ color }} className="text-xs font-semibold mt-0.5">{pct}%</div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <SecTitle icon="📋">Recent Orders</SecTitle>
          <div className="flex gap-1 flex-wrap">
            {['all', 'pending', 'completed', 'cancelled'].map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1) }}
                className={`px-3 py-1.5 text-xs rounded-full font-medium capitalize transition-colors ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Shop</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(ord => (
                <tr key={ord.id} onClick={() => openDetail('order', ord.id)}
                  className="hover:bg-blue-50 cursor-pointer border-b border-gray-50 transition-colors">
                  <td className="px-3 py-2.5 font-semibold text-blue-600">#{ord.order_number}</td>
                  <td className="px-3 py-2.5 text-gray-700">{ord.customer}</td>
                  <td className="px-3 py-2.5 text-gray-700 max-w-[120px] truncate">{ord.shop}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-gray-800">{fmtINR(ord.total)}</td>
                  <td className="px-3 py-2.5"><StsBdg status={ord.status} /></td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">{fmtDate(ord.created_at)}</td>
                </tr>
              ))}
              {paged.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-400">No orders found</td></tr>}
            </tbody>
          </table>
        </div>
        <Pages page={page} total={orders.length} pp={pp} onChange={setPage} />
      </Card>
    </div>
  )
}

// ─── Section: Engagement ──────────────────────────────────────────────────────
function EngagementSection({ data }) {
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon="🤝" label="Total Haggles" value={data.haggles?.total} />
        <KpiCard icon="✅" label="Haggles Accepted" value={data.haggles?.accepted} />
        <KpiCard icon="🎯" label="Acceptance Rate" value={data.haggles?.acceptance_rate} fmt="pct" />
        <KpiCard icon="🎁" label="Deal Claims" value={data.deals?.total_claims} />
      </div>
      {data.features?.length > 0 && (
        <Card>
          <SecTitle icon="⚡">Feature Usage</SecTitle>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={[...data.features].sort((a, b) => b.count - a.count)} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
              <Tooltip content={<TTip />} />
              <Bar dataKey="count" name="Count" radius={[0, 4, 4, 0]} animationDuration={800}>
                {[...data.features].sort((a, b) => b.count - a.count).map((_, i) => (
                  <Cell key={i} fill={PIE[i % PIE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
      <div className="grid lg:grid-cols-2 gap-4">
        {data.searches?.length > 0 && (
          <Card>
            <SecTitle icon="🔍">Search Intelligence</SecTitle>
            <p className="text-xs text-gray-400 mb-3 -mt-2">🟡 Amber rows = zero results (demand gaps)</p>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">#</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Query</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">Searches</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">Avg Results</th>
                </tr>
              </thead>
              <tbody>
                {data.searches.slice(0, 15).map((s, i) => (
                  <tr key={i} className={`border-b border-gray-50 ${s.avg_results === 0 ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-800">{s.query}</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmtNum(s.count)}</td>
                    <td className="px-3 py-2 text-right">
                      {s.avg_results === 0
                        ? <span className="text-amber-600 font-bold">0 ⚠️</span>
                        : <span className="text-gray-600">{s.avg_results}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
        {data.demandGaps?.length > 0 && (
          <Card>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🎯</span>
              <h2 className="text-base font-bold text-red-700">Unmet Demand</h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">People search for these but no results — prioritize for shop onboarding</p>
            <div className="space-y-2">
              {data.demandGaps.map((g, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 bg-red-50 rounded-xl border border-red-100">
                  <div className="w-6 h-6 flex-shrink-0 bg-red-100 rounded-full flex items-center justify-center text-xs font-bold text-red-500">{i + 1}</div>
                  <div className="flex-1 font-semibold text-gray-800">{g.query}</div>
                  <div className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0">
                    {fmtNum(g.count)}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

// ─── Section: Financial ───────────────────────────────────────────────────────
function FinancialSection({ data }) {
  const coins = data.shopcoins || {}
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <KpiCard icon="🪙" label="Coins Earned" value={coins.total_earned} />
        <KpiCard icon="💸" label="Coins Spent" value={coins.total_spent} />
        <KpiCard icon="📊" label="In Circulation" value={coins.circulation} />
      </div>
      {coins.trend?.length > 0 ? (
        <Card>
          <SecTitle icon="💰">ShopCoins Economy</SecTitle>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={coins.trend}>
              <defs>
                <linearGradient id="gEarn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.green} stopOpacity={0.3} /><stop offset="95%" stopColor={C.green} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.red} stopOpacity={0.25} /><stop offset="95%" stopColor={C.red} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tickFormatter={fmtDateSh} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<TTip />} />
              <Legend />
              <Area type="monotone" dataKey="earned" stroke={C.green} fill="url(#gEarn)" name="Earned" strokeWidth={2} animationDuration={800} />
              <Area type="monotone" dataKey="spent" stroke={C.red} fill="url(#gSpend)" name="Spent" strokeWidth={2} animationDuration={800} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      ) : (
        <Card className="text-center py-12">
          <div className="text-5xl mb-3">🪙</div>
          <div className="font-semibold text-gray-600">No ShopCoins activity in this period</div>
          <div className="text-sm text-gray-400 mt-1">Coins data will appear once users earn or spend coins</div>
        </Card>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        {[
          { icon: '💳', title: 'Subscription Revenue', sub: 'Premium shop plans' },
          { icon: '📣', title: 'Promoted Listings Revenue', sub: 'Boosted product visibility' },
        ].map(item => (
          <Card key={item.title} className="opacity-60">
            <div className="text-center py-8">
              <div className="text-4xl mb-3">{item.icon}</div>
              <div className="font-semibold text-gray-700">{item.title}</div>
              <div className="text-xs text-gray-400 mt-1">{item.sub}</div>
              <div className="mt-3 inline-block px-3 py-1 bg-gray-100 text-gray-500 text-xs rounded-full font-medium">Coming Soon</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── Section: AI Usage ────────────────────────────────────────────────────────
const fmtUSD = v => `$${(parseFloat(v) || 0).toFixed(4)}`
const FEAT_CLR = {
  smart_search: '#3B8BD4', cataloging_snap: '#7F77DD', cataloging_shelf: '#D4537E',
  sentiment_analysis: '#1D9E75', advisor_chat: '#EF9F27', description_gen: '#D85A30',
  cataloging_snap_url: '#5DCAA5', cataloging_shelf_url: '#6B7280',
}

function AiUsageSection({ data }) {
  const ov = data.aiOverview || {}
  const byFeature = data.aiByFeature || []
  const byModel = data.aiByModel || []
  const trend = data.aiDailyTrend || []
  const recent = data.aiRecentCalls || []
  const hourly = data.aiHourly || []
  const topUsers = data.aiTopUsers || []

  const [recentPage, setRecentPage] = useState(1)
  const perPage = 15
  const pagedRecent = recent.slice((recentPage - 1) * perPage, recentPage * perPage)

  if (!ov.total_calls && ov.total_calls !== 0) {
    return (
      <Card className="text-center py-16">
        <div className="text-5xl mb-3">🤖</div>
        <div className="font-semibold text-gray-600">Loading AI Usage data...</div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon="📞" label="Total API Calls" value={ov.total_calls} sub={`${ov.error_count || 0} errors (${ov.error_rate || 0}%)`} />
        <KpiCard icon="🪙" label="Total Tokens Used" value={ov.total_tokens} sub={`${fmtNum(ov.total_prompt_tokens || 0)} in / ${fmtNum(ov.total_completion_tokens || 0)} out`} />
        <KpiCard icon="💵" label="Total Cost (USD)" value={ov.total_cost_usd} fmt="number" sub={fmtUSD(ov.total_cost_usd)} />
        <KpiCard icon="⚡" label="Avg Response Time" value={ov.avg_response_ms} sub={`${ov.unique_users || 0} unique users`} />
      </div>

      {/* Daily Trend Chart */}
      {trend.length > 0 && (
        <Card>
          <SecTitle icon="📈">Daily API Usage & Cost</SecTitle>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="gCalls" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.primary} stopOpacity={0.3} /><stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gTokens" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.purple} stopOpacity={0.2} /><stop offset="95%" stopColor={C.purple} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tickFormatter={fmtDateSh} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip content={<TTip />} />
              <Legend />
              <Area yAxisId="left" type="monotone" dataKey="calls" stroke={C.primary} fill="url(#gCalls)" name="Calls" strokeWidth={2} animationDuration={800} />
              <Area yAxisId="left" type="monotone" dataKey="tokens" stroke={C.purple} fill="url(#gTokens)" name="Tokens" strokeWidth={2} animationDuration={800} />
              <Line yAxisId="right" type="monotone" dataKey="errors" stroke={C.red} name="Errors" strokeWidth={2} dot={false} animationDuration={800} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Cost by Feature */}
        {byFeature.length > 0 && (
          <Card>
            <SecTitle icon="🧩">Cost by Feature</SecTitle>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byFeature} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="feature" type="category" tick={{ fontSize: 10 }} width={120} />
                <Tooltip formatter={(v) => fmtUSD(v)} />
                <Bar dataKey="cost_usd" name="Cost (USD)" radius={[0, 6, 6, 0]} animationDuration={800}>
                  {byFeature.map((entry, i) => (
                    <Cell key={i} fill={FEAT_CLR[entry.feature] || PIE[i % PIE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-1.5">
              {byFeature.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: FEAT_CLR[f.feature] || PIE[i % PIE.length] }} />
                    <span className="text-gray-700 font-medium">{f.feature.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{fmtNum(f.calls)} calls</span>
                    <span>{fmtNum(f.tokens)} tokens</span>
                    <span className="font-semibold text-gray-800">{fmtUSD(f.cost_usd)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Cost by Model */}
        {byModel.length > 0 && (
          <Card>
            <SecTitle icon="🧠">Usage by Model</SecTitle>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byModel} dataKey="cost_usd" nameKey="model" cx="50%" cy="50%" outerRadius={80} label={({ model, cost_usd }) => `${model}: ${fmtUSD(cost_usd)}`}>
                  {byModel.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmtUSD(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-2">
              {byModel.map((m, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE[i % PIE.length] }} />
                    <span className="font-semibold text-gray-800">{m.model}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>{fmtNum(m.calls)} calls</span>
                    <span>{fmtNum(m.prompt_tokens)} in</span>
                    <span>{fmtNum(m.completion_tokens)} out</span>
                    <span className="font-bold text-gray-800">{fmtUSD(m.cost_usd)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Hourly Distribution */}
        {hourly.length > 0 && (
          <Card>
            <SecTitle icon="🕐">Usage by Hour of Day</SecTitle>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickFormatter={h => `${h}:00`} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, name) => name === 'cost_usd' ? fmtUSD(v) : fmtNum(v)} />
                <Bar dataKey="calls" name="Calls" fill={C.primary} radius={[4, 4, 0, 0]} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Top AI Users */}
        {topUsers.length > 0 && (
          <Card>
            <SecTitle icon="👤">Top AI Users by Cost</SecTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">User</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Calls</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Tokens</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {topUsers.slice(0, 10).map((u, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Avt name={u.name} size="sm" />
                          <div>
                            <div className="font-medium text-gray-800">{u.name}</div>
                            <div className="text-xs text-gray-400">{u.phone || 'No phone'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{fmtNum(u.calls)}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{fmtNum(u.tokens)}</td>
                      <td className="px-3 py-2 text-right font-bold text-gray-800">{fmtUSD(u.cost_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Recent API Calls Log */}
      {recent.length > 0 && (
        <Card>
          <SecTitle icon="📋">Recent API Calls</SecTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Time</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Feature</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Model</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Tokens</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Cost</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Latency</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {pagedRecent.map((call, i) => (
                  <tr key={call.id || i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{fmtDate(call.created_at)}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: FEAT_CLR[call.feature] || C.gray }} />
                        <span className="font-medium text-gray-700">{call.feature?.replace(/_/g, ' ')}</span>
                        {call.has_image && <span className="text-xs">📷</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{call.model}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(call.total_tokens)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{fmtUSD(call.cost_usd)}</td>
                    <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{call.response_time_ms}ms</td>
                    <td className="px-3 py-2 text-center">
                      <Bdg color={call.status === 'success' ? C.green : C.red}>{call.status}</Bdg>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pages page={recentPage} total={recent.length} pp={perPage} onChange={setRecentPage} />
        </Card>
      )}

      {ov.total_calls === 0 && (
        <Card className="text-center py-16">
          <div className="text-5xl mb-3">🤖</div>
          <div className="font-semibold text-gray-600">No AI API calls recorded yet</div>
          <div className="text-sm text-gray-400 mt-1">Usage data will appear as users interact with AI features</div>
        </Card>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [section, setSection] = useState('overview')
  const [period, setPeriod] = useState('30d')
  const [slideOver, setSlideOver] = useState(null)
  const [sectionData, setSectionData] = useState({})
  const [loading, setLoading] = useState(false)
  const loaded = useRef(new Set())

  const openDetail = useCallback(async (type, id) => {
    setSlideOver({ type, id, data: null, loading: true })
    try {
      const fns = { user: api.getUserDetail, shop: api.getShopDetail, product: api.getProductDetail, order: api.getOrderDetail }
      const res = await fns[type](id)
      setSlideOver({ type, id, data: res.data, loading: false })
    } catch {
      setSlideOver({ type, id, data: null, loading: false })
    }
  }, [])

  const loadSection = useCallback(async (sec, per) => {
    const key = `${sec}_${per}`
    if (loaded.current.has(key)) return
    setLoading(true)
    const res = {}
    try {
      const calls = []
      if (sec === 'overview') {
        calls.push(
          api.getOverview().then(r => { res.overview = r.data }),
          api.getUserGrowth(per).then(r => { res.userGrowth = r.data }),
          api.getOrdersTrend(per).then(r => { res.ordersTrend = r.data }),
          api.getRecentUsers(8).then(r => { res.recentUsers = r.data }),
          api.getRecentOrders(8).then(r => { res.recentOrders = r.data }),
        )
      } else if (sec === 'users') {
        calls.push(
          api.getOverview().then(r => { res.overview = r.data }),
          api.getUserGrowth(per).then(r => { res.userGrowth = r.data }),
          api.getUserSegmentation().then(r => { res.segmentation = r.data }),
          api.getRecentUsers(200).then(r => { res.recentUsers = r.data }),
        )
      } else if (sec === 'shops') {
        calls.push(
          api.getShopLeaderboard('score', 200).then(r => { res.leaderboard = r.data }),
          api.getShopCategories().then(r => { res.shopCategories = r.data }),
          api.getShopGrowth(per).then(r => { res.shopGrowth = r.data }),
          api.getShopsHealth().then(r => { res.attention = r.data }),
        )
      } else if (sec === 'products') {
        calls.push(
          api.getProductsByCategory().then(r => { res.productsByCategory = r.data }),
          api.getTopViewed(100).then(r => { res.topViewed = r.data }),
          api.getTopWishlisted(100).then(r => { res.topWishlisted = r.data }),
          api.getPriceDistribution().then(r => { res.priceDistribution = r.data }),
          api.getAiStats().then(r => { res.aiStats = r.data }),
        )
      } else if (sec === 'orders') {
        calls.push(
          api.getOverview().then(r => { res.overview = r.data }),
          api.getOrdersTrend(per).then(r => { res.ordersTrend = r.data }),
          api.getOrderFunnel().then(r => { res.orderFunnel = r.data }),
          api.getRecentOrders(300).then(r => { res.recentOrders = r.data }),
        )
      } else if (sec === 'engagement') {
        calls.push(
          api.getFeatureUsage().then(r => { res.features = r.data }),
          api.getTopSearches(30).then(r => { res.searches = r.data }),
          api.getDemandGaps(20).then(r => { res.demandGaps = r.data }),
          api.getHaggleStats().then(r => { res.haggles = r.data }),
          api.getDealPerformance().then(r => { res.deals = r.data }),
        )
      } else if (sec === 'financial') {
        calls.push(api.getShopcoinsEconomy(per).then(r => { res.shopcoins = r.data }))
      } else if (sec === 'ai_usage') {
        calls.push(
          api.getAiOverview(per).then(r => { res.aiOverview = r.data }),
          api.getAiCostByFeature(per).then(r => { res.aiByFeature = r.data }),
          api.getAiCostByModel(per).then(r => { res.aiByModel = r.data }),
          api.getAiDailyTrend(per).then(r => { res.aiDailyTrend = r.data }),
          api.getAiRecentCalls(50).then(r => { res.aiRecentCalls = r.data }),
          api.getAiHourlyDistribution(per).then(r => { res.aiHourly = r.data }),
          api.getAiTopUsers(per).then(r => { res.aiTopUsers = r.data }),
        )
      }
      await Promise.allSettled(calls)
    } catch { /* no-op */ }
    setSectionData(prev => ({ ...prev, ...res }))
    loaded.current.add(key)
    setLoading(false)
  }, [])

  useEffect(() => { loadSection(section, period) }, [section, period, loadSection])

  const handlePeriod = p => { loaded.current = new Set(); setPeriod(p) }

  const secProps = { data: sectionData, openDetail, period, setSection }

  return (
    <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
      <Sidebar section={section} setSection={setSection} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-100 shadow-sm flex-shrink-0">
          <div className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="lg:hidden font-bold text-gray-900 text-lg">🛍️ Admin</span>
              <span className="hidden lg:flex items-center gap-2 text-sm font-semibold text-gray-700">
                {SECS.find(s => s.id === section)?.icon}
                {SECS.find(s => s.id === section)?.label}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {loading && <Spin size="sm" />}
              <div className="flex bg-gray-100 rounded-xl p-1">
                {['7d', '30d', '90d'].map(p => (
                  <button key={p} onClick={() => handlePeriod(p)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${period === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    {p}
                  </button>
                ))}
              </div>
              <a href="/app/home" className="hidden sm:block text-xs text-gray-400 hover:text-gray-600 transition-colors">← App</a>
            </div>
          </div>
          <MobileTabs section={section} setSection={setSection} />
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {section === 'overview' && <OverviewSection {...secProps} />}
          {section === 'users' && <UsersSection {...secProps} />}
          {section === 'shops' && <ShopsSection {...secProps} />}
          {section === 'products' && <ProductsSection {...secProps} />}
          {section === 'orders' && <OrdersSection {...secProps} />}
          {section === 'engagement' && <EngagementSection {...secProps} />}
          {section === 'financial' && <FinancialSection {...secProps} />}
          {section === 'ai_usage' && <AiUsageSection {...secProps} />}
        </main>
      </div>
      {slideOver && (
        <SlideOver type={slideOver.type} data={slideOver.data} loading={slideOver.loading} onClose={() => setSlideOver(null)} />
      )}
    </div>
  )
}
