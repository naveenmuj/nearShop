import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { alert } from '../../components/ui/PremiumAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import useMyShop from '../../hooks/useMyShop';
import { getShopProducts } from '../../lib/shops';
import { toggleAvailability, deleteProduct } from '../../lib/products';

const COLORS = {
  primary: '#7F77DD',
  green: '#1D9E75',
  amber: '#EF9F27',
  red: '#E24B4A',
  blue: '#3B8BD4',
  white: '#FFFFFF',
  bg: '#F9FAFB',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  primaryLight: '#EEEDFE',
  greenLight: '#E1F5EE',
};

const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
};

const formatPrice = (p) => '₹' + Number(p).toLocaleString('en-IN');

export default function CatalogScreen() {
  const { shopId } = useMyShop();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const loadProducts = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const res = await getShopProducts(shopId, { per_page: 100, include_hidden: true });
      const items = res?.data?.items ?? res?.data ?? [];
      setProducts(Array.isArray(items) ? items : []);
    } catch {
      alert.error({ title: 'Error', message: 'Failed to load products' });
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts])
  );

  const filtered = products.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = async (item) => {
    const confirmed = await alert.confirm({
      title: 'Toggle Availability',
      message: `Mark "${item.name}" as ${item.available ? 'Off' : 'Live'}?`,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
    });
    if (confirmed) {
      try {
        await toggleAvailability(item.id);
        loadProducts();
      } catch {
        alert.error({ title: 'Error', message: 'Failed to update availability' });
      }
    }
  };

  const handleDelete = async (item) => {
    const confirmed = await alert.confirm({
      title: 'Delete Product',
      message: `Are you sure you want to delete "${item.name}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (confirmed) {
      try {
        await deleteProduct(item.id);
        loadProducts();
      } catch {
        alert.error({ title: 'Error', message: 'Failed to delete product' });
      }
    }
  };

  const renderProduct = ({ item }) => {
    const isLive = item.is_available ?? item.available ?? true;
    const imageUrl = item.images?.[0] ?? item.image_url;
    return (
      <TouchableOpacity
        style={styles.productRow}
        onPress={() => router.push({ pathname: '/(business)/product-details', params: { id: item.id } })}
        onLongPress={() => handleToggle(item)}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: imageUrl || 'https://via.placeholder.com/56' }}
          style={styles.productImage}
        />
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.productPrice}>{formatPrice(item.price)}</Text>
          <Text style={styles.productCategory} numberOfLines={1}>{item.category}</Text>
        </View>
        <View style={styles.productActions}>
          {!isLive ? (
            <TouchableOpacity
              style={styles.makeLiveBtn}
              onPress={() => handleToggle(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.makeLiveText}>Make Live</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.badge, styles.badgeLive]}>
              <Text style={[styles.badgeText, styles.badgeLiveText]}>Live</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.trashBtn}
            onPress={() => handleDelete(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.red} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const ListEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>📦</Text>
      <Text style={styles.emptyTitle}>No products yet</Text>
      <Text style={styles.emptySub}>Analyse a product photo to auto-fill details, then publish it to your catalog.</Text>
      <TouchableOpacity
        style={styles.emptyBtn}
        onPress={() => router.push('/(business)/snap-list')}
      >
        <Text style={styles.emptyBtnText}>Analyze Image</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>My Products</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{products.length}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: COLORS.green }]}
            onPress={() => router.push('/(business)/bulk-upload')}
          >
            <Ionicons name="documents-outline" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/(business)/snap-list')}
          >
            <Ionicons name="add" size={24} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={COLORS.gray400} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          placeholderTextColor={COLORS.gray400}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <TouchableOpacity
        style={styles.analyzeCard}
        activeOpacity={0.8}
        onPress={() => router.push('/(business)/snap-list')}
      >
        <View style={styles.analyzeIconWrap}>
          <Ionicons name="sparkles-outline" size={22} color={COLORS.primary} />
        </View>
        <View style={styles.analyzeCopy}>
          <Text style={styles.analyzeTitle}>Analyze product image</Text>
          <Text style={styles.analyzeSub}>Use camera or gallery to auto-fill product details with AI.</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.gray400} />
      </TouchableOpacity>

      {/* List */}
      {loading && products.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderProduct}
          ListEmptyComponent={ListEmpty}
          contentContainerStyle={filtered.length === 0 ? { flex: 1 } : { paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(business)/snap-list')}
        activeOpacity={0.85}
      >
        <Ionicons name="camera" size={20} color={COLORS.white} />
        <Text style={styles.fabText}>Snap &amp; List</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  countBadge: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.card,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    ...SHADOWS.card,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 42,
    fontSize: 15,
    color: COLORS.gray800,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    padding: 12,
    ...SHADOWS.card,
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: COLORS.gray100,
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.gray800,
    marginBottom: 2,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 2,
  },
  productCategory: {
    fontSize: 12,
    color: COLORS.gray500,
  },
  productActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeLive: {
    backgroundColor: COLORS.greenLight,
  },
  badgeOff: {
    backgroundColor: COLORS.gray100,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeLiveText: {
    color: COLORS.green,
  },
  badgeOffText: {
    color: COLORS.gray500,
  },
  makeLiveBtn: {
    backgroundColor: COLORS.green,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  makeLiveText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },
  trashBtn: {
    padding: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.gray600,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.gray500,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  emptyBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  emptyBtnText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 15,
  },
  analyzeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    ...SHADOWS.card,
  },
  analyzeIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
  },
  analyzeCopy: {
    flex: 1,
  },
  analyzeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.gray900,
    marginBottom: 2,
  },
  analyzeSub: {
    fontSize: 12,
    color: COLORS.gray500,
    lineHeight: 17,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 13,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
  },
  fabText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
