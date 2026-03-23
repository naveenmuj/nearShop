import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, StatusBar, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import client from '../../lib/api';
import useMyShop from '../../hooks/useMyShop';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';

const TEMPLATES = [
  { label: 'New Arrival', text: 'New products just arrived at our store! Come check them out.' },
  { label: 'Sale', text: 'Big sale happening now! Up to 50% off on select items.' },
  { label: 'Festival', text: 'Wishing you a happy festival! Special offers inside.' },
  { label: 'Custom', text: '' },
];

export default function BroadcastScreen() {
  const { shopId } = useMyShop();
  const [tab, setTab] = useState('compose');
  const [segments, setSegments] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { const h = BackHandler.addEventListener('hardwareBackPress', () => { router.navigate('/(business)/more'); return true; }); return () => h.remove(); }, []);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [sRes, hRes] = await Promise.allSettled([
        client.get('/broadcast/segments'),
        client.get('/broadcast/history'),
      ]);
      if (sRes.status === 'fulfilled') setSegments(sRes.value.data?.segments ?? sRes.value.data ?? []);
      if (hRes.status === 'fulfilled') setHistory(hRes.value.data?.broadcasts ?? hRes.value.data ?? []);
      if (sRes.status === 'rejected' && hRes.status === 'rejected') setError('Failed to load data');
    } catch { setError('Failed to load data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSend = async () => {
    if (!message.trim()) { Alert.alert('Error', 'Enter a message'); return; }
    setSending(true);
    try {
      await client.post('/broadcast/send', { segment: selectedSegment, message: message.trim() });
      Alert.alert('Success', 'Broadcast sent!');
      setMessage(''); loadData();
    } catch (e) { Alert.alert('Error', e.response?.data?.detail || 'Failed to send broadcast'); }
    finally { setSending(false); }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.navigate('/(business)/more')}><Text style={s.back}>← Back</Text></TouchableOpacity>
        <Text style={s.title}>Broadcast</Text>
        <View style={{ width: 50 }} />
      </View>
      <View style={s.tabs}>
        {['compose', 'history'].map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabActive]}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t === 'compose' ? 'Compose' : 'History'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} /> :
         error ? <Text style={s.empty}>{error}</Text> : null}

        {tab === 'compose' && !loading && (
          <>
            <Text style={s.sectionLabel}>Audience</Text>
            <View style={s.segRow}>
              <TouchableOpacity onPress={() => setSelectedSegment('all')} style={[s.segCard, selectedSegment === 'all' && s.segCardActive]}>
                <Text style={[s.segTitle, selectedSegment === 'all' && s.segTitleActive]}>All Customers</Text>
                <Text style={[s.segCount, selectedSegment === 'all' && s.segCountActive]}>{segments.find(sg => sg.key === 'all')?.count ?? '--'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSelectedSegment('repeat')} style={[s.segCard, selectedSegment === 'repeat' && s.segCardActive]}>
                <Text style={[s.segTitle, selectedSegment === 'repeat' && s.segTitleActive]}>Repeat Buyers</Text>
                <Text style={[s.segCount, selectedSegment === 'repeat' && s.segCountActive]}>{segments.find(sg => sg.key === 'repeat')?.count ?? '--'}</Text>
              </TouchableOpacity>
            </View>
            <View style={s.segRow}>
              <TouchableOpacity onPress={() => setSelectedSegment('inactive')} style={[s.segCard, selectedSegment === 'inactive' && s.segCardActive]}>
                <Text style={[s.segTitle, selectedSegment === 'inactive' && s.segTitleActive]}>Inactive</Text>
                <Text style={[s.segCount, selectedSegment === 'inactive' && s.segCountActive]}>{segments.find(sg => sg.key === 'inactive')?.count ?? '--'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSelectedSegment('high_value')} style={[s.segCard, selectedSegment === 'high_value' && s.segCardActive]}>
                <Text style={[s.segTitle, selectedSegment === 'high_value' && s.segTitleActive]}>High Value</Text>
                <Text style={[s.segCount, selectedSegment === 'high_value' && s.segCountActive]}>{segments.find(sg => sg.key === 'high_value')?.count ?? '--'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.sectionLabel}>Templates</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {TEMPLATES.map(t => (
                <TouchableOpacity key={t.label} onPress={() => setMessage(t.text)} style={s.tplChip}>
                  <Text style={s.tplText}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.sectionLabel}>Message</Text>
            <TextInput style={[s.input, { height: 120, textAlignVertical: 'top' }]} value={message} onChangeText={setMessage} placeholder="Type your broadcast message..." placeholderTextColor={COLORS.gray400} multiline />

            <TouchableOpacity onPress={handleSend} disabled={sending || !message.trim()} style={[s.btn, (sending || !message.trim()) && { opacity: 0.5 }]}>
              {sending ? <ActivityIndicator color={COLORS.white} /> : <Text style={s.btnText}>Send Broadcast</Text>}
            </TouchableOpacity>
          </>
        )}

        {tab === 'history' && !loading && (
          <>
            {Array.isArray(history) && history.length === 0 && <Text style={s.empty}>No broadcasts sent yet</Text>}
            {Array.isArray(history) && history.map((b, i) => (
              <View key={b.id || i} style={s.card}>
                <View style={s.cardTop}>
                  <Text style={s.cardSegment}>{(b.segment || 'all').replace('_', ' ')}</Text>
                  <Text style={s.cardDate}>{b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</Text>
                </View>
                <Text style={s.cardMsg} numberOfLines={2}>{b.message}</Text>
                <View style={s.cardBottom}>
                  <Text style={s.cardStat}>Sent: {b.sent_count ?? 0}</Text>
                  <Text style={s.cardStat}>Delivered: {b.delivered_count ?? 0}</Text>
                </View>
              </View>
            ))}
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
  segRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  segCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 14, borderWidth: 2, borderColor: COLORS.gray200, ...SHADOWS.card },
  segCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  segTitle: { fontSize: 13, fontWeight: '600', color: COLORS.gray600 },
  segTitleActive: { color: COLORS.primary },
  segCount: { fontSize: 20, fontWeight: '800', color: COLORS.gray900, marginTop: 4 },
  segCountActive: { color: COLORS.primaryDark },
  tplChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.gray200, marginRight: 8 },
  tplText: { fontSize: 13, fontWeight: '600', color: COLORS.gray600 },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 10, ...SHADOWS.card },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cardSegment: { fontSize: 12, fontWeight: '700', color: COLORS.primary, textTransform: 'capitalize' },
  cardDate: { fontSize: 12, color: COLORS.gray400 },
  cardMsg: { fontSize: 14, color: COLORS.gray700, marginBottom: 8 },
  cardBottom: { flexDirection: 'row', gap: 16 },
  cardStat: { fontSize: 12, color: COLORS.gray500 },
});
