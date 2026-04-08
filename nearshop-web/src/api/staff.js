import client from './client'

export const getStaffRoles = () => client.get('/staff/roles')

export const inviteStaff = (name, email = null, phone = null, role = 'staff', permissions = null) =>
  client.post('/staff/invite', { name, email, phone, role, permissions })

export const getShopStaff = (includeInactive = false) =>
  client.get('/staff', { params: { include_inactive: includeInactive } })

export const updateStaff = (staffId, updates) => client.patch(`/staff/${staffId}`, updates)

export const removeStaff = (staffId) => client.delete(`/staff/${staffId}`)

export const getActivityLogs = (staffId = null, limit = 50) =>
  client.get('/staff/activity', { params: { staff_id: staffId || undefined, limit } })
