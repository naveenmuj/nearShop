import { useState, useEffect } from 'react'
import { MessageCircle, ThumbsUp, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { getCommunityFeed, createPost, upvotePost } from '../../api/community'
import { useLocation } from '../../hooks/useLocation'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'

export default function CommunityPage() {
  const { latitude, longitude } = useLocation()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formBody, setFormBody] = useState('')
  const [formType, setFormType] = useState('question')
  const [submitting, setSubmitting] = useState(false)

  const fetchPosts = async () => {
    setLoading(true)
    setError(null)
    try {
      const geoParams = latitude != null ? { lat: latitude, lng: longitude } : {}
      const { data } = await getCommunityFeed({ ...geoParams, sort: 'newest' })
      setPosts(data.items || data || [])
    } catch (err) {
      setError(err.message || 'Failed to load posts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPosts()
  }, [latitude, longitude])

  const handleCreatePost = async (e) => {
    e.preventDefault()
    if (!formTitle.trim()) return
    setSubmitting(true)
    try {
      const { data } = await createPost({
        title: formTitle,
        body: formBody,
        post_type: formType,
        latitude,
        longitude,
      })
      setPosts((prev) => [data, ...prev])
      setShowForm(false)
      setFormTitle('')
      setFormBody('')
      toast.success('Post created!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create post')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpvote = async (postId) => {
    try {
      await upvotePost(postId)
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, upvotes: (p.upvotes || 0) + 1 } : p
        )
      )
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-4">
        <h1 className="text-2xl font-bold mb-4">Community</h1>
        <EmptyState icon={MessageCircle} title="Could not load posts" message={error} action="Retry" onAction={fetchPosts} />
      </div>
    )
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Community</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 bg-primary-600 text-white px-3 py-2 rounded-lg text-sm"
        >
          <Plus className="h-4 w-4" />
          Post
        </button>
      </div>

      {/* Create post form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">New Post</h2>
            <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
          </div>
          <form onSubmit={handleCreatePost} className="space-y-3">
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="question">Question</option>
              <option value="tip">Tip</option>
              <option value="alert">Alert</option>
              <option value="deal">Deal</option>
            </select>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Title"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <textarea
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              placeholder="More details (optional)"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary-600 text-white py-2 rounded-lg text-sm disabled:opacity-50"
            >
              {submitting ? 'Posting...' : 'Post'}
            </button>
          </form>
        </div>
      )}

      {posts.length === 0 ? (
        <EmptyState icon={MessageCircle} title="No posts yet" message="Ask questions and share with your local community" />
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <div key={post.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full capitalize">
                  {post.post_type || 'post'}
                </span>
                {post.is_resolved && (
                  <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">Resolved</span>
                )}
              </div>
              <h2 className="font-semibold mb-1">{post.title}</h2>
              {post.body && <p className="text-sm text-gray-500 mb-2">{post.body}</p>}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <button
                  onClick={() => handleUpvote(post.id)}
                  className="flex items-center gap-1 hover:text-primary-600"
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  {post.upvotes || 0}
                </button>
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {post.answer_count || 0} answers
                </span>
                <span className="ml-auto">{new Date(post.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
