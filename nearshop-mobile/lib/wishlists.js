import client from './api';

export const getWishlist = () => client.get('/wishlists');
export const addToWishlist = (productId) => client.post(`/wishlists/${productId}`);
export const removeFromWishlist = (productId) =>
  client.delete(`/wishlists/${productId}`);
export const getPriceDrops = () => client.get('/wishlists/price-drops');
