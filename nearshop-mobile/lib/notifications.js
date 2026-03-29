import { authGet, authPut } from './api';

export const getNotifications = () => authGet('/notifications');
export const getUnreadCount = () => authGet('/notifications/unread-count');
export const markAllRead = () => authPut('/notifications/read-all');
export const markRead = (id) => authPut(`/notifications/${id}/read`);
