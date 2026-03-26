import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, FileText, PlusCircle, Trash2, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import useMyShop from '../../hooks/useMyShop'
import client from '../../api/client'

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN')

const EMPTY = { name: '', price: '', category: '', description: '' }

export default function BulkUploadPage() {
  const navigate = useNavigate()
  const { shopId } = useMyShop()
  const [mode, setMode] = useState('manual')
  const [products, setProducts] = useState([{ ...EMPTY }, { ...EMPTY }, { ...EMPTY }])
  const [csvText, setCsvText] = useState('')
  const [parsed, setParsed] = useState([])
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)

  const parseCsv = () => {
    const lines = csvText.trim().split('\n').filter(l => l.trim())
    if (!lines.length) { toast.error('No data to parse'); return }
    const items = lines.map(line => {
      const parts = line.split(/[,\t]/).map(s => s.trim().replace(/^["']|["']$/g, ''))
      return { name: parts[0] || '', price: parts[1] || '0', category: parts[2] || '', description: parts[3] || '' }
    }).filter(p => p.name)
    setParsed(items)
    toast.success(`${items.length} products parsed`)
  }

  const update = (i, field, val) => setProducts(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p))
  const addRow = () => setProducts(prev => [...prev, { ...EMPTY }])
  const removeRow = (i) => { if (products.length > 1) setProducts(prev => prev.filter((_, idx) => idx !== i)) }

  const handleUpload = async () => {
    const items = mode === 'manual' ? products.filter(p => p.name.trim() && p.price) : parsed
    if (!items.length) { toast.error('Add at least one product'); return }
    if (!shopId) { toast.error('Shop not found'); return }
    setUploading(true); setResult(null)
    try {
      const payload = items.map(p => ({
        name: p.name.trim(),
        price: Number(p.price) || 0,
        category: p.category || undefined,
        description: p.description || undefined,
        images: [],
      }))
      const res = await client.post(`/products/bulk?shop_id=${shopId}`, payload)
      setResult(res.data)
      if (res.data.created_count > 0) toast.success(`${res.data.created_count} products added!`)
      if (res.data.error_count > 0) toast.error(`${res.data.error_count} products had errors`)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Upload failed')
    } finally { setUploading(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/biz/catalog')} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" /> Bulk Add Products
          </h1>
          <p className="text-xs text-gray-400">Add multiple products at once</p>
        </div>
      </div>

      <div className="px-4 py-4 max-w-3xl mx-auto space-y-4">
        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'manual', icon: PlusCircle, label: 'Manual Entry', desc: 'Add products one by one' },
            { key: 'paste', icon: FileText, label: 'Paste CSV', desc: 'Copy-paste from spreadsheet' },
          ].map(m => (
            <button key={m.key} onClick={() => setMode(m.key)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                mode === m.key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}>
              <m.icon className={`w-5 h-5 mb-2 ${mode === m.key ? 'text-blue-600' : 'text-gray-400'}`} />
              <p className={`text-sm font-bold ${mode === m.key ? 'text-blue-700' : 'text-gray-800'}`}>{m.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{m.desc}</p>
            </button>
          ))}
        </div>

        {/* Manual mode */}
        {mode === 'manual' && (
          <div className="space-y-3">
            {products.map((p, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-blue-600">Product #{i + 1}</span>
                  {products.length > 1 && (
                    <button onClick={() => removeRow(i)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={p.name} onChange={e => update(i, 'name', e.target.value)} placeholder="Product name *"
                    className="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none" />
                  <input value={p.price} onChange={e => update(i, 'price', e.target.value)} placeholder="Price *" type="number"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none" />
                  <input value={p.category} onChange={e => update(i, 'category', e.target.value)} placeholder="Category"
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none" />
                  <input value={p.description} onChange={e => update(i, 'description', e.target.value)} placeholder="Description (optional)"
                    className="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none" />
                </div>
              </div>
            ))}
            <button onClick={addRow}
              className="w-full border-2 border-dashed border-blue-300 rounded-xl py-3 text-sm font-bold text-blue-600 hover:bg-blue-50 transition-colors">
              + Add Another Product
            </button>
          </div>
        )}

        {/* Paste mode */}
        {mode === 'paste' && (
          <div className="space-y-3">
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <p className="text-sm font-bold text-indigo-800 mb-1">Format Guide</p>
              <p className="text-xs text-indigo-700 leading-relaxed">
                Paste data from Excel/Google Sheets or type each product on a new line:<br />
                <code className="bg-indigo-100 px-1 rounded">Name, Price, Category, Description</code><br /><br />
                Example:<br />
                Samsung Galaxy, 15999, Electronics, Latest model<br />
                Rice 5kg, 350, Grocery, Premium basmati
              </p>
            </div>
            <textarea
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              placeholder="Paste your product data here..."
              className="w-full h-40 border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none"
            />
            <button onClick={parseCsv}
              className="w-full bg-indigo-100 text-indigo-700 py-3 rounded-xl text-sm font-bold hover:bg-indigo-200 transition-colors">
              Parse Data ({csvText.split('\n').filter(l => l.trim()).length} lines)
            </button>

            {parsed.length > 0 && (
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <p className="text-sm font-bold text-gray-700 mb-3">{parsed.length} products ready:</p>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {parsed.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
                      <span className="text-gray-800 truncate flex-1">{p.name}</span>
                      <span className="font-bold text-green-600 ml-2">{formatPrice(p.price)}</span>
                      {p.category && <span className="text-xs text-gray-400 ml-2 bg-gray-100 px-2 py-0.5 rounded">{p.category}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Upload button */}
        <button onClick={handleUpload} disabled={uploading}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-base hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {uploading ? (
            <><span className="animate-spin">⏳</span> Uploading...</>
          ) : (
            <>🚀 Upload {mode === 'manual' ? products.filter(p => p.name.trim()).length : parsed.length} Products</>
          )}
        </button>

        {/* Result */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-3" />
            <p className="text-lg font-bold text-green-800 mb-1">Upload Complete!</p>
            <p className="text-sm text-green-700">✅ {result.created_count} products added</p>
            {result.error_count > 0 && <p className="text-sm text-red-600 mt-1">❌ {result.error_count} failed</p>}
            <button onClick={() => navigate('/biz/catalog')}
              className="mt-4 bg-green-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-green-700 transition-colors">
              View Catalog →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
