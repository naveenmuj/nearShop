import { useState, useEffect, useRef } from 'react'
import { BookOpen, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { getShopStories } from '../../api/stories'
import useMyShop from '../../hooks/useMyShop'
import useImageUpload from '../../hooks/useImageUpload'
import client from '../../api/client'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function StoriesPage() {
  const { shopId } = useMyShop()
  const fileInputRef = useRef(null)
  const { upload, isUploading } = useImageUpload()
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [caption, setCaption] = useState('')
  const [previewFile, setPreviewFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (!shopId) { setLoading(false); return }
    getShopStories(shopId)
      .then(({ data }) => setStories(data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [shopId])

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPreviewFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setShowForm(true)
  }

  const handlePost = async () => {
    if (!previewFile) {
      toast.error('Select an image first')
      return
    }
    setPosting(true)
    try {
      const mediaUrl = await upload(previewFile, 'stories')
      const { data } = await client.post(`/stories?shop_id=${shopId}`, {
        media_url: mediaUrl,
        caption,
      })
      setStories((prev) => [data, ...prev])
      setShowForm(false)
      setCaption('')
      setPreviewFile(null)
      setPreviewUrl(null)
      toast.success('Story posted!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to post story')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Stories</h1>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 bg-primary-600 text-white px-3 py-2 rounded-lg text-sm"
        >
          <Upload className="h-4 w-4" />
          New Story
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Create story form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">New Story</h2>
            <button onClick={() => { setShowForm(false); setPreviewUrl(null); setPreviewFile(null) }}>
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>
          {previewUrl && (
            <img src={previewUrl} alt="Preview" className="w-full rounded-xl object-cover max-h-48 mb-3" />
          )}
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a caption (optional)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
          />
          <button
            onClick={handlePost}
            disabled={posting || isUploading}
            className="w-full bg-primary-600 text-white py-2 rounded-lg text-sm disabled:opacity-50"
          >
            {posting || isUploading ? 'Posting...' : 'Post Story'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : stories.length === 0 ? (
        <EmptyState icon={BookOpen} title="No stories" message="Share updates with your followers" action="Create Story" onAction={() => fileInputRef.current?.click()} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {stories.map((story) => (
            <div key={story.id} className="rounded-xl overflow-hidden bg-gray-100 aspect-[9/16] relative">
              {story.media_url && (
                <img src={story.media_url} alt="Story" className="w-full h-full object-cover" />
              )}
              {story.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                  <p className="text-white text-xs">{story.caption}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
