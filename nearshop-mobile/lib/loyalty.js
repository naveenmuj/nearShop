import { authGet, authPost } from './api';

export const getBalance = () => authGet('/loyalty/balance');
export const getCoinHistory = (params = {}) =>
  authGet('/loyalty/history', { params });
export const getBadges = () => authGet('/loyalty/badges');
export const getStreak = () => authGet('/loyalty/streak');
export const dailyCheckin = () => authPost('/loyalty/streak/checkin');
