/**
 * Staff API - Staff management
 */
import { authGet, authPost, authPatch, authDelete } from './api';

// Get staff roles
export async function getStaffRoles() {
  const response = await authGet('/staff/roles');
  return response.data.roles;
}

// Invite staff member
export async function inviteStaff(name, email = null, phone = null, role = 'staff', permissions = null) {
  const response = await authPost('/staff/invite', {
    name, email, phone, role, permissions,
  });
  return response.data;
}

// Accept invite
export async function acceptInvite(inviteCode) {
  const response = await authPost('/staff/accept', { invite_code: inviteCode });
  return response.data;
}

// List shop staff
export async function getShopStaff(includeInactive = false) {
  const response = await authGet(`/staff?include_inactive=${includeInactive}`);
  return response.data;
}

// Update staff
export async function updateStaff(staffId, updates) {
  const response = await authPatch(`/staff/${staffId}`, updates);
  return response.data;
}

// Remove staff
export async function removeStaff(staffId) {
  const response = await authDelete(`/staff/${staffId}`);
  return response.data;
}

// Get activity logs
export async function getActivityLogs(staffId = null, limit = 50) {
  const params = new URLSearchParams({ limit });
  if (staffId) params.append('staff_id', staffId);
  const response = await authGet(`/staff/activity?${params}`);
  return response.data;
}
