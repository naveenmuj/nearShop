import client from './client'
export const createReservation = (productId) => client.post('/reservations', { product_id: productId })
export const getMyReservations = () => client.get('/reservations/my')
export const cancelReservation = (id) => client.delete(`/reservations/${id}`)
export const getShopReservations = (shopId) => client.get(`/reservations/shop/${shopId}`)
