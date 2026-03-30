/**
 * Returns Screen - Customer view of their return requests
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, SHADOWS } from '../../constants/theme';
import { getMyReturns } from '../../lib/returns';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: COLORS.warning, icon: 'time-outline' },
  approved: { label: 'Approved', color: COLORS.success, icon: 'checkmark-circle-outline' },
  rejected: { label: 'Rejected', color: COLORS.error, icon: 'close-circle-outline' },
  processing: { label: 'Processing', color: COLORS.primary, icon: 'sync-outline' },
  completed: { label: 'Completed', color: COLORS.success, icon: 'checkmark-done-outline' },
};

export default function ReturnsScreen() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState(null);

  const loadReturns = useCallback(async () => {
    try {
      const data = await getMyReturns(filter);
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

  const renderReturn = ({ item }) => {
    const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    
    return (
      <TouchableOpacity
        style={styles.returnCard}
        onPress={() => router.push(`/(customer)/return/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.returnHeader}>
          <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
            <Ionicons name={status.icon} size={14} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
          <Text style={styles.date}>
            {new Date(item.requested_at).toLocaleDateString()}
          </Text>
        </View>
        
        <View style={styles.returnBody}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={2}>{item.item_name}</Text>
            <Text style={styles.itemMeta}>Qty: {item.item_quantity} • ₹{item.item_price}</Text>
            <Text style={styles.reason}>Reason: {item.reason.replace(/_/g, ' ')}</Text>
          </View>
        </View>
        
        {item.refund_amount && (
          <View style={styles.refundRow}>
            <Ionicons name="wallet-outline" size={16} color={COLORS.success} />
            <Text style={styles.refundText}>Refund: ₹{item.refund_amount}</Text>
          </View>
        )}
        
        <View style={styles.returnFooter}>
          <Text style={styles.shopName}>{item.shop_name || 'Shop'}</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.gray} />
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
        <Text style={styles.title}>My Returns</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Filter tabs */}
      <View style={styles.filterTabs}>
        {[null, 'pending', 'approved', 'completed'].map((f) => (
          <TouchableOpacity
            key={f || 'all'}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f ? f.charAt(0).toUpperCase() + f.slice(1) : 'All'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {returns.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="return-up-back-outline" size={64} color={COLORS.gray} />
          <Text style={styles.emptyTitle}>No returns</Text>
          <Text style={styles.emptySubtitle}>Your return requests will appear here</Text>
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
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: COLORS.background },
  filterTabActive: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 14, color: COLORS.gray },
  filterTextActive: { color: COLORS.white, fontWeight: '600' },
  list: { padding: 16 },
  returnCard: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginBottom: 12, ...SHADOWS.small,
  },
  returnHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
  date: { fontSize: 12, color: COLORS.gray },
  returnBody: { flexDirection: 'row' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  itemMeta: { fontSize: 13, color: COLORS.gray, marginTop: 4 },
  reason: { fontSize: 13, color: COLORS.gray, marginTop: 2, textTransform: 'capitalize' },
  refundRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  refundText: { fontSize: 14, fontWeight: '600', color: COLORS.success, marginLeft: 6 },
  returnFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  shopName: { fontSize: 13, color: COLORS.gray },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: COLORS.gray, marginTop: 4 },
});
