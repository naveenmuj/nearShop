import { authPost, authGet } from './api';

/**
 * Submit a product review
 * @param {Object} data - Review data
 * @param {string} data.order_id - Order ID
 * @param {string} data.product_id - Product ID
 * @param {string} data.shop_id - Shop ID
 * @param {number} data.rating - Rating (1-5)
 * @param {string} data.review_text - Review text
 * @param {string[]} data.photos - Photo URLs
 * @returns {Promise}
 */
export const submitReview = async (data) => {
  return authPost('/reviews', data);
};

/**
 * Get reviews for a product
 * @param {string} productId - Product ID
 * @param {Object} params - Query params
 * @returns {Promise}
 */
export const getProductReviews = async (productId, params = {}) => {
  return authGet(`/products/${productId}/reviews`, { params });
};

/**
 * Get reviews for a shop
 * @param {string} shopId - Shop ID
 * @param {Object} params - Query params
 * @returns {Promise}
 */
export const getShopReviews = async (shopId, params = {}) => {
  return authGet(`/shops/${shopId}/reviews`, { params });
};

/**
 * Get user's reviews
 * @returns {Promise}
 */
export const getMyReviews = async () => {
  return authGet('/reviews/me');
};

/**
 * Reply to a review (business only)
 * @param {string} reviewId - Review ID
 * @param {string} replyText - Reply text
 * @returns {Promise}
 */
export const replyToReview = async (reviewId, replyText) => {
  return authPost(`/reviews/${reviewId}/reply`, { reply_text: replyText });
};
