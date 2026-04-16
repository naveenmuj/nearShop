import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  Animated,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import useAuthStore from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import { searchProducts } from '../../lib/products';
import { getCFRecommendations, getRecommendations as getAIRecommendations, getTrendingProducts } from '../../lib/api/ai';
import ProductCard from '../../components/ProductCard';
import { COLORS, SHADOWS } from '../../constants/theme';

const CATEGORIES = ['All', 'Grocery', 'Electronics', 'Clothing', 'Food', 'Beauty', 'Home'];

function normalizeCategory(value) {
  return value && value !== 'All' ? String(value) : 'All';
}

function normalizeProduct(item = {}, source = 'global') {
  return {
    ...item,
    type: 'product',
    reason: item.reason || (source === 'personalized' ? 'ai_match' : source === 'trending' ? 'trending' : 'new_arrival'),
    image_url: item.image_url || item.images?.[0] || null,
    images: Array.isArray(item.images) ? item.images : (item.image_url ? [item.image_url] : []),
    ranking_context: {
      ...(item.ranking_context || {}),
      source,
    },
  };
}

export default function ProductsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuthStore();
  const { lat, lng, address, preferredRadiusKm } = useLocationStore();

  const [personalized, setPersonalized] = useState([]);
  const [trending, setTrending] = useState([]);
  const [globalProducts, setGlobalProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(normalizeCategory(params?.category));

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(50000);
  const [minRating, setMinRating] = useState(0);
  const [inStockOnly, setInStockOnly] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    setSelectedCategory(normalizeCategory(params?.category));
  }, [params?.category]);

  const nearbyRadiusKm = useMemo(() => {
    const parsed = Number(preferredRadiusKm);
    if (!Number.isFinite(parsed)) return 5;
    return Math.max(1, Math.min(50, Math.round(parsed)));
  }, [preferredRadiusKm]);

  const loadProducts = useCallback(async () => {
    const reqs = [
      getTrendingProducts(lat, lng, { limit: 40, radius_km: nearbyRadiusKm }),
      searchProducts({ lat, lng, radius_km: nearbyRadiusKm, per_page: 80, sort: 'newest' }),
    ];

    if (user) {
      reqs.push(getAIRecommendations({ lat, lng, limit: 30, radius_km: nearbyRadiusKm }));
      reqs.push(getCFRecommendations(lat, lng, { limit: 30, radius_km: nearbyRadiusKm }));
    }

    const [trendingRes, globalRes, aiRes, cfRes] = await Promise.allSettled(reqs);

    if (trendingRes.status === 'fulfilled') {
      setTrending(trendingRes.value?.data?.products ?? []);
    } else {
      setTrending([]);
    }

    if (globalRes.status === 'fulfilled') {
      setGlobalProducts(globalRes.value?.data?.items ?? globalRes.value?.data ?? []);
    } else {
      setGlobalProducts([]);
    }

    if (user) {
      const mergedPersonalized = [];
      if (aiRes?.status === 'fulfilled') {
        mergedPersonalized.push(...(aiRes.value?.data?.products ?? []));
      }
      if (cfRes?.status === 'fulfilled') {
        mergedPersonalized.push(...(cfRes.value?.data?.products ?? []));
      }
      setPersonalized(mergedPersonalized);
    } else {
      setPersonalized([]);
    }
  }, [lat, lng, user, nearbyRadiusKm]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadProducts()
      .catch(() => {
        if (!cancelled) {
          setTrending([]);
          setGlobalProducts([]);
          setPersonalized([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadProducts]);

  const fullFeed = useMemo(() => {
    const map = new Map();

    const add = (items = [], source = 'global') => {
      items.forEach((item) => {
        if (!item?.id) return;
        const key = String(item.id);
        if (map.has(key)) return;

        const normalized = normalizeProduct(item, source);
        const category = String(normalized?.category || '');
        if (selectedCategory !== 'All' && category.toLowerCase() !== selectedCategory.toLowerCase()) {
          return;
        }

        // Apply filters - ensure free products show when minPrice is 0
        const price = Number(normalized?.price ?? 0);
        if (price > 0 && (price < minPrice || price > maxPrice)) return;
        if (price === 0 && minPrice > 0) return; // Hide free items if minPrice > 0

        const rating = Number(normalized?.rating || 0);
        if (rating < minRating) return;

        if (inStockOnly && !normalized?.is_available) return;

        map.set(key, normalized);
      });
    };

    if (user) add(personalized, 'personalized');
    add(trending, 'trending');
    add(globalProducts, 'global');

    return Array.from(map.values());
  }, [user, personalized, trending, globalProducts, selectedCategory, minPrice, maxPrice, minRating, inStockOnly]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProducts().catch(() => {});
    setRefreshing(false);
  }, [loadProducts]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
              <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.heroTitle}>All Products</Text>
            <View style={styles.filterBtnWrapper}>
              <TouchableOpacity 
                style={styles.filterBtn} 
                onPress={() => setShowFilters(true)} 
                activeOpacity={0.8}
              >
                <Text style={styles.filterBtnText}>🔧</Text>
              </TouchableOpacity>
              {(minPrice > 0 || maxPrice < 50000 || minRating > 0 || inStockOnly) && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>
                    {[minPrice > 0 ? 1 : 0, maxPrice < 50000 ? 1 : 0, minRating > 0 ? 1 : 0, inStockOnly ? 1 : 0].filter(Boolean).length}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <Text style={styles.heroSubtitle} numberOfLines={1}>{address || 'Current location'}</Text>
          <Text style={styles.heroDesc}>
            {user
              ? 'Personalized picks first, then trending and fresh local products.'
              : 'Trending and fresh local products around you.'}
          </Text>
        </View>

        <FlatList
          data={CATEGORIES}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
          renderItem={({ item }) => {
            const active = selectedCategory === item;
            return (
              <TouchableOpacity
                style={[styles.categoryPill, active && styles.categoryPillActive]}
                onPress={() => setSelectedCategory(item)}
                activeOpacity={0.8}
              >
                <Text style={[styles.categoryPillText, active && styles.categoryPillTextActive]}>{item}</Text>
              </TouchableOpacity>
            );
          }}
        />

        <FlatList
          data={fullFeed}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.columnWrap}
          contentContainerStyle={styles.productsList}
          showsVerticalScrollIndicator={false}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          )}
          renderItem={({ item }) => (
            <View style={styles.productWrap}>
              <ProductCard
                product={item}
                tracking={{
                  ranking_surface: 'products_screen',
                  source_screen: 'all_products_screen',
                  ranking_reason: item.reason,
                }}
              />
            </View>
          )}
          ListEmptyComponent={!loading ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No products found</Text>
              <Text style={styles.emptySub}>Try another category to discover more.</Text>
            </View>
          ) : null}
        />
      </Animated.View>

      {/* Filter Modal */}
      <Modal visible={showFilters} transparent animationType="slide">
        <View style={styles.filterModalOverlay}>
          <View style={styles.filterModal}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filters</Text>
              <Pressable onPress={() => setShowFilters(false)} hitSlop={8}>
                <Text style={styles.filterClose}>✕</Text>
              </Pressable>
            </View>

            {/* Price Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Price Range</Text>
              <View style={styles.filterPriceRow}>
                <Text style={styles.filterLabel}>₹{minPrice}</Text>
                <Text style={styles.filterLabel}>₹{maxPrice}</Text>
              </View>
              <View style={styles.filterSliderRow}>
                <TouchableOpacity 
                  style={styles.filterPriceBtn}
                  onPress={() => setMinPrice(Math.max(0, minPrice - 1000))}
                >
                  <Text style={styles.filterPriceBtnText}>−</Text>
                </TouchableOpacity>
                <View style={styles.filterSlider} />
                <TouchableOpacity 
                  style={styles.filterPriceBtn}
                  onPress={() => setMaxPrice(Math.min(100000, maxPrice + 1000))}
                >
                  <Text style={styles.filterPriceBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Rating Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Minimum Rating</Text>
              <View style={styles.filterRatingRow}>
                {[0, 2, 3, 4, 4.5].map((rating) => (
                  <Pressable
                    key={rating}
                    style={[
                      styles.filterRatingChip,
                      minRating === rating && styles.filterRatingChipActive
                    ]}
                    onPress={() => setMinRating(rating)}
                  >
                    <Text style={[
                      styles.filterRatingText,
                      minRating === rating && styles.filterRatingTextActive
                    ]}>
                      {rating === 0 ? 'All' : `${rating}⭐`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Availability Filter */}
            <View style={styles.filterSection}>
              <Pressable 
                style={styles.filterCheckbox}
                onPress={() => setInStockOnly(!inStockOnly)}
              >
                <Text style={styles.filterCheckboxBox}>
                  {inStockOnly ? '☑' : '☐'}
                </Text>
                <Text style={styles.filterCheckboxLabel}>In Stock Only</Text>
              </Pressable>
            </View>

            {/* Action Buttons */}
            <View style={styles.filterActions}>
              <Pressable 
                style={styles.filterResetBtn}
                onPress={() => {
                  setMinPrice(0);
                  setMaxPrice(50000);
                  setMinRating(0);
                  setInStockOnly(false);
                }}
              >
                <Text style={styles.filterResetBtnText}>Reset</Text>
              </Pressable>
              <Pressable 
                style={styles.filterApplyBtn}
                onPress={() => setShowFilters(false)}
              >
                <Text style={styles.filterApplyBtnText}>Apply Filters</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.gray50,
  },
  hero: {
    backgroundColor: '#EAF6FF',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...SHADOWS.card,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnGhost: {
    width: 34,
    height: 34,
  },
  filterBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnText: {
    fontSize: 18,
  },
  filterBtnWrapper: {
    position: 'relative',
    width: 34,
    height: 34,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },
  backBtnText: {
    fontSize: 20,
    color: COLORS.gray800,
    marginTop: -1,
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.gray900,
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.gray600,
  },
  heroDesc: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.gray700,
    lineHeight: 18,
  },
  categoriesList: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 8,
  },
  categoryPill: {
    backgroundColor: COLORS.white,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  categoryPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryPillText: {
    color: COLORS.gray600,
    fontSize: 12,
    fontWeight: '700',
  },
  categoryPillTextActive: {
    color: COLORS.white,
  },
  productsList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  columnWrap: {
    gap: 12,
  },
  productWrap: {
    flex: 1,
    marginBottom: 12,
  },
  emptyWrap: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    marginTop: 12,
    paddingVertical: 24,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gray800,
  },
  emptySub: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.gray500,
  },
  // Filter Modal Styles
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  filterClose: {
    fontSize: 24,
    color: COLORS.gray600,
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  filterSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.gray800,
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray700,
  },
  filterPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  filterSliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterPriceBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPriceBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
  },
  filterSlider: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.gray200,
    borderRadius: 2,
  },
  filterRatingRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterRatingChip: {
    backgroundColor: COLORS.gray100,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
  },
  filterRatingChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterRatingText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray700,
  },
  filterRatingTextActive: {
    color: COLORS.white,
  },
  filterCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterCheckboxBox: {
    fontSize: 20,
  },
  filterCheckboxLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray800,
  },
  filterActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  filterResetBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: COLORS.gray300,
    alignItems: 'center',
  },
  filterResetBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.gray700,
  },
  filterApplyBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  filterApplyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
});
