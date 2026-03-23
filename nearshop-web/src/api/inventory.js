import client from './client'

export const restockProduct = (data) => client.post('/inventory/restock', data)
export const getLowStock = () => client.get('/inventory/low-stock')
export const getStockValue = () => client.get('/inventory/value')
export const getMargins = () => client.get('/inventory/margins')
export const getStockLogs = (productId, limit = 20) => client.get(`/inventory/logs/${productId}`, { params: { limit } })
