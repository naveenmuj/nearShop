import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Image, ActivityIndicator, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, SHADOWS } from '../../constants/theme';
import { assignConversation, getConversations } from '../../lib/messaging';
import useAuthStore from '../../store/authStore';
import { getShopStaff } from '../../lib/staff';

function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'Now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
  return date.toLocaleDateString();
}

function slaMeta(level, pendingMinutes) {
  if (!level || pendingMinutes == null) return null;
  if (level === 'high') return { label: `SLA risk ${pendingMinutes}m`, color: '#b42318', bg: '#fee4e2' };
  if (level === 'medium') return { label: `Aging ${pendingMinutes}m`, color: '#b54708', bg: '#ffead5' };
  return { label: `Fresh ${pendingMinutes}m`, color: '#146c43', bg: '#d1f5df' };
}

export default function BusinessMessagesScreen() {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [slaFilter, setSlaFilter] = useState('all');
  const [sortBy, setSortBy] = useState('last_message');
  const [assigningId, setAssigningId] = useState(null);
  const [staffOptions, setStaffOptions] = useState([]);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignTargetConversation, setAssignTargetConversation] = useState(null);
  const PAGE_SIZE = 20;

  const loadStaffOptions = useCallback(async () => {
    try {
      const staffRes = await getShopStaff();
      const items = Array.isArray(staffRes?.items) ? staffRes.items : [];
      const activeStaffUsers = items
        .filter((s) => s?.status === 'active' && s?.user_id)
        .map((s) => ({
          userId: String(s.user_id),
          label: s.name || 'Staff',
          role: s.role || 'staff',
        }));
      setStaffOptions(activeStaffUsers);
    } catch (error) {
      console.error('Failed to load staff options:', error);
      setStaffOptions([]);
    }
  }, []);

  useEffect(() => {
    loadStaffOptions();
  }, [loadStaffOptions]);

  const loadConversations = useCallback(async (offset = 0, append = false) => {
    try {
      const data = await getConversations(PAGE_SIZE, offset, {
        slaRiskLevel: slaFilter === 'all' ? null : slaFilter,
        sortBy,
      });
      const items = data.items || [];
      setConversations(prev => (append ? [...prev, ...items] : items));
      setHasMore(items.length >= PAGE_SIZE);
    } catch (error) {
      console.error('Error loading business conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [slaFilter, sortBy]);

  useEffect(() => {
    loadConversations(0, false);
  }, [loadConversations]);

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations(0, false);
  };

  const onEndReached = () => {
    if (loadingMore || loading || refreshing || !hasMore) return;
    setLoadingMore(true);
    loadConversations(conversations.length, true);
  };

  const handleAssign = useCallback(async (item, assignedToUserId) => {
    if (!user?.id || assigningId) return;
    setAssigningId(item.id);
    try {
      const updated = await assignConversation(item.id, assignedToUserId);
      setConversations((prev) => prev.map((conv) => (
        String(conv.id) === String(item.id)
          ? {
              ...conv,
              assigned_to_user_id: updated.assigned_to_user_id,
              assigned_staff_name: updated.assigned_staff_name,
            }
          : conv
      )));
      setAssignModalVisible(false);
      setAssignTargetConversation(null);
    } catch (error) {
      console.error('Assignment update failed:', error);
      const detail = error?.response?.data?.detail;
      Alert.alert('Assignment failed', typeof detail === 'string' ? detail : 'Unable to update assignment right now.');
    } finally {
      setAssigningId(null);
    }
  }, [assigningId, user?.id]);

  const openAssignModal = useCallback((item) => {
    setAssignTargetConversation(item);
    setAssignModalVisible(true);
  }, []);

  const renderConversation = ({ item }) => {
    const sla = slaMeta(item.sla_risk_level, item.pending_minutes);

    return (
      <TouchableOpacity
        style={styles.conversationCard}
        onPress={() => router.push(`/(business)/chat/${item.id}`)}
        activeOpacity={0.7}
      >
      <View style={styles.avatarContainer}>
        {item.other_party_avatar ? (
          <Image source={{ uri: item.other_party_avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={22} color={COLORS.primary} />
          </View>
        )}
        {item.unread_count > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unread_count > 9 ? '9+' : item.unread_count}</Text>
          </View>
        )}
      </View>

      <View style={styles.conversationInfo}>
        <View style={styles.headerRow}>
          <Text style={styles.partyName} numberOfLines={1}>{item.other_party_name || 'Customer'}</Text>
          <Text style={styles.time}>{formatTime(item.last_message_at)}</Text>
        </View>
        <View style={styles.metaRow}>
          <View style={styles.assigneeChip}>
            <Ionicons name="person-outline" size={11} color="#155e75" />
            <Text style={styles.assigneeText} numberOfLines={1}>{item.assigned_staff_name || 'Unassigned'}</Text>
          </View>
          <TouchableOpacity
            style={styles.assignActionChip}
            onPress={() => openAssignModal(item)}
            disabled={assigningId === item.id}
          >
            {assigningId === item.id ? (
              <ActivityIndicator size="small" color="#1d4ed8" />
            ) : (
              <Text style={styles.assignActionText}>Assign</Text>
            )}
          </TouchableOpacity>
          {sla ? (
            <View style={[styles.slaChip, { backgroundColor: sla.bg }]}> 
              <Text style={[styles.slaText, { color: sla.color }]}>
                {sla.label}
              </Text>
            </View>
          ) : null}
        </View>
        {item.product_name ? (
          <Text style={styles.productTag}>Re: {item.product_name}</Text>
        ) : null}
        <Text style={[styles.preview, item.unread_count > 0 && styles.previewUnread]} numberOfLines={1}>
          {item.last_message_preview || 'No messages yet'}
        </Text>
      </View>
      </TouchableOpacity>
    );
  };

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
        <Text style={styles.title}>Customer Chats</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.filtersRow}>
        {['all', 'high', 'medium', 'low'].map((level) => {
          const active = slaFilter === level;
          return (
            <TouchableOpacity
              key={level}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => {
                setSlaFilter(level);
                setLoading(true);
              }}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{level.toUpperCase()}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={styles.sortChip}
          onPress={() => {
            setSortBy((prev) => (prev === 'last_message' ? 'pending_minutes' : 'last_message'));
            setLoading(true);
          }}
        >
          <Text style={styles.sortChipText}>{sortBy === 'last_message' ? 'Sort: Latest' : 'Sort: SLA'}</Text>
        </TouchableOpacity>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="chatbubbles-outline" size={64} color={COLORS.gray} />
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptySubtitle}>Chats started by customers will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          contentContainerStyle={styles.list}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 12 }} color={COLORS.primary} /> : null}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
        />
      )}

      <Modal visible={assignModalVisible} transparent animationType="fade" onRequestClose={() => setAssignModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Assign Conversation</Text>
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => assignTargetConversation && handleAssign(assignTargetConversation, user?.id || null)}
            >
              <Text style={styles.modalOptionText}>Assign to me</Text>
            </TouchableOpacity>
            {staffOptions.map((staff) => (
              <TouchableOpacity
                key={staff.userId}
                style={styles.modalOption}
                onPress={() => assignTargetConversation && handleAssign(assignTargetConversation, staff.userId)}
              >
                <Text style={styles.modalOptionText}>{staff.label} ({staff.role})</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => assignTargetConversation && handleAssign(assignTargetConversation, null)}
            >
              <Text style={styles.modalOptionDanger}>Unassign</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setAssignModalVisible(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
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
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  list: { paddingVertical: 8 },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#eef2f7',
  },
  filterChipActive: { backgroundColor: '#dbeafe' },
  filterChipText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  filterChipTextActive: { color: '#1d4ed8' },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#ecfdf3',
  },
  sortChipText: { fontSize: 11, fontWeight: '700', color: '#166534' },
  conversationCard: {
    flexDirection: 'row', padding: 16, backgroundColor: COLORS.white,
    marginHorizontal: 16, marginVertical: 4, borderRadius: 12, ...SHADOWS.small,
  },
  avatarContainer: { position: 'relative' },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: {
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  unreadBadge: {
    position: 'absolute', top: -4, right: -4, backgroundColor: COLORS.primary,
    borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center',
  },
  unreadText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  conversationInfo: { flex: 1, marginLeft: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  partyName: { fontSize: 16, fontWeight: '600', color: COLORS.text, flex: 1 },
  time: { fontSize: 12, color: COLORS.gray, marginLeft: 8 },
  assigneeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 150,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#e0f2fe',
  },
  assigneeText: { fontSize: 11, color: '#0f4c5c', fontWeight: '700' },
  assignActionChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#eff6ff',
  },
  assignActionText: { fontSize: 11, fontWeight: '700', color: '#1d4ed8' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    padding: 14,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  modalOption: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalOptionText: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  modalOptionDanger: { fontSize: 14, color: '#b42318', fontWeight: '700' },
  modalCancelBtn: { paddingVertical: 12, alignItems: 'center' },
  modalCancelText: { fontSize: 14, color: COLORS.gray, fontWeight: '700' },
  slaChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  slaText: { fontSize: 11, fontWeight: '700' },
  productTag: { fontSize: 12, color: COLORS.primary, marginTop: 2 },
  preview: { fontSize: 14, color: COLORS.gray, marginTop: 4 },
  previewUnread: { fontWeight: '600', color: COLORS.text },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: COLORS.gray, marginTop: 4, textAlign: 'center' },
});
