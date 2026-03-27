import { authGet } from '../api';

const a = '/admin';

// Overview
export const getOverview = () => authGet(`${a}/overview`);

// Users
export const getUserGrowth = (period = '30d', interval = 'daily') => authGet(`${a}/users/growth`, { params: { period, interval } });
export const getUserSegmentation = () => authGet(`${a}/users/segmentation`);
export const getRecentUsers = (limit = 20) => authGet(`${a}/users/recent`, { params: { limit } });

// Shops
export const getShopLeaderboard = (sort = 'score', limit = 50) => authGet(`${a}/shops/leaderboard`, { params: { sort_by: sort, limit } });
export const getShopCategories = () => authGet(`${a}/shops/categories`);
export const getShopGrowth = (period = '30d') => authGet(`${a}/shops/growth`, { params: { period } });
export const getShopsHealth = () => authGet(`${a}/shops/health`);

// Products
export const getProductsByCategory = () => authGet(`${a}/products/by-category`);
export const getTopViewed = (limit = 20) => authGet(`${a}/products/top-viewed`, { params: { limit } });
export const getTopWishlisted = (limit = 20) => authGet(`${a}/products/top-wishlisted`, { params: { limit } });
export const getProductsGrowth = (period = '30d') => authGet(`${a}/products/growth`, { params: { period } });
export const getPriceDistribution = () => authGet(`${a}/products/price-distribution`);
export const getAiStats = () => authGet(`${a}/products/ai-stats`);
export const getRatingDistribution = () => authGet(`${a}/products/rating-distribution`);

// Orders
export const getOrdersTrend = (period = '30d') => authGet(`${a}/orders/trend`, { params: { period } });
export const getOrderFunnel = () => authGet(`${a}/orders/funnel`);
export const getRecentOrders = (limit = 50) => authGet(`${a}/orders/recent`, { params: { limit } });

// Engagement
export const getFeatureUsage = () => authGet(`${a}/engagement/features`);
export const getTopSearches = (limit = 30) => authGet(`${a}/engagement/searches`, { params: { limit } });
export const getDemandGaps = (limit = 20) => authGet(`${a}/engagement/demand-gaps`, { params: { limit } });
export const getHaggleStats = () => authGet(`${a}/engagement/haggles`);
export const getDealPerformance = () => authGet(`${a}/engagement/deals`);

// Financial
export const getShopcoinsEconomy = (period = '30d') => authGet(`${a}/financial/shopcoins`, { params: { period } });

// Detail views
export const getUserDetail = (id) => authGet(`${a}/users/${id}`);
export const getShopDetail = (id) => authGet(`${a}/shops/${id}`);
export const getProductDetail = (id) => authGet(`${a}/products/${id}`);
export const getOrderDetail = (id) => authGet(`${a}/orders/${id}`);

// AI Usage Analytics
export const getAiOverview = (period = '30d') => authGet(`${a}/ai/overview`, { params: { period } });
export const getAiCostByFeature = (period = '30d') => authGet(`${a}/ai/cost-by-feature`, { params: { period } });
export const getAiCostByModel = (period = '30d') => authGet(`${a}/ai/cost-by-model`, { params: { period } });
export const getAiDailyTrend = (period = '30d') => authGet(`${a}/ai/daily-trend`, { params: { period } });
export const getAiRecentCalls = (limit = 50) => authGet(`${a}/ai/recent-calls`, { params: { limit } });
export const getAiHourlyDistribution = (period = '7d') => authGet(`${a}/ai/hourly-distribution`, { params: { period } });
export const getAiTopUsers = (period = '30d', limit = 20) => authGet(`${a}/ai/top-users`, { params: { period, limit } });
