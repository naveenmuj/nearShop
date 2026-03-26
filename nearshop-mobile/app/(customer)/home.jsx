import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  Pressable,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';

import useAuthStore from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import { getNearbyShops, getSearchHistory } from '../../lib/shops';
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
import { COLORS, SHADOWS } from '../../constants/theme';

const CATEGORIES = [
  { label: 'All', value: '' },
  { label: 'Grocery', value: 'Grocery' },
  { label: 'Electronics', value: 'Electronics' },
  { label: 'Clothing', value: 'Clothing' },
  { label: 'Food', value: 'Food' },
  { label: 'Beauty', value: 'Beauty' },
  { label: 'Home', value: 'Home' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { lat, lng, address } = useLocationStore();

  const [stories, setStories] = useState([]);
  const [deals, setDeals] = useState([]);
  const [shops, setShops] = useState([]);
  const [products, setProducts] = useState([]);
  const [forYouRecs, setForYouRecs] = useState([]);
  const [trending, setTrending] = useState([]);
  const [cfRecs, setCfRecs] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showLocationPicker, setShowLocationPicker] = useState(false);

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
      getNearbyShops(lat, lng, { radius_km: 5 }),
      searchProducts({ sort: 'newest', limit: 20 }),
      getTrendingProducts(lat, lng, { limit: 10 }),
    ];
    
    // Add personalized data requests if user is logged in
    if (user) {
      requests.push(getAIRecommendations({ lat, lng, limit: 10 }));
      requests.push(getCFRecommendations(lat, lng, { limit: 10 }));
      requests.push(getSearchHistory(5));
    }

    const results = await Promise.allSettled(requests);
    const [storiesRes, dealsRes, shopsRes, productsRes, trendingRes, recsRes, cfRes, historyRes] = results;

    // Check if all failed
    const allFailed = storiesRes.status === 'rejected' &&
                      dealsRes.status === 'rejected' &&
                      shopsRes.status === 'rejected' &&
                      productsRes.status === 'rejected' &&
                      trendingRes.status === 'rejected';

    if (allFailed) {
      setError('Failed to load content. Check your internet connection.');
      return;
    }

    if (storiesRes.status === 'fulfilled') {
      const raw = storiesRes.value?.data?.items ?? [];
      setStories(raw.slice(0, 8));
    }
    if (dealsRes.status === 'fulfilled') {
      setDeals(dealsRes.value?.data?.items ?? []);
    }
    if (shopsRes.status === 'fulfilled') {
      setShops(shopsRes.value?.data?.items ?? []);
    }
    if (productsRes.status === 'fulfilled') {
      setProducts(productsRes.value?.data?.items ?? []);
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
    if (user && historyRes?.status === 'fulfilled') {
      setRecentSearches(historyRes.value?.data?.history ?? []);
    }
  }, [lat, lng, user]);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleCategoryPress = (value) => {
    setSelectedCategory(value);
    router.push(`/(customer)/search${value ? `?category=${encodeURIComponent(value)}` : ''}`);
  };

  const handleStoryPress = (story) => {
    router.push(`/(customer)/shop/${story.shop_id}`);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  const firstName = user?.name ? String(user.name).split(' ')[0] : 'there';
  const locality = address || 'Locating…';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Hi, {firstName} 👋</Text>
            <Pressable
              style={styles.locationRow}
              onPress={() => setShowLocationPicker(true)}
              accessibilityLabel="Change location"
            >
              <Text style={styles.locationPin}>📍</Text>
              <Text style={styles.locationText} numberOfLines={1}>
                {locality}
              </Text>
              <Text style={styles.locationChevron}>▾</Text>
            </Pressable>
          </View>
          <Pressable
            style={({ pressed }) => [styles.notifBtn, pressed && styles.notifBtnPressed]}
            onPress={() => router.push('/(customer)/profile')}
            accessibilityLabel="Notifications"
          >
            <Text style={styles.notifIcon}>🔔</Text>
          </Pressable>
        </View>

        {/* ── Error Message ──────────────────────────────────────── */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Stories ────────────────────────────────────────────── */}
        {stories.length > 0 && (
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
        )}

        {/* ── Search bar ─────────────────────────────────────────── */}
        <Pressable
          style={styles.searchBar}
          onPress={() => router.push('/(customer)/search')}
          accessibilityLabel="Search products and shops"
          accessibilityRole="search"
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Search products, shops…</Text>
        </Pressable>

        {/* ── Hot Deals ──────────────────────────────────────────── */}
        {deals.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Hot Deals 🔥</Text>
              <TouchableOpacity onPress={() => router.push('/(customer)/deals')} activeOpacity={0.7}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={deals}
              keyExtractor={(item) => String(item.id)}
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
        )}

        {/* ── Categories ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesList}
          >
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.value;
              return (
                <TouchableOpacity
                  key={cat.value}
                  style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                  onPress={() => handleCategoryPress(cat.value)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Nearby Shops ───────────────────────────────────────── */}
        {shops.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Shops Near You</Text>
            </View>
            <FlatList
              data={shops}
              keyExtractor={(item) => String(item.id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shopsList}
              ItemSeparatorComponent={() => <View style={styles.shopSeparator} />}
              renderItem={({ item }) => <ShopCard shop={item} />}
            />
          </View>
        )}

        {/* ── Products Grid ──────────────────────────────────────── */}
        {products.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Just In</Text>
            </View>
            <FlatList
              data={products}
              keyExtractor={(item) => String(item.id)}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={styles.productRow}
              contentContainerStyle={styles.productGrid}
              renderItem={({ item }) => (
                <View style={styles.productCardWrap}>
                  <ProductCard product={item} />
                </View>
              )}
            />
          </View>
        )}

        {/* ── Trending Near You ─────────────────────────────────── */}
        {trending.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.aiTitleRow}>
                <Text style={styles.aiTitleIcon}>📈</Text>
                <Text style={styles.sectionTitle}>Trending Near You</Text>
              </View>
            </View>
            <FlatList
              data={trending}
              keyExtractor={(item) => String(item.id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.forYouList}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.forYouCard}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/(customer)/product/${item.id}`)}
                >
                  <View style={styles.forYouImageWrap}>
                    {item.images?.[0] ? (
                      <Image source={{ uri: item.images[0] }} style={styles.forYouImage} />
                    ) : (
                      <View style={styles.forYouImagePlaceholder}>
                        <Text style={styles.forYouImageEmoji}>📦</Text>
                      </View>
                    )}
                    <View style={[styles.forYouBadge, styles.trendingBadge]}>
                      <Text style={[styles.forYouBadgeText, styles.trendingBadgeText]}>
                        {item.trend_label || 'Trending'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.forYouCardContent}>
                    <Text style={styles.forYouCardName} numberOfLines={1}>{item.name}</Text>
                    {item.price && <Text style={styles.forYouCardPrice}>₹{item.price}</Text>}
                    {item.shop_name && <Text style={styles.forYouCardShop} numberOfLines={1}>{item.shop_name}</Text>}
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* ── For You - Personalized Recommendations ─────────────── */}
        {user && forYouRecs.length > 0 && (
          <View style={styles.forYouSection}>
            <View style={styles.forYouGradient}>
              <View style={styles.forYouHeader}>
                <View style={styles.forYouTitleRow}>
                  <View style={styles.forYouIconBox}>
                    <Text style={styles.forYouIcon}>✨</Text>
                  </View>
                  <View>
                    <Text style={styles.forYouTitle}>For You</Text>
                    <Text style={styles.forYouSubtitle}>Based on your preferences</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => router.push('/(customer)/search')} activeOpacity={0.7}>
                  <Text style={styles.seeAll}>See all</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={forYouRecs}
                keyExtractor={(item, idx) => `${item.type}-${item.id}-${idx}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.forYouList}
                ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.forYouCard}
                    activeOpacity={0.8}
                    onPress={() => {
                      if (item.type === 'shop') {
                        router.push(`/(customer)/shop/${item.id}`);
                      } else {
                        router.push(`/(customer)/product/${item.id}`);
                      }
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
                      <View style={[styles.forYouBadge, 
                        item.reason === 'reorder' ? styles.forYouBadgeReorder :
                        item.reason === 'favorite_shop' ? styles.forYouBadgeFavorite :
                        styles.forYouBadgeDefault
                      ]}>
                        <Text style={[styles.forYouBadgeText,
                          item.reason === 'reorder' ? styles.forYouBadgeTextReorder :
                          item.reason === 'favorite_shop' ? styles.forYouBadgeTextFavorite :
                          styles.forYouBadgeTextDefault
                        ]}>
                          {item.type === 'shop' ? 'Shop' : 
                           item.reason === 'reorder' ? '🔄 Reorder' :
                           item.reason === 'favorite_shop' ? '❤️ Favorite' :
                           '✨ For You'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.forYouCardContent}>
                      <Text style={styles.forYouCardName} numberOfLines={1}>{item.name}</Text>
                      {item.price && <Text style={styles.forYouCardPrice}>₹{item.price}</Text>}
                      {item.shop_name && <Text style={styles.forYouCardShop} numberOfLines={1}>{item.shop_name}</Text>}
                    </View>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        )}

        {/* ── Recommended For You - Collaborative ───────────────── */}
        {user && cfRecs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.aiTitleRow}>
                <Text style={styles.aiTitleIcon}>🤝</Text>
                <Text style={styles.sectionTitle}>Recommended For You</Text>
              </View>
            </View>
            <FlatList
              data={cfRecs}
              keyExtractor={(item) => String(item.id)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.forYouList}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.forYouCard}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/(customer)/product/${item.id}`)}
                >
                  <View style={styles.forYouImageWrap}>
                    {item.images?.[0] ? (
                      <Image source={{ uri: item.images[0] }} style={styles.forYouImage} />
                    ) : (
                      <View style={styles.forYouImagePlaceholder}>
                        <Text style={styles.forYouImageEmoji}>📦</Text>
                      </View>
                    )}
                    <View style={[styles.forYouBadge, styles.cfBadge]}>
                      <Text style={[styles.forYouBadgeText, styles.cfBadgeText]}>Nearby Match</Text>
                    </View>
                  </View>
                  <View style={styles.forYouCardContent}>
                    <Text style={styles.forYouCardName} numberOfLines={1}>{item.name}</Text>
                    {item.price && <Text style={styles.forYouCardPrice}>₹{item.price}</Text>}
                    <Text style={styles.aiReason} numberOfLines={2}>{item.reason || 'People near you also bought this'}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* ── Recent Searches ────────────────────────────────────── */}
        {user && recentSearches.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.recentSearchTitleRow}>
                <Text style={styles.recentSearchIcon}>🕐</Text>
                <Text style={styles.recentSearchTitle}>Recent Searches</Text>
              </View>
            </View>
            <View style={styles.recentSearchList}>
              {recentSearches.map((query, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.recentSearchPill}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/(customer)/search?q=${encodeURIComponent(query)}`)}
                >
                  <Text style={styles.recentSearchPillIcon}>🔍</Text>
                  <Text style={styles.recentSearchPillText}>{query}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Recently Viewed ─────────────────────────────────────── */}
        <RecentlyViewed />

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
    backgroundColor: COLORS.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Header
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
  locationChevron: {
    fontSize: 11,
    color: COLORS.gray400,
    marginLeft: 3,
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
  notifBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifBtnPressed: {
    backgroundColor: COLORS.gray200,
  },
  notifIcon: {
    fontSize: 20,
  },

  // Stories
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

  // Search bar
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

  // Sections
  section: {
    marginTop: 20,
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
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Deals
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

  // Categories
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

  // Shops
  shopsList: {
    paddingHorizontal: 16,
    paddingBottom: 2,
  },
  shopSeparator: {
    width: 12,
  },

  // Products grid
  productGrid: {
    paddingHorizontal: 16,
    paddingBottom: 2,
  },
  productRow: {
    gap: 12,
    marginBottom: 12,
  },
  productCardWrap: {
    flex: 1,
  },

  bottomSpacing: {
    height: 32,
  },

  // For You Section
  forYouSection: {
    marginTop: 20,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  forYouGradient: {
    paddingVertical: 16,
    backgroundColor: '#F8F3FF',
  },
  forYouHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  forYouTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  forYouIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  forYouIcon: {
    fontSize: 16,
  },
  forYouTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  forYouSubtitle: {
    fontSize: 11,
    color: COLORS.gray500,
    marginTop: 1,
  },
  forYouList: {
    paddingHorizontal: 16,
  },
  forYouCard: {
    width: 140,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  forYouImageWrap: {
    height: 96,
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
  forYouBadgeDefault: {
    backgroundColor: '#F3E8FF',
  },
  forYouBadgeReorder: {
    backgroundColor: '#DCFCE7',
  },
  forYouBadgeFavorite: {
    backgroundColor: '#FCE7F3',
  },
  forYouBadgeText: {
    fontSize: 9,
    fontWeight: '600',
  },
  forYouBadgeTextDefault: {
    color: '#7C3AED',
  },
  forYouBadgeTextReorder: {
    color: '#16A34A',
  },
  forYouBadgeTextFavorite: {
    color: '#DB2777',
  },
  forYouCardContent: {
    padding: 10,
  },
  forYouCardName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray900,
  },
  forYouCardPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 3,
  },
  forYouCardShop: {
    fontSize: 11,
    color: COLORS.gray500,
    marginTop: 2,
  },
  aiTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiTitleIcon: {
    fontSize: 15,
  },
  aiReason: {
    fontSize: 11,
    color: COLORS.primary,
    marginTop: 4,
    lineHeight: 14,
  },
  trendingBadge: {
    backgroundColor: '#FFF7ED',
  },
  trendingBadgeText: {
    color: '#C2410C',
  },
  cfBadge: {
    backgroundColor: '#EEF2FF',
  },
  cfBadgeText: {
    color: '#4338CA',
  },

  // Recent Searches
  recentSearchTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentSearchIcon: {
    fontSize: 14,
  },
  recentSearchTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.gray700,
  },
  recentSearchList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
  },
  recentSearchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    gap: 6,
  },
  recentSearchPillIcon: {
    fontSize: 12,
  },
  recentSearchPillText: {
    fontSize: 13,
    color: COLORS.gray600,
    fontWeight: '500',
  },

  // Error handling
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
