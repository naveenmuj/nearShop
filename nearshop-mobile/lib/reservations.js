import client from './api';

export const createReservation = (productId) =>
  client.post('/reservations', { product_id: productId });
export const getMyReservations = () => client.get('/reservations/my');
export const cancelReservation = (id) => client.delete(`/reservations/${id}`);
