import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, X, Send, MessageCircle, Lightbulb, Bot, TrendingUp, AlertTriangle, Star, Package } from 'lucide-react'
import client from '../../api/client'
import { getDemandGaps, getCatalogueSuggestions, getReviewSentiment } from '../../api/ai'
import useMyShop from '../../hooks/useMyShop'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const PRIORITY_COLORS = {
  high: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-700' },
  medium: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  low: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
}

const ACTION_LABELS = {
  discount_or_remove: { label: 'Apply Discount', to: '/biz/catalog' },
  reduce_price: { label: 'Edit Price', to: '/biz/catalog' },
  create_deal: { label: 'Create Deal', to: '/biz/deals/new' },
  add_product: { label: 'Add Product', to: '/biz/snap' },
  request_reviews: { label: 'Request Reviews', to: '/biz/broadcast' },
  update_catalog: { label: 'Update Catalog', to: '/biz/catalog' },
  share_shop: { label: 'Share Shop', to: '/biz/marketing' },
}

const QUICK_QUESTIONS = [
  '💡 How can I get more customers?',
  '📈 How to increase my revenue?',
  '🎯 Which products should I promote?',
  '🏷️ Should I create any deals right now?',
  '📱 How to use NearShop features better?',
  '🎪 Any festival-related suggestions?',
]

export default function AdvisorPage() {
  const navigate = useNavigate()
  const { shop, shopId } = useMyShop()
  const [suggestions, setSuggestions] = useState([])
  const [dismissed, setDismissed] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('suggestions')

  // ML feature states
  const [demandGaps, setDemandGaps] = useState([])
  const [catalogSuggestions, setCatalogSuggestions] = useState(null)
  const [sentiment, setSentiment] = useState(null)
  const [mlLoading, setMlLoading] = useState(false)

  // Chat state
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await client.get('/advisor/suggestions')
      const data = res.data?.suggestions ?? res.data
      setSuggestions(Array.isArray(data) ? data : [])
    } catch {} finally { setLoading(false) }
  }

  const loadMLFeatures = async () => {
    if (!shopId || !shop?.latitude) return
    setMlLoading(true)
    const lat = shop.latitude
    const lng = shop.longitude
    try {
      const [gapsRes, catRes, sentRes] = await Promise.allSettled([
        getDemandGaps(shopId, lat, lng),
        getCatalogueSuggestions(shopId, lat, lng),
        getReviewSentiment(shopId),
      ])
      if (gapsRes.status === 'fulfilled') setDemandGaps(gapsRes.value.data?.gaps ?? [])
      if (catRes.status === 'fulfilled') setCatalogSuggestions(catRes.value.data)
      if (sentRes.status === 'fulfilled') setSentiment(sentRes.value.data)
    } catch {} finally { setMlLoading(false) }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (shopId && shop) loadMLFeatures() }, [shopId, shop])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendChat = async (question) => {
    const q = question || chatInput.trim()
    if (!q) return
    setChatInput('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setChatLoading(true)
    try {
      const res = await client.post('/advisor/chat', { question: q })
      setMessages(prev => [...prev, { role: 'assistant', text: res.data?.answer || 'No response', fallback: res.data?.fallback }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, could not process your question. Please try again.', error: true }])
    } finally { setChatLoading(false) }
  }

  const visible = suggestions.filter((_, i) => !dismissed.has(i))

  const TABS = [
    { key: 'suggestions', icon: Lightbulb, label: 'Tips', count: visible.length },
    { key: 'demand', icon: TrendingUp, label: 'Demand', count: demandGaps.length },
    { key: 'sentiment', icon: Star, label: 'Reviews' },
    { key: 'catalogue', icon: Package, label: 'Catalog' },
    { key: 'chat', icon: MessageCircle, label: 'Ask AI' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Bot className="w-5 h-5 text-purple-600" /> AI Business Advisor
            </h1>
            <p className="text-xs text-gray-400">Data-driven insights & AI-powered advice</p>
          </div>
          <button onClick={() => { load(); loadMLFeatures() }} className="p-2 rounded-lg hover:bg-gray-100">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Tab pills — scrollable row */}
      <div className="flex gap-2 px-4 py-3 bg-white border-b border-gray-100 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${tab === t.key ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            {t.count != null && t.count > 0 && <span className={`text-[10px] font-bold px-1.5 rounded-full ${tab === t.key ? 'bg-white/30' : 'bg-gray-300'}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ── Suggestions Tab ───────────────────────────────── */}
      {tab === 'suggestions' && (
        <div className="px-4 mt-4 space-y-3">
          {loading ? <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>
            : visible.length === 0 ? (
              <div className="text-center py-16">
                <span className="text-5xl block mb-3">🎉</span>
                <p className="text-gray-700 font-bold text-lg">All clear!</p>
                <p className="text-sm text-gray-400 mt-1">No suggestions right now. Your shop is looking great!</p>
                <button onClick={() => setTab('chat')} className="mt-4 bg-purple-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-purple-700 transition-colors">
                  💬 Ask AI for growth tips
                </button>
              </div>
            ) : (
              <>
                <div className="bg-purple-600 rounded-2xl p-4 flex items-center gap-3">
                  <span className="text-2xl">🧠</span>
                  <div>
                    <p className="text-white font-bold text-sm">
                      {visible.filter(s => s.priority === 'high').length} high priority actions
                    </p>
                    <p className="text-purple-200 text-xs">Based on your shop data analysis</p>
                  </div>
                </div>
                {visible.map((s, i) => {
                  const colors = PRIORITY_COLORS[s.priority] || PRIORITY_COLORS.low
                  const action = ACTION_LABELS[s.action]
                  return (
                    <div key={i} className={`rounded-xl p-4 border shadow-sm ${colors.bg} ${colors.border}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <span className="text-xl flex-shrink-0">{s.icon}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-bold text-gray-900">{s.title}</p>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colors.badge}`}>{s.priority}</span>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed">{s.body || s.description}</p>
                          </div>
                        </div>
                        <button onClick={() => setDismissed(p => new Set([...p, i]))} className="p-1 flex-shrink-0 ml-2">
                          <X className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                      </div>
                      {action && (
                        <button onClick={() => navigate(action.to)}
                          className="mt-3 w-full bg-white/80 border border-gray-200 text-gray-700 py-2 rounded-lg text-xs font-bold hover:bg-white transition-colors">
                          {action.label} →
                        </button>
                      )}
                    </div>
                  )
                })}
              </>
            )}
        </div>
      )}

      {/* ── Demand Gaps Tab ───────────────────────────────── */}
      {tab === 'demand' && (
        <div className="px-4 mt-4 space-y-3">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4">
            <p className="text-white font-bold flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Unfulfilled Demand Near You</p>
            <p className="text-blue-100 text-xs mt-1">Searches by customers nearby that found no results — your opportunity!</p>
          </div>
          {mlLoading ? <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
            : demandGaps.length === 0 ? (
              <div className="text-center py-16">
                <span className="text-5xl block mb-3">🔍</span>
                <p className="text-gray-500 font-medium">No demand gaps found yet</p>
                <p className="text-xs text-gray-400 mt-1">Data appears as customers search near your shop</p>
              </div>
            ) : demandGaps.map((gap, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-900 capitalize">"{gap.keyword}"</p>
                    <p className="text-xs text-gray-500 mt-0.5">{gap.suggested_action}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-lg font-extrabold text-blue-600">{gap.search_volume}</p>
                    <p className="text-[10px] text-gray-400">searches</p>
                  </div>
                </div>
                {gap.zero_result_searches > 0 && (
                  <p className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded mt-2">
                    ⚠️ {gap.zero_result_searches} searches found absolutely nothing nearby
                  </p>
                )}
                <button onClick={() => navigate('/biz/snap')}
                  className="mt-3 w-full bg-blue-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors">
                  + Add Products for This Demand
                </button>
              </div>
            ))}
        </div>
      )}

      {/* ── Review Sentiment Tab ──────────────────────────── */}
      {tab === 'sentiment' && (
        <div className="px-4 mt-4 space-y-3">
          {mlLoading ? <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
            : !sentiment ? (
              <div className="text-center py-16">
                <span className="text-5xl block mb-3">💬</span>
                <p className="text-gray-500 font-medium">No review data yet</p>
              </div>
            ) : (
              <>
                {/* Overall score */}
                <div className={`rounded-2xl p-5 ${sentiment.overall_sentiment === 'positive' ? 'bg-green-600' : sentiment.overall_sentiment === 'negative' ? 'bg-red-600' : 'bg-amber-500'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-bold text-lg">
                        {sentiment.overall_sentiment === 'positive' ? '😊 Positive' : sentiment.overall_sentiment === 'negative' ? '😟 Negative' : '😐 Neutral'} Sentiment
                      </p>
                      <p className="text-white/70 text-xs mt-1">Based on {sentiment.analysed_reviews} reviews</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white text-3xl font-extrabold">{sentiment.avg_rating}</p>
                      <p className="text-white/70 text-xs">avg ⭐</p>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                {sentiment.summary && (
                  <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">AI Summary</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{sentiment.summary}</p>
                  </div>
                )}

                {/* Positives */}
                {sentiment.key_positives?.length > 0 && (
                  <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                    <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">✅ What Customers Love</p>
                    {sentiment.key_positives.map((p, i) => (
                      <p key={i} className="text-sm text-green-800 py-1 border-b border-green-100 last:border-0">• {p}</p>
                    ))}
                  </div>
                )}

                {/* Negatives */}
                {sentiment.key_negatives?.length > 0 && (
                  <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                    <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2">⚠️ Areas to Improve</p>
                    {sentiment.key_negatives.map((n, i) => (
                      <p key={i} className="text-sm text-red-800 py-1 border-b border-red-100 last:border-0">• {n}</p>
                    ))}
                  </div>
                )}

                {/* Suggestions */}
                {sentiment.improvement_suggestions?.length > 0 && (
                  <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                    <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">🤖 AI Recommendations</p>
                    {sentiment.improvement_suggestions.map((s, i) => (
                      <p key={i} className="text-sm text-indigo-800 py-1 border-b border-indigo-100 last:border-0">• {s}</p>
                    ))}
                  </div>
                )}
              </>
            )}
        </div>
      )}

      {/* ── Catalogue Suggestions Tab ─────────────────────── */}
      {tab === 'catalogue' && (
        <div className="px-4 mt-4 space-y-3">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4">
            <p className="text-white font-bold flex items-center gap-2"><Package className="w-5 h-5" /> Smart Catalogue Completion</p>
            <p className="text-amber-100 text-xs mt-1">Products customers buy together nearby that you're missing</p>
          </div>
          {mlLoading ? <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
            : !catalogSuggestions ? (
              <div className="text-center py-16">
                <span className="text-5xl block mb-3">📦</span>
                <p className="text-gray-500 font-medium">No catalogue data yet</p>
              </div>
            ) : (
              <>
                {/* Current categories */}
                {catalogSuggestions.existing_categories?.length > 0 && (
                  <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Your Current Categories</p>
                    <div className="flex flex-wrap gap-1.5">
                      {catalogSuggestions.existing_categories.map((cat, i) => (
                        <span key={i} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-medium">{cat}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing opportunities */}
                {catalogSuggestions.missing_opportunities?.length > 0 ? (
                  catalogSuggestions.missing_opportunities.map((opp, i) => (
                    <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-bold text-gray-900">Add: {opp.category}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Often bought with {opp.co_occurs_with}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-extrabold text-amber-600">{opp.confidence}%</p>
                          <p className="text-[10px] text-gray-400">confidence</p>
                        </div>
                      </div>
                      <p className="text-xs text-amber-800 leading-relaxed">{opp.message}</p>
                      <button onClick={() => navigate('/biz/catalog/bulk')}
                        className="mt-3 w-full bg-amber-500 text-white py-2 rounded-lg text-xs font-bold hover:bg-amber-600 transition-colors">
                        + Add {opp.category} Products
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <span className="text-3xl block mb-2">✅</span>
                    <p className="text-gray-600 font-medium text-sm">Your catalogue is well-rounded!</p>
                    <p className="text-xs text-gray-400 mt-1">Based on {catalogSuggestions.orders_analysed} local orders</p>
                  </div>
                )}

                {/* Top local categories */}
                {catalogSuggestions.top_local_categories?.length > 0 && (
                  <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">🔥 Most Popular Categories in Your Area</p>
                    {catalogSuggestions.top_local_categories.slice(0, 5).map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                        <span className="text-sm text-gray-700">{item.category}</span>
                        <span className="text-xs font-bold text-gray-500">{item.order_count} orders</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
        </div>
      )}

      {/* ── Chat Tab ──────────────────────────────────────── */}
      {tab === 'chat' && (
        <div className="flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <span className="text-5xl block mb-3">🤖</span>
                <p className="text-gray-900 font-bold text-xl mb-1">AI Business Advisor</p>
                <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
                  Ask me anything about growing your shop, pricing, marketing, or attracting customers.
                </p>
                <p className="text-xs font-bold text-gray-400 tracking-wider mb-3">QUICK QUESTIONS</p>
                <div className="space-y-2 max-w-md mx-auto">
                  {QUICK_QUESTIONS.map((q, i) => (
                    <button key={i} onClick={() => sendChat(q)}
                      className="w-full text-left px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-purple-300 hover:bg-purple-50 transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
                {msg.role === 'assistant' && <span className="text-xl mt-1">🤖</span>}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-purple-600 text-white rounded-br-sm'
                    : 'bg-white border border-gray-200 shadow-sm text-gray-800 rounded-bl-sm'
                }`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex gap-2">
                <span className="text-xl">🤖</span>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2"><LoadingSpinner size="sm" /><span className="text-sm text-gray-400">Thinking...</span></div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="border-t border-gray-100 bg-white px-4 py-3 flex gap-2">
            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
              placeholder="Ask me anything about your shop..."
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400" />
            <button onClick={() => sendChat()} disabled={!chatInput.trim() || chatLoading}
              className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center disabled:bg-gray-300 hover:bg-purple-700 transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
