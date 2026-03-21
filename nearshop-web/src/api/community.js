import api from './client'
export const getFeed = (params = {}) => api.get('/community/feed', { params })
export const getPostById = (postId) => api.get(`/community/posts/${postId}`)
export const createPost = (data) => api.post('/community/posts', data)
export const createAnswer = (postId, data) => api.post(`/community/posts/${postId}/answers`, data)
export const upvote = (postId) => api.post(`/community/posts/${postId}/upvote`)
export const downvote = (postId) => api.post(`/community/posts/${postId}/downvote`)

// Named exports matching task spec
export const getCommunityFeed = (params = {}) => api.get('/community/feed', { params })
export const getPost = (id) => api.get(`/community/posts/${id}`)
export const upvotePost = (id) => api.post(`/community/posts/${id}/upvote`)
export const resolvePost = (id) => api.post(`/community/posts/${id}/resolve`)
