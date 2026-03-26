import api from '../api'

// Feature 1: Collaborative Filtering recommendations
export const getCFRecommendations = (lat, lng, params = {}) =>
  api.get('/ai/recommendations/collaborative', { params: { lat, lng, ...params } })

// Feature 2: Unfulfilled demand gaps
export const getDemandGaps = (shopId, lat, lng, params = {}) =>
  api.get('/ai/demand-gaps', { params: { shop_id: shopId, lat, lng, ...params } })

// Feature 4: RFM customer segments
export const getCustomerSegments = (shopId) =>
  api.get('/ai/customer-segments', { params: { shop_id: shopId } })

// Feature 7: Personalised deal feed
export const getPersonalisedDeals = (lat, lng, params = {}) =>
  api.get('/ai/deals/personalised', { params: { lat, lng, ...params } })

// Feature 8: Review sentiment intelligence
export const getReviewSentiment = (shopId) =>
  api.get('/ai/review-sentiment', { params: { shop_id: shopId } })

// Feature 9: Hyperlocal trending products
export const getTrendingProducts = (lat, lng, params = {}) =>
  api.get('/ai/trending', { params: { lat, lng, ...params } })

// Feature 10: Catalogue completion suggestions
export const getCatalogueSuggestions = (shopId, lat, lng, params = {}) =>
  api.get('/ai/catalogue-suggestions', { params: { shop_id: shopId, lat, lng, ...params } })

// Existing endpoints
export const getRecommendations = (params = {}) =>
  api.get('/ai/recommendations', { params })

export const getPriceSuggestion = (productId, shopId) =>
  api.get(`/ai/pricing/suggest/${productId}`, { params: { shop_id: shopId } })
