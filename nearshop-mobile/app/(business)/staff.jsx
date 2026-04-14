/**
 * Staff Management Screen - Business view
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, TextInput, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, SHADOWS } from '../../constants/theme';
import { getShopStaff, inviteStaff, updateStaff, removeStaff, getStaffRoles, getActivityLogs } from '../../lib/staff';
import { toast } from '../../components/ui/Toast/toastRef';

const ROLE_COLORS = {
  admin: COLORS.primary,
  manager: COLORS.warning,
  staff: COLORS.success,
  delivery: COLORS.info,
};

export default function StaffScreen() {
  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', phone: '', role: 'staff' });
  const [inviting, setInviting] = useState(false);
  const [assignmentLogs, setAssignmentLogs] = useState([]);

  const loadData = useCallback(async () => {
    try {
      const [staffData, rolesData, activityData] = await Promise.all([
        getShopStaff(),
        getStaffRoles(),
        getActivityLogs(null, 40),
      ]);
      setStaff(staffData.items || []);
      setRoles(rolesData || []);
      const logs = Array.isArray(activityData) ? activityData : [];
      const assignmentOnly = logs.filter((l) => l?.action === 'conversation_assignment_updated').slice(0, 6);
      setAssignmentLogs(assignmentOnly);
    } catch (error) {
      console.error('Error loading staff:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInvite = async () => {
    if (!inviteForm.name.trim() || !inviteForm.phone.trim()) {
      toast.show('Please fill name and phone');
      return;
    }
    
    setInviting(true);
    try {
      await inviteStaff(inviteForm.name, null, inviteForm.phone, inviteForm.role);
      toast.show('Staff invited successfully!', 'success');
      setShowInvite(false);
      setInviteForm({ name: '', phone: '', role: 'staff' });
      loadData();
    } catch (error) {
      toast.show(error.response?.data?.detail || 'Failed to invite staff', 'error');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = (staffMember) => {
    Alert.alert(
      'Remove Staff',
      `Are you sure you want to remove ${staffMember.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeStaff(staffMember.id);
              toast.show('Staff removed');
              loadData();
            } catch (error) {
              toast.show('Failed to remove staff', 'error');
            }
          },
        },
      ]
    );
  };

  const renderStaff = ({ item }) => (
    <View style={styles.staffCard}>
      <View style={styles.staffAvatar}>
        <Ionicons name="person" size={24} color={COLORS.gray} />
      </View>
      <View style={styles.staffInfo}>
        <Text style={styles.staffName}>{item.name}</Text>
        <Text style={styles.staffPhone}>{item.phone || item.email}</Text>
        <View style={styles.roleRow}>
          <View style={[styles.roleBadge, { backgroundColor: (ROLE_COLORS[item.role] || COLORS.gray) + '20' }]}>
            <Text style={[styles.roleText, { color: ROLE_COLORS[item.role] || COLORS.gray }]}>
              {String(item.role || 'staff').toUpperCase()}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: item.status === 'active' ? COLORS.success + '20' : COLORS.warning + '20' }]}>
            <Text style={[styles.statusText, { color: item.status === 'active' ? COLORS.success : COLORS.warning }]}>
              {item.status}
            </Text>
          </View>
        </View>
      </View>
      <TouchableOpacity onPress={() => handleRemove(item)} style={styles.removeBtn}>
        <Ionicons name="trash-outline" size={20} color={COLORS.error} />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Staff Management</Text>
        <TouchableOpacity onPress={() => setShowInvite(true)}>
          <Ionicons name="person-add" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {staff.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="people-outline" size={64} color={COLORS.gray} />
          <Text style={styles.emptyTitle}>No staff yet</Text>
          <Text style={styles.emptySubtitle}>Invite staff members to help manage your shop</Text>
          <TouchableOpacity style={styles.inviteBtn} onPress={() => setShowInvite(true)}>
            <Ionicons name="person-add" size={20} color={COLORS.white} />
            <Text style={styles.inviteBtnText}>Invite Staff</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={staff}
          keyExtractor={(item) => item.id}
          renderItem={renderStaff}
          contentContainerStyle={styles.list}
          ListHeaderComponent={(
            assignmentLogs.length > 0 ? (
              <View style={styles.auditWrap}>
                <Text style={styles.auditTitle}>Recent Assignment Activity</Text>
                {assignmentLogs.map((log) => (
                  <View key={log.id} style={styles.auditRow}>
                    <Ionicons name="swap-horizontal-outline" size={14} color={COLORS.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.auditText} numberOfLines={2}>{log.description || 'Conversation assignment updated'}</Text>
                      <Text style={styles.auditMeta}>{log.staff_name || 'Staff'} • {new Date(log.created_at).toLocaleString()}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[COLORS.primary]} />
          }
        />
      )}

      {/* Invite Modal */}
      <Modal visible={showInvite} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Staff</Text>
              <TouchableOpacity onPress={() => setShowInvite(false)}>
                <Ionicons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.input}
              placeholder="Name"
              value={inviteForm.name}
              onChangeText={(t) => setInviteForm({ ...inviteForm, name: t })}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              value={inviteForm.phone}
              onChangeText={(t) => setInviteForm({ ...inviteForm, phone: t })}
              keyboardType="phone-pad"
            />
            
            <Text style={styles.inputLabel}>Role</Text>
            <View style={styles.roleOptions}>
              {roles.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.roleOption, inviteForm.role === r.key && styles.roleOptionActive]}
                  onPress={() => setInviteForm({ ...inviteForm, role: r.key })}
                >
                  <Text style={[styles.roleOptionText, inviteForm.role === r.key && styles.roleOptionTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TouchableOpacity
              style={[styles.submitBtn, inviting && styles.submitBtnDisabled]}
              onPress={handleInvite}
              disabled={inviting}
            >
              {inviting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.submitBtnText}>Send Invite</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  list: { padding: 16 },
  auditWrap: {
    backgroundColor: '#f8fbff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  auditTitle: { fontSize: 13, fontWeight: '700', color: '#1e3a5f', marginBottom: 8 },
  auditRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  auditText: { fontSize: 12, color: COLORS.text, fontWeight: '600' },
  auditMeta: { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  staffCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    borderRadius: 12, padding: 16, marginBottom: 12, ...SHADOWS.small,
  },
  staffAvatar: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.background,
    justifyContent: 'center', alignItems: 'center',
  },
  staffInfo: { flex: 1, marginLeft: 12 },
  staffName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  staffPhone: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  roleRow: { flexDirection: 'row', marginTop: 6 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginRight: 6 },
  roleText: { fontSize: 10, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  removeBtn: { padding: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: COLORS.gray, marginTop: 4, textAlign: 'center' },
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, marginTop: 20,
  },
  inviteBtnText: { color: COLORS.white, fontWeight: '600', marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 12, fontSize: 16, marginBottom: 12, color: COLORS.text,
  },
  inputLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8, marginTop: 4 },
  roleOptions: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
  roleOption: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.background,
    marginRight: 8, marginBottom: 8,
  },
  roleOptionActive: { backgroundColor: COLORS.primary },
  roleOptionText: { fontSize: 14, color: COLORS.gray },
  roleOptionTextActive: { color: COLORS.white, fontWeight: '600' },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
});
