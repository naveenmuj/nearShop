import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, BackHandler, Linking, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { authGet, authPost } from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import useMyShop from '../../hooks/useMyShop';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';

const TEMPLATES = [
  { key: 'catalog', label: '📋 Full Catalog', desc: 'Share your complete product catalog' },
  { key: 'new_arrivals', label: '🆕 New Arrivals', desc: 'Announce new products' },
  { key: 'deals', label: '🏷️ Deals & Offers', desc: 'Highlight discounted products' },
  { key: 'festival', label: '🎪 Festival Special', desc: 'Festival-themed message' },
];

export default function MarketingScreen() {
  const { shopId } = useMyShop();
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [template, setTemplate] = useState('catalog');
  const [generatedText, setGeneratedText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { const h = BackHandler.addEventListener('hardwareBackPress', () => { router.navigate('/(business)/more'); return true; }); return () => h.remove(); }, []);

  const loadProducts = useCallback(async () => {
    if (!shopId) return;
    try {
      const res = await authGet(`/shops/${shopId}/products`, { params: { per_page: 100 } });
      const items = res.data?.items ?? res.data ?? [];
      setProducts(Array.isArray(items) ? items : []);
    } catch {}
    finally { setLoading(false); }
  }, [shopId]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const toggleProduct = (id) => {
    setSelectedProducts(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
    setGeneratedText(''); // Clear preview when selection changes
  };

  const selectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => String(p.id)));
    }
    setGeneratedText('');
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const payload = { template };
      if (selectedProducts.length > 0) {
        payload.product_ids = selectedProducts;
      }
      const res = await authPost('/marketing/whatsapp-text', payload);
      setGeneratedText(res.data?.text ?? '');
    } catch (err) {
      toast.show({ type: 'error', text1: err?.response?.data?.detail || 'Failed to generate' });
    } finally {
      setGenerating(false);
    }
  };

  const shareWhatsApp = () => {
    if (!generatedText) return;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(generatedText)}`).catch(() =>
      toast.show({ type: 'error', text1: 'WhatsApp not found' })
    );
  };

  const notifyFollowers = async () => {
    if (!generatedText) return;
    try {
      await authPost('/broadcast/send', {
        title: TEMPLATES.find(t => t.key === template)?.label || 'New Update',
        message: generatedText.substring(0, 200),
        segment: 'all',
      });
      toast.show({ type: 'success', text1: 'Notification sent to all followers!' });
    } catch (err) {
      console.error('Notify followers error:', err);
      const errorMsg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Failed to notify followers';
      toast.show({ type: 'error', text1: 'Error', text2: String(errorMsg) });
    }
  };

  const filteredProducts = search
    ? products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()))
    : products;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.navigate('/(business)/more')}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>📱 WhatsApp Studio</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {/* Step 1: Template Selection */}
        <Text style={s.stepLabel}>STEP 1: Choose Template</Text>
        <View style={s.templateGrid}>
          {TEMPLATES.map(t => {
            const active = template === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[s.tplCard, active && s.tplCardActive]}
                onPress={() => { setTemplate(t.key); setGeneratedText(''); }}
              >
                <Text style={s.tplEmoji}>{t.label.split(' ')[0]}</Text>
                <Text style={[s.tplLabel, active && s.tplLabelActive]}>{t.label.split(' ').slice(1).join(' ')}</Text>
                <Text style={[s.tplDesc, active && s.tplDescActive]}>{t.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Step 2: Product Selection */}
        <View style={s.stepHeaderRow}>
          <Text style={s.stepLabel}>STEP 2: Select Products</Text>
          <TouchableOpacity onPress={selectAll}>
            <Text style={s.selectAllText}>
              {selectedProducts.length === filteredProducts.length ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search products..."
          placeholderTextColor={COLORS.gray400}
        />

        {selectedProducts.length > 0 && (
          <Text style={s.selectedCount}>{selectedProducts.length} product{selectedProducts.length > 1 ? 's' : ''} selected</Text>
        )}

        {loading ? (
          <ActivityIndicator style={{ marginTop: 20 }} color={COLORS.primary} />
        ) : (
          <View style={s.productList}>
            {filteredProducts.slice(0, 20).map(p => {
              const selected = selectedProducts.includes(String(p.id));
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[s.prodRow, selected && s.prodRowSelected]}
                  onPress={() => toggleProduct(String(p.id))}
                >
                  <View style={[s.checkbox, selected && s.checkboxActive]}>
                    {selected && <Text style={s.checkmark}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.prodName} numberOfLines={1}>{p.name}</Text>
                    <Text style={s.prodCategory}>{p.category}</Text>
                  </View>
                  <Text style={s.prodPrice}>{formatPrice(p.price)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Step 3: Generate & Share */}
        <Text style={s.stepLabel}>STEP 3: Generate & Share</Text>
        <TouchableOpacity
          onPress={handleGenerate}
          disabled={generating}
          style={[s.generateBtn, generating && { opacity: 0.6 }]}
        >
          {generating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.generateBtnText}>✨ Generate WhatsApp Message</Text>
          )}
        </TouchableOpacity>

        {generatedText !== '' && (
          <View style={s.previewCard}>
            <Text style={s.previewLabel}>MESSAGE PREVIEW</Text>
            <Text style={s.previewText}>{generatedText}</Text>

            <View style={s.shareRow}>
              <TouchableOpacity onPress={shareWhatsApp} style={[s.shareBtn, { backgroundColor: '#25D366' }]}>
                <Text style={s.shareBtnText}>📱 Share on WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={notifyFollowers} style={[s.shareBtn, { backgroundColor: COLORS.primary }]}>
                <Text style={s.shareBtnText}>🔔 Notify Followers</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
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

  stepLabel: { fontSize: 11, fontWeight: '700', color: COLORS.gray400, letterSpacing: 0.8, marginBottom: 10, marginTop: 16 },
  stepHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 10 },
  selectAllText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },

  // Templates
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tplCard: { width: '48%', backgroundColor: COLORS.white, borderRadius: 14, padding: 14, borderWidth: 2, borderColor: COLORS.gray200, ...SHADOWS.card },
  tplCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  tplEmoji: { fontSize: 22, marginBottom: 6 },
  tplLabel: { fontSize: 14, fontWeight: '700', color: COLORS.gray800, marginBottom: 2 },
  tplLabelActive: { color: COLORS.primary },
  tplDesc: { fontSize: 11, color: COLORS.gray400, lineHeight: 15 },
  tplDescActive: { color: COLORS.primary },

  // Search
  searchInput: { backgroundColor: COLORS.white, borderRadius: 10, borderWidth: 1, borderColor: COLORS.gray200, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.gray900, marginBottom: 8 },
  selectedCount: { fontSize: 13, fontWeight: '600', color: COLORS.primary, marginBottom: 8 },

  // Product list
  productList: { gap: 6 },
  prodRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 10, borderWidth: 1, borderColor: COLORS.gray100 },
  prodRowSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight + '40' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.gray300, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  prodName: { fontSize: 14, fontWeight: '600', color: COLORS.gray800 },
  prodCategory: { fontSize: 11, color: COLORS.gray400, marginTop: 1 },
  prodPrice: { fontSize: 14, fontWeight: '700', color: COLORS.green },

  // Generate
  generateBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  generateBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Preview
  previewCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginTop: 16, ...SHADOWS.card },
  previewLabel: { fontSize: 11, fontWeight: '700', color: COLORS.gray400, letterSpacing: 0.8, marginBottom: 10 },
  previewText: { fontSize: 14, color: COLORS.gray800, lineHeight: 22, backgroundColor: COLORS.gray50, borderRadius: 10, padding: 14 },
  shareRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  shareBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  shareBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
