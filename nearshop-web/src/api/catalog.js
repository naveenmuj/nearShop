import client from './client'

export const getCatalogTemplates = (params = {}) =>
  client.get('/catalog/templates', { params })

export const getCatalogTemplate = (id) =>
  client.get(`/catalog/templates/${id}`)

export const getCatalogCategories = () =>
  client.get('/catalog/categories')

export const addCatalogProducts = (shopId, items) =>
  client.post(`/catalog/shops/${shopId}/add-products`, { items })

export const enableCatalogProducts = (shopId, productIds) =>
  client.post(`/catalog/shops/${shopId}/enable-products`, { product_ids: productIds })
