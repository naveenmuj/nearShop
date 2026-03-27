import { authDelete, authGet, authPost } from './api';

export const getWishlist = () => authGet('/wishlists');
export const addToWishlist = (productId) => authPost(`/wishlists/${productId}`);
export const removeFromWishlist = (productId) =>
  authDelete(`/wishlists/${productId}`);
export const getPriceDrops = () => authGet('/wishlists/price-drops');
