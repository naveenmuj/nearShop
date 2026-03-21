import client from './client'

export const getStoriesFeed = () => client.get('/stories/feed')
export const getShopStories = (shopId) => client.get(`/stories/shop/${shopId}`)
export const viewStory = (id) => client.post(`/stories/${id}/view`)
