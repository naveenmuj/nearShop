import client from './client'

export const getFeatureFlags = () => client.get('/features')

export const getShareLink = (entityType, entityId) =>
  client.get(`/share/${entityType}/${entityId}`)
