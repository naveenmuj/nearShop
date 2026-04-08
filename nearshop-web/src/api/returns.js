import client from './client'

export const getReturnReasons = () => client.get('/returns/reasons')

export const createReturnRequest = (payload) => client.post('/returns', payload)

export const getMyReturns = (status = null, limit = 50, offset = 0) =>
  client.get('/returns/my', { params: { status: status || undefined, limit, offset } })

export const getShopReturns = (status = null, limit = 50, offset = 0) =>
  client.get('/returns/shop', { params: { status: status || undefined, limit, offset } })

export const getReturnDetail = (returnId) => client.get(`/returns/${returnId}`)

export const approveReturn = (returnId, refundAmount = null, refundMethod = 'store_credit') =>
  client.post(`/returns/${returnId}/approve`, null, {
    params: {
      refund_amount: refundAmount || undefined,
      refund_method: refundMethod,
    },
  })

export const rejectReturn = (returnId, reason) =>
  client.post(`/returns/${returnId}/reject`, null, { params: { reason } })

export const updateReturnStatus = (returnId, payload) => client.patch(`/returns/${returnId}`, payload)

export const markReturnProcessing = (returnId, resolutionNotes = 'Return moved to processing') =>
  updateReturnStatus(returnId, { status: 'processing', resolution_notes: resolutionNotes })

export const markReturnCompleted = (returnId, resolutionNotes = 'Return completed') =>
  updateReturnStatus(returnId, { status: 'completed', resolution_notes: resolutionNotes })
