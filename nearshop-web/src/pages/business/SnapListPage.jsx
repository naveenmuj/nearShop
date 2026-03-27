import { useState, useRef, useMemo, useEffect } from 'react'
import { Edit3 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import useImageUpload from '../../hooks/useImageUpload'
import { snapAndList } from '../../api/ai'
import { createProduct } from '../../api/products'
import { getMyShops } from '../../api/shops'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const STEPS = { CAPTURE: 'capture', ANALYZING: 'analyzing', REVIEW: 'review' }

// Map shop category → { categories[], products[] }
const BUSINESS_CATALOG = {
  electronics: {
    categories: [
      'Mobile & Accessories', 'Laptops & Computers', 'TV & Displays', 'Audio & Speakers',
      'Cameras & Photography', 'Tablets & iPads', 'Smart Watches', 'Gaming',
      'Cables & Adapters', 'Power Banks & Chargers', 'Networking', 'Printers & Scanners',
      'Home Appliances', 'Lighting', 'Components & Parts',
    ],
    products: [
      'iPhone 15', 'Samsung Galaxy S24', 'Redmi Note 13', 'Realme 12 Pro', 'OnePlus 12',
      'Vivo V30', 'OPPO Reno 11', 'Nothing Phone 2', 'Google Pixel 8',
      'boAt Rockerz 450', 'JBL Charge 5', 'Sony WH-1000XM5', 'Boat Airdopes 141',
      'Samsung 55" 4K TV', 'LG OLED TV', 'Mi Smart TV 43"',
      'HP Laptop 15', 'Dell Inspiron', 'Lenovo IdeaPad', 'MacBook Air M2', 'ASUS VivoBook',
      'Samsung Tab A9', 'iPad 10th Gen', 'Realme Pad 2',
      'Apple Watch Series 9', 'Samsung Galaxy Watch 6', 'boAt Storm Smart Watch',
      'Anker Power Bank 20000mAh', 'Mi Power Bank 3i', 'Baseus Charger',
      'Type-C Cable 2m', 'HDMI Cable', 'USB Hub', 'Screen Guard', 'Phone Cover',
      'Canon EOS 1500D', 'Nikon D3500', 'GoPro Hero 12',
      'TP-Link Router', 'D-Link WiFi Router', 'Netgear Switch',
      'HP Ink Cartridge', 'Canon Printer', 'Epson L3210',
    ],
  },
  grocery: {
    categories: [
      'Rice, Atta & Dal', 'Spices & Masala', 'Oil & Ghee', 'Dairy & Eggs',
      'Snacks & Namkeen', 'Beverages', 'Bakery & Biscuits', 'Fruits & Vegetables',
      'Frozen Foods', 'Cleaning Supplies', 'Personal Care',
    ],
    products: [
      'Aashirvaad Atta 5kg', 'Fortune Chakki Atta', 'India Gate Basmati Rice 5kg',
      'Sona Masoori Rice', 'Dawat Basmati Rice', 'Kohinoor Rice',
      'Toor Dal 1kg', 'Chana Dal', 'Moong Dal', 'Masoor Dal', 'Urad Dal',
      'Fortune Sunflower Oil 1L', 'Saffola Gold Oil', 'Amul Butter 500g', 'Amul Ghee 1L',
      'Tata Salt 1kg', 'Catch Salt', 'MDH Garam Masala', 'Everest Chilli Powder',
      'Maggi 2-Min Noodles', 'Yippee Noodles', 'Parle-G Biscuits', 'Britannia Good Day',
      'Lays Chips 26g', 'Kurkure Masala Munch', 'Haldiram Bhujia 200g',
      'Tata Tea Premium', 'Red Label Tea', 'Bru Coffee', 'Nescafé Classic',
      'Tropicana Orange Juice', 'Real Fruit Juice', 'Maaza Mango 600ml',
      'Amul Milk 1L', 'Mother Dairy Milk', 'Amul Paneer 200g',
      'Colgate Toothpaste', 'Pepsodent Toothpaste', 'Dettol Handwash',
    ],
  },
  clothing: {
    categories: [
      "Men's Clothing", "Women's Clothing", "Kids' Clothing", 'Traditional Wear',
      'Sportswear', 'Innerwear & Socks', 'Winter Wear', 'Accessories',
    ],
    products: [
      'Men\'s Formal Shirt', 'Men\'s Casual T-Shirt', 'Men\'s Jeans', 'Men\'s Trousers',
      'Women\'s Kurta', 'Women\'s Saree', 'Women\'s Leggings', 'Women\'s Tops',
      'Kids\' T-Shirt', 'Kids\' Frock', 'Boys Jeans', 'School Uniform',
      'Salwar Kameez Set', 'Lehenga Choli', 'Sherwani', 'Men\'s Dhoti',
      'Sports Jersey', 'Track Pants', 'Yoga Pants', 'Gym T-Shirt',
      'Men\'s Sweater', 'Women\'s Cardigan', 'Woollen Jacket', 'Hoodie',
      'Men\'s Formal Suit', 'Party Wear Dress', 'Indo-Western Dress',
    ],
  },
  footwear: {
    categories: ['Men\'s Footwear', 'Women\'s Footwear', 'Kids\' Footwear', 'Sports Shoes', 'Formal Shoes', 'Sandals & Slippers'],
    products: [
      'Nike Air Max', 'Adidas Ultraboost', 'Puma Softride', 'Bata Formal Shoes',
      'Woodland Boots', 'Red Tape Shoes', 'Skechers Sneakers', 'Campus Running Shoes',
      'Paragon Slippers', 'Crocs Classic', 'Hawkins Chappal', 'Ladies Heels',
      'Kolhapuri Chappal', 'Ladies Sandals', 'Kids Sports Shoes', 'School Shoes',
    ],
  },
  pharmacy: {
    categories: ['Medicines', 'Vitamins & Supplements', 'Personal Care', 'Baby Care', 'Ayurvedic', 'Medical Devices'],
    products: [
      'Crocin 500mg', 'Dolo 650mg', 'Disprin', 'Ibuprofen 400mg', 'Combiflam',
      'Vitamin C 1000mg', 'Vitamin D3', 'Calcium Tablets', 'Multivitamin',
      'Dettol Antiseptic Liquid', 'Savlon Liquid', 'Band-Aid', 'Bandage Roll',
      'Volini Pain Spray', 'Moov Cream', 'Iodex',
      'BP Monitor Omron', 'Glucometer', 'Pulse Oximeter', 'Thermometer',
      'Dabur Chyawanprash', 'Himalaya Ashwagandha', 'Patanjali Products',
    ],
  },
  restaurant: {
    categories: ['Snacks', 'Meals', 'Beverages', 'Desserts', 'Breakfast', 'Fast Food'],
    products: [
      'Vada Pav', 'Samosa', 'Bread Pakora', 'Aloo Tikki', 'Paneer Tikka',
      'Masala Dosa', 'Idli Sambar', 'Poha', 'Upma', 'Paratha',
      'Biryani', 'Fried Rice', 'Noodles', 'Dal Makhani', 'Paneer Butter Masala',
      'Cold Coffee', 'Lassi', 'Nimbu Pani', 'Sugarcane Juice', 'Chai',
      'Gulab Jamun', 'Jalebi', 'Ice Cream', 'Kulfi',
    ],
  },
  furniture: {
    categories: ['Bedroom', 'Living Room', 'Kitchen & Dining', 'Office Furniture', 'Storage', 'Kids Furniture'],
    products: [
      'Queen Size Bed', 'Single Bed', 'Bunk Bed', 'Wardrobe', 'Dressing Table',
      '3-Seater Sofa', 'L-Shape Sofa', 'Coffee Table', 'TV Unit', 'Bookshelf',
      'Dining Table 4-Seater', 'Dining Chairs', 'Kitchen Cabinet',
      'Office Chair', 'Computer Table', 'Study Table', 'Office Desk',
      'Shoe Rack', 'Wall Shelf', 'Storage Cabinet',
    ],
  },
  jewellery: {
    categories: ['Gold Jewellery', 'Silver Jewellery', 'Artificial Jewellery', 'Watches', 'Bridal Collection'],
    products: [
      'Gold Necklace', 'Gold Earrings', 'Gold Bangles', 'Gold Ring', 'Gold Chain',
      'Silver Anklet', 'Silver Bracelet', 'Silver Earrings',
      'Imitation Necklace Set', 'Oxidised Earrings', 'Kundan Set', 'Meenakari Jewellery',
      'Titan Watch', 'Sonata Watch', 'Casio Watch', 'Fastrack Watch',
      'Bridal Gold Set', 'Mangalsutra',
    ],
  },
  stationery: {
    categories: ['Pens & Pencils', 'Notebooks & Diaries', 'Art Supplies', 'Office Supplies', 'Books', 'Bags'],
    products: [
      'Reynolds 045 Pen', 'Parker Pen', 'Cello Pen', 'Staedtler Pencil HB',
      'Apsara Pencil', 'Natraj Pencil', 'Faber-Castell Colour Pencils',
      'Classmate Notebook', 'Single Line Notebook 200 Pages', 'Spiral Notebook',
      'A4 Printing Paper 500 Sheets', 'Sticky Notes', 'Highlighter Set',
      'Fevicol', 'Scotch Tape', 'Stapler', 'Scissors', 'Scale 30cm',
      'School Bag', 'Tiffin Box', 'Water Bottle',
    ],
  },
  general: {
    categories: [
      'Electronics', 'Groceries', 'Clothing & Fashion', 'Footwear',
      'Home & Kitchen', 'Health & Wellness', 'Beauty & Personal Care',
      'Stationery & Books', 'Sports & Fitness', 'Toys & Games',
      'Automobile Accessories', 'Hardware & Tools', 'Puja & Religious Items',
      'Baby Products', 'Pet Supplies', 'Plants & Gardening', 'General',
    ],
    products: [
      'Tata Salt 1kg', 'Amul Butter', 'Maggi Noodles', 'Parle-G',
      'Colgate Toothpaste', 'Dettol Soap', 'Surf Excel 500g',
      'Samsung Mobile', 'boAt Earphones', 'Anker Power Bank',
      'Men\'s T-Shirt', 'Women\'s Kurta', 'Kids Shoes',
      'Notebook', 'Reynolds Pen', 'School Bag',
    ],
  },
}

function normalizeCat(cat = '') {
  const c = cat.toLowerCase()
  if (c.includes('electron') || c.includes('mobile') || c.includes('tech')) return 'electronics'
  if (c.includes('grocer') || c.includes('kirana') || c.includes('food') || c.includes('supermark')) return 'grocery'
  if (c.includes('cloth') || c.includes('fashion') || c.includes('apparel') || c.includes('garment')) return 'clothing'
  if (c.includes('shoe') || c.includes('footwear')) return 'footwear'
  if (c.includes('pharma') || c.includes('medical') || c.includes('health') || c.includes('medicine')) return 'pharmacy'
  if (c.includes('restaur') || c.includes('food') || c.includes('cafe') || c.includes('snack')) return 'restaurant'
  if (c.includes('furniture') || c.includes('home decor') || c.includes('interior')) return 'furniture'
  if (c.includes('jewel') || c.includes('gold') || c.includes('silver')) return 'jewellery'
  if (c.includes('station') || c.includes('book') || c.includes('school')) return 'stationery'
  return 'general'
}

const STEP_NUM = { [STEPS.CAPTURE]: 1, [STEPS.ANALYZING]: 2, [STEPS.REVIEW]: 3 }

export default function SnapListPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const { upload, isUploading } = useImageUpload()
  const [step, setStep] = useState(STEPS.CAPTURE)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [aiResult, setAiResult] = useState(null)
  const [form, setForm] = useState({ name: '', price: '', description: '', category: '' })
  const [publishing, setPublishing] = useState(false)
  const [shopId, setShopId] = useState(null)
  const [shopCategory, setShopCategory] = useState('general')
  const [showNameSuggestions, setShowNameSuggestions] = useState(false)
  const [showCatSuggestions, setShowCatSuggestions] = useState(false)

  // Fetch business owner's shop to get ID + category
  useEffect(() => {
    getMyShops()
      .then(({ data }) => {
        if (data?.length > 0) {
          setShopId(data[0].id)
          const cat = normalizeCat(data[0].category || '')
          setShopCategory(cat)
          const catalog = BUSINESS_CATALOG[cat] || BUSINESS_CATALOG.general
          setForm((f) => ({ ...f, category: f.category || catalog.categories[0] || '' }))
        }
      })
      .catch(() => {})
  }, [])

  const catalog = BUSINESS_CATALOG[shopCategory] || BUSINESS_CATALOG.general

  const nameSuggestions = useMemo(() => {
    const q = form.name.trim().toLowerCase()
    if (!q || q.length < 2) return []
    return catalog.products.filter((n) => n.toLowerCase().includes(q)).slice(0, 8)
  }, [form.name, catalog])

  const catSuggestions = useMemo(() => {
    const q = form.category.trim().toLowerCase()
    if (!q) return catalog.categories.slice(0, 8)
    return catalog.categories.filter((c) => c.toLowerCase().includes(q)).slice(0, 8)
  }, [form.category, catalog])

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPreviewUrl(URL.createObjectURL(file))
    setStep(STEPS.ANALYZING)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const { data } = await snapAndList(formData)
      const result = data.product || data

      if (result.error && !result.name) {
        // AI failed but still go to review so user can fill manually
        toast.error(
          result.error === 'AI analysis failed'
            ? 'AI unavailable — fill in details manually'
            : `AI: ${result.error}`
        )
        setForm((f) => ({ ...f }))
        setStep(STEPS.REVIEW)
        return
      }

      setAiResult(result)
      const suggestedCat = result.category
        ? catalog.categories.find((c) =>
            c.toLowerCase().includes(result.category.toLowerCase()) ||
            result.category.toLowerCase().includes(c.toLowerCase().split(' ')[0])
          ) || result.category
        : catalog.categories[0]

      setForm({
        name: result.name || '',
        price: result.estimated_price_range?.min?.toString() || result.price?.toString() || '',
        description: result.description || '',
        category: suggestedCat || catalog.categories[0] || '',
      })
      setStep(STEPS.REVIEW)
    } catch {
      toast.error('AI analysis failed — please fill in manually')
      setStep(STEPS.REVIEW)
    }
  }

  const handlePublish = async () => {
    if (!form.name || !form.price) {
      toast.error('Name and price are required')
      return
    }
    if (!shopId) {
      toast.error('Please create your shop first in Settings.')
      navigate('/biz/settings')
      return
    }
    setPublishing(true)
    try {
      // Upload image to server (local storage in dev, R2 in production)
      let imageUrl = null
      if (fileInputRef.current?.files?.[0]) {
        imageUrl = await upload(fileInputRef.current.files[0], {
          folder: 'products',
          entityType: 'product',
          purpose: 'image',
          shopId,
        })
      }

      await createProduct(
        {
          name: form.name,
          price: parseFloat(form.price),
          description: form.description || null,
          category: form.category || null,
          images: imageUrl ? [imageUrl] : [],   // backend expects images[]
          ai_generated: true,
        },
        shopId,  // passed as ?shop_id= query param
      )
      toast.success('Product listed! Add another or view catalog.')
      setStep(STEPS.CAPTURE)
      setPreviewUrl(null)
      setAiResult(null)
      setForm({ name: '', price: '', description: '', category: catalog.categories[0] || '' })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to publish product')
    } finally {
      setPublishing(false)
    }
  }

  const stepNum = STEP_NUM[step] || 1

  // Progress indicator
  const ProgressBar = () => (
    <div className="flex items-center justify-center gap-2 py-4">
      {[1, 2, 3].map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              stepNum >= s ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-400'
            }`}
          >
            {s}
          </div>
          {s < 3 && <div className={`w-8 h-0.5 ${stepNum > s ? 'bg-brand-purple' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  )

  if (step === STEPS.CAPTURE) {
    return (
      <div className="bg-gray-50 min-h-screen pb-8">
        <div className="px-4 pt-4">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Snap & List</h1>
          <p className="text-xs text-gray-400">Take a photo — AI creates the listing</p>
        </div>
        <ProgressBar />
        <div
          className="mx-4 rounded-2xl overflow-hidden bg-gray-900 aspect-[4/3] flex flex-col items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors border-2 border-dashed border-gray-600"
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="text-5xl">📷</span>
          <p className="text-gray-400 text-sm mt-3">Tap to take a photo or upload</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    )
  }

  if (step === STEPS.ANALYZING) {
    return (
      <div className="bg-gray-50 min-h-screen pb-8">
        <div className="px-4 pt-4">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Snap & List</h1>
          <p className="text-xs text-gray-400">AI is analyzing your photo...</p>
        </div>
        <ProgressBar />
        {previewUrl && (
          <div className="mx-4 rounded-2xl overflow-hidden aspect-[4/3]">
            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex flex-col items-center gap-3 py-8">
          <LoadingSpinner size="lg" />
          <p className="text-gray-500 text-sm">AI is analyzing your product...</p>
        </div>
      </div>
    )
  }

  // REVIEW step
  return (
    <div className="bg-gray-50 min-h-screen pb-32">
      <div className="px-4 pt-4">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Review & Publish</h1>
        <p className="text-xs text-gray-400">Check AI-filled details before publishing</p>
      </div>
      <ProgressBar />

      {previewUrl && (
        <div className="mx-4 rounded-2xl overflow-hidden mb-4 aspect-[4/3]">
          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
        </div>
      )}

      {/* AI result card */}
      {aiResult && !aiResult.error && (
        <div className="bg-white rounded-2xl shadow-card p-4 mx-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-brand-purple">✨</span>
            <span className="font-semibold text-brand-purple text-sm">AI Extracted Details</span>
          </div>
          <p className="text-xs text-gray-500">Review and edit the fields below before publishing.</p>
        </div>
      )}

      <div className="px-4 space-y-3">
        {/* Product Name with smart suggestions */}
        <div className="relative">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Product Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setShowNameSuggestions(true) }}
            onFocus={() => setShowNameSuggestions(true)}
            onBlur={() => setTimeout(() => setShowNameSuggestions(false), 150)}
            className="w-full bg-white border border-gray-200 rounded-xl h-12 px-4 text-sm outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-all"
            placeholder="Start typing to search..."
            autoComplete="off"
          />
          {showNameSuggestions && nameSuggestions.length > 0 && (
            <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-xl shadow-card-hover mt-1 max-h-40 overflow-y-auto">
              {nameSuggestions.map((s) => (
                <li
                  key={s}
                  onMouseDown={() => { setForm((p) => ({ ...p, name: s })); setShowNameSuggestions(false) }}
                  className="px-4 py-2 text-sm hover:bg-brand-purple-light cursor-pointer"
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Price (₹) *</label>
          <input
            type="number"
            value={form.price}
            onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
            className="w-full bg-white border border-gray-200 rounded-xl h-12 px-4 text-sm outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-all"
            placeholder="0"
          />
        </div>

        {/* Category with business-type aware suggestions */}
        <div className="relative">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Category</label>
          <input
            type="text"
            value={form.category}
            onChange={(e) => { setForm((p) => ({ ...p, category: e.target.value })); setShowCatSuggestions(true) }}
            onFocus={() => setShowCatSuggestions(true)}
            onBlur={() => setTimeout(() => setShowCatSuggestions(false), 150)}
            className="w-full bg-white border border-gray-200 rounded-xl h-12 px-4 text-sm outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-all"
            placeholder="e.g. Electronics, Clothing"
            autoComplete="off"
          />
          {showCatSuggestions && catSuggestions.length > 0 && (
            <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-xl shadow-card-hover mt-1 max-h-40 overflow-y-auto">
              {catSuggestions.map((s) => (
                <li
                  key={s}
                  onMouseDown={() => { setForm((p) => ({ ...p, category: s })); setShowCatSuggestions(false) }}
                  className="px-4 py-2 text-sm hover:bg-brand-purple-light cursor-pointer"
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            rows={3}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-all resize-none min-h-[100px]"
            placeholder="Describe the product"
          />
        </div>
      </div>

      {/* Sticky action bar — always visible above the bottom nav */}
      <div className="fixed bottom-16 inset-x-0 z-50 bg-white border-t border-gray-200 px-4 py-3">
        <div className="flex gap-3 max-w-lg mx-auto">
          <button
            onClick={() => { setStep(STEPS.CAPTURE); setPreviewUrl(null); setAiResult(null); setForm({ name: '', price: '', description: '', category: '' }) }}
            disabled={publishing || isUploading}
            className="w-24 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm flex-shrink-0 font-medium"
          >
            Discard
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing || isUploading}
            style={{ flex: 1, background: '#7F77DD', color: '#fff', padding: '10px 16px', borderRadius: '12px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: (publishing || isUploading) ? 'not-allowed' : 'pointer', opacity: (publishing || isUploading) ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {publishing || isUploading ? <LoadingSpinner size="sm" /> : <Edit3 className="h-4 w-4" />}
            {publishing ? 'Publishing...' : isUploading ? 'Uploading...' : 'Publish to Catalog'}
          </button>
        </div>
      </div>
    </div>
  )
}
