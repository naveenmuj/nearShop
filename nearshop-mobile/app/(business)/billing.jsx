import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, StatusBar, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import client from '../../lib/api';
import { getShopProducts } from '../../lib/shops';
import useMyShop from '../../hooks/useMyShop';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';

export default function BillingScreen() {
  const { shopId } = useMyShop();
  const [tab, setTab] = useState('create');
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [gstPct, setGstPct] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [payMethod, setPayMethod] = useState('cash');
  const [creating, setCreating] = useState(false);
  const [createdBill, setCreatedBill] = useState(null);
  const [bills, setBills] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { const h = BackHandler.addEventListener('hardwareBackPress', () => { router.navigate('/(business)/more'); return true; }); return () => h.remove(); }, []);

  useEffect(() => {
    if (shopId) getShopProducts(shopId, { per_page: 100 }).then(res => {
      const d = res?.data; setProducts(Array.isArray(d) ? d : d?.items ?? []);
    }).catch(() => {});
  }, [shopId]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, sRes] = await Promise.allSettled([client.get('/billing', { params: { per_page: 30 } }), client.get('/billing/stats', { params: { period: '30d' } })]);
      if (bRes.status === 'fulfilled') setBills(bRes.value.data?.bills ?? []);
      if (sRes.status === 'fulfilled') setStats(sRes.value.data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { if (tab === 'history') loadHistory(); }, [tab, loadHistory]);

  const subtotal = items.reduce((s, i) => s + (Number(i.price) || 0) * (i.quantity || 1), 0);
  const gstAmt = subtotal * (Number(gstPct) || 0) / 100;
  const total = subtotal + gstAmt - (Number(discount) || 0);

  const addProduct = (p) => {
    const existing = items.find(i => i.product_id === p.id);
    if (existing) setItems(prev => prev.map(i => i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i));
    else setItems(prev => [...prev, { product_id: p.id, name: p.name, price: Number(p.price), quantity: 1 }]);
    setSearch('');
  };

  const addCustom = () => setItems(prev => [...prev, { product_id: '', name: '', price: 0, quantity: 1 }]);
  const updateItem = (idx, field, val) => setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const handleGenerate = async () => {
    if (items.length === 0) { Alert.alert('Error', 'Add at least one item'); return; }
    setCreating(true);
    try {
      const res = await client.post('/billing', {
        customer_name: customerName || undefined, customer_phone: customerPhone || undefined,
        items: items.map(i => ({ product_id: i.product_id || undefined, name: i.name, price: Number(i.price), quantity: i.quantity })),
        gst_percentage: Number(gstPct) || 0, discount_amount: Number(discount) || 0,
        payment_method: payMethod, payment_status: payMethod === 'credit' ? 'unpaid' : 'paid',
      });
      setCreatedBill(res.data);
      Alert.alert('Success', `Bill ${res.data.bill_number} generated!`);
    } catch (e) { Alert.alert('Error', e.response?.data?.detail || 'Failed to generate bill'); }
    finally { setCreating(false); }
  };

  const resetForm = () => { setItems([]); setCustomerName(''); setCustomerPhone(''); setGstPct('0'); setDiscount('0'); setCreatedBill(null); };
  const filtered = search ? products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase())) : [];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.navigate('/(business)/more')}><Text style={s.back}>← Back</Text></TouchableOpacity>
        <Text style={s.title}>Billing</Text>
        <View style={{ width: 50 }} />
      </View>
      <View style={s.tabs}>
        {['create', 'history'].map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabActive]}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t === 'create' ? 'New Bill' : 'History'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {tab === 'create' && !createdBill && (
          <>
            <Text style={s.sectionLabel}>Customer (optional)</Text>
            <View style={s.row}>
              <TextInput style={[s.input, { flex: 1 }]} value={customerName} onChangeText={setCustomerName} placeholder="Name" placeholderTextColor={COLORS.gray400} />
              <TextInput style={[s.input, { flex: 1 }]} value={customerPhone} onChangeText={setCustomerPhone} placeholder="Phone" placeholderTextColor={COLORS.gray400} keyboardType="phone-pad" />
            </View>

            <View style={s.rowBetween}><Text style={s.sectionLabel}>Items</Text><TouchableOpacity onPress={addCustom}><Text style={s.link}>+ Custom</Text></TouchableOpacity></View>
            <TextInput style={s.input} value={search} onChangeText={setSearch} placeholder="Search products..." placeholderTextColor={COLORS.gray400} />
            {search.length > 0 && filtered.slice(0, 5).map(p => (
              <TouchableOpacity key={p.id} onPress={() => addProduct(p)} style={s.suggestion}>
                <Text style={s.sugName}>{p.name}</Text><Text style={s.sugPrice}>{formatPrice(p.price)}</Text>
              </TouchableOpacity>
            ))}

            {items.map((item, idx) => (
              <View key={idx} style={s.itemRow}>
                <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} value={item.name} onChangeText={v => updateItem(idx, 'name', v)} placeholder="Item name" placeholderTextColor={COLORS.gray400} />
                <TextInput style={[s.input, { width: 70, marginBottom: 0, textAlign: 'right' }]} value={String(item.price)} onChangeText={v => updateItem(idx, 'price', Number(v) || 0)} keyboardType="numeric" />
                <View style={s.qtyWrap}>
                  <TouchableOpacity onPress={() => updateItem(idx, 'quantity', Math.max(1, item.quantity - 1))}><Text style={s.qtyBtn}>-</Text></TouchableOpacity>
                  <Text style={s.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity onPress={() => updateItem(idx, 'quantity', item.quantity + 1)}><Text style={s.qtyBtn}>+</Text></TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => removeItem(idx)}><Ionicons name="trash-outline" size={18} color={COLORS.red} /></TouchableOpacity>
              </View>
            ))}

            <View style={s.totals}>
              <View style={s.totalRow}><Text style={s.totalLabel}>Subtotal</Text><Text style={s.totalVal}>{formatPrice(subtotal)}</Text></View>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>GST %</Text>
                <TextInput style={s.miniInput} value={gstPct} onChangeText={setGstPct} keyboardType="numeric" />
                <Text style={s.totalVal}>{formatPrice(gstAmt)}</Text>
              </View>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Discount</Text>
                <TextInput style={s.miniInput} value={discount} onChangeText={setDiscount} keyboardType="numeric" />
              </View>
              <View style={[s.totalRow, { borderTopWidth: 1, borderTopColor: COLORS.gray200, paddingTop: 10, marginTop: 6 }]}>
                <Text style={s.grandLabel}>TOTAL</Text><Text style={s.grandVal}>{formatPrice(total)}</Text>
              </View>
            </View>

            <Text style={s.sectionLabel}>Payment</Text>
            <View style={s.payRow}>
              {['cash', 'upi', 'card', 'credit'].map(m => (
                <TouchableOpacity key={m} onPress={() => setPayMethod(m)} style={[s.payChip, payMethod === m && s.payChipActive]}>
                  <Text style={[s.payChipText, payMethod === m && s.payChipTextActive]}>{m.charAt(0).toUpperCase() + m.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity onPress={handleGenerate} disabled={creating || items.length === 0} style={[s.btn, (creating || items.length === 0) && { opacity: 0.5 }]}>
              {creating ? <ActivityIndicator color={COLORS.white} /> : <Text style={s.btnText}>Generate Bill</Text>}
            </TouchableOpacity>
          </>
        )}

        {tab === 'create' && createdBill && (
          <View style={s.billPreview}>
            <Text style={s.billNumber}>{createdBill.bill_number}</Text>
            <Text style={s.billDate}>{new Date(createdBill.created_at).toLocaleString('en-IN')}</Text>
            {createdBill.customer_name && <Text style={s.billCustomer}>Customer: {createdBill.customer_name}</Text>}
            {createdBill.items?.map((item, i) => (
              <View key={i} style={s.billItem}><Text style={s.billItemName}>{item.quantity}x {item.name}</Text><Text style={s.billItemPrice}>{formatPrice(item.total)}</Text></View>
            ))}
            <View style={s.billDivider} />
            <View style={s.billItem}><Text style={s.grandLabel}>Total</Text><Text style={s.grandVal}>{formatPrice(createdBill.total)}</Text></View>
            <Text style={s.billPay}>{createdBill.payment_method} | {createdBill.payment_status}</Text>
            <TouchableOpacity onPress={resetForm} style={s.btn}><Text style={s.btnText}>+ New Bill</Text></TouchableOpacity>
          </View>
        )}

        {tab === 'history' && (
          <>
            {stats && (
              <View style={s.statsRow}>
                <View style={s.statCard}><Text style={s.statVal}>{formatPrice(stats.total_revenue)}</Text><Text style={s.statLabel}>Revenue</Text></View>
                <View style={s.statCard}><Text style={s.statVal}>{stats.total_bills}</Text><Text style={s.statLabel}>Bills</Text></View>
              </View>
            )}
            {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} /> :
              bills.length === 0 ? <Text style={s.empty}>No bills yet</Text> :
              bills.map(b => (
                <View key={b.id} style={s.billCard}>
                  <View style={s.billCardTop}><Text style={s.billCardNum}>{b.bill_number}</Text><Text style={[s.billCardStatus, { color: b.payment_status === 'paid' ? COLORS.green : COLORS.amber }]}>{b.payment_status}</Text></View>
                  <Text style={s.billCardCustomer}>{b.customer_name || 'Walk-in'} · {b.items?.length || 0} items</Text>
                  <View style={s.billCardBottom}><Text style={s.billCardTotal}>{formatPrice(b.total)}</Text><Text style={s.billCardDate}>{b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</Text></View>
                </View>
              ))
            }
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
  row: { flexDirection: 'row', gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  input: { backgroundColor: COLORS.white, borderRadius: 10, borderWidth: 1, borderColor: COLORS.gray200, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.gray900, marginBottom: 8 },
  suggestion: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: COLORS.white, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray100 },
  sugName: { fontSize: 14, color: COLORS.gray800 }, sugPrice: { fontSize: 14, fontWeight: '600', color: COLORS.gray500 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  qtyWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.gray200 },
  qtyBtn: { paddingHorizontal: 10, paddingVertical: 6, fontSize: 16, fontWeight: '700', color: COLORS.gray600 },
  qtyText: { fontSize: 14, fontWeight: '700', color: COLORS.gray900, paddingHorizontal: 4 },
  totals: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginTop: 12, ...SHADOWS.card },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  totalLabel: { fontSize: 14, color: COLORS.gray500 }, totalVal: { fontSize: 14, fontWeight: '600', color: COLORS.gray800 },
  miniInput: { width: 50, backgroundColor: COLORS.gray50, borderRadius: 6, borderWidth: 1, borderColor: COLORS.gray200, paddingHorizontal: 8, paddingVertical: 4, fontSize: 13, textAlign: 'center' },
  grandLabel: { fontSize: 15, fontWeight: '700', color: COLORS.gray900 }, grandVal: { fontSize: 20, fontWeight: '800', color: COLORS.green },
  payRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  payChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.gray200 },
  payChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  payChipText: { fontSize: 13, fontWeight: '600', color: COLORS.gray600 },
  payChipTextActive: { color: COLORS.white },
  btn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  billPreview: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20, ...SHADOWS.card },
  billNumber: { fontSize: 18, fontWeight: '800', color: COLORS.gray900, textAlign: 'center' },
  billDate: { fontSize: 12, color: COLORS.gray400, textAlign: 'center', marginTop: 4 },
  billCustomer: { fontSize: 13, color: COLORS.gray600, marginTop: 12 },
  billItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  billItemName: { fontSize: 14, color: COLORS.gray700 }, billItemPrice: { fontSize: 14, fontWeight: '600', color: COLORS.gray900 },
  billDivider: { borderTopWidth: 1, borderTopColor: COLORS.gray200, borderStyle: 'dashed', marginVertical: 10 },
  billPay: { fontSize: 12, color: COLORS.gray400, textAlign: 'center', marginTop: 10 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 14, ...SHADOWS.card },
  statVal: { fontSize: 18, fontWeight: '800', color: COLORS.gray900 },
  statLabel: { fontSize: 11, color: COLORS.gray400, marginTop: 2 },
  empty: { textAlign: 'center', color: COLORS.gray400, marginTop: 40 },
  billCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 10, ...SHADOWS.card },
  billCardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  billCardNum: { fontSize: 12, fontWeight: '700', color: COLORS.gray500, fontFamily: 'monospace' },
  billCardStatus: { fontSize: 11, fontWeight: '700' },
  billCardCustomer: { fontSize: 14, fontWeight: '600', color: COLORS.gray800 },
  billCardBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  billCardTotal: { fontSize: 16, fontWeight: '800', color: COLORS.gray900 },
  billCardDate: { fontSize: 12, color: COLORS.gray400 },
});
