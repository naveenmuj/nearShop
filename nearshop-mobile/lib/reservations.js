import { authPost, authGet, authDelete } from './api';

export const createReservation = (productId) =>
  authPost('/reservations', { product_id: productId });
export const getMyReservations = () => authGet('/reservations/my');
export const cancelReservation = (id) => authDelete(`/reservations/${id}`);
