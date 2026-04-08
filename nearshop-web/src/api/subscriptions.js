import client from './client'

export const getSubscriptionTiers = () => client.get('/subscriptions/tiers')

export const getMySubscription = () => client.get('/subscriptions/mine')

export const getSubscriptionUsage = () => client.get('/subscriptions/usage')

export const getSubscriptionInvoices = (limit = 20) => client.get('/subscriptions/invoices', { params: { limit } })

export const upgradeSubscription = (newTier, billingCycle = 'monthly') =>
  client.post('/subscriptions/upgrade', { new_tier: newTier, billing_cycle: billingCycle })

export const cancelSubscription = () => client.post('/subscriptions/cancel')
