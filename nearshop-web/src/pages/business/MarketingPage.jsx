import { useState, useEffect, useCallback } from 'react'
import { Send, Copy, Check, Calendar, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { generateWhatsAppText, getCatalogData, getFestivals } from '../../api/marketing'
import { getShopProducts } from '../../api/shops'
import useMyShop from '../../hooks/useMyShop'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const TEMPLATES = [
  { key: 'catalog', label: 'Full Catalog', icon: '📋', desc: 'All your products organized by category' },
  { key: 'new_arrivals', label: 'New Arrivals', icon: '🆕', desc: 'Highlight your newest products' },
  { key: 'deals', label: 'Deals & Offers', icon: '🔥', desc: 'Products with discounts' },
  { key: 'festival', label: 'Festival Special', icon: '🎉', desc: 'Festive season greeting + products' },
]

const QUICK_MESSAGES = [
  { label: 'We\'re Open!', icon: '🏪', text: (name) => `*${name}* is OPEN today! Come visit us for great deals.` },
  { label: 'New Stock', icon: '📦', text: (name) => `*New stock just arrived at ${name}!* Visit us today before it sells out.` },
  { label: 'Flash Sale', icon: '⚡', text: (name) => `*FLASH SALE at ${name}!* Limited time offers. Hurry!` },
  { label: 'We Miss You', icon: '💬', text: (name) => `We miss you! Visit *${name}* today and enjoy special returning customer offers.` },
]

export default function MarketingPage() {
  const { shop, shopId } = useMyShop()
  const [tab, setTab] = useState('share')
  const [selectedTemplate, setSelectedTemplate] = useState('catalog')
  const [generatedText, setGeneratedText] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [festivals, setFestivals] = useState([])

  const [products, setProducts] = useState([])
  const [selectedProductIds, setSelectedProductIds] = useState([])

  useEffect(() => {
    if (shopId) {
      getShopProducts(shopId, { per_page: 50 }).then(res => {
        const d = res.data
        setProducts(Array.isArray(d) ? d : d?.items ?? [])
      }).catch(() => {})
    }
  }, [shopId])

  useEffect(() => {
    getFestivals().then(res => setFestivals(res.data || [])).catch(() => {})
  }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await generateWhatsAppText({
        template: selectedTemplate,
        product_ids: selectedProductIds.length > 0 ? selectedProductIds : undefined,
      })
      setGeneratedText(res.data.text || '')
    } catch (e) {
      toast.error('Failed to generate text')
    } finally { setGenerating(false) }
  }

  const shareWA = (text) => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`)
  const copyText = (text) => {
    navigator.clipboard?.writeText(text)
    setCopied(true)
    toast.success('Copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleProduct = (id) => {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : prev.length < 10 ? [...prev, id] : prev
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">WhatsApp Marketing</h1>
        <p className="text-xs text-gray-400">Share your catalog & promotions</p>
        <div className="flex gap-2 mt-2">
          {[['share', 'Share Catalog'], ['festivals', 'Festivals'], ['templates', 'Quick Messages']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === key ? 'bg-[#1D9E75] text-white' : 'bg-gray-100 text-gray-500'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Catalog Share ──────────────────────────── */}
      {tab === 'share' && (
        <div className="px-4 mt-4 space-y-4">
          {/* Template selector */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Choose Template</p>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map(t => (
                <button key={t.key} onClick={() => setSelectedTemplate(t.key)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${selectedTemplate === t.key ? 'border-[#1D9E75] bg-[#1D9E75]/5' : 'border-gray-200 bg-white'}`}>
                  <span className="text-xl">{t.icon}</span>
                  <p className={`text-xs font-semibold mt-1 ${selectedTemplate === t.key ? 'text-[#1D9E75]' : 'text-gray-700'}`}>{t.label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Product selection */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Select Products ({selectedProductIds.length}/10)</p>
            <div className="max-h-48 overflow-y-auto bg-white rounded-xl border border-gray-100 divide-y">
              {products.slice(0, 30).map(p => {
                const sel = selectedProductIds.includes(String(p.id))
                return (
                  <button key={p.id} onClick={() => toggleProduct(String(p.id))}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 ${sel ? 'bg-[#1D9E75]/5' : ''}`}>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${sel ? 'bg-[#1D9E75] border-[#1D9E75]' : 'border-gray-300'}`}>
                      {sel && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">₹{Number(p.price).toLocaleString('en-IN')}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <button onClick={handleGenerate} disabled={generating}
            className="w-full bg-[#1D9E75] text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            <Sparkles className="w-4 h-4" /> {generating ? 'Generating...' : 'Generate Message'}
          </button>

          {/* Generated text preview */}
          {generatedText && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">Preview</p>
              <div className="bg-[#DCF8C6] rounded-2xl p-4 shadow-sm border border-[#B4E0A0] relative">
                <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">{generatedText}</pre>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => shareWA(generatedText)} className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-xl text-sm font-bold">
                  <Send className="w-4 h-4" /> Share on WhatsApp
                </button>
                <button onClick={() => copyText(generatedText)} className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold">
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Festivals ──────────────────────────────── */}
      {tab === 'festivals' && (
        <div className="px-4 mt-4 space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase">Upcoming Festivals</p>
          {festivals.length === 0 ? (
            <div className="text-center py-12"><Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" /><p className="text-gray-500 font-medium">No upcoming festivals</p></div>
          ) : festivals.map((f, i) => (
            <div key={i} className={`bg-white rounded-xl p-4 border shadow-sm ${f.status === 'happening_now' ? 'border-amber-300 bg-amber-50' : 'border-gray-100'}`}>
              <div className="flex items-start gap-3">
                <span className="text-3xl">{f.emoji}</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900">{f.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {f.status === 'happening_now' ? 'Happening now!' : `${f.days_away} days away · ${f.date}`}
                  </p>
                  <p className="text-xs text-[#1D9E75] font-medium mt-1">{f.suggestion}</p>
                </div>
              </div>
              <button onClick={() => { setTab('share'); setSelectedTemplate('festival') }}
                className="w-full mt-3 bg-[#1D9E75]/10 text-[#1D9E75] py-2 rounded-lg text-xs font-bold">
                Create Festival Post
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Quick Messages ──────────────────────────── */}
      {tab === 'templates' && (
        <div className="px-4 mt-4 space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase">Quick Message Templates</p>
          {QUICK_MESSAGES.map((msg, i) => {
            const text = msg.text(shop?.name || 'My Shop')
            return (
              <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{msg.icon}</span>
                  <p className="text-sm font-bold text-gray-900">{msg.label}</p>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => shareWA(text)} className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 text-white py-2 rounded-lg text-xs font-bold">
                    <Send className="w-3 h-3" /> WhatsApp
                  </button>
                  <button onClick={() => copyText(text)} className="flex items-center justify-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-2 rounded-lg text-xs font-bold">
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
