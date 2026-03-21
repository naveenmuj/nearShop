import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCategories } from '../../api/categories'

export default function CategoriesPage() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    getCategories()
      .then(({ data }) => setCategories(data.items || data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Categories</h1>
      {loading && <p className="text-gray-500">Loading...</p>}
      {categories.length === 0 && !loading && (
        <p className="text-gray-400 text-center mt-10">No categories found</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {categories.map((cat) => (
          <button
            key={cat.id || cat.slug}
            onClick={() => navigate(`/app/search?category=${cat.slug || cat.id}`)}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-2 hover:border-purple-300 transition-colors"
          >
            {cat.icon && <span className="text-3xl">{cat.icon}</span>}
            <span className="text-sm font-medium text-gray-700">{cat.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
