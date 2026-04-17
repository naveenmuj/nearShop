import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar, BackHandler, Linking } from 'react-native';
import { alert } from '../../components/ui/PremiumAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { authGet } from '../../lib/api';
import useMyShop from '../../hooks/useMyShop';
import { exportOrders } from '../../lib/orders';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';

const fmtDate = (d) => d.toISOString().split('T')[0];
const displayDate = (d) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export default function ReportsScreen() {
  const { shopId } = useMyShop();
  const [date, setDate] = useState(new Date());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);

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

  const loadReport = useCallback(async () => {
    if (!shopId) return;
    setLoading(true); setError(null);
    try {
      const [rRes] = await Promise.allSettled([
        authGet(`/shops/${shopId}/eod-report`, { params: { report_date: fmtDate(date) } }),
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

  const handleExport = async (format) => {
    if (!shopId) return;
    setExporting(true);
    setShowExportOptions(false);
    
    try {
      // Calculate date range (current month)
      const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const response = await exportOrders(shopId, {
        format,
        start_date: fmtDate(startDate),
        end_date: fmtDate(endDate),
      });
      
      if (response.data) {
        const ext = format === 'csv' ? 'csv' : 'xlsx';
        const fileName = `orders-${fmtDate(startDate)}-to-${fmtDate(endDate)}.${ext}`;
        const fileUri = FileSystem.documentDirectory + fileName;
        
        await FileSystem.writeAsStringAsync(fileUri, response.data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const canOpen = await Linking.canOpenURL(fileUri);
        if (canOpen) {
          await Linking.openURL(fileUri);
        }
        alert.success({
          title: 'Success',
          message: canOpen
            ? `Orders exported to ${fileName}`
            : `Orders exported to ${fileName}. Open it from your device files if it did not launch automatically.`
        });
      }
    } catch {
      alert.error({ title: 'Error', message: 'Failed to export orders. Please try again.' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={s.header}>
        <TouchableOpacity onPress={goBack}><Text style={s.back}>← Back</Text></TouchableOpacity>
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

            {/* Export Section */}
            <View style={s.card}>
              <Text style={s.sectionLabel}>Export Orders</Text>
              <Text style={s.exportDesc}>Download your orders as CSV or Excel file</Text>
              
              {!showExportOptions ? (
                <TouchableOpacity 
                  onPress={() => setShowExportOptions(true)} 
                  style={s.exportBtn}
                  disabled={exporting}
                >
                  {exporting ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <>
                      <Text style={s.exportIcon}>📊</Text>
                      <Text style={s.exportBtnText}>Export This Month&apos;s Orders</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={s.exportOptions}>
                  <TouchableOpacity 
                    onPress={() => handleExport('csv')} 
                    style={[s.exportOption, { borderColor: '#22C55E' }]}
                    disabled={exporting}
                  >
                    <Text style={s.exportOptionIcon}>📄</Text>
                    <View style={s.exportOptionInfo}>
                      <Text style={s.exportOptionTitle}>CSV File</Text>
                      <Text style={s.exportOptionDesc}>Best for Excel, Google Sheets</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => handleExport('xlsx')} 
                    style={[s.exportOption, { borderColor: '#2563EB' }]}
                    disabled={exporting}
                  >
                    <Text style={s.exportOptionIcon}>📊</Text>
                    <View style={s.exportOptionInfo}>
                      <Text style={s.exportOptionTitle}>Excel File</Text>
                      <Text style={s.exportOptionDesc}>Formatted spreadsheet</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowExportOptions(false)} style={s.cancelExportBtn}>
                    <Text style={s.cancelExportText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

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
  
  // Export section
  exportDesc: { fontSize: 13, color: COLORS.gray500, marginBottom: 12, marginTop: -4 },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight + '30',
    borderRadius: 10,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '40',
    gap: 8,
  },
  exportIcon: { fontSize: 18 },
  exportBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  exportOptions: { gap: 10 },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: COLORS.gray50,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 12,
  },
  exportOptionIcon: { fontSize: 24 },
  exportOptionInfo: { flex: 1 },
  exportOptionTitle: { fontSize: 15, fontWeight: '600', color: COLORS.gray800 },
  exportOptionDesc: { fontSize: 12, color: COLORS.gray500, marginTop: 2 },
  cancelExportBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelExportText: { fontSize: 14, fontWeight: '500', color: COLORS.gray500 },
});
