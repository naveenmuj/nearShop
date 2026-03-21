import client from './client'

export const searchProducts = (params = {}) => client.get('/products/search', { params })
export const getProduct = (id) => client.get(`/products/${id}`)
export const getSimilarProducts = (id) => client.get(`/products/${id}/similar`)

// Legacy aliases kept for backwards compatibility
export const search = (query, params = {}) => client.get('/products/search', { params: { q: query, ...params } })
export const getById = getProduct
export const create = (data) => client.post('/products', data)
export const update = (productId, data) => client.put(`/products/${productId}`, data)
export const remove = (productId) => client.delete(`/products/${productId}`)
export const getByShop = (shopId, params = {}) => client.get(`/shops/${shopId}/products`, { params })

// New named exports
export const createProduct = (data, shopId) => client.post('/products', data, { params: { shop_id: shopId } })
export const updateProduct = (id, data) => client.put(`/products/${id}`, data)
export const toggleAvailability = (id) => client.put(`/products/${id}/availability`)
export const deleteProduct = (id) => client.delete(`/products/${id}`)
export const getProductPriceHistory = (id) => client.get(`/products/${id}/price-history`)
