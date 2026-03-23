import client from './client'

export const generateWhatsAppText = (data) => client.post('/marketing/whatsapp-text', data)
export const getCatalogData = (limit = 10) => client.get('/marketing/catalog-data', { params: { limit } })
export const getFestivals = () => client.get('/marketing/festivals')
