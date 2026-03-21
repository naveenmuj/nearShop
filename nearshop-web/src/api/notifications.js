import client from './client'
export const getNotifications = (params = {}) => client.get('/notifications', { params })
export const getUnreadCount = () => client.get('/notifications/unread-count')
export const markAllRead = () => client.put('/notifications/read-all')
