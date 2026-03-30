import client, { authGet, authPost, authDelete } from './api';

// Stories feed - public (for discovery)
export const getStoriesFeed = () => authGet('/stories/feed');
export const getDiscoverStories = (lat, lng) =>
  client.get('/stories/discover', { params: { lat, lng } });

// Story interactions - requires auth
export const viewStory = (id) => authPost(`/stories/${id}/view`);
export const createStory = (data, shopId) =>
  authPost(`/stories?shop_id=${shopId}`, data);

// Shop owner functions
export const getShopStories = (shopId) =>
  authGet(`/stories/shop/${shopId}`);
export const deleteStory = (id) =>
  authDelete(`/stories/${id}`);
