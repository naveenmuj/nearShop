import client from './client'

export const addExpense = (data) => client.post('/expenses', data)
export const getExpenses = (params = {}) => client.get('/expenses', { params })
export const getExpensesByCategory = (period = '30d') => client.get('/expenses/by-category', { params: { period } })
export const getProfitLoss = (period = '30d') => client.get('/expenses/profit-loss', { params: { period } })
export const deleteExpense = (id) => client.delete(`/expenses/${id}`)
