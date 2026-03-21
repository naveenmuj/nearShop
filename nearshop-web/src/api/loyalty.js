import client from './client'
export const getBalance = () => client.get('/loyalty/balance')
export const getCoinHistory = (params = {}) => client.get('/loyalty/history', { params })
export const getBadges = () => client.get('/loyalty/badges')
export const getStreak = () => client.get('/loyalty/streak')
export const dailyCheckin = () => client.post('/loyalty/streak/checkin')
export const getLeaderboard = () => client.get('/loyalty/leaderboard')
