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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';

import useAuthStore from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import { getNearbyShops } from '../../lib/shops';
import { searchProducts } from '../../lib/products';
import { getNearbyDeals } from '../../lib/deals';
import { getStoriesFeed } from '../../lib/stories';
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const loadData = useCallback(async () => {
    const [storiesRes, dealsRes, shopsRes, productsRes] = await Promise.allSettled([
      getStoriesFeed(),
      getNearbyDeals(lat, lng),
      getNearbyShops(lat, lng, { radius: 5000 }),
      searchProducts({ sort: 'newest', limit: 20 }),
    ]);

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
  }, [lat, lng]);

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

  const firstName = user?.name?.split(' ')[0] || 'there';
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
});
