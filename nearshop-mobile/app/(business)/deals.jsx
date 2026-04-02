import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar, BackHandler } from 'react-native';
import { alert } from '../../components/ui/PremiumAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { createDeal, getShopDeals } from '../../lib/deals';
import useMyShop from '../../hooks/useMyShop';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';
import { GenericListSkeleton } from '../../components/ui/ScreenSkeletons';

const DURATIONS = [
  { label: '1 Day', value: 1 },
  { label: '3 Days', value: 3 },
  { label: '7 Days', value: 7 },
  { label: '14 Days', value: 14 },
  { label: '30 Days', value: 30 },
];

export default function DealsScreen() {
  const { shopId } = useMyShop();
  const [tab, setTab] = useState('create');
  const [products, setProducts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [discountPct, setDiscountPct] = useState('10');
  const [duration, setDuration] = useState(7);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(business)/more');
  }, []);

  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => h.remove();
  }, [goBack]);

  const loadData = useCallback(async () => {
    if (!shopId) return;
    setLoading(true); setError(null);
    try {
      const [pRes, dRes] = await Promise.allSettled([
        import('../../lib/api').then(({ authGet }) => authGet(`/shops/${shopId}/products`, { params: { per_page: 100 } })),
        getShopDeals(shopId),
      ]);
      if (pRes.status === 'fulfilled') {
        const d = pRes.value.data;
        setProducts(Array.isArray(d) ? d : d?.items ?? []);
      }
      if (dRes.status === 'fulfilled') setDeals(dRes.value.data?.deals ?? dRes.value.data ?? []);
      if (pRes.status === 'rejected' && dRes.status === 'rejected') setError('Failed to load data');
    } catch { setError('Failed to load data'); }
    finally { setLoading(false); }
  }, [shopId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
    if (!selectedProduct) { alert.info({ title: 'Select Product', message: 'Please choose a product to create a deal for.' }); return; }
    if (!shopId) { alert.error({ title: 'Shop Not Found', message: 'Could not find your shop. Please go back and try again.' }); return; }
    const disc = Number(discountPct);
    if (!disc || disc <= 0 || disc > 99) { alert.warning({ title: 'Invalid Discount', message: 'Enter a discount between 1% and 99%.' }); return; }
    setCreating(true);
    try {
      await createDeal({
        product_id: selectedProduct.id,
        title: `${selectedProduct.name} deal`,
        discount_pct: disc,
        duration_hours: duration * 24,
      }, shopId);
      alert.success({ title: 'Deal Created!', message: `${disc}% off deal created for ${selectedProduct.name}. It will be visible to nearby customers.` });
      setSelectedProduct(null);
      setDiscountPct('10');
      setTab('active');
      loadData();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.response?.data?.message || e?.message || 'Failed to create deal. Please try again.';
      alert.error({ title: 'Error', message: String(msg) });
    } finally {
      setCreating(false);
    }
  };

  const filtered = search ? products.filter(p => p?.name?.toLowerCase().includes(search.toLowerCase())) : [];
  const discountedPrice = selectedProduct?.price ? Number(selectedProduct.price) * (1 - (Number(discountPct) || 0) / 100) : 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={s.header}>
        <TouchableOpacity onPress={goBack}><Text style={s.back}>← Back</Text></TouchableOpacity>
        <Text style={s.title}>Deals</Text>
        <View style={{ width: 50 }} />
      </View>
      <View style={s.tabs}>
        {['create', 'active'].map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabActive]}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t === 'create' ? 'Create Deal' : 'Active Deals'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={s.content}
        keyboardDismissMode="on-drag"
      >
        {loading ? <GenericListSkeleton /> :
         error ? <Text style={s.empty}>{error}</Text> : null}

        {tab === 'create' && !loading && (
          <>
            <Text style={s.sectionLabel}>Select Product</Text>
            {selectedProduct ? (
              <View style={s.selectedCard}>
                <View style={{ flex: 1 }}>
                  <Text style={s.selName}>{selectedProduct.name}</Text>
                  <Text style={s.selPrice}>{formatPrice(selectedProduct.price)}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedProduct(null)}><Text style={s.link}>Change</Text></TouchableOpacity>
              </View>
            ) : (
              <>
                <TextInput style={s.input} value={search} onChangeText={setSearch} placeholder="Search products..." placeholderTextColor={COLORS.gray400} />
                {search.length > 0 && filtered.slice(0, 6).map(p => (
                  <TouchableOpacity key={p.id} onPress={() => { setSelectedProduct(p); setSearch(''); }} style={s.suggestion}>
                    <Text style={s.sugName}>{p.name}</Text>
                    <Text style={s.sugPrice}>{formatPrice(p.price)}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            <Text style={s.sectionLabel}>Discount %</Text>
            <TextInput style={s.input} value={discountPct} onChangeText={setDiscountPct} placeholder="e.g. 10" placeholderTextColor={COLORS.gray400} keyboardType="numeric" />

            {selectedProduct && (
              <View style={s.previewRow}>
                <Text style={s.previewOld}>{formatPrice(selectedProduct.price)}</Text>
                <Text style={s.previewNew}>{formatPrice(discountedPrice)}</Text>
                <Text style={s.previewSave}>Save {discountPct}%</Text>
              </View>
            )}

            <Text style={s.sectionLabel}>Duration</Text>
            <View style={s.durRow}>
              {DURATIONS.map(d => (
                <TouchableOpacity key={d.value} onPress={() => setDuration(d.value)} style={[s.durChip, duration === d.value && s.durChipActive]}>
                  <Text style={[s.durText, duration === d.value && s.durTextActive]}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity onPress={handleCreate} disabled={creating || !selectedProduct} style={[s.btn, (creating || !selectedProduct) && { opacity: 0.5 }]}>
              {creating ? <ActivityIndicator color={COLORS.white} /> : <Text style={s.btnText}>Create Deal</Text>}
            </TouchableOpacity>
          </>
        )}

        {tab === 'active' && !loading && (
          <>
            {Array.isArray(deals) && deals.length === 0 && <Text style={s.empty}>No active deals</Text>}
            {Array.isArray(deals) && deals.map((d, i) => {
              const expires = d.expires_at ? new Date(d.expires_at) : null;
              const daysLeft = expires ? Math.max(0, Math.ceil((expires - new Date()) / 86400000)) : null;
              return (
                <View key={d.id || i} style={s.card}>
                  <View style={s.cardTop}>
                    <Text style={s.dealName}>{d.product_name || d.name || 'Product'}</Text>
                    <View style={[s.discBadge, { backgroundColor: COLORS.redLight }]}>
                      <Text style={[s.discText, { color: COLORS.red }]}>-{d.discount_percentage}%</Text>
                    </View>
                  </View>
                  <View style={s.dealPrices}>
                    <Text style={s.dealOrig}>{formatPrice(d.original_price)}</Text>
                    <Text style={s.dealFinal}>{formatPrice(d.deal_price ?? d.discounted_price)}</Text>
                  </View>
                  {daysLeft !== null && (
                    <Text style={[s.dealExpiry, { color: daysLeft <= 2 ? COLORS.red : COLORS.gray400 }]}>
                      {daysLeft === 0 ? 'Expires today' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`}
                    </Text>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
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
  link: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  empty: { textAlign: 'center', color: COLORS.gray400, marginTop: 40 },
  btn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  suggestion: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: COLORS.white, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray100 },
  sugName: { fontSize: 14, color: COLORS.gray800 },
  sugPrice: { fontSize: 14, fontWeight: '600', color: COLORS.gray500 },
  selectedCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight, borderRadius: 12, padding: 14, marginBottom: 8 },
  selName: { fontSize: 14, fontWeight: '600', color: COLORS.gray800 },
  selPrice: { fontSize: 13, color: COLORS.gray500, marginTop: 2 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.white, borderRadius: 10, padding: 12, marginBottom: 8 },
  previewOld: { fontSize: 14, color: COLORS.gray400, textDecorationLine: 'line-through' },
  previewNew: { fontSize: 18, fontWeight: '800', color: COLORS.green },
  previewSave: { fontSize: 12, fontWeight: '700', color: COLORS.red, backgroundColor: COLORS.redLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  durRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  durChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.gray200 },
  durChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  durText: { fontSize: 13, fontWeight: '600', color: COLORS.gray600 },
  durTextActive: { color: COLORS.white },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 10, ...SHADOWS.card },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  dealName: { fontSize: 14, fontWeight: '600', color: COLORS.gray800, flex: 1 },
  discBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  discText: { fontSize: 13, fontWeight: '700' },
  dealPrices: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  dealOrig: { fontSize: 13, color: COLORS.gray400, textDecorationLine: 'line-through' },
  dealFinal: { fontSize: 17, fontWeight: '800', color: COLORS.green },
  dealExpiry: { fontSize: 12, marginTop: 4 },
});
