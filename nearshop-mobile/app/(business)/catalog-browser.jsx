import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Animated,
  Easing,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import useMyShop from '../../hooks/useMyShop';
import { alert } from '../../components/ui/PremiumAlert';
import {
  addCatalogProducts,
  getCatalogCategories,
  getCatalogTemplates,
  getShopCatalogSelections,
  publishCatalogProducts,
} from '../../lib/catalog';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';

const PAGE_SIZE = 40;

export default function CatalogBrowserScreen() {
  const insets = useSafeAreaInsets();
  const { shop, shopId, loading: shopLoading } = useMyShop();
  const [query, setQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [overrides, setOverrides] = useState({});
  const [bulkMarginPct, setBulkMarginPct] = useState('');
  const [adding, setAdding] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPublishReview, setShowPublishReview] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showSelectionTools, setShowSelectionTools] = useState(false);
  const [shopSelections, setShopSelections] = useState([]);
  const [loadingSelections, setLoadingSelections] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const riseAnim = useRef(new Animated.Value(16)).current;

  const onboardingCategories = useMemo(() => {
    const raw = [shop?.category, ...(Array.isArray(shop?.subcategories) ? shop.subcategories : [])];
    return [...new Set(raw.map((item) => String(item || '').trim()).filter(Boolean))];
  }, [shop?.category, shop?.subcategories]);

  const selectedCategoriesSet = useMemo(() => new Set(selectedCategories), [selectedCategories]);
  const recommendedMatches = useMemo(() => {
    if (!categories.length || !onboardingCategories.length) return [];
    const normalized = new Set(onboardingCategories.map((item) => item.toLowerCase()));
    return categories.filter((item) => normalized.has(String(item.name || '').toLowerCase()));
  }, [categories, onboardingCategories]);

  const selectedCount = selected.size;
  const allVisibleSelected = useMemo(
    () => products.length > 0 && products.every((item) => selected.has(item.id)),
    [products, selected]
  );
  const selectedProducts = useMemo(() => products.filter((item) => selected.has(item.id)), [products, selected]);

  const selectedBaseTotal = useMemo(
    () => selectedProducts.reduce((sum, item) => sum + Number(item.base_price_inr ?? 0), 0),
    [selectedProducts]
  );
  const selectedOverrideTotal = useMemo(
    () =>
      selectedProducts.reduce((sum, item) => {
        const override = overrides[item.id] || {};
        const parsed = parseNumberField(override.price);
        return sum + Number(parsed ?? item.base_price_inr ?? 0);
      }, 0),
    [overrides, selectedProducts, parseNumberField]
  );
  const expectedMarginPct = useMemo(() => {
    if (!selectedBaseTotal) return null;
    return ((selectedOverrideTotal - selectedBaseTotal) / selectedBaseTotal) * 100;
  }, [selectedBaseTotal, selectedOverrideTotal]);

  const compactValue = useCallback(
    (value) =>
      String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ''),
    []
  );
  const getImageFingerprint = useCallback((value) => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';
    const withoutQuery = raw.split('?')[0].split('#')[0];
    return withoutQuery.split('/').filter(Boolean).pop() || withoutQuery;
  }, []);
  const getProductSignature = useCallback(
    (item) => {
      const brand = compactValue(item?.brand);
      const name = compactValue(item?.name);
      const image = getImageFingerprint(item?.thumbnail_url || item?.image_urls?.[0]);
      return `${brand}|${name}|${image}`;
    },
    [compactValue, getImageFingerprint]
  );

  const existingSelectionKeys = useMemo(() => {
    const keys = new Set(
      shopSelections.flatMap((item) => {
        const rowKeys = [String(item.catalog_id || '').toLowerCase()];
        if (item.name) {
          rowKeys.push(`${compactValue(item.brand)}|${compactValue(item.name)}`);
          rowKeys.push(compactValue(item.name));
        }
        const thumbnailFingerprint = getImageFingerprint(item.thumbnail_url);
        if (thumbnailFingerprint) {
          rowKeys.push(thumbnailFingerprint);
        }
        return rowKeys.filter(Boolean);
      })
    );
    return keys;
  }, [compactValue, getImageFingerprint, shopSelections]);

  const duplicateSelectedProducts = useMemo(
    () =>
      selectedProducts.filter((item) => {
        const catalogKey = String(item.id || '').toLowerCase();
        return (
          existingSelectionKeys.has(catalogKey) ||
          existingSelectionKeys.has(getProductSignature(item)) ||
          existingSelectionKeys.has(compactValue(item.name)) ||
          existingSelectionKeys.has(getImageFingerprint(item.thumbnail_url || item.image_urls?.[0]))
        );
      }),
    [compactValue, existingSelectionKeys, getImageFingerprint, getProductSignature, selectedProducts]
  );
  const duplicateCount = duplicateSelectedProducts.length;

  const selectedCategorySuggestions = useMemo(() => {
    const counts = new Map();
    selectedProducts.forEach((item) => {
      const category = String(item.category || '').trim();
      if (!category) return;
      counts.set(category, (counts.get(category) || 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));
  }, [selectedProducts]);

  const selectedBrandSuggestions = useMemo(() => {
    const counts = new Map();
    selectedProducts.forEach((item) => {
      const brand = String(item.brand || '').trim();
      if (!brand) return;
      counts.set(brand, (counts.get(brand) || 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));
  }, [selectedProducts]);

  const selectedReviewItems = useMemo(() => {
    return selectedProducts.map((item) => {
      const override = overrides[item.id] || {};
      const basePrice = Number(item.base_price_inr ?? 0);
      const overridePrice = parseNumberField(override.price);
      const selectedPrice = overridePrice ?? basePrice;
      const priceDelta = selectedPrice - basePrice;
      const priceDeltaPct = basePrice > 0 ? (priceDelta / basePrice) * 100 : null;
      const imageUrl = item.thumbnail_url || item.image_urls?.[0];
      const hasImage = Boolean(imageUrl);
      const isDuplicate = duplicateSelectedProducts.some((entry) => entry.id === item.id);
      const isLargeJump = basePrice > 0 ? Math.abs(priceDeltaPct || 0) >= 25 : selectedPrice > 0;

      return {
        ...item,
        basePrice,
        selectedPrice,
        priceDelta,
        priceDeltaPct,
        hasImage,
        isDuplicate,
        isLargeJump,
      };
    });
  }, [duplicateSelectedProducts, overrides, selectedProducts, parseNumberField]);

  useEffect(() => {
    if (selectedCount > 0) {
      setShowSelectionTools(true);
    }
  }, [selectedCount]);

  const reviewRiskCounts = useMemo(() => {
    return selectedReviewItems.reduce(
      (acc, item) => {
        if (item.isDuplicate) acc.duplicates += 1;
        if (!item.hasImage) acc.emptyImages += 1;
        if (item.isLargeJump) acc.priceJumps += 1;
        return acc;
      },
      { duplicates: 0, emptyImages: 0, priceJumps: 0 }
    );
  }, [selectedReviewItems]);

  const riskyReviewCount = reviewRiskCounts.duplicates + reviewRiskCounts.emptyImages + reviewRiskCounts.priceJumps;

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

  const loadShopSelections = useCallback(async () => {
    if (!shopId) return;
    setLoadingSelections(true);
    try {
      const response = await getShopCatalogSelections(shopId, { page: 1, per_page: 100 });
      const rows = Array.isArray(response?.data?.items) ? response.data.items : [];
      setShopSelections(rows);
    } catch {
      setShopSelections([]);
    } finally {
      setLoadingSelections(false);
    }
  }, [shopId]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getCatalogTemplates({
        q: query.trim() || undefined,
        categories: selectedCategories.length > 0 ? selectedCategories : undefined,
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
  }, [query, selectedCategories]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(riseAnim, {
        toValue: 0,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, riseAnim]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadShopSelections();
  }, [loadShopSelections]);

  useEffect(() => {
    if (!categories.length || onboardingCategories.length === 0) return;
    setSelectedCategories((current) => {
      if (current.length > 0) return current;
      const available = categories
        .map((item) => item.name)
        .filter((name) => onboardingCategories.some((pref) => pref.toLowerCase() === String(name || '').toLowerCase()));
      return available.length > 0 ? available : [categories[0].name];
    });
  }, [categories, onboardingCategories]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadProducts]);

  const filteredCountLabel = useMemo(() => {
    if (loading) return 'Searching shared library...';
    return `${products.length} product${products.length === 1 ? '' : 's'} found`;
  }, [loading, products.length]);

  const activeCategoryText = useMemo(() => {
    if (selectedCategories.length === 0) return 'All categories';
    if (selectedCategories.length <= 2) return selectedCategories.join(' · ');
    return `${selectedCategories.length} categories selected`;
  }, [selectedCategories]);

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

  const parseNumberField = useCallback((value) => {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, []);

  const parseIntegerField = useCallback((value) => {
    const parsed = parseNumberField(value);
    if (parsed == null) return undefined;
    return Math.max(0, Math.floor(parsed));
  }, [parseNumberField]);

  const clearFilters = useCallback(() => {
    setQuery('');
    setSelectedCategories([]);
  }, []);

  const toggleCategory = useCallback((name) => {
    const normalized = String(name || '').trim();
    if (!normalized) return;
    setSelectedCategories((current) => {
      const exists = current.some((item) => item.toLowerCase() === normalized.toLowerCase());
      if (exists) {
        return current.filter((item) => item.toLowerCase() !== normalized.toLowerCase());
      }
      return [...current, normalized];
    });
  }, []);

  const setCategoryPreset = useCallback((items) => {
    const next = [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))];
    setSelectedCategories(next);
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

  const visibleCategories = useMemo(
    () => (showAllCategories ? categories : categories.slice(0, 8)),
    [categories, showAllCategories]
  );

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
  }, [bulkMarginPct, products, selected, selectedCount, parseNumberField]);

  const openPublishReview = useCallback(() => {
    if (selectedCount === 0) {
      alert.warning({ title: 'Select products', message: 'Choose at least one catalog item to publish.' });
      return;
    }
    setShowPublishReview(true);
  }, [selectedCount]);

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
        title: 'Selections saved',
        message: `${created} selected${updated ? `, ${updated} updated` : ''}${skipped ? `, ${skipped} skipped` : ''}. Publish when ready.`,
      });
    } catch (err) {
      alert.error({ title: 'Add failed', message: err?.userMessage || 'Unable to add catalog products.' });
    } finally {
      setAdding(false);
    }
  }, [overrides, products, selected, selectedCount, shopId, parseIntegerField, parseNumberField]);

  const handlePublishSelected = useCallback(async () => {
    if (!shopId) {
      alert.error({ title: 'No shop found', message: 'Create or select a shop first.' });
      return;
    }
    if (selectedCount === 0) {
      alert.warning({ title: 'Select products', message: 'Choose at least one catalog item to publish.' });
      return;
    }

    if (riskyReviewCount > 0) {
      const riskyConfirmed = await alert.confirm({
        title: 'Confirm risky publish',
        message:
          `${riskyReviewCount} selected item${riskyReviewCount === 1 ? '' : 's'} have duplicates, missing images, or large price changes. Continue?`,
        confirmText: 'Publish anyway',
        cancelText: 'Review again',
      });
      if (!riskyConfirmed) return;
    }

    setShowPublishReview(false);

    setPublishing(true);
    try {
      const selectedProducts = products.filter((item) => selected.has(item.id));

      // Ensure latest overrides are saved before publishing.
      await addCatalogProducts(
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

      const publishResponse = await publishCatalogProducts(
        shopId,
        selectedProducts.map((item) => item.id)
      );

      const created = publishResponse?.data?.created_count || 0;
      const updated = publishResponse?.data?.updated_count || 0;
      const skipped = publishResponse?.data?.skipped_count || 0;

      alert.success({
        title: 'Products published',
        message: `${created} created${updated ? `, ${updated} updated` : ''}${skipped ? `, ${skipped} skipped` : ''}.`,
      });

      setSelected(new Set());
      setOverrides({});
      loadShopSelections();
    } catch (err) {
      alert.error({
        title: 'Publish failed',
        message: err?.userMessage || 'Unable to publish selected products.',
      });
    } finally {
      setPublishing(false);
    }
  }, [loadShopSelections, overrides, products, riskyReviewCount, selected, selectedCount, shopId, parseIntegerField, parseNumberField]);

  const renderCategoryChip = (item) => {
    const active = selectedCategoriesSet.has(item.name);
    return (
      <TouchableOpacity
        key={item.name}
        onPress={() => toggleCategory(item.name)}
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
      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: riseAnim }] }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.gray800} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Shared Product Library</Text>
          <Text style={styles.headerSub}>Pick products that match your shop and keep your prices separate.</Text>
        </View>
        <TouchableOpacity onPress={() => router.replace('/(business)/catalog')} style={styles.iconBtn}>
          <Ionicons name="cube-outline" size={20} color={COLORS.gray800} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[styles.heroCard, { opacity: fadeAnim, transform: [{ translateY: riseAnim }] }]}>
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.heroEyebrow}>Built for {shop?.name || 'your shop'}</Text>
            <Text style={styles.heroTitle}>Start with your categories, then add more anytime</Text>
          </View>
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles-outline" size={14} color={COLORS.primary} />
            <Text style={styles.heroBadgeText}>Smart defaults</Text>
          </View>
        </View>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{recommendedMatches.length}</Text>
            <Text style={styles.heroStatLabel}>Recommended matches</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{selectedCount}</Text>
            <Text style={styles.heroStatLabel}>Items chosen</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{products.length}</Text>
            <Text style={styles.heroStatLabel}>Visible results</Text>
          </View>
        </View>

        <Text style={styles.heroHint}>{activeCategoryText}</Text>
      </Animated.View>

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
          <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.infoTitle}>Pick one or many categories</Text>
          <Text style={styles.infoSub}>Your onboarding category is preselected. Tap any chip to add or remove it from the library filter.</Text>
        </View>
      </View>

      {onboardingCategories.length > 0 ? (
        <View style={styles.recommendedWrap}>
          <View style={styles.recommendedHeader}>
            <View style={styles.recommendedHeaderTextWrap}>
              <Text style={styles.sectionTitle}>Pinned for your shop</Text>
              <Text style={styles.recommendedHeaderSub}>Based on your onboarding category</Text>
            </View>
            <View style={styles.recommendedBadge}>
              <Ionicons name="pin-outline" size={12} color={COLORS.primaryDark} />
              <Text style={styles.recommendedBadgeText}>{recommendedMatches.length} matches</Text>
            </View>
          </View>
          <View style={styles.recommendedLead}>
            <Text style={styles.recommendedLeadText} numberOfLines={2}>
              These categories are preselected from your business setup. Tap any chip to keep it, remove it, or add more.
            </Text>
          </View>
          <TouchableOpacity onPress={() => setCategoryPreset(onboardingCategories)} style={styles.linkBtn}>
            <Text style={styles.linkBtnText}>Reset to shop choices</Text>
          </TouchableOpacity>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recommendedRow}>
            {onboardingCategories.map((name) => {
              const active = selectedCategoriesSet.has(name);
              return (
                <TouchableOpacity
                  key={name}
                  onPress={() => toggleCategory(name)}
                  style={[styles.recommendedChip, active && styles.recommendedChipActive]}
                  activeOpacity={0.86}
                >
                  <Ionicons
                    name={active ? 'checkbox' : 'ellipse-outline'}
                    size={14}
                    color={active ? COLORS.white : COLORS.primary}
                  />
                  <Text style={[styles.recommendedChipText, active && styles.recommendedChipTextActive]}>{name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>All Categories</Text>
        <View style={styles.sectionActionsRow}>
          {categories.length > 8 ? (
            <TouchableOpacity onPress={() => setShowAllCategories((prev) => !prev)} style={styles.linkBtn}>
              <Text style={styles.linkBtnText}>{showAllCategories ? 'Less' : 'More'}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={clearFilters} style={styles.linkBtn}>
            <Text style={styles.linkBtnText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.chipRowWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <TouchableOpacity
            onPress={clearFilters}
            style={[styles.chip, selectedCategories.length === 0 && styles.chipActive]}
            activeOpacity={0.85}
          >
            <Text style={[styles.chipText, selectedCategories.length === 0 && styles.chipTextActive]}>All</Text>
            <Text style={[styles.chipCount, selectedCategories.length === 0 && styles.chipCountActive]}>{products.length}</Text>
          </TouchableOpacity>
          {loadingCategories ? (
            <View style={styles.chipLoader}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : (
            visibleCategories.map(renderCategoryChip)
          )}
        </ScrollView>
      </View>

      <View style={styles.resultsRow}>
        <Text style={styles.resultsText}>{filteredCountLabel}</Text>
        <Text style={styles.resultsHint}>{selectedCount} selected</Text>
      </View>

      {selectedCount > 0 ? (
        <View style={styles.bulkActionsWrap}>
          <TouchableOpacity
            style={styles.toolsToggleBtn}
            activeOpacity={0.86}
            onPress={() => setShowSelectionTools((prev) => !prev)}
          >
            <View style={styles.toolsToggleLabelRow}>
              <Ionicons name="options-outline" size={16} color={COLORS.gray700} />
              <Text style={styles.toolsToggleLabel}>Selection tools</Text>
            </View>
            <Ionicons
              name={showSelectionTools ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={COLORS.gray500}
            />
          </TouchableOpacity>

          {showSelectionTools ? (
            <>
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
            </>
          ) : null}
        </View>
      ) : null}

      {selectedCount > 0 ? (
      <View style={styles.reviewSummaryCard}>
        <View style={styles.reviewSummaryTopRow}>
          <View>
            <Text style={styles.reviewSummaryTitle}>Review before publish</Text>
            <Text style={styles.reviewSummarySub}>
              Selected items, duplicate checks, and price changes are summarized here before they go live.
            </Text>
          </View>
          <View style={styles.reviewSummaryBadge}>
            <Ionicons name="shield-checkmark-outline" size={13} color={COLORS.primaryDark} />
            <Text style={styles.reviewSummaryBadgeText}>{duplicateCount} duplicates</Text>
          </View>
        </View>

        <View style={styles.reviewSummaryStats}>
          <View style={styles.reviewStat}>
            <Text style={styles.reviewStatValue}>{selectedCount}</Text>
            <Text style={styles.reviewStatLabel}>Selected</Text>
          </View>
          <View style={styles.reviewStat}>
            <Text style={styles.reviewStatValue}>{duplicateCount}</Text>
            <Text style={styles.reviewStatLabel}>Already saved</Text>
          </View>
          <View style={styles.reviewStat}>
            <Text style={styles.reviewStatValue}>{formatPrice(selectedOverrideTotal)}</Text>
            <Text style={styles.reviewStatLabel}>Override total</Text>
          </View>
        </View>

        <View style={styles.reviewSuggestionBlock}>
          <Text style={styles.reviewSuggestionTitle}>Suggested categories</Text>
          <View style={styles.reviewSuggestionRow}>
            {selectedCategorySuggestions.length > 0 ? (
              selectedCategorySuggestions.map((item) => (
                <TouchableOpacity
                  key={item.name}
                  onPress={() => toggleCategory(item.name)}
                  style={styles.reviewSuggestionChip}
                  activeOpacity={0.85}
                >
                  <Text style={styles.reviewSuggestionChipText}>{item.name}</Text>
                  <Text style={styles.reviewSuggestionChipCount}>{item.count}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.reviewSuggestionEmpty}>No categories found in the current selection.</Text>
            )}
          </View>
        </View>

        <View style={styles.reviewSuggestionBlock}>
          <Text style={styles.reviewSuggestionTitle}>Suggested brands</Text>
          <View style={styles.reviewSuggestionRow}>
            {selectedBrandSuggestions.length > 0 ? (
              selectedBrandSuggestions.map((item) => (
                <View key={item.name} style={[styles.reviewSuggestionChip, styles.reviewSuggestionChipMuted]}>
                  <Text style={styles.reviewSuggestionChipText}>{item.name}</Text>
                  <Text style={styles.reviewSuggestionChipCount}>{item.count}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.reviewSuggestionEmpty}>No brands found in the current selection.</Text>
            )}
          </View>
        </View>

        <View style={styles.reviewFooterRow}>
          <Text style={styles.reviewFooterText}>
            {expectedMarginPct == null
              ? 'Apply a margin to selected items to see expected uplift.'
              : `Expected margin: ${expectedMarginPct.toFixed(1)}% based on override pricing.`}
          </Text>
          <TouchableOpacity onPress={openPublishReview} style={styles.reviewButton} activeOpacity={0.86}>
            <Text style={styles.reviewButtonText}>Open publish review</Text>
          </TouchableOpacity>
        </View>
      </View>
      ) : null}

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
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={
          products.length === 0
            ? (selectedCount > 0 ? styles.listEmptyContentWithFooter : styles.listEmptyContent)
            : (selectedCount > 0 ? styles.listContentWithFooter : styles.listContent)
        }
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

      {selectedCount > 0 ? (
        <View style={[styles.footer, { marginBottom: Math.max(insets.bottom + 8, 14) }]}>
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={[styles.addBtn, styles.footerHalfBtn, selectedCount === 0 && styles.addBtnDisabled]}
              disabled={selectedCount === 0 || adding || publishing}
              onPress={handleAddSelected}
            >
              {adding ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="bookmark-outline" size={18} color={COLORS.white} />
                  <Text style={styles.addBtnText}>Save Selection</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.publishBtn, styles.footerHalfBtn, selectedCount === 0 && styles.addBtnDisabled]}
              disabled={selectedCount === 0 || adding || publishing}
              onPress={openPublishReview}
            >
              {publishing ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="rocket-outline" size={18} color={COLORS.white} />
                  <Text style={styles.addBtnText}>Publish to Shop</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {loading && products.length === 0 ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : null}

      <Modal visible={showPublishReview} transparent animationType="fade" onRequestClose={() => setShowPublishReview(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.reviewModal}>
            <View style={styles.reviewModalHeader}>
              <View style={styles.reviewModalIcon}>
                <Ionicons name="file-tray-full-outline" size={18} color={COLORS.primaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewModalTitle}>Publish review</Text>
                <Text style={styles.reviewModalSub}>
                  Confirm the selection before these products are added to your shop catalog.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowPublishReview(false)} style={styles.reviewModalClose}>
                <Ionicons name="close" size={18} color={COLORS.gray600} />
              </TouchableOpacity>
            </View>

            <View style={styles.reviewModalStats}>
              <View style={styles.reviewModalStat}>
                <Text style={styles.reviewModalStatValue}>{selectedCount}</Text>
                <Text style={styles.reviewModalStatLabel}>Products</Text>
              </View>
              <View style={styles.reviewModalStat}>
                <Text style={styles.reviewModalStatValue}>{duplicateCount}</Text>
                <Text style={styles.reviewModalStatLabel}>Existing</Text>
              </View>
              <View style={styles.reviewModalStat}>
                <Text style={styles.reviewModalStatValue}>{formatPrice(selectedOverrideTotal)}</Text>
                <Text style={styles.reviewModalStatLabel}>Total</Text>
              </View>
            </View>

            <View style={styles.reviewModalList}>
              <Text style={styles.reviewModalListTitle}>Selected items</Text>
              {selectedReviewItems.slice(0, 5).map((item) => {
                const deltaPctText =
                  item.priceDeltaPct == null
                    ? 'New'
                    : `${item.priceDelta > 0 ? '+' : ''}${item.priceDeltaPct.toFixed(1)}%`;
                const override = overrides[item.id] || {};
                const dirtyPrice = String(override.price ?? '').trim() !== '' && Number(override.price) !== item.basePrice;
                const dirtyCompare = String(override.compare_price ?? '').trim() !== '';
                const dirtyStock = String(override.stock_quantity ?? '').trim() !== '';
                const riskPills = [];
                if (item.isDuplicate) riskPills.push('Duplicate');
                if (!item.hasImage) riskPills.push('No image');
                if (item.isLargeJump) riskPills.push('Price jump');
                return (
                  <View key={item.id} style={styles.reviewModalItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewModalItemTitle} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.reviewModalItemSub} numberOfLines={1}>
                        {item.brand || 'Generic'} • {item.category}
                      </Text>
                      <View style={styles.reviewModalDiffRow}>
                        <Text style={styles.reviewModalDiffText}>Base {formatPrice(item.basePrice)}</Text>
                        <Ionicons name="chevron-forward" size={12} color={COLORS.gray300} />
                        <Text style={styles.reviewModalDiffTextStrong}>New {formatPrice(item.selectedPrice)}</Text>
                        <Text style={[styles.reviewModalDiffDelta, item.priceDelta > 0 && styles.reviewModalDiffDeltaUp, item.priceDelta < 0 && styles.reviewModalDiffDeltaDown]}>
                          {deltaPctText}
                        </Text>
                      </View>
                      <View style={styles.reviewModalEditRow}>
                        <Text style={styles.reviewModalEditLabel}>Edit price</Text>
                        <TextInput
                          value={override.price ?? ''}
                          onChangeText={(value) => setOverrideField(item.id, 'price', value)}
                          keyboardType="numeric"
                          placeholder={String(item.basePrice || 0)}
                          selectionColor={COLORS.primary}
                          placeholderTextColor={COLORS.gray400}
                          style={[styles.reviewModalEditInput, dirtyPrice && styles.reviewModalEditInputDirty]}
                        />
                        {dirtyPrice ? <Text style={styles.reviewModalEditDirty}>Updated</Text> : null}
                      </View>
                      <View style={styles.reviewModalEditRow}>
                        <Text style={styles.reviewModalEditLabel}>Compare</Text>
                        <TextInput
                          value={override.compare_price ?? ''}
                          onChangeText={(value) => setOverrideField(item.id, 'compare_price', value)}
                          keyboardType="numeric"
                          placeholder="Optional"
                          selectionColor={COLORS.primary}
                          placeholderTextColor={COLORS.gray400}
                          style={[styles.reviewModalEditInput, dirtyCompare && styles.reviewModalEditInputDirty]}
                        />
                        {dirtyCompare ? <Text style={styles.reviewModalEditDirty}>Updated</Text> : null}
                      </View>
                      <View style={styles.reviewModalEditRow}>
                        <Text style={styles.reviewModalEditLabel}>Stock</Text>
                        <TextInput
                          value={override.stock_quantity ?? ''}
                          onChangeText={(value) => setOverrideField(item.id, 'stock_quantity', value)}
                          keyboardType="number-pad"
                          placeholder="Qty"
                          selectionColor={COLORS.primary}
                          placeholderTextColor={COLORS.gray400}
                          style={[styles.reviewModalEditInput, dirtyStock && styles.reviewModalEditInputDirty]}
                        />
                        {dirtyStock ? <Text style={styles.reviewModalEditDirty}>Updated</Text> : null}
                      </View>
                      {riskPills.length > 0 ? (
                        <View style={styles.reviewModalRiskRow}>
                          {riskPills.map((pill) => (
                            <View key={pill} style={styles.reviewModalRiskPill}>
                              <Text style={styles.reviewModalRiskPillText}>{pill}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.reviewModalItemMeta}>
                      <Text style={styles.reviewModalItemPrice}>{formatPrice(item.selectedPrice)}</Text>
                      <Text style={[styles.reviewModalItemFlag, item.isDuplicate && styles.reviewModalItemFlagActive]}>
                        {item.isDuplicate ? 'Already saved' : 'New'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.reviewModalWarning}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.primaryDark} />
              <Text style={styles.reviewModalWarningText}>
                {loadingSelections
                  ? 'Checking existing shop selections...'
                  : riskyReviewCount > 0
                    ? `${reviewRiskCounts.duplicates} duplicates, ${reviewRiskCounts.emptyImages} missing images, and ${reviewRiskCounts.priceJumps} large price changes detected.`
                    : 'No risky changes detected in the current selection.'}
              </Text>
            </View>

            <View style={styles.reviewModalActions}>
              <TouchableOpacity
                onPress={() => setShowPublishReview(false)}
                style={[styles.reviewModalBtn, styles.reviewModalBtnSecondary]}
                activeOpacity={0.86}
              >
                <Text style={styles.reviewModalBtnSecondaryText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePublishSelected}
                style={[styles.reviewModalBtn, styles.reviewModalBtnPrimary]}
                activeOpacity={0.86}
                disabled={publishing}
              >
                {publishing ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.reviewModalBtnPrimaryText}>Publish now</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  heroCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 22,
    backgroundColor: '#F7F5FF',
    borderWidth: 1,
    borderColor: '#E5DEFF',
    ...SHADOWS.card,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    color: COLORS.primary,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
    color: COLORS.gray900,
    maxWidth: 260,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  heroStat: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  heroStatValue: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.gray900,
  },
  heroStatLabel: {
    marginTop: 2,
    fontSize: 11,
    color: COLORS.gray500,
    fontWeight: '600',
  },
  heroHint: {
    marginTop: 12,
    fontSize: 12,
    color: COLORS.gray600,
    lineHeight: 18,
    fontWeight: '600',
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
    marginTop: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.gray100,
    ...SHADOWS.card,
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  infoSub: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.gray500,
    marginTop: 2,
  },
  recommendedWrap: {
    marginTop: 6,
  },
  recommendedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  recommendedHeaderTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  recommendedHeaderSub: {
    marginTop: 3,
    fontSize: 11,
    color: COLORS.gray500,
    fontWeight: '600',
  },
  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F2EEFF',
    borderWidth: 1,
    borderColor: '#DCCFFB',
  },
  recommendedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  recommendedLead: {
    marginHorizontal: 16,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#FBFAFF',
    borderWidth: 1,
    borderColor: '#ECE7FD',
  },
  recommendedLeadText: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.gray600,
    fontWeight: '600',
  },
  recommendedRow: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 2,
  },
  recommendedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    backgroundColor: '#FBFAFF',
  },
  recommendedChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  recommendedChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  recommendedChipTextActive: {
    color: COLORS.white,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
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
  sectionActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkBtn: {
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  linkBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primaryDark,
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
    height: 36,
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
    marginTop: 10,
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
    marginBottom: 6,
    gap: 8,
  },
  toolsToggleBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolsToggleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolsToggleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.gray700,
  },
  reviewSummaryCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FBFAFF',
    borderWidth: 1,
    borderColor: '#E9E2FF',
    ...SHADOWS.card,
  },
  reviewSummaryTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  reviewSummaryTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.gray900,
  },
  reviewSummarySub: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.gray500,
    fontWeight: '600',
    maxWidth: 250,
  },
  reviewSummaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F2EEFF',
    borderWidth: 1,
    borderColor: '#DCCFFB',
  },
  reviewSummaryBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  reviewSummaryStats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  reviewStat: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  reviewStatValue: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.gray900,
  },
  reviewStatLabel: {
    marginTop: 2,
    fontSize: 11,
    color: COLORS.gray500,
    fontWeight: '600',
  },
  reviewSuggestionBlock: {
    marginTop: 12,
  },
  reviewSuggestionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.gray700,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  reviewSuggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reviewSuggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#E4DEF8',
  },
  reviewSuggestionChipMuted: {
    backgroundColor: '#FBFAFF',
  },
  reviewSuggestionChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.gray800,
  },
  reviewSuggestionChipCount: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  reviewSuggestionEmpty: {
    fontSize: 12,
    color: COLORS.gray500,
    fontWeight: '600',
  },
  reviewFooterRow: {
    marginTop: 12,
    gap: 10,
  },
  reviewFooterText: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.gray600,
    fontWeight: '600',
  },
  reviewButton: {
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  reviewButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.gray800,
  },
  bulkSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
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
    height: 44,
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
    height: 44,
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
    paddingBottom: 28,
    gap: 10,
  },
  listContentWithFooter: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 160,
    gap: 10,
  },
  listEmptyContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 28,
  },
  listEmptyContentWithFooter: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 160,
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 13,
    borderWidth: 1,
    borderColor: '#ECEAF8',
    ...SHADOWS.card,
  },
  cardSelected: {
    borderColor: '#CDBFF8',
    backgroundColor: '#F8F4FF',
  },
  imageWrap: {
    width: 90,
    height: 90,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.primaryLight,
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
    marginTop: 5,
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
    color: COLORS.primaryDark,
  },
  sourcePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F2EEFF',
  },
  sourcePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primaryDark,
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
    borderTopColor: '#EEEAFB',
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E1F8',
    backgroundColor: '#FCFBFF',
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
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
  },
  footerRow: {
    flexDirection: 'column',
    gap: 10,
  },
  footerHalfBtn: {
    flex: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.green,
    ...SHADOWS.card,
  },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.blue,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.42)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  reviewModal: {
    borderRadius: 22,
    backgroundColor: COLORS.white,
    padding: 16,
    ...SHADOWS.cardHover,
  },
  reviewModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  reviewModalIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
  },
  reviewModalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.gray900,
  },
  reviewModalSub: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.gray500,
    fontWeight: '600',
  },
  reviewModalClose: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray100,
  },
  reviewModalStats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  reviewModalStat: {
    flex: 1,
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#FBFAFF',
    borderWidth: 1,
    borderColor: '#E9E2FF',
  },
  reviewModalStatValue: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.gray900,
  },
  reviewModalStatLabel: {
    marginTop: 2,
    fontSize: 11,
    color: COLORS.gray500,
    fontWeight: '600',
  },
  reviewModalList: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  reviewModalListTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.gray700,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  reviewModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  reviewModalItemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.gray900,
  },
  reviewModalItemSub: {
    marginTop: 2,
    fontSize: 11,
    color: COLORS.gray500,
    fontWeight: '600',
  },
  reviewModalDiffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  reviewModalDiffText: {
    fontSize: 11,
    color: COLORS.gray500,
    fontWeight: '600',
  },
  reviewModalDiffTextStrong: {
    fontSize: 11,
    color: COLORS.gray800,
    fontWeight: '800',
  },
  reviewModalDiffDelta: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.gray400,
  },
  reviewModalDiffDeltaUp: {
    color: COLORS.green,
  },
  reviewModalDiffDeltaDown: {
    color: COLORS.blue,
  },
  reviewModalEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  reviewModalEditLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gray600,
    textTransform: 'uppercase',
  },
  reviewModalEditInput: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E1F8',
    backgroundColor: '#FCFBFF',
    paddingHorizontal: 10,
    fontSize: 12,
    color: COLORS.gray800,
    fontWeight: '700',
  },
  reviewModalEditInputDirty: {
    borderColor: COLORS.primary,
    backgroundColor: '#F7F5FF',
  },
  reviewModalEditDirty: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primaryDark,
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  reviewModalRiskRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  reviewModalRiskPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFF6E8',
    borderWidth: 1,
    borderColor: '#F6D19A',
  },
  reviewModalRiskPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.amber,
    textTransform: 'uppercase',
  },
  reviewModalItemMeta: {
    alignItems: 'flex-end',
  },
  reviewModalItemPrice: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  reviewModalItemFlag: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.gray400,
    textTransform: 'uppercase',
  },
  reviewModalItemFlagActive: {
    color: COLORS.amber,
  },
  reviewModalWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
  },
  reviewModalWarningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.gray700,
    fontWeight: '600',
  },
  reviewModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  reviewModalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewModalBtnSecondary: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  reviewModalBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.gray700,
  },
  reviewModalBtnPrimary: {
    backgroundColor: COLORS.primary,
  },
  reviewModalBtnPrimaryText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.white,
  },
});
