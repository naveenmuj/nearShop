/**
 * Returns Management Screen - Business view for handling return requests
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, SHADOWS } from '../../constants/theme';
import { getShopReturns, approveReturn, rejectReturn, getReturnDetail } from '../../lib/returns';
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

  const renderReturn = ({ item }) => {
    const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    
    return (
      <TouchableOpacity
        style={styles.returnCard}
        onPress={() => { setSelectedReturn(item); setShowActions(true); }}
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
        {['pending', 'approved', 'rejected', 'completed'].map((f) => (
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
  list: { padding: 16 },
  returnCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginBottom: 12, ...SHADOWS.small },
  returnHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
  date: { fontSize: 12, color: COLORS.gray },
  itemName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  itemMeta: { fontSize: 13, color: COLORS.gray, marginTop: 4 },
  reason: { fontSize: 13, color: COLORS.gray, marginTop: 2, textTransform: 'capitalize' },
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
  rejectInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 12, fontSize: 14, marginTop: 16, minHeight: 80, textAlignVertical: 'top',
  },
  actionButtons: { flexDirection: 'row', marginTop: 16 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  rejectBtn: { backgroundColor: COLORS.error + '20', marginRight: 8 },
  rejectBtnText: { color: COLORS.error, fontWeight: '600' },
  approveBtn: { backgroundColor: COLORS.success },
  approveBtnText: { color: COLORS.white, fontWeight: '600' },
});
