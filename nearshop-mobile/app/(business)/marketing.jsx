import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, StatusBar, BackHandler, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import client from '../../lib/api';
import useMyShop from '../../hooks/useMyShop';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';

const TEMPLATES_LIST = ['New Arrival', 'Festival Offer', 'Clearance Sale', 'Weekend Special', 'Custom'];

export default function MarketingScreen() {
  const { shopId } = useMyShop();
  const [festivals, setFestivals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [template, setTemplate] = useState('New Arrival');
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => { const h = BackHandler.addEventListener('hardwareBackPress', () => { router.navigate('/(business)/more'); return true; }); return () => h.remove(); }, []);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [fRes] = await Promise.allSettled([client.get('/marketing/festivals')]);
      if (fRes.status === 'fulfilled') setFestivals(fRes.value.data?.festivals ?? fRes.value.data ?? []);
      else setError('Failed to load festival data');
    } catch { setError('Failed to load data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleGenerate = async () => {
    if (!productName.trim()) { Alert.alert('Error', 'Enter a product name'); return; }
    setGenerating(true);
    try {
      const res = await client.post('/marketing/whatsapp-text', {
        template, product_name: productName.trim(),
        product_price: productPrice ? Number(productPrice) : undefined,
      });
      setGeneratedText(res.data?.text ?? res.data?.message ?? '');
    } catch (e) { Alert.alert('Error', e.response?.data?.detail || 'Failed to generate text'); }
    finally { setGenerating(false); }
  };

  const shareWhatsApp = () => {
    if (!generatedText) return;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(generatedText)}`).catch(() => {});
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.navigate('/(business)/more')}><Text style={s.back}>← Back</Text></TouchableOpacity>
        <Text style={s.title}>WhatsApp Marketing</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} /> :
         error ? <Text style={s.empty}>{error}</Text> : null}

        <Text style={s.sectionLabel}>Template</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {TEMPLATES_LIST.map(t => (
            <TouchableOpacity key={t} onPress={() => setTemplate(t)} style={[s.tplChip, template === t && s.tplChipActive]}>
              <Text style={[s.tplText, template === t && s.tplTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={s.sectionLabel}>Product</Text>
        <TextInput style={s.input} value={productName} onChangeText={setProductName} placeholder="Product name" placeholderTextColor={COLORS.gray400} />
        <TextInput style={s.input} value={productPrice} onChangeText={setProductPrice} placeholder="Price (optional)" placeholderTextColor={COLORS.gray400} keyboardType="numeric" />

        <TouchableOpacity onPress={handleGenerate} disabled={generating || !productName.trim()} style={[s.btn, (generating || !productName.trim()) && { opacity: 0.5 }]}>
          {generating ? <ActivityIndicator color={COLORS.white} /> : <Text style={s.btnText}>Generate Text</Text>}
        </TouchableOpacity>

        {generatedText !== '' && (
          <View style={s.previewCard}>
            <Text style={s.previewLabel}>Preview</Text>
            <Text style={s.previewText}>{generatedText}</Text>
            <TouchableOpacity onPress={shareWhatsApp} style={[s.btn, { backgroundColor: '#25D366', marginTop: 12 }]}>
              <Text style={s.btnText}>Share on WhatsApp</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && festivals.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Upcoming Festivals</Text>
            {festivals.map((f, i) => {
              const daysLeft = f.days_left ?? Math.ceil((new Date(f.date) - new Date()) / 86400000);
              return (
                <View key={f.id || i} style={s.festCard}>
                  <View style={s.festRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.festName}>{f.name}</Text>
                      <Text style={s.festDate}>{f.date ? new Date(f.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</Text>
                    </View>
                    <View style={[s.urgBadge, { backgroundColor: daysLeft <= 7 ? COLORS.redLight : daysLeft <= 14 ? COLORS.amberLight : COLORS.greenLight }]}>
                      <Text style={[s.urgText, { color: daysLeft <= 7 ? COLORS.red : daysLeft <= 14 ? COLORS.amber : COLORS.green }]}>{daysLeft}d</Text>
                    </View>
                  </View>
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
  content: { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.gray400, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: COLORS.white, borderRadius: 10, borderWidth: 1, borderColor: COLORS.gray200, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.gray900, marginBottom: 8 },
  empty: { textAlign: 'center', color: COLORS.gray400, marginTop: 40 },
  btn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  tplChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.gray200, marginRight: 8 },
  tplChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tplText: { fontSize: 13, fontWeight: '600', color: COLORS.gray600 },
  tplTextActive: { color: COLORS.white },
  previewCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginTop: 16, ...SHADOWS.card },
  previewLabel: { fontSize: 12, fontWeight: '700', color: COLORS.gray400, textTransform: 'uppercase', marginBottom: 8 },
  previewText: { fontSize: 14, color: COLORS.gray800, lineHeight: 20 },
  festCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 10, ...SHADOWS.card },
  festRow: { flexDirection: 'row', alignItems: 'center' },
  festName: { fontSize: 14, fontWeight: '600', color: COLORS.gray800 },
  festDate: { fontSize: 12, color: COLORS.gray500, marginTop: 2 },
  urgBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  urgText: { fontSize: 13, fontWeight: '700' },
});
