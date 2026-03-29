import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar, BackHandler } from 'react-native';
import { alert } from '../../components/ui/PremiumAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { authGet, authPost } from '../../lib/api';
import useMyShop from '../../hooks/useMyShop';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';

const CATEGORIES = ['rent', 'electricity', 'salary', 'stock_purchase', 'transport', 'misc'];

export default function ExpensesScreen() {
  const { shopId } = useMyShop();
  const [tab, setTab] = useState('overview');
  const [expenses, setExpenses] = useState([]);
  const [pnl, setPnl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('misc');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { const h = BackHandler.addEventListener('hardwareBackPress', () => { router.navigate('/(business)/more'); return true; }); return () => h.remove(); }, []);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [eRes, pRes] = await Promise.allSettled([
        authGet('/expenses', { params: { period: '30d' } }),
        authGet('/expenses/profit-loss', { params: { period: '30d' } }),
      ]);
      if (eRes.status === 'fulfilled') setExpenses(eRes.value.data?.expenses ?? eRes.value.data ?? []);
      if (pRes.status === 'fulfilled') setPnl(pRes.value.data);
      if (eRes.status === 'rejected' && pRes.status === 'rejected') setError('Failed to load data');
    } catch { setError('Failed to load data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddExpense = async () => {
    if (!amount || Number(amount) <= 0) { alert.error({ title: 'Error', message: 'Enter a valid amount' }); return; }
    setSubmitting(true);
    try {
      await authPost('/expenses', { amount: Number(amount), category, description: description || undefined });
      alert.success({ title: 'Success', message: 'Expense added' });
      setAmount(''); setDescription(''); loadData();
    } catch (e) { alert.error({ title: 'Error', message: e.response?.data?.detail || 'Failed to add expense' }); }
    finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.navigate('/(business)/more')}><Text style={s.back}>← Back</Text></TouchableOpacity>
        <Text style={s.title}>Expenses & P&L</Text>
        <View style={{ width: 50 }} />
      </View>
      <View style={s.tabs}>
        {['overview', 'add'].map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabActive]}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t === 'overview' ? 'Overview' : 'Add Expense'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} /> :
         error ? <Text style={s.empty}>{error}</Text> : null}

        {tab === 'overview' && !loading && (
          <>
            {pnl && (
              <View style={s.pnlRow}>
                <View style={[s.pnlCard, { backgroundColor: COLORS.greenLight }]}>
                  <Text style={[s.pnlVal, { color: COLORS.green }]}>{formatPrice(pnl.revenue)}</Text>
                  <Text style={s.pnlLabel}>Revenue</Text>
                </View>
                <View style={[s.pnlCard, { backgroundColor: COLORS.redLight }]}>
                  <Text style={[s.pnlVal, { color: COLORS.red }]}>{formatPrice(pnl.total_expenses)}</Text>
                  <Text style={s.pnlLabel}>Expenses</Text>
                </View>
                <View style={[s.pnlCard, { backgroundColor: (pnl.profit ?? 0) >= 0 ? COLORS.greenLight : COLORS.redLight }]}>
                  <Text style={[s.pnlVal, { color: (pnl.profit ?? 0) >= 0 ? COLORS.green : COLORS.red }]}>{formatPrice(pnl.profit)}</Text>
                  <Text style={s.pnlLabel}>Profit</Text>
                </View>
              </View>
            )}

            <Text style={s.sectionLabel}>Recent Expenses</Text>
            {Array.isArray(expenses) && expenses.length === 0 && <Text style={s.empty}>No expenses recorded</Text>}
            {Array.isArray(expenses) && expenses.map((exp, i) => (
              <View key={exp.id || i} style={s.card}>
                <View style={s.cardTop}>
                  <View style={s.catBadge}><Text style={s.catText}>{(exp.category || 'misc').replace('_', ' ')}</Text></View>
                  <Text style={s.expAmount}>{formatPrice(exp.amount)}</Text>
                </View>
                {exp.description ? <Text style={s.expDesc}>{exp.description}</Text> : null}
                <Text style={s.expDate}>{exp.created_at ? new Date(exp.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</Text>
              </View>
            ))}
          </>
        )}

        {tab === 'add' && (
          <>
            <Text style={s.sectionLabel}>Amount</Text>
            <TextInput style={s.input} value={amount} onChangeText={setAmount} placeholder="Enter amount" placeholderTextColor={COLORS.gray400} keyboardType="numeric" />

            <Text style={s.sectionLabel}>Category</Text>
            <View style={s.catRow}>
              {CATEGORIES.map(c => (
                <TouchableOpacity key={c} onPress={() => setCategory(c)} style={[s.catChip, category === c && s.catChipActive]}>
                  <Text style={[s.catChipText, category === c && s.catChipTextActive]}>{c.replace('_', ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.sectionLabel}>Description (optional)</Text>
            <TextInput style={s.input} value={description} onChangeText={setDescription} placeholder="What was this expense for?" placeholderTextColor={COLORS.gray400} />

            <TouchableOpacity onPress={handleAddExpense} disabled={submitting} style={[s.btn, submitting && { opacity: 0.5 }]}>
              {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={s.btnText}>Add Expense</Text>}
            </TouchableOpacity>
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
  empty: { textAlign: 'center', color: COLORS.gray400, marginTop: 40 },
  btn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  pnlRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  pnlCard: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  pnlVal: { fontSize: 16, fontWeight: '800' },
  pnlLabel: { fontSize: 11, color: COLORS.gray500, marginTop: 2 },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 10, ...SHADOWS.card },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  catBadge: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  catText: { fontSize: 11, fontWeight: '600', color: COLORS.primary, textTransform: 'capitalize' },
  expAmount: { fontSize: 16, fontWeight: '800', color: COLORS.gray900 },
  expDesc: { fontSize: 13, color: COLORS.gray600, marginBottom: 4 },
  expDate: { fontSize: 11, color: COLORS.gray400 },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.gray200 },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catChipText: { fontSize: 13, fontWeight: '600', color: COLORS.gray600, textTransform: 'capitalize' },
  catChipTextActive: { color: COLORS.white },
});
