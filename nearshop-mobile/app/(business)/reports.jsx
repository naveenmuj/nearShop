import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar, BackHandler, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import client from '../../lib/api';
import useMyShop from '../../hooks/useMyShop';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';

const fmtDate = (d) => d.toISOString().split('T')[0];
const displayDate = (d) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export default function ReportsScreen() {
  const { shopId } = useMyShop();
  const [date, setDate] = useState(new Date());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { const h = BackHandler.addEventListener('hardwareBackPress', () => { router.navigate('/(business)/more'); return true; }); return () => h.remove(); }, []);

  const loadReport = useCallback(async () => {
    if (!shopId) return;
    setLoading(true); setError(null);
    try {
      const [rRes] = await Promise.allSettled([
        client.get(`/shops/${shopId}/eod-report`, { params: { report_date: fmtDate(date) } }),
      ]);
      if (rRes.status === 'fulfilled') setReport(rRes.value.data);
      else setError('No report available for this date');
    } catch { setError('Failed to load report'); }
    finally { setLoading(false); }
  }, [shopId, date]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const changeDate = (dir) => {
    const nd = new Date(date);
    nd.setDate(nd.getDate() + dir);
    if (nd <= new Date()) setDate(nd);
  };

  const shareWhatsApp = () => {
    if (!report) return;
    const text = `Daily Report - ${displayDate(date)}\n\nOrders: ${report.total_orders ?? 0}\nRevenue: ${formatPrice(report.total_revenue)}\nAvg Order: ${formatPrice(report.avg_order_value)}\nTop Product: ${report.top_product?.name || 'N/A'}\n\nPayments:\nCash: ${formatPrice(report.cash_total)}\nUPI: ${formatPrice(report.upi_total)}\nCard: ${formatPrice(report.card_total)}`;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`).catch(() => {});
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.navigate('/(business)/more')}><Text style={s.back}>← Back</Text></TouchableOpacity>
        <Text style={s.title}>Daily Report</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={s.datePicker}>
        <TouchableOpacity onPress={() => changeDate(-1)} style={s.dateBtn}><Text style={s.dateBtnText}>{'<'}</Text></TouchableOpacity>
        <Text style={s.dateText}>{displayDate(date)}</Text>
        <TouchableOpacity onPress={() => changeDate(1)} style={s.dateBtn}><Text style={s.dateBtnText}>{'>'}</Text></TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} /> :
         error ? <Text style={s.empty}>{error}</Text> : null}

        {!loading && report && (
          <>
            <View style={s.statsRow}>
              <View style={s.statCard}><Text style={s.statVal}>{report.total_orders ?? 0}</Text><Text style={s.statLabel}>Orders</Text></View>
              <View style={s.statCard}><Text style={s.statVal}>{formatPrice(report.total_revenue)}</Text><Text style={s.statLabel}>Revenue</Text></View>
            </View>
            <View style={s.statsRow}>
              <View style={s.statCard}><Text style={s.statVal}>{formatPrice(report.avg_order_value)}</Text><Text style={s.statLabel}>Avg Order</Text></View>
              <View style={s.statCard}><Text style={s.statVal}>{report.unique_customers ?? 0}</Text><Text style={s.statLabel}>Customers</Text></View>
            </View>

            <View style={s.card}>
              <Text style={s.sectionLabel}>Payment Breakdown</Text>
              <View style={s.metricRow}><Text style={s.metricLabel}>Cash</Text><Text style={s.metricVal}>{formatPrice(report.cash_total)}</Text></View>
              <View style={s.metricRow}><Text style={s.metricLabel}>UPI</Text><Text style={s.metricVal}>{formatPrice(report.upi_total)}</Text></View>
              <View style={s.metricRow}><Text style={s.metricLabel}>Card</Text><Text style={s.metricVal}>{formatPrice(report.card_total)}</Text></View>
            </View>

            {report.top_product && (
              <View style={s.card}>
                <Text style={s.sectionLabel}>Top Product</Text>
                <Text style={s.topProduct}>{report.top_product.name}</Text>
                <Text style={s.topProductSub}>{report.top_product.quantity_sold ?? 0} sold | {formatPrice(report.top_product.revenue)}</Text>
              </View>
            )}

            <TouchableOpacity onPress={shareWhatsApp} style={[s.btn, { backgroundColor: '#25D366' }]}>
              <Text style={s.btnText}>Share on WhatsApp</Text>
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
  content: { padding: 16, paddingBottom: 40 },
  datePicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  dateBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.gray100, alignItems: 'center', justifyContent: 'center' },
  dateBtnText: { fontSize: 18, fontWeight: '700', color: COLORS.gray600 },
  dateText: { fontSize: 15, fontWeight: '600', color: COLORS.gray800 },
  empty: { textAlign: 'center', color: COLORS.gray400, marginTop: 40 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 14, ...SHADOWS.card },
  statVal: { fontSize: 18, fontWeight: '800', color: COLORS.gray900 },
  statLabel: { fontSize: 11, color: COLORS.gray400, marginTop: 2 },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 12, ...SHADOWS.card },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.gray400, textTransform: 'uppercase', marginBottom: 10 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  metricLabel: { fontSize: 14, color: COLORS.gray600 },
  metricVal: { fontSize: 14, fontWeight: '700', color: COLORS.gray800 },
  topProduct: { fontSize: 16, fontWeight: '700', color: COLORS.gray900 },
  topProductSub: { fontSize: 13, color: COLORS.gray500, marginTop: 2 },
  btn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
});
