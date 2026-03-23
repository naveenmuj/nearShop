import client from './client'

export const createBill = (data) => client.post('/billing', data)
export const getBills = (params = {}) => client.get('/billing', { params })
export const getBill = (id) => client.get(`/billing/${id}`)
export const getBillStats = (period = '30d') => client.get('/billing/stats', { params: { period } })
export const updateBillStatus = (id, status) => client.put(`/billing/${id}/status`, null, { params: { status } })
