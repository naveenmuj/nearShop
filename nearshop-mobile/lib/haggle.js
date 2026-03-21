import client from './api';

export const startHaggle = (data) => client.post('/haggle/start', data);
export const sendOffer = (id, data) => client.post(`/haggle/${id}/offer`, data);
export const acceptHaggle = (id) => client.post(`/haggle/${id}/accept`);
export const rejectHaggle = (id) => client.post(`/haggle/${id}/reject`);
export const getMyHaggles = () => client.get('/haggle/my');
export const getShopHaggles = (shopId) => client.get(`/haggle/shop/${shopId}`);
