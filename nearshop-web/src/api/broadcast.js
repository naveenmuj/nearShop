import client from './client'

export const sendBroadcast = (data) => client.post('/broadcast/send', data)
export const getSegments = () => client.get('/broadcast/segments')
export const getBroadcastHistory = (limit = 20) => client.get('/broadcast/history', { params: { limit } })
