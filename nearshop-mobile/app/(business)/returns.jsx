/**
 * Returns Management Screen - Business view for handling return requests
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Modal, TextInput, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, SHADOWS } from '../../constants/theme';
import {
  getShopReturns,
  approveReturn,
  rejectReturn,
  markReturnProcessing,
  markReturnCompleted,
  getReturnDetail,
} from '../../lib/returns';
import { toast } from '../../components/ui/Toast/toastRef';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: COLORS.warning, icon: 'time-outline' },
  approved: { label: 'Approved', color: COLORS.success, icon: 'checkmark-circle-outline' },
  rejected: { label: 'Rejected', color: COLORS.error, icon: 'close-circle-outline' },
  processing: { label: 'Processing', color: COLORS.primary, icon: 'sync-outline' },
  completed: { label: 'Completed', color: COLORS.success, icon: 'checkmark-done-outline' },
};

export default function ReturnsManagementScreen() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('pending');
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [showActions, setShowActions] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedReturnDetail, setSelectedReturnDetail] = useState(null);
  const pendingCount = returns.filter((r) => r.status === 'pending').length;

  const loadReturns = useCallback(async () => {
    try {
      const data = await getShopReturns(filter);
      setReturns(data.items || []);
    } catch (error) {
      console.error('Error loading returns:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    loadReturns();
  }, [loadReturns]);

  const openReturnReview = async (item) => {
    setSelectedReturn(item);
    setSelectedReturnDetail(null);
    setShowActions(true);
    setDetailLoading(true);
    try {
      const detail = await getReturnDetail(item.id);
      setSelectedReturnDetail(detail);
    } catch (error) {
      console.error('Failed to load return detail:', error);
      toast.show('Could not load full return history', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedReturn) return;
    setProcessing(true);
    try {
      await approveReturn(selectedReturn.id);
      toast.show('Return approved', 'success');
      setShowActions(false);
      setSelectedReturn(null);
      loadReturns();
    } catch (error) {
      toast.show('Failed to approve', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReturn || !rejectReason.trim()) {
      toast.show('Please provide a reason');
      return;
    }
    setProcessing(true);
    try {
      await rejectReturn(selectedReturn.id, rejectReason);
      toast.show('Return rejected');
      setShowActions(false);
      setSelectedReturn(null);
      setRejectReason('');
      loadReturns();
    } catch (error) {
      toast.show('Failed to reject', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleMoveToProcessing = async () => {
    if (!selectedReturn) return;
    setProcessing(true);
    try {
      await markReturnProcessing(selectedReturn.id);
      toast.show('Return moved to processing', 'success');
      setShowActions(false);
      setSelectedReturn(null);
      loadReturns();
    } catch (error) {
      toast.show('Failed to update status', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkCompleted = async () => {
    if (!selectedReturn) return;
    setProcessing(true);
    try {
      await markReturnCompleted(selectedReturn.id);
      toast.show('Return marked completed', 'success');
      setShowActions(false);
      setSelectedReturn(null);
      loadReturns();
    } catch (error) {
      toast.show('Failed to complete return', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const getAgingInfo = (item) => {
    const requestedAt = new Date(item.requested_at);
    const now = new Date();
    const days = Math.max(0, Math.floor((now.getTime() - requestedAt.getTime()) / (1000 * 60 * 60 * 24)));

    if (days >= 5) return { label: `SLA risk · ${days}d`, color: COLORS.error, bg: COLORS.error + '20' };
    if (days >= 3) return { label: `Aging · ${days}d`, color: COLORS.warning, bg: COLORS.warning + '20' };
    return { label: `Fresh · ${days}d`, color: COLORS.success, bg: COLORS.success + '20' };
  };

  const handleBulkMovePendingToProcessing = async () => {
    const pendingItems = returns.filter((r) => r.status === 'pending').slice(0, 5);
    if (!pendingItems.length) {
      toast.show('No pending returns to process', 'info');
      return;
    }

    Alert.alert(
      'Start processing pending returns?',
      `This will move ${pendingItems.length} pending return${pendingItems.length > 1 ? 's' : ''} to processing.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Proceed',
          onPress: async () => {
            setProcessing(true);
            let success = 0;
            for (const item of pendingItems) {
              try {
                await markReturnProcessing(item.id, 'Bulk moved to processing');
                success += 1;
              } catch {
                // continue bulk processing for remaining items
              }
            }
            setProcessing(false);
            toast.show(`${success} return${success > 1 ? 's' : ''} moved to processing`, success > 0 ? 'success' : 'error');
            loadReturns();
          },
        },
      ],
    );
  };

  const renderReturn = ({ item }) => {
    const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const aging = getAgingInfo(item);
    
    return (
      <TouchableOpacity
        style={styles.returnCard}
        onPress={() => openReturnReview(item)}
        activeOpacity={0.7}
      >
        <View style={styles.returnHeader}>
          <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
            <Ionicons name={status.icon} size={14} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
          <Text style={styles.date}>{new Date(item.requested_at).toLocaleDateString()}</Text>
        </View>
        
        <Text style={styles.itemName} numberOfLines={2}>{item.item_name}</Text>
        <Text style={styles.itemMeta}>Qty: {item.item_quantity} • ₹{item.item_price}</Text>
        <Text style={styles.reason}>Reason: {item.reason.replace(/_/g, ' ')}</Text>

        {(item.status === 'pending' || item.status === 'processing') && (
          <View style={[styles.agingBadge, { backgroundColor: aging.bg }]}>
            <Text style={[styles.agingBadgeText, { color: aging.color }]}>{aging.label}</Text>
          </View>
        )}
        
        {item.status === 'pending' && (
          <View style={styles.actionHint}>
            <Ionicons name="hand-left-outline" size={14} color={COLORS.primary} />
            <Text style={styles.actionHintText}>Tap to review</Text>
          </View>
        )}
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
        <Text style={styles.title}>Return Requests</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.filterTabs}>
        {['pending', 'approved', 'processing', 'rejected', 'completed'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filter === 'pending' && pendingCount > 1 && (
        <View style={styles.bulkActionBar}>
          <Text style={styles.bulkActionText}>{pendingCount} pending returns</Text>
          <TouchableOpacity
            style={[styles.bulkActionBtn, processing && styles.bulkActionBtnDisabled]}
            onPress={handleBulkMovePendingToProcessing}
            disabled={processing}
          >
            <Text style={styles.bulkActionBtnText}>Start Top 5</Text>
          </TouchableOpacity>
        </View>
      )}

      {returns.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="checkmark-circle-outline" size={64} color={COLORS.gray} />
          <Text style={styles.emptyTitle}>No {filter} returns</Text>
        </View>
      ) : (
        <FlatList
          data={returns}
          keyExtractor={(item) => item.id}
          renderItem={renderReturn}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadReturns(); }} colors={[COLORS.primary]} />
          }
        />
      )}

      {/* Actions Modal */}
      <Modal visible={showActions} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Review Return</Text>
              <TouchableOpacity onPress={() => { setShowActions(false); setSelectedReturn(null); setRejectReason(''); }}>
                <Ionicons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
            </View>
            
            {selectedReturn && (
              <>
                <Text style={styles.modalItemName}>{selectedReturn.item_name}</Text>
                <Text style={styles.modalItemMeta}>
                  Qty: {selectedReturn.item_quantity} • ₹{selectedReturn.item_price}
                </Text>
                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>Customer's reason:</Text>
                  <Text style={styles.reasonText}>{selectedReturn.reason.replace(/_/g, ' ')}</Text>
                  {selectedReturn.description && (
                    <Text style={styles.descriptionText}>{selectedReturn.description}</Text>
                  )}
                </View>

                {detailLoading ? (
                  <View style={styles.detailLoadingWrap}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.detailLoadingText}>Loading timeline...</Text>
                  </View>
                ) : (
                  <>
                    {Array.isArray(selectedReturnDetail?.images) && selectedReturnDetail.images.length > 0 && (
                      <View style={styles.evidenceWrap}>
                        <Text style={styles.evidenceTitle}>Evidence</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.evidenceRow}>
                          {selectedReturnDetail.images.map((imgUrl, idx) => (
                            <View key={`${selectedReturn.id}-img-${idx}`} style={styles.evidenceChip}>
                              <Ionicons name="image-outline" size={14} color={COLORS.primary} />
                              <Text style={styles.evidenceChipText}>Image {idx + 1}</Text>
                            </View>
                          ))}
                        </ScrollView>
                      </View>
                    )}

                    {Array.isArray(selectedReturnDetail?.timeline) && selectedReturnDetail.timeline.length > 0 && (
                      <View style={styles.timelineWrap}>
                        <Text style={styles.timelineTitle}>Timeline</Text>
                        {selectedReturnDetail.timeline.slice(0, 6).map((event, idx) => (
                          <View key={`${selectedReturn.id}-event-${idx}`} style={styles.timelineItem}>
                            <View style={styles.timelineDot} />
                            <View style={styles.timelineTextWrap}>
                              <Text style={styles.timelineEventLabel}>
                                {event.new_status
                                  ? `${String(event.new_status).charAt(0).toUpperCase()}${String(event.new_status).slice(1)}`
                                  : 'Update'}
                              </Text>
                              {event.message ? <Text style={styles.timelineEventMessage}>{event.message}</Text> : null}
                              <Text style={styles.timelineEventTime}>{new Date(event.created_at).toLocaleString()}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                )}
                
                {selectedReturn.status === 'pending' && (
                  <>
                    <TextInput
                      style={styles.rejectInput}
                      placeholder="Reason for rejection (if rejecting)"
                      value={rejectReason}
                      onChangeText={setRejectReason}
                      multiline
                    />
                    
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.rejectBtn]}
                        onPress={handleReject}
                        disabled={processing}
                      >
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.approveBtn]}
                        onPress={handleApprove}
                        disabled={processing}
                      >
                        {processing ? (
                          <ActivityIndicator color={COLORS.white} />
                        ) : (
                          <Text style={styles.approveBtnText}>Approve & Refund</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {selectedReturn.status === 'approved' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.processingBtn, { marginTop: 16 }]}
                    onPress={handleMoveToProcessing}
                    disabled={processing}
                  >
                    {processing ? (
                      <ActivityIndicator color={COLORS.white} />
                    ) : (
                      <Text style={styles.processingBtnText}>Start Processing</Text>
                    )}
                  </TouchableOpacity>
                )}

                {selectedReturn.status === 'processing' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.completeBtn, { marginTop: 16 }]}
                    onPress={handleMarkCompleted}
                    disabled={processing}
                  >
                    {processing ? (
                      <ActivityIndicator color={COLORS.white} />
                    ) : (
                      <Text style={styles.approveBtnText}>Mark as Completed</Text>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}
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
  filterTabs: { flexDirection: 'row', padding: 12, backgroundColor: COLORS.white },
  filterTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: COLORS.background },
  filterTabActive: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 13, color: COLORS.gray },
  filterTextActive: { color: COLORS.white, fontWeight: '600' },
  bulkActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  bulkActionText: { fontSize: 12, color: COLORS.gray, fontWeight: '600' },
  bulkActionBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  bulkActionBtnDisabled: { opacity: 0.6 },
  bulkActionBtnText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  list: { padding: 16 },
  returnCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginBottom: 12, ...SHADOWS.small },
  returnHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
  date: { fontSize: 12, color: COLORS.gray },
  itemName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  itemMeta: { fontSize: 13, color: COLORS.gray, marginTop: 4 },
  reason: { fontSize: 13, color: COLORS.gray, marginTop: 2, textTransform: 'capitalize' },
  agingBadge: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, marginTop: 8 },
  agingBadgeText: { fontSize: 11, fontWeight: '700' },
  actionHint: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  actionHintText: { fontSize: 13, color: COLORS.primary, marginLeft: 6, fontWeight: '500' },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  modalItemName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  modalItemMeta: { fontSize: 14, color: COLORS.gray, marginTop: 4 },
  reasonBox: { backgroundColor: COLORS.background, borderRadius: 12, padding: 12, marginTop: 16 },
  reasonLabel: { fontSize: 12, color: COLORS.gray, marginBottom: 4 },
  reasonText: { fontSize: 14, fontWeight: '500', color: COLORS.text, textTransform: 'capitalize' },
  descriptionText: { fontSize: 13, color: COLORS.gray, marginTop: 4 },
  detailLoadingWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  detailLoadingText: { fontSize: 12, color: COLORS.gray },
  evidenceWrap: { marginTop: 14 },
  evidenceTitle: { fontSize: 12, color: COLORS.gray, fontWeight: '700', marginBottom: 8 },
  evidenceRow: { gap: 8 },
  evidenceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary + '33',
    backgroundColor: COLORS.primary + '12',
  },
  evidenceChipText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  timelineWrap: { marginTop: 14, gap: 8 },
  timelineTitle: { fontSize: 12, color: COLORS.gray, fontWeight: '700' },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 6,
  },
  timelineTextWrap: { flex: 1 },
  timelineEventLabel: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  timelineEventMessage: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  timelineEventTime: { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  rejectInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 12, fontSize: 14, marginTop: 16, minHeight: 80, textAlignVertical: 'top',
  },
  actionButtons: { flexDirection: 'row', marginTop: 16 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  rejectBtn: { backgroundColor: COLORS.error + '20', marginRight: 8 },
  rejectBtnText: { color: COLORS.error, fontWeight: '600' },
  approveBtn: { backgroundColor: COLORS.success },
  processingBtn: { backgroundColor: COLORS.primary },
  completeBtn: { backgroundColor: COLORS.success },
  approveBtnText: { color: COLORS.white, fontWeight: '600' },
  processingBtnText: { color: COLORS.white, fontWeight: '600' },
});
