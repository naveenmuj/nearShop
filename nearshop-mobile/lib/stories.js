import client, { authGet, authPost } from './api';

// Stories feed - public (for discovery)
export const getStoriesFeed = () => client.get('/stories/feed');
export const getDiscoverStories = (lat, lng) =>
  client.get('/stories/discover', { params: { lat, lng } });

// Story interactions - requires auth
export const viewStory = (id) => authPost(`/stories/${id}/view`);
export const createStory = (data, shopId) =>
  authPost(`/stories?shop_id=${shopId}`, data);
