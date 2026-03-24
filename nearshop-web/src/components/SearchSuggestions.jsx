import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Clock, X, TrendingUp, ArrowUpRight } from 'lucide-react'
import { getSearchSuggestions, getRecentSearches, deleteRecentSearch, logSearch } from '../api/engagement'

const DEBOUNCE_MS = 300
const TRENDING = ['Grocery', 'Electronics', 'Food', 'Beauty', 'Clothing', 'Medicine']

export default function SearchSuggestions({ className = '' }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [recentSearches, setRecentSearches] = useState([])
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const debounceRef = useRef(null)

  // Load recent searches on focus
  const loadRecent = useCallback(() => {
    getRecentSearches()
      .then(({ data }) => setRecentSearches(data.searches ?? data ?? []))
      .catch(() => setRecentSearches([]))
  }, [])

  // Fetch suggestions when query changes
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim() || query.length < 2) {
      setSuggestions([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await getSearchSuggestions(query.trim())
        setSuggestions(data.suggestions ?? [])
      } catch {
        setSuggestions([])
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleFocus = () => {
    setFocused(true)
    loadRecent()
  }

  const doNavigate = (q) => {
    if (!q.trim()) return
    logSearch(q.trim()).catch(() => {})
    setFocused(false)
    setQuery('')
    navigate(`/app/search?q=${encodeURIComponent(q.trim())}`)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    doNavigate(query)
  }

  const handleDeleteRecent = async (e, term) => {
    e.stopPropagation()
    try {
      await deleteRecentSearch(term)
      setRecentSearches(prev => prev.filter(s => s !== term))
    } catch {}
  }

  // Keyboard navigation
  const allItems = query.trim().length >= 2 ? suggestions : []
  const handleKeyDown = (e) => {
    if (!focused) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx(i => Math.min(i + 1, allItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && highlightIdx >= 0 && allItems[highlightIdx]) {
      e.preventDefault()
      const item = allItems[highlightIdx]
      if (item.type === 'shop') navigate(`/app/shop/${item.id}`)
      else doNavigate(item.name)
    } else if (e.key === 'Escape') {
      setFocused(false)
    }
    if (!['ArrowDown', 'ArrowUp'].includes(e.key)) setHighlightIdx(-1)
  }

  const showDropdown = focused
  const showSuggestions = query.trim().length >= 2 && suggestions.length > 0
  const showRecent = !showSuggestions && recentSearches.length > 0
  const showTrending = !showSuggestions && !showRecent

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit}>
        <div className={`flex items-center bg-gray-50 border rounded-xl px-4 h-10 transition ${focused ? 'border-brand-purple bg-white shadow-md' : 'border-gray-200'}`}>
          <Search className="w-4 h-4 text-gray-400 mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setHighlightIdx(-1) }}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder="Search products, shops, categories..."
            className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); setSuggestions([]) }} className="p-0.5">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </form>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-[200]"
          style={{ transition: 'opacity 0.15s ease, transform 0.15s ease' }}
        >
          {/* API Suggestions */}
          {showSuggestions && (
            <div>
              {suggestions.map((item, idx) => (
                <button
                  key={`${item.type}-${item.id ?? idx}`}
                  onMouseDown={() => {
                    if (item.type === 'shop') navigate(`/app/shop/${item.id}`)
                    else doNavigate(item.name)
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition border-b border-gray-50 last:border-0 ${idx === highlightIdx ? 'bg-brand-purple/5' : 'hover:bg-gray-50'}`}
                >
                  <span className="text-base flex-shrink-0">{item.type === 'shop' ? '🏪' : '🛍️'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                    {item.category && <p className="text-xs text-gray-400">{item.type === 'shop' ? 'Shop' : `in ${item.category}`}</p>}
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-brand-purple flex-shrink-0 opacity-60" />
                </button>
              ))}
            </div>
          )}

          {/* Recent searches */}
          {showRecent && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-4 pt-3 pb-1.5">Recent</p>
              {recentSearches.slice(0, 5).map((term, i) => (
                <button
                  key={i}
                  onMouseDown={() => doNavigate(term)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition border-b border-gray-50 last:border-0 text-left"
                >
                  <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="flex-1 text-sm text-gray-700">{term}</span>
                  <button
                    type="button"
                    onMouseDown={(e) => handleDeleteRecent(e, term)}
                    className="p-0.5 hover:text-brand-red transition"
                  >
                    <X className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </button>
              ))}
            </div>
          )}

          {/* Trending */}
          {showTrending && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-4 pt-3 pb-1.5">Trending</p>
              {TRENDING.map((term) => (
                <button
                  key={term}
                  onMouseDown={() => doNavigate(term)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition border-b border-gray-50 last:border-0 text-left"
                >
                  <TrendingUp className="w-4 h-4 text-brand-amber flex-shrink-0" />
                  <span className="flex-1 text-sm text-gray-700">{term}</span>
                  <span className="text-base">🔥</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
