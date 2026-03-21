import api from './client'
export const snapProduct = (formData) => api.post('/ai/snap-product', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const visualSearch = (formData) => api.post('/ai/visual-search', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const conversationalSearch = (query, context = []) => api.post('/ai/conversational-search', { query, context })
export const suggestPrice = (productData) => api.post('/ai/suggest-price', productData)

// Named exports matching task spec
export const snapAndList = (formData) => api.post('/ai/catalog/snap', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 90000 })
export const getRecommendations = (params = {}) => api.get('/ai/recommendations', { params })
export const getPriceSuggestion = (productId) => api.get(`/ai/pricing/suggest/${productId}`)
