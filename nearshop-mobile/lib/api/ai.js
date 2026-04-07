import { authGet, authPost } from '../api'

// Feature 1: Collaborative Filtering recommendations
export const getCFRecommendations = (lat, lng, params = {}) =>
  authGet('/ai/recommendations/collaborative', { params: { lat, lng, ...params } })

// Feature 2: Unfulfilled demand gaps
export const getDemandGaps = (shopId, lat, lng, params = {}) =>
  authGet('/ai/demand-gaps', { params: { shop_id: shopId, lat, lng, ...params } })

// Feature 4: RFM customer segments
export const getCustomerSegments = (shopId) =>
  authGet('/ai/customer-segments', { params: { shop_id: shopId } })

// Feature 7: Personalised deal feed
export const getPersonalisedDeals = (lat, lng, params = {}) =>
  authGet('/ai/deals/personalised', { params: { lat, lng, ...params } })

// Feature 8: Review sentiment intelligence
export const getReviewSentiment = (shopId) =>
  authGet('/ai/review-sentiment', { params: { shop_id: shopId } })

// Feature 9: Hyperlocal trending products
export const getTrendingProducts = (lat, lng, params = {}) =>
  authGet('/ai/trending', { params: { lat, lng, ...params } })

// Feature 10: Catalogue completion suggestions
export const getCatalogueSuggestions = (shopId, lat, lng, params = {}) =>
  authGet('/ai/catalogue-suggestions', { params: { shop_id: shopId, lat, lng, ...params } })

// Existing endpoints
export const getRecommendations = (params = {}) =>
  authGet('/ai/recommendations', { params })

export const getPriceSuggestion = (productId, shopId) =>
  authGet(`/ai/pricing/suggest/${productId}`, { params: { shop_id: shopId } })

export const visualSearchProducts = (payload) =>
  authPost('/ai/search/visual', payload)
