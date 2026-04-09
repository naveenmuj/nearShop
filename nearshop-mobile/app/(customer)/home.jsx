import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  StatusBar,
  Pressable,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useEffect, useCallback, useMemo } from 'react';

import useAuthStore from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import useCartStore from '../../store/cartStore';
import { getNearbyShops } from '../../lib/shops';
import { searchProducts } from '../../lib/products';
import { getNearbyDeals } from '../../lib/deals';
import { getStoriesFeed } from '../../lib/stories';
import {
  getCFRecommendations,
  getRecommendations as getAIRecommendations,
  getTrendingProducts,
} from '../../lib/api/ai';
import StoryCircle from '../../components/StoryCircle';
import ShopCard from '../../components/ShopCard';
import ProductCard from '../../components/ProductCard';
import DealCard from '../../components/DealCard';
import LocationPicker from '../../components/LocationPicker';
import RecentlyViewed from '../../components/RecentlyViewed';
import LocationFallbackBanner from '../../components/LocationFallbackBanner';
import { HomeScreenSkeleton } from '../../components/ui/ScreenSkeletons';
import { COLORS, SHADOWS } from '../../constants/theme';
import { getRankingReasonLabel, getRankingReasonTone } from '../../lib/ranking';
import { rankingRouteParams, trackRankingClick, trackRankingImpressions } from '../../lib/rankingTracking';
import { distanceKm, formatDistance } from '../../lib/distance';
import { getUnreadCount } from '../../lib/notifications';

const CATEGORIES = [
  { label: 'All', value: '' },
  { label: 'Grocery', value: 'Grocery' },
  { label: 'Electronics', value: 'Electronics' },
  { label: 'Clothing', value: 'Clothing' },
  { label: 'Food', value: 'Food' },
  { label: 'Beauty', value: 'Beauty' },
  { label: 'Home', value: 'Home' },
];

function getReasonBadgeStyle(reason) {
  const tone = getRankingReasonTone(reason);
  return {
    backgroundColor: tone.backgroundColor,
    color: tone.textColor,
  };
}

function normalizeGridProduct(item = {}, source = 'global') {
  const image = item.image_url || item.images?.[0] || null;
  return {
    ...item,
    type: 'product',
    images: Array.isArray(item.images) && item.images.length > 0 ? item.images : (image ? [image] : []),
    image_url: image,
    reason: item.reason || (source === 'personalized' ? 'ai_match' : source === 'trending' ? 'trending' : 'new_arrival'),
    ranking_context: {
      ...(item.ranking_context || {}),
      source,
    },
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    lat,
    lng,
    address,
    error: locationError,
    refreshLocation,
    preferredRadiusKm,
  } = useLocationStore();
  const cartCount = useCartStore((state) => state.getItemCount());
  const initializeCart = useCartStore((state) => state.initialize);

  const [stories, setStories] = useState([]);
  const [deals, setDeals] = useState([]);
  const [shops, setShops] = useState([]);
  const [products, setProducts] = useState([]);
  const [forYouRecs, setForYouRecs] = useState([]);
  const [trending, setTrending] = useState([]);
  const [cfRecs, setCfRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const combinedRecommendations = useMemo(() => {
    const merged = new Map();

    const addItems = (items = [], source) => {
      items.forEach((item) => {
        const key = `${item.type || 'product'}-${item.id}`;
        const normalized = {
          ...item,
          recommendation_source: item.recommendation_source || source,
          image_url: item.image_url || item.images?.[0] || null,
        };

        const existing = merged.get(key);
        if (!existing) {
          merged.set(key, normalized);
          return;
        }

        merged.set(key, {
          ...existing,
          ...normalized,
          recommendation_source:
            existing.recommendation_source === normalized.recommendation_source
              ? existing.recommendation_source
              : 'both',
        });
      });
    };

    addItems(forYouRecs, 'ai');
    addItems(cfRecs, 'ml');

    return Array.from(merged.values()).slice(0, 12);
  }, [forYouRecs, cfRecs]);

  const nearbyShops = useMemo(() => {
    const filtered = Array.isArray(shops)
      ? shops.filter((shop) => {
          if (!selectedCategory) return true;
          return String(shop?.category || '').toLowerCase() === selectedCategory.toLowerCase();
        })
      : [];

    return filtered
      .map((shop) => {
        const liveDistance = distanceKm(lat, lng, shop?.latitude, shop?.longitude);
        const fallbackDistance = Number(shop?.distance_km);
        const normalizedDistance = Number.isFinite(liveDistance)
          ? liveDistance
          : (Number.isFinite(fallbackDistance) ? fallbackDistance : null);
        return {
          ...shop,
          live_distance_km: normalizedDistance,
          live_distance_label: formatDistance(normalizedDistance),
        };
      })
      .slice()
      .sort((a, b) => Number(a?.live_distance_km ?? 9999) - Number(b?.live_distance_km ?? 9999))
      .slice(0, 12);
  }, [shops, selectedCategory, lat, lng]);

  // Hybrid strategy: personalized products first, then trending, then fresh global catalog.
  const homeGridProducts = useMemo(() => {
    const byId = new Map();

    const add = (items = [], source) => {
      items.forEach((item) => {
        if (!item?.id) return;
        const key = String(item.id);
        if (byId.has(key)) return;

        const normalized = normalizeGridProduct(item, source);
        if (
          selectedCategory
          && String(normalized?.category || '').toLowerCase() !== selectedCategory.toLowerCase()
        ) {
          return;
        }
        byId.set(key, normalized);
      });
    };

    if (user) {
      add(
        combinedRecommendations.filter((item) => (item?.type || 'product') === 'product'),
        'personalized'
      );
    }
    add(trending, 'trending');
    add(products, 'global');

    return Array.from(byId.values()).slice(0, 20);
  }, [user, combinedRecommendations, trending, products, selectedCategory]);

  const productRows = useMemo(() => {
    const rows = [];
    for (let i = 0; i < homeGridProducts.length; i += 2) {
      rows.push(homeGridProducts.slice(i, i + 2));
    }
    return rows;
  }, [homeGridProducts]);

  const nearbyRadiusKm = useMemo(() => {
    const parsed = Number(preferredRadiusKm);
    if (!Number.isFinite(parsed)) return 5;
    return Math.max(1, Math.min(50, parsed));
  }, [preferredRadiusKm]);

  const loadData = useCallback(async () => {
    setError(null);

    const mapAIProducts = (items = []) =>
      items.map((item) => ({
        ...item,
        type: 'product',
        image_url: item.images?.[0] ?? null,
        reason: item.reason ?? 'ai_match',
      }));

    const requests = [
      getStoriesFeed(),
      getNearbyDeals(lat, lng),
      getNearbyShops(lat, lng, { radius_km: nearbyRadiusKm }),
      searchProducts({ sort: 'newest', per_page: 30, lat, lng, radius_km: nearbyRadiusKm }),
      getTrendingProducts(lat, lng, { limit: 14, radius_km: nearbyRadiusKm }),
    ];

    if (user) {
      requests.push(getAIRecommendations({ lat, lng, limit: 12, radius_km: nearbyRadiusKm }));
      requests.push(getCFRecommendations(lat, lng, { limit: 12, radius_km: nearbyRadiusKm }));
    }

    const results = await Promise.allSettled(requests);
    const [storiesRes, dealsRes, shopsRes, productsRes, trendingRes, recsRes, cfRes] = results;

    const allFailed =
      storiesRes.status === 'rejected'
      && dealsRes.status === 'rejected'
      && shopsRes.status === 'rejected'
      && productsRes.status === 'rejected'
      && trendingRes.status === 'rejected';

    if (allFailed) {
      setError('Failed to load content. Check your internet connection.');
      return;
    }

    if (storiesRes.status === 'fulfilled') {
      setStories((storiesRes.value?.data?.items ?? []).slice(0, 8));
    }
    if (dealsRes.status === 'fulfilled') {
      setDeals(dealsRes.value?.data?.items ?? []);
    }
    if (shopsRes.status === 'fulfilled') {
      setShops(shopsRes.value?.data?.items ?? []);
    }
    if (productsRes.status === 'fulfilled') {
      setProducts(productsRes.value?.data?.items ?? productsRes.value?.data ?? []);
    }
    if (trendingRes.status === 'fulfilled') {
      setTrending(trendingRes.value?.data?.products ?? []);
    }

    if (user && recsRes?.status === 'fulfilled') {
      setForYouRecs(mapAIProducts(recsRes.value?.data?.products ?? []));
    }
    if (user && cfRes?.status === 'fulfilled') {
      setCfRecs(cfRes.value?.data?.products ?? []);
    }
  }, [lat, lng, user, nearbyRadiusKm]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadData().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  useEffect(() => {
    if (user && combinedRecommendations.length > 0) {
      trackRankingImpressions(combinedRecommendations, {
        ranking_surface: 'combined_recommendations',
        source_screen: 'home_recommendations',
      });
    }
  }, [user, combinedRecommendations]);

  useEffect(() => {
    if (homeGridProducts.length > 0) {
      trackRankingImpressions(homeGridProducts, {
        ranking_surface: 'home_grid',
        source_screen: 'home_products_grid',
      });
    }
  }, [homeGridProducts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadData(), (async () => {
      try {
        const response = await getUnreadCount();
        const count = Number(response?.data?.unread_count ?? 0);
        setUnreadNotificationCount(Number.isFinite(count) ? Math.max(0, count) : 0);
      } catch {
        setUnreadNotificationCount(0);
      }
    })()]);
    setRefreshing(false);
  }, [loadData]);

  const loadUnreadNotificationCount = useCallback(async () => {
    try {
      const response = await getUnreadCount();
      const count = Number(response?.data?.unread_count ?? 0);
      setUnreadNotificationCount(Number.isFinite(count) ? Math.max(0, count) : 0);
    } catch {
      setUnreadNotificationCount(0);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUnreadNotificationCount();
    }, [loadUnreadNotificationCount])
  );

  useEffect(() => {
    initializeCart().catch(() => {});
  }, [initializeCart]);

  const handleStoryPress = (story) => {
    router.push(`/(customer)/shop/${story.shop_id}`);
  };

  if (loading) {
    return <HomeScreenSkeleton />;
  }

  const firstName = user?.name ? String(user.name).split(' ')[0] : 'there';
  const locality = address || 'Locating...';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        )}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Hi, {firstName} 👋</Text>
            <Pressable
              style={styles.locationRow}
              onPress={() => setShowLocationPicker(true)}
              accessibilityLabel="Change location"
            >
              <Text style={styles.locationPin}>📍</Text>
              <Text style={styles.locationText} numberOfLines={1}>{locality}</Text>
              <Text style={styles.locationChevron}>▾</Text>
            </Pressable>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={({ pressed }) => [styles.cartBtn, pressed && styles.notifBtnPressed]}
              onPress={() => router.push('/(customer)/cart')}
              accessibilityLabel="Cart"
            >
              <Text style={styles.notifIcon}>🛒</Text>
              {cartCount > 0 ? (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.notifBtn, pressed && styles.notifBtnPressed]}
              onPress={() => router.push('/(customer)/notifications')}
              accessibilityLabel="Notifications"
            >
              <Text style={styles.notifIcon}>🔔</Text>
              {unreadNotificationCount > 0 ? (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <LocationFallbackBanner
          visible={Boolean(locationError)}
          message="Nearby deals, delivery zones, and recommendations may be less accurate without precise location."
          onRetry={async () => {
            await refreshLocation();
          }}
        />

        {stories.length > 0 ? (
          <View style={styles.storiesSection}>
            <FlatList
              data={stories}
              keyExtractor={(item) => String(item.id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.storiesList}
              renderItem={({ item }) => (
                <StoryCircle story={item} onPress={() => handleStoryPress(item)} />
              )}
            />
          </View>
        ) : null}

        <Pressable
          style={styles.searchBar}
          onPress={() => router.push('/(customer)/search')}
          accessibilityLabel="Search products and shops"
          accessibilityRole="search"
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Search products, shops...</Text>
        </Pressable>

        {user && combinedRecommendations.length > 0 ? (
          <View style={styles.forYouSection}>
            <View style={styles.forYouGradient}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Recommended for you</Text>
                  <Text style={styles.sectionSubTitle}>AI + shoppers with similar activity</Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push('/(customer)/search')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.seeAll}>See all</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={combinedRecommendations}
                keyExtractor={(item) => `${item.type}-${item.id}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.forYouList}
                ItemSeparatorComponent={() => <View style={styles.shopSeparator} />}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={styles.forYouCard}
                    activeOpacity={0.8}
                    onPress={() => {
                      if (item.type === 'shop') {
                        router.push(`/(customer)/shop/${item.id}`);
                        return;
                      }
                      trackRankingClick(item, {
                        ranking_surface: 'combined_recommendations',
                        source_screen: 'home_recommendations',
                        position: index + 1,
                      });
                      router.push({
                        pathname: `/(customer)/product/${item.id}`,
                        params: rankingRouteParams({
                          ranking_surface: 'combined_recommendations',
                          source_screen: 'home_recommendations',
                          ranking_reason: item.reason,
                          position: index + 1,
                        }),
                      });
                    }}
                  >
                    <View style={styles.forYouImageWrap}>
                      {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={styles.forYouImage} />
                      ) : (
                        <View style={styles.forYouImagePlaceholder}>
                          <Text style={styles.forYouImageEmoji}>{item.type === 'shop' ? '🏪' : '📦'}</Text>
                        </View>
                      )}
                      <View
                        style={[
                          styles.forYouBadge,
                          { backgroundColor: getReasonBadgeStyle(item.reason).backgroundColor },
                        ]}
                      >
                        <Text
                          style={[
                            styles.forYouBadgeText,
                            { color: getReasonBadgeStyle(item.reason).color },
                          ]}
                        >
                          {item.type === 'shop' ? 'Shop' : getRankingReasonLabel(item.reason)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.forYouCardContent}>
                      <Text style={styles.forYouCardName} numberOfLines={1}>{item.name}</Text>
                      {item.price ? <Text style={styles.forYouCardPrice}>₹{item.price}</Text> : null}
                      {item.shop_name ? (
                        <Text style={styles.forYouCardShop} numberOfLines={1}>{item.shop_name}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Browse by category</Text>
            {selectedCategory ? (
              <TouchableOpacity onPress={() => setSelectedCategory('')} activeOpacity={0.7}>
                <Text style={styles.seeAll}>Clear</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <FlatList
            data={CATEGORIES}
            keyExtractor={(item) => item.label}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
            renderItem={({ item }) => {
              const active = selectedCategory === item.value;
              return (
                <TouchableOpacity
                  style={[styles.categoryPill, active && styles.categoryPillActive]}
                  onPress={() => setSelectedCategory(item.value)}
                  activeOpacity={0.78}
                >
                  <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {nearbyShops.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Shops near you</Text>
                <Text style={styles.sectionSubTitle}>
                  Within {nearbyRadiusKm} km: distance, rating, open status, and delivery badges
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push({
                  pathname: '/(customer)/shops',
                  params: selectedCategory ? { category: selectedCategory } : {},
                })}
                activeOpacity={0.7}
              >
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={nearbyShops}
              keyExtractor={(item) => String(item.id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shopsList}
              ItemSeparatorComponent={() => <View style={styles.shopSeparator} />}
              renderItem={({ item }) => (
                <View style={styles.shopCardWrap}>
                  <ShopCard
                    shop={item}
                    showDelivery
                    forceEqualHeight
                    distance={item.live_distance_km}
                    distanceLabel={item.live_distance_label}
                    showLocationText
                  />
                </View>
              )}
            />
          </View>
        ) : null}

        <RecentlyViewed />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Shop products</Text>
              <Text style={styles.sectionSubTitle}>
                {user
                  ? 'Personalized picks first, then trending and fresh local products'
                  : 'Trending and fresh local products for everyone'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push({
                pathname: '/(customer)/products',
                params: selectedCategory ? { category: selectedCategory } : {},
              })}
              activeOpacity={0.7}
            >
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.productGrid}>
            {productRows.map((row, rowIdx) => (
              <View key={`row-${rowIdx}`} style={styles.productRow}>
                {row.map((item) => (
                  <View key={String(item.id)} style={styles.productCardWrap}>
                    <ProductCard
                      product={item}
                      tracking={{
                        ranking_surface: 'home_grid',
                        source_screen: 'home_products_grid',
                        ranking_reason: item.reason,
                      }}
                    />
                  </View>
                ))}
                {row.length === 1 ? <View style={styles.productCardWrap} /> : null}
              </View>
            ))}
            {productRows.length === 0 ? (
              <View style={styles.emptyProductsWrap}>
                <Text style={styles.emptyProductsText}>No products found for this category yet.</Text>
              </View>
            ) : null}
          </View>
        </View>

        {deals.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Hot deals 🔥</Text>
              <TouchableOpacity onPress={() => router.push('/(customer)/deals')} activeOpacity={0.7}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={deals}
              keyExtractor={(item) => String(item.id || item.product_id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dealsList}
              ItemSeparatorComponent={() => <View style={styles.dealSeparator} />}
              renderItem={({ item }) => (
                <View style={styles.dealCardWrap}>
                  <DealCard deal={item} />
                </View>
              )}
            />
          </View>
        ) : null}

        <View style={styles.bottomSpacing} />
      </ScrollView>

      <LocationPicker
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scroll: {
    flex: 1,
    backgroundColor: COLORS.gray100,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    ...SHADOWS.card,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.gray900,
    lineHeight: 28,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  locationPin: {
    fontSize: 13,
    marginRight: 3,
  },
  locationText: {
    fontSize: 13,
    color: COLORS.gray500,
    fontWeight: '500',
    flexShrink: 1,
  },
  locationChevron: {
    fontSize: 11,
    color: COLORS.gray400,
    marginLeft: 3,
  },
  notifBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  notifBtnPressed: {
    backgroundColor: COLORS.gray200,
  },
  notifIcon: {
    fontSize: 20,
  },
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -1,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: COLORS.red,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  notifBadgeText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: '800',
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: -1,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  cartBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
  },
  storiesSection: {
    backgroundColor: COLORS.white,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  storiesList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchPlaceholder: {
    fontSize: 15,
    color: COLORS.gray400,
    fontWeight: '400',
  },
  section: {
    marginTop: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  sectionSubTitle: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.gray500,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  categoriesList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.gray200,
    ...SHADOWS.card,
  },
  categoryPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray600,
  },
  categoryTextActive: {
    color: COLORS.white,
  },
  shopsList: {
    paddingHorizontal: 16,
    paddingBottom: 2,
  },
  shopSeparator: {
    width: 12,
  },
  shopCardWrap: {
    width: 286,
  },
  forYouSection: {
    marginTop: 14,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  forYouGradient: {
    paddingVertical: 12,
    backgroundColor: '#F7F4FF',
  },
  forYouList: {
    paddingHorizontal: 16,
  },
  forYouCard: {
    width: 132,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  forYouImageWrap: {
    height: 88,
    backgroundColor: COLORS.gray100,
    position: 'relative',
  },
  forYouImage: {
    width: '100%',
    height: '100%',
  },
  forYouImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  forYouImageEmoji: {
    fontSize: 28,
    opacity: 0.5,
  },
  forYouBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  forYouBadgeText: {
    fontSize: 9,
    fontWeight: '600',
  },
  forYouCardContent: {
    padding: 8,
  },
  forYouCardName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray900,
  },
  forYouCardPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 3,
  },
  forYouCardShop: {
    fontSize: 11,
    color: COLORS.gray500,
    marginTop: 2,
  },
  productGrid: {
    paddingHorizontal: 16,
    paddingBottom: 2,
  },
  productRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  productCardWrap: {
    flex: 1,
  },
  emptyProductsWrap: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 14,
    ...SHADOWS.card,
  },
  emptyProductsText: {
    color: COLORS.gray500,
    fontSize: 13,
    textAlign: 'center',
  },
  dealsList: {
    paddingHorizontal: 16,
    paddingBottom: 2,
  },
  dealSeparator: {
    width: 12,
  },
  dealCardWrap: {
    width: 300,
  },
  bottomSpacing: {
    height: 26,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500',
  },
});
