import client from './api';

export const getNotifications = () => client.get('/notifications');
export const getUnreadCount = () => client.get('/notifications/unread-count');
export const markAllRead = () => client.put('/notifications/read-all');
export const markRead = (id) => client.put(`/notifications/${id}/read`);
