import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  Animated,
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
    return Math.max(1, Math.min(50, parsed));
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

        map.set(key, normalized);
      });
    };

    if (user) add(personalized, 'personalized');
    add(trending, 'trending');
    add(globalProducts, 'global');

    return Array.from(map.values());
  }, [user, personalized, trending, globalProducts, selectedCategory]);

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
            <View style={styles.backBtnGhost} />
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
});
