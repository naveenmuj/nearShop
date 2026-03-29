import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar, BackHandler, Modal } from 'react-native';
import { alert } from '../../components/ui/PremiumAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { authGet, authPost } from '../../lib/api';
import useMyShop from '../../hooks/useMyShop';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';

export default function InventoryScreen() {
  const { shopId } = useMyShop();
  const [tab, setTab] = useState('stock');
  const [stockValue, setStockValue] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [margins, setMargins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [restockModal, setRestockModal] = useState(null);
  const [restockQty, setRestockQty] = useState('');
  const [restocking, setRestocking] = useState(false);

  useEffect(() => { const h = BackHandler.addEventListener('hardwareBackPress', () => { router.navigate('/(business)/more'); return true; }); return () => h.remove(); }, []);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [vRes, lRes, mRes] = await Promise.allSettled([
        authGet('/inventory/value'),
        authGet('/inventory/low-stock'),
        authGet('/inventory/margins'),
      ]);
      if (vRes.status === 'fulfilled') setStockValue(vRes.value.data);
      if (lRes.status === 'fulfilled') setLowStock(lRes.value.data?.items ?? lRes.value.data ?? []);
      if (mRes.status === 'fulfilled') setMargins(mRes.value.data?.items ?? mRes.value.data ?? []);
      if (vRes.status === 'rejected' && lRes.status === 'rejected' && mRes.status === 'rejected') setError('Failed to load inventory data');
    } catch { setError('Failed to load data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRestock = async () => {
    if (!restockQty || Number(restockQty) <= 0) { alert.error({ title: 'Error', message: 'Enter a valid quantity' }); return; }
    setRestocking(true);
    try {
      await authPost('/inventory/restock', { product_id: restockModal.product_id || restockModal.id, quantity: Number(restockQty) });
      alert.success({ title: 'Success', message: `Restocked ${restockModal.name || 'product'}` });
      setRestockModal(null); setRestockQty(''); loadData();
    } catch (e) { alert.error({ title: 'Error', message: e.response?.data?.detail || 'Failed to restock' }); }
    finally { setRestocking(false); }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.navigate('/(business)/more')}><Text style={s.back}>← Back</Text></TouchableOpacity>
        <Text style={s.title}>Inventory</Text>
        <View style={{ width: 50 }} />
      </View>
      <View style={s.tabs}>
        {['stock', 'margins'].map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabActive]}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t === 'stock' ? 'Stock' : 'Margins'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} /> :
         error ? <Text style={s.empty}>{error}</Text> : null}

        {tab === 'stock' && !loading && (
          <>
            {stockValue && (
              <View style={s.statsRow}>
                <View style={s.statCard}><Text style={s.statVal}>{formatPrice(stockValue.total_value)}</Text><Text style={s.statLabel}>Total Value</Text></View>
                <View style={s.statCard}><Text style={s.statVal}>{stockValue.total_items ?? 0}</Text><Text style={s.statLabel}>Total Items</Text></View>
              </View>
            )}

            <Text style={s.sectionLabel}>Low Stock Alerts</Text>
            {Array.isArray(lowStock) && lowStock.length === 0 && <Text style={s.empty}>All stocked up!</Text>}
            {Array.isArray(lowStock) && lowStock.map((item, i) => (
              <View key={item.id || i} style={s.card}>
                <View style={s.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemName}>{item.name}</Text>
                    <Text style={s.itemSub}>Current: <Text style={{ color: COLORS.red, fontWeight: '700' }}>{item.current_stock ?? item.stock}</Text> | Min: {item.min_stock ?? 5}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setRestockModal(item)} style={s.restockBtn}>
                    <Text style={s.restockBtnText}>Restock</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {tab === 'margins' && !loading && (
          <>
            <Text style={s.sectionLabel}>Product Margins</Text>
            {Array.isArray(margins) && margins.length === 0 && <Text style={s.empty}>No margin data</Text>}
            {Array.isArray(margins) && margins.map((item, i) => (
              <View key={item.id || i} style={s.card}>
                <View style={s.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemName}>{item.name}</Text>
                    <Text style={s.itemSub}>Cost: {formatPrice(item.cost_price)} | Sell: {formatPrice(item.sell_price ?? item.price)}</Text>
                  </View>
                  <View style={[s.marginBadge, { backgroundColor: (item.margin ?? 0) >= 20 ? COLORS.greenLight : COLORS.amberLight }]}>
                    <Text style={[s.marginText, { color: (item.margin ?? 0) >= 20 ? COLORS.green : COLORS.amber }]}>{item.margin ?? 0}%</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={!!restockModal} transparent animationType="fade" onRequestClose={() => setRestockModal(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Restock {restockModal?.name}</Text>
            <TextInput style={s.input} value={restockQty} onChangeText={setRestockQty} placeholder="Quantity to add" placeholderTextColor={COLORS.gray400} keyboardType="numeric" />
            <View style={s.modalBtns}>
              <TouchableOpacity onPress={() => setRestockModal(null)} style={s.cancelBtn}><Text style={s.cancelBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleRestock} disabled={restocking} style={[s.btn, restocking && { opacity: 0.5 }]}>
                {restocking ? <ActivityIndicator color={COLORS.white} /> : <Text style={s.btnText}>Restock</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  back: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.gray900 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  tab: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginRight: 8 },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.gray500 },
  tabTextActive: { color: COLORS.white },
  content: { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.gray400, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: COLORS.white, borderRadius: 10, borderWidth: 1, borderColor: COLORS.gray200, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.gray900, marginBottom: 8 },
  empty: { textAlign: 'center', color: COLORS.gray400, marginTop: 40 },
  btn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', flex: 1 },
  btnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  statCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 14, ...SHADOWS.card },
  statVal: { fontSize: 18, fontWeight: '800', color: COLORS.gray900 },
  statLabel: { fontSize: 11, color: COLORS.gray400, marginTop: 2 },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 10, ...SHADOWS.card },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemName: { fontSize: 14, fontWeight: '600', color: COLORS.gray800 },
  itemSub: { fontSize: 12, color: COLORS.gray500, marginTop: 2 },
  restockBtn: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  restockBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  marginBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  marginText: { fontSize: 14, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: COLORS.white, borderRadius: 16, padding: 24, width: '85%' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.gray900, marginBottom: 16 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: COLORS.gray100 },
  cancelBtnText: { fontWeight: '700', fontSize: 15, color: COLORS.gray600 },
});
