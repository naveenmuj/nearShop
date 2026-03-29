import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, BackHandler, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { authPost } from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import useMyShop from '../../hooks/useMyShop';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';

const EMPTY_PRODUCT = { name: '', price: '', category: '', description: '' };

export default function BulkUploadScreen() {
  const { shopId } = useMyShop();
  const [mode, setMode] = useState('manual'); // 'manual' or 'paste'
  const [products, setProducts] = useState([{ ...EMPTY_PRODUCT }, { ...EMPTY_PRODUCT }, { ...EMPTY_PRODUCT }]);
  const [csvText, setCsvText] = useState('');
  const [parsedProducts, setParsedProducts] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => { const h = BackHandler.addEventListener('hardwareBackPress', () => { router.back(); return true; }); return () => h.remove(); }, []);

  // Parse CSV/text input
  const parseCsv = () => {
    const lines = csvText.trim().split('\n').filter(l => l.trim());
    if (lines.length === 0) {
      toast.show({ type: 'error', text1: 'No data to parse' });
      return;
    }

    const parsed = [];
    for (const line of lines) {
      // Support: Name, Price, Category, Description
      const parts = line.split(/[,\t]/).map(s => s.trim().replace(/^["']|["']$/g, ''));
      if (parts[0]) {
        parsed.push({
          name: parts[0],
          price: parts[1] || '0',
          category: parts[2] || '',
          description: parts[3] || '',
        });
      }
    }
    setParsedProducts(parsed);
    toast.show({ type: 'success', text1: `${parsed.length} products parsed` });
  };

  const updateProduct = (index, field, value) => {
    setProducts(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const addRow = () => {
    setProducts(prev => [...prev, { ...EMPTY_PRODUCT }]);
  };

  const removeRow = (index) => {
    if (products.length <= 1) return;
    setProducts(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    const items = mode === 'manual'
      ? products.filter(p => p.name.trim() && p.price)
      : parsedProducts;

    if (items.length === 0) {
      toast.show({ type: 'error', text1: 'Add at least one product' });
      return;
    }

    if (!shopId) {
      toast.show({ type: 'error', text1: 'Shop not found' });
      return;
    }

    setUploading(true);
    setResult(null);
    try {
      const payload = items.map(p => ({
        name: p.name.trim(),
        price: Number(p.price) || 0,
        category: p.category || undefined,
        description: p.description || undefined,
        images: [],
      }));

      const res = await authPost(`/products/bulk?shop_id=${shopId}`, payload);
      setResult(res.data);

      if (res.data.created_count > 0) {
        toast.show({ type: 'success', text1: `${res.data.created_count} products added to your catalog!` });
      }
      if (res.data.error_count > 0) {
        toast.show({ type: 'warning', text1: `${res.data.error_count} products had errors` });
      }
    } catch (err) {
      toast.show({ type: 'error', text1: err?.response?.data?.detail || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>📦 Bulk Add Products</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {/* Mode toggle */}
        <View style={s.modeRow}>
          {[
            { key: 'manual', label: '✏️ Manual Entry', desc: 'Add products one by one' },
            { key: 'paste', label: '📋 Paste CSV', desc: 'Copy-paste from spreadsheet' },
          ].map(m => (
            <TouchableOpacity
              key={m.key}
              style={[s.modeCard, mode === m.key && s.modeCardActive]}
              onPress={() => setMode(m.key)}
            >
              <Text style={[s.modeLabel, mode === m.key && s.modeLabelActive]}>{m.label}</Text>
              <Text style={[s.modeDesc, mode === m.key && s.modeDescActive]}>{m.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Manual Mode */}
        {mode === 'manual' && (
          <>
            {products.map((p, i) => (
              <View key={i} style={s.productCard}>
                <View style={s.cardHeaderRow}>
                  <Text style={s.cardNum}>Product #{i + 1}</Text>
                  {products.length > 1 && (
                    <TouchableOpacity onPress={() => removeRow(i)}>
                      <Text style={s.removeBtn}>✕ Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  style={s.input}
                  value={p.name}
                  onChangeText={(v) => updateProduct(i, 'name', v)}
                  placeholder="Product name *"
                  placeholderTextColor={COLORS.gray400}
                />
                <View style={s.inputRow}>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    value={p.price}
                    onChangeText={(v) => updateProduct(i, 'price', v)}
                    placeholder="Price *"
                    placeholderTextColor={COLORS.gray400}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    value={p.category}
                    onChangeText={(v) => updateProduct(i, 'category', v)}
                    placeholder="Category"
                    placeholderTextColor={COLORS.gray400}
                  />
                </View>
                <TextInput
                  style={s.input}
                  value={p.description}
                  onChangeText={(v) => updateProduct(i, 'description', v)}
                  placeholder="Description (optional)"
                  placeholderTextColor={COLORS.gray400}
                />
              </View>
            ))}

            <TouchableOpacity style={s.addRowBtn} onPress={addRow}>
              <Text style={s.addRowText}>+ Add Another Product</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Paste Mode */}
        {mode === 'paste' && (
          <>
            <View style={s.hintBox}>
              <Text style={s.hintTitle}>📝 Format Guide</Text>
              <Text style={s.hintText}>
                Paste data from Excel/Google Sheets or type each product on a new line:{'\n'}
                Name, Price, Category, Description{'\n\n'}
                Example:{'\n'}
                Samsung Galaxy, 15999, Electronics, Latest model{'\n'}
                Rice 5kg, 350, Grocery, Premium basmati
              </Text>
            </View>

            <TextInput
              style={s.csvInput}
              value={csvText}
              onChangeText={setCsvText}
              placeholder="Paste your product data here..."
              placeholderTextColor={COLORS.gray400}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity style={s.parseBtn} onPress={parseCsv}>
              <Text style={s.parseBtnText}>📊 Parse Data ({csvText.split('\n').filter(l => l.trim()).length} lines)</Text>
            </TouchableOpacity>

            {parsedProducts.length > 0 && (
              <View style={s.parsedList}>
                <Text style={s.parsedTitle}>{parsedProducts.length} products ready to upload:</Text>
                {parsedProducts.map((p, i) => (
                  <View key={i} style={s.parsedRow}>
                    <Text style={s.parsedName} numberOfLines={1}>{p.name}</Text>
                    <Text style={s.parsedPrice}>{formatPrice(p.price)}</Text>
                    {p.category ? <Text style={s.parsedCat}>{p.category}</Text> : null}
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* Upload Button */}
        <TouchableOpacity
          style={[s.uploadBtn, uploading && { opacity: 0.6 }]}
          onPress={handleUpload}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.uploadBtnText}>
              🚀 Upload {mode === 'manual' ? products.filter(p => p.name.trim()).length : parsedProducts.length} Products
            </Text>
          )}
        </TouchableOpacity>

        {/* Result */}
        {result && (
          <View style={s.resultCard}>
            <Text style={s.resultTitle}>Upload Complete!</Text>
            <Text style={s.resultSuccess}>✅ {result.created_count} products added</Text>
            {result.error_count > 0 && (
              <Text style={s.resultError}>❌ {result.error_count} failed</Text>
            )}
            <TouchableOpacity
              style={s.viewCatalogBtn}
              onPress={() => router.replace('/(business)/catalog')}
            >
              <Text style={s.viewCatalogText}>View Catalog →</Text>
            </TouchableOpacity>
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

  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  modeCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 14, padding: 14, borderWidth: 2, borderColor: COLORS.gray200, ...SHADOWS.card },
  modeCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  modeLabel: { fontSize: 14, fontWeight: '700', color: COLORS.gray800, marginBottom: 2 },
  modeLabelActive: { color: COLORS.primary },
  modeDesc: { fontSize: 11, color: COLORS.gray400 },
  modeDescActive: { color: COLORS.primary },

  productCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 10, ...SHADOWS.card },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardNum: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  removeBtn: { fontSize: 12, fontWeight: '600', color: COLORS.red },
  input: { borderWidth: 1, borderColor: COLORS.gray200, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.gray900, marginBottom: 8, backgroundColor: COLORS.gray50 },
  inputRow: { flexDirection: 'row', gap: 8 },

  addRowBtn: { borderWidth: 2, borderColor: COLORS.primary, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  addRowText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },

  hintBox: { backgroundColor: '#EEF2FF', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#C7D2FE' },
  hintTitle: { fontSize: 14, fontWeight: '700', color: '#4338CA', marginBottom: 6 },
  hintText: { fontSize: 13, color: '#4338CA', lineHeight: 20 },

  csvInput: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray200, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.gray900, minHeight: 160, textAlignVertical: 'top', marginBottom: 10 },
  parseBtn: { backgroundColor: COLORS.primaryLight, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 12 },
  parseBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },

  parsedList: { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 12, ...SHADOWS.card },
  parsedTitle: { fontSize: 13, fontWeight: '700', color: COLORS.gray700, marginBottom: 10 },
  parsedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.gray100, gap: 8 },
  parsedName: { flex: 1, fontSize: 13, color: COLORS.gray800 },
  parsedPrice: { fontSize: 13, fontWeight: '700', color: COLORS.green },
  parsedCat: { fontSize: 11, color: COLORS.gray400, backgroundColor: COLORS.gray100, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },

  uploadBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  resultCard: { backgroundColor: '#D1FAE5', borderRadius: 16, padding: 20, marginTop: 16, alignItems: 'center', borderWidth: 1, borderColor: '#6EE7B7' },
  resultTitle: { fontSize: 18, fontWeight: '800', color: '#065F46', marginBottom: 8 },
  resultSuccess: { fontSize: 15, fontWeight: '600', color: '#059669', marginBottom: 4 },
  resultError: { fontSize: 14, color: '#DC2626', marginBottom: 8 },
  viewCatalogBtn: { backgroundColor: '#059669', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10, marginTop: 8 },
  viewCatalogText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
