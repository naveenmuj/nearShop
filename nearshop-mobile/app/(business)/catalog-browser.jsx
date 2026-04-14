import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import useMyShop from '../../hooks/useMyShop';
import { alert } from '../../components/ui/PremiumAlert';
import { addCatalogProducts, getCatalogCategories, getCatalogTemplates } from '../../lib/catalog';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';

const PAGE_SIZE = 40;

export default function CatalogBrowserScreen() {
  const { shopId, loading: shopLoading } = useMyShop();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [overrides, setOverrides] = useState({});
  const [bulkMarginPct, setBulkMarginPct] = useState('');
  const [adding, setAdding] = useState(false);

  const selectedCount = selected.size;
  const allVisibleSelected = useMemo(
    () => products.length > 0 && products.every((item) => selected.has(item.id)),
    [products, selected]
  );

  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const response = await getCatalogCategories();
      const rows = Array.isArray(response?.data) ? response.data : [];
      setCategories(rows);
    } catch {
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getCatalogTemplates({
        q: query.trim() || undefined,
        category: category || undefined,
        per_page: PAGE_SIZE,
        page: 1,
      });
      const rows = response?.data?.items ?? [];
      setProducts(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err?.userMessage || 'Failed to load catalog products.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [category, query]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadProducts]);

  const filteredCountLabel = useMemo(() => {
    if (loading) return 'Searching master catalog...';
    return `${products.length} product${products.length === 1 ? '' : 's'} found`;
  }, [loading, products.length]);

  const toggleSelected = useCallback((item) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(item.id)) {
        next.delete(item.id);
        setOverrides((prev) => {
          const copy = { ...prev };
          delete copy[item.id];
          return copy;
        });
      } else {
        next.add(item.id);
        setOverrides((prev) => ({
          ...prev,
          [item.id]: {
            price: String(item.base_price_inr ?? 0),
            compare_price: item.compare_price_inr != null ? String(item.compare_price_inr) : '',
            stock_quantity: '',
          },
        }));
      }
      return next;
    });
  }, []);

  const setOverrideField = useCallback((itemId, field, value) => {
    setOverrides((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        [field]: value,
      },
    }));
  }, []);

  const parseNumberField = (value) => {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const parseIntegerField = (value) => {
    const parsed = parseNumberField(value);
    if (parsed == null) return undefined;
    return Math.max(0, Math.floor(parsed));
  };

  const clearFilters = useCallback(() => {
    setQuery('');
    setCategory('');
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    setSelected((current) => {
      const next = new Set(current);
      const shouldSelectAll = !products.every((item) => next.has(item.id));

      if (shouldSelectAll) {
        products.forEach((item) => {
          next.add(item.id);
        });
        setOverrides((prev) => {
          const copy = { ...prev };
          products.forEach((item) => {
            if (!copy[item.id]) {
              copy[item.id] = {
                price: String(item.base_price_inr ?? 0),
                compare_price: item.compare_price_inr != null ? String(item.compare_price_inr) : '',
                stock_quantity: '',
              };
            }
          });
          return copy;
        });
      } else {
        products.forEach((item) => {
          next.delete(item.id);
        });
        setOverrides((prev) => {
          const copy = { ...prev };
          products.forEach((item) => {
            delete copy[item.id];
          });
          return copy;
        });
      }

      return next;
    });
  }, [products]);

  const applyMarginToSelected = useCallback(() => {
    const margin = parseNumberField(bulkMarginPct);
    if (margin == null) {
      alert.warning({ title: 'Invalid margin', message: 'Enter a valid margin percentage.' });
      return;
    }
    if (selectedCount === 0) {
      alert.warning({ title: 'Select products', message: 'Select products before applying margin.' });
      return;
    }

    setOverrides((prev) => {
      const copy = { ...prev };
      products.forEach((item) => {
        if (!selected.has(item.id)) return;
        const base = Number(item.base_price_inr ?? 0);
        const nextPrice = Math.max(0, Math.round(base * (1 + margin / 100) * 100) / 100);
        copy[item.id] = {
          ...(copy[item.id] || {}),
          price: String(nextPrice),
          compare_price:
            copy[item.id]?.compare_price ??
            (item.compare_price_inr != null ? String(item.compare_price_inr) : ''),
          stock_quantity: copy[item.id]?.stock_quantity ?? '',
        };
      });
      return copy;
    });

    alert.success({
      title: 'Margin applied',
      message: `Applied ${margin}% to ${selectedCount} selected product${selectedCount === 1 ? '' : 's'}.`,
    });
  }, [bulkMarginPct, products, selected, selectedCount]);

  const handleAddSelected = useCallback(async () => {
    if (!shopId) {
      alert.error({ title: 'No shop found', message: 'Create or select a shop first.' });
      return;
    }
    if (selectedCount === 0) {
      alert.warning({ title: 'Select products', message: 'Choose at least one catalog item to add.' });
      return;
    }

    setAdding(true);
    try {
      const selectedProducts = products.filter((item) => selected.has(item.id));
      const response = await addCatalogProducts(
        shopId,
        selectedProducts.map((item) => {
          const override = overrides[item.id] || {};
          return {
            catalog_id: item.id,
            price: parseNumberField(override.price),
            compare_price: parseNumberField(override.compare_price),
            stock_quantity: parseIntegerField(override.stock_quantity),
          };
        })
      );

      const created = response?.data?.created_count || 0;
      const updated = response?.data?.updated_count || 0;
      const skipped = response?.data?.skipped_count || 0;
      alert.success({
        title: 'Catalog updated',
        message: `${created} added${updated ? `, ${updated} updated` : ''}${skipped ? `, ${skipped} skipped` : ''}.`,
      });
      setSelected(new Set());
      setOverrides({});
    } catch (err) {
      alert.error({ title: 'Add failed', message: err?.userMessage || 'Unable to add catalog products.' });
    } finally {
      setAdding(false);
    }
  }, [overrides, products, selected, selectedCount, shopId]);

  const renderCategoryChip = (item) => {
    const active = category === item.name;
    return (
      <TouchableOpacity
        key={item.name}
        onPress={() => setCategory(active ? '' : item.name)}
        style={[styles.chip, active && styles.chipActive]}
        activeOpacity={0.85}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.chipCount, active && styles.chipCountActive]}>{item.count}</Text>
      </TouchableOpacity>
    );
  };

  const renderProduct = ({ item }) => {
    const selectedItem = selected.has(item.id);
    const imageUrl = item.thumbnail_url || item.image_urls?.[0];
    const price = item.base_price_inr ?? 0;

    return (
      <TouchableOpacity
        style={[styles.card, selectedItem && styles.cardSelected]}
        activeOpacity={0.86}
        onPress={() => toggleSelected(item)}
      >
        <View style={styles.imageWrap}>
          <Image
            source={{ uri: imageUrl || 'https://via.placeholder.com/120x120?text=Catalog' }}
            style={styles.image}
          />
          {selectedItem ? (
            <View style={styles.checkBadge}>
              <Ionicons name="checkmark" size={14} color={COLORS.white} />
            </View>
          ) : null}
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.productMeta} numberOfLines={1}>
            {item.brand || 'Generic'} • {item.category}
          </Text>
          <View style={styles.rowBetween}>
            <Text style={styles.price}>{formatPrice(price)}</Text>
            <View style={styles.sourcePill}>
              <Text style={styles.sourcePillText}>{item.data_source || 'catalog'}</Text>
            </View>
          </View>
          <Text style={styles.helperText} numberOfLines={2}>
            {item.short_description || item.description || 'Tap to select this product and add it to your shop catalog.'}
          </Text>
          {selectedItem ? (
            <View style={styles.overrideWrap}>
              <Text style={styles.overrideTitle}>Override for this shop</Text>
              <View style={styles.overrideRow}>
                <View style={styles.overrideField}>
                  <Text style={styles.overrideLabel}>Price</Text>
                  <TextInput
                    value={overrides[item.id]?.price ?? ''}
                    onChangeText={(value) => setOverrideField(item.id, 'price', value)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.gray400}
                    style={styles.overrideInput}
                  />
                </View>
                <View style={styles.overrideField}>
                  <Text style={styles.overrideLabel}>Compare</Text>
                  <TextInput
                    value={overrides[item.id]?.compare_price ?? ''}
                    onChangeText={(value) => setOverrideField(item.id, 'compare_price', value)}
                    keyboardType="numeric"
                    placeholder="Optional"
                    placeholderTextColor={COLORS.gray400}
                    style={styles.overrideInput}
                  />
                </View>
                <View style={styles.overrideField}>
                  <Text style={styles.overrideLabel}>Stock</Text>
                  <TextInput
                    value={overrides[item.id]?.stock_quantity ?? ''}
                    onChangeText={(value) => setOverrideField(item.id, 'stock_quantity', value)}
                    keyboardType="number-pad"
                    placeholder="Qty"
                    placeholderTextColor={COLORS.gray400}
                    style={styles.overrideInput}
                  />
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  if (shopLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading shop...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!shopId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.emptyState}>
          <Ionicons name="storefront-outline" size={46} color={COLORS.primary} />
          <Text style={styles.emptyTitle}>No shop selected</Text>
          <Text style={styles.emptySub}>Create or select your business profile before adding catalog products.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(business)/more')}>
            <Text style={styles.primaryBtnText}>Go to More</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.gray800} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Master Catalog</Text>
          <Text style={styles.headerSub}>Search products and add them to your shop.</Text>
        </View>
        <TouchableOpacity onPress={() => router.replace('/(business)/catalog')} style={styles.iconBtn}>
          <Ionicons name="cube-outline" size={20} color={COLORS.gray800} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={COLORS.gray400} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search the master catalog..."
          placeholderTextColor={COLORS.gray400}
          returnKeyType="search"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.gray400} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoIconWrap}>
          <Ionicons name="sparkles-outline" size={20} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.infoTitle}>Select catalog items in one tap</Text>
          <Text style={styles.infoSub}>Prices and images are prefilled. You can edit them later from your catalog.</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Categories</Text>
        <TouchableOpacity onPress={clearFilters}>
          <Text style={styles.linkText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.chipRowWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <TouchableOpacity
            onPress={() => setCategory('')}
            style={[styles.chip, !category && styles.chipActive]}
            activeOpacity={0.85}
          >
            <Text style={[styles.chipText, !category && styles.chipTextActive]}>All</Text>
            <Text style={[styles.chipCount, !category && styles.chipCountActive]}>{products.length}</Text>
          </TouchableOpacity>
          {loadingCategories ? (
            <View style={styles.chipLoader}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : (
            categories.slice(0, 18).map(renderCategoryChip)
          )}
        </ScrollView>
      </View>

      <View style={styles.resultsRow}>
        <Text style={styles.resultsText}>{filteredCountLabel}</Text>
        <Text style={styles.resultsHint}>{selectedCount} selected</Text>
      </View>

      <View style={styles.bulkActionsWrap}>
        <TouchableOpacity
          style={[styles.bulkSelectBtn, allVisibleSelected && styles.bulkSelectBtnActive]}
          onPress={toggleSelectAllVisible}
          activeOpacity={0.86}
        >
          <Ionicons
            name={allVisibleSelected ? 'checkbox-outline' : 'square-outline'}
            size={16}
            color={allVisibleSelected ? COLORS.white : COLORS.gray700}
          />
          <Text style={[styles.bulkSelectBtnText, allVisibleSelected && styles.bulkSelectBtnTextActive]}>
            {allVisibleSelected ? 'Unselect visible' : 'Select all visible'}
          </Text>
        </TouchableOpacity>

        <View style={styles.marginRow}>
          <TextInput
            value={bulkMarginPct}
            onChangeText={setBulkMarginPct}
            keyboardType="numeric"
            placeholder="Margin %"
            placeholderTextColor={COLORS.gray400}
            style={styles.marginInput}
          />
          <TouchableOpacity
            style={styles.marginApplyBtn}
            onPress={applyMarginToSelected}
            activeOpacity={0.86}
          >
            <Text style={styles.marginApplyText}>Apply Margin</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={18} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadProducts}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        data={products}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderProduct}
        contentContainerStyle={products.length === 0 ? styles.listEmptyContent : styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyStateCompact}>
              <Ionicons name="search-outline" size={44} color={COLORS.gray300} />
              <Text style={styles.emptyTitle}>No catalog products found</Text>
              <Text style={styles.emptySub}>Try a different search term or clear the category filter.</Text>
              <TouchableOpacity style={styles.secondaryBtn} onPress={clearFilters}>
                <Text style={styles.secondaryBtnText}>Clear filters</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.addBtn, selectedCount === 0 && styles.addBtnDisabled]}
          disabled={selectedCount === 0 || adding}
          onPress={handleAddSelected}
        >
          {adding ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.white} />
              <Text style={styles.addBtnText}>
                Add {selectedCount > 0 ? `${selectedCount} product${selectedCount === 1 ? '' : 's'}` : 'to catalog'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {loading && products.length === 0 ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    ...SHADOWS.card,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.gray900,
  },
  headerSub: {
    fontSize: 12,
    color: COLORS.gray500,
    marginTop: 2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 50,
    ...SHADOWS.card,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.gray800,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.gray100,
    ...SHADOWS.card,
  },
  infoIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  infoSub: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.gray500,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.gray700,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  chipRowWrap: {
    minHeight: 44,
  },
  chipRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chipLoader: {
    width: 54,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.gray700,
  },
  chipTextActive: {
    color: COLORS.white,
  },
  chipCount: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.gray400,
  },
  chipCountActive: {
    color: 'rgba(255,255,255,0.85)',
  },
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  resultsText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.gray700,
  },
  resultsHint: {
    fontSize: 12,
    color: COLORS.gray400,
    fontWeight: '600',
  },
  bulkActionsWrap: {
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  bulkSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    backgroundColor: COLORS.white,
  },
  bulkSelectBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  bulkSelectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.gray700,
  },
  bulkSelectBtnTextActive: {
    color: COLORS.white,
  },
  marginRow: {
    flexDirection: 'row',
    gap: 8,
  },
  marginInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    backgroundColor: COLORS.white,
    paddingHorizontal: 10,
    fontSize: 13,
    color: COLORS.gray800,
    fontWeight: '600',
  },
  marginApplyBtn: {
    width: 122,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.blue,
  },
  marginApplyText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.white,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.redLight,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.red,
    fontWeight: '600',
  },
  retryText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.red,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 120,
    gap: 10,
  },
  listEmptyContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 120,
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.gray100,
    ...SHADOWS.card,
  },
  cardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#FAF8FF',
  },
  imageWrap: {
    width: 94,
    height: 94,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.gray100,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  checkBadge: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  cardBody: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    color: COLORS.gray900,
  },
  productMeta: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.gray500,
    fontWeight: '600',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  price: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },
  sourcePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.primaryLight,
  },
  sourcePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
    textTransform: 'uppercase',
  },
  helperText: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.gray500,
  },
  overrideWrap: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  overrideTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gray700,
    marginBottom: 8,
  },
  overrideRow: {
    flexDirection: 'row',
    gap: 8,
  },
  overrideField: {
    flex: 1,
  },
  overrideLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.gray500,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  overrideInput: {
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    backgroundColor: COLORS.white,
    paddingHorizontal: 10,
    fontSize: 13,
    color: COLORS.gray800,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyStateCompact: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.gray800,
    textAlign: 'center',
  },
  emptySub: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 19,
  },
  primaryBtn: {
    marginTop: 18,
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryBtn: {
    marginTop: 18,
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: COLORS.gray700,
    fontSize: 14,
    fontWeight: '800',
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.gray500,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.green,
    ...SHADOWS.card,
  },
  addBtnDisabled: {
    backgroundColor: COLORS.gray300,
  },
  addBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
  },
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(249,250,251,0.35)',
  },
});
