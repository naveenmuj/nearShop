import client from './api';

export const getStoriesFeed = () => client.get('/stories/feed');
export const getDiscoverStories = (lat, lng) =>
  client.get('/stories/discover', { params: { lat, lng } });
export const viewStory = (id) => client.post(`/stories/${id}/view`);
export const createStory = (data, shopId) =>
  client.post(`/stories?shop_id=${shopId}`, data);
