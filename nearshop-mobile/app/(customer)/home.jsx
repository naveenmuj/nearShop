import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  StatusBar,
  Pressable,
  Image,
  Animated,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';

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
import FadeInItem from '../../components/ui/FadeInItem';
import { COLORS, SHADOWS } from '../../constants/theme';
import { getRankingReasonLabel, getRankingReasonTone } from '../../lib/ranking';
import { rankingRouteParams, trackRankingClick, trackRankingImpressions } from '../../lib/rankingTracking';
import { distanceKm, formatDistance } from '../../lib/distance';
import { getUnreadCount } from '../../lib/notifications';

const CATEGORIES = [
  { label: 'All', value: '', icon: '✨' },
  { label: 'Grocery', value: 'Grocery', icon: '🥬' },
  { label: 'Electronics', value: 'Electronics', icon: '🎧' },
  { label: 'Clothing', value: 'Clothing', icon: '👕' },
  { label: 'Food', value: 'Food', icon: '🍜' },
  { label: 'Beauty', value: 'Beauty', icon: '💄' },
  { label: 'Home', value: 'Home', icon: '🛋️' },
];

const MAX_RECOMMENDATIONS = 10;
const MAX_NEARBY_SHOPS = 10;
const MAX_GRID_PRODUCTS = 16;
const MAX_DEALS = 8;

const CATEGORY_THEMES = {
  all: {
    gradient: ['#2E1D01', '#B07811'],
    accent: '#F7B933',
    accentSoft: '#FFF2D9',
    borderSoft: '#F2D8A0',
    icon: '🌟',
    title: 'Everything in minutes',
    subtitle: 'Switch categories to discover a fresh vibe and curated picks',
  },
  Grocery: {
    gradient: ['#0F3D2E', '#1F8A63'],
    accent: '#2FAF7A',
    accentSoft: '#E3F8EF',
    borderSoft: '#B8E7D2',
    icon: '🥑',
    title: 'Fresh picks for today',
    subtitle: 'Farm-fresh groceries and daily essentials near you',
  },
  Electronics: {
    gradient: ['#102A4A', '#1F73C9'],
    accent: '#2E8EF0',
    accentSoft: '#E6F1FF',
    borderSoft: '#BDD8FF',
    icon: '⚡',
    title: 'Power up your setup',
    subtitle: 'Chargers, gadgets, and smart accessories in one tap',
  },
  Clothing: {
    gradient: ['#3E2B5B', '#B15EA7'],
    accent: '#D06AC3',
    accentSoft: '#FAEAF7',
    borderSoft: '#EDC5E7',
    icon: '🧵',
    title: 'Style drop is live',
    subtitle: 'Trending fits and everyday fashion from local sellers',
  },
  Food: {
    gradient: ['#4A190D', '#C95C1F'],
    accent: '#F0782E',
    accentSoft: '#FFECDD',
    borderSoft: '#F9CCAD',
    icon: '🍲',
    title: 'Cravings, sorted fast',
    subtitle: 'Snacks, meals, and comfort food delivered quickly',
  },
  Beauty: {
    gradient: ['#501E3C', '#D34E8A'],
    accent: '#E05F9A',
    accentSoft: '#FCE9F2',
    borderSoft: '#F4C2D9',
    icon: '💅',
    title: 'Glow mode on',
    subtitle: 'Beauty and personal care picks tailored for you',
  },
  Home: {
    gradient: ['#4A2F10', '#C2862E'],
    accent: '#D39A3E',
    accentSoft: '#FCF1DF',
    borderSoft: '#EFD9AF',
    icon: '🏡',
    title: 'Make home feel better',
    subtitle: 'Decor, utility, and comfort essentials nearby',
  },
};

function getThemeByCategory(category = '') {
  if (!category) return CATEGORY_THEMES.all;
  return CATEGORY_THEMES[category] || CATEGORY_THEMES.all;
}

function normalizeCategoryValue(value = '') {
  return String(value || '').trim().toLowerCase();
}

function matchesHomeCategory(item = {}, selectedCategory = '') {
  const category = normalizeCategoryValue(selectedCategory);
  if (!category) return true;

  const candidates = [
    item?.category,
    item?.subcategory,
    item?.category_name,
    item?.shop_category,
    ...(Array.isArray(item?.tags) ? item.tags : []),
  ]
    .filter(Boolean)
    .map(normalizeCategoryValue);

  const aliases = {
    grocery: ['grocery', 'groceries', 'supermarket', 'daily essentials'],
    electronics: ['electronics', 'electronic', 'gadgets', 'mobile', 'mobile accessories'],
    clothing: ['clothing', 'fashion', 'apparel', 'wear', 'wears'],
    food: ['food', 'restaurant', 'meals', 'snacks', 'snack', 'cafe'],
    beauty: ['beauty', 'personal care', 'cosmetics', 'makeup', 'skincare'],
    home: ['home', 'household', 'decor', 'furniture', 'kitchen'],
  };

  const allowed = aliases[category] || [category];
  return candidates.some((candidate) => allowed.some((alias) => candidate.includes(alias)));
}

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
  const [layoutVariant, setLayoutVariant] = useState('B');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const themeTransition = useRef(new Animated.Value(1)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const categoryCardPulse = useRef(new Animated.Value(1)).current;
  const isLegacyAndroid = Platform.OS === 'android' && Number(Platform.Version) <= 29;
  const useLightMotion = reduceMotionEnabled || isLegacyAndroid;
  const [themeLayer, setThemeLayer] = useState(() => ({
    current: getThemeByCategory(''),
    previous: null,
  }));

  useEffect(() => {
    let mounted = true;

    const supportsReduceMotionCheck = typeof AccessibilityInfo?.isReduceMotionEnabled === 'function';
    if (supportsReduceMotionCheck) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          if (mounted) {
            setReduceMotionEnabled(Boolean(enabled));
          }
        })
        .catch(() => {
          if (mounted) setReduceMotionEnabled(false);
        });
    } else {
      setReduceMotionEnabled(false);
    }

    const supportsReduceMotionListener = typeof AccessibilityInfo?.addEventListener === 'function';
    const subscription = supportsReduceMotionListener
      ? AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
          setReduceMotionEnabled(Boolean(enabled));
        })
      : null;

    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    const nextTheme = getThemeByCategory(selectedCategory);
    setThemeLayer((prev) => ({
      current: nextTheme,
      previous: prev.current,
    }));
    themeTransition.setValue(0);
    Animated.timing(themeTransition, {
      toValue: 1,
      duration: useLightMotion ? 150 : 280,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setThemeLayer((prev) => ({ ...prev, previous: null }));
      }
    });

    if (useLightMotion) {
      categoryCardPulse.setValue(1);
    } else {
      Animated.sequence([
        Animated.timing(categoryCardPulse, {
          toValue: 0.985,
          duration: 110,
          useNativeDriver: true,
        }),
        Animated.spring(categoryCardPulse, {
          toValue: 1,
          speed: 18,
          bounciness: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [selectedCategory, themeTransition, categoryCardPulse, useLightMotion]);

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

    return Array.from(merged.values()).slice(0, MAX_RECOMMENDATIONS);
  }, [forYouRecs, cfRecs]);

  const nearbyShops = useMemo(() => {
    const filtered = Array.isArray(shops)
      ? shops.filter((shop) => matchesHomeCategory(shop, selectedCategory))
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
        .slice(0, MAX_NEARBY_SHOPS);
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
        if (!matchesHomeCategory(normalized, selectedCategory)) {
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

    return Array.from(byId.values()).slice(0, MAX_GRID_PRODUCTS);
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
    return Math.max(1, Math.min(50, Math.round(parsed)));
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

    const categoryFilter = selectedCategory || undefined;
    const requests = [
      getStoriesFeed(),
      getNearbyDeals(lat, lng, { radius_km: nearbyRadiusKm }),
      getNearbyShops(lat, lng, { radius_km: nearbyRadiusKm }),
      searchProducts({ sort: 'newest', per_page: 30, lat, lng, radius_km: nearbyRadiusKm, category: categoryFilter }),
      getTrendingProducts(lat, lng, { limit: 14, radius_km: nearbyRadiusKm, category: categoryFilter }),
    ];

    if (user) {
      requests.push(getAIRecommendations({ lat, lng, limit: 12, radius_km: nearbyRadiusKm, category: categoryFilter }));
      requests.push(getCFRecommendations(lat, lng, { limit: 12, radius_km: nearbyRadiusKm, category: categoryFilter }));
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
      setDeals((dealsRes.value?.data?.items ?? []).slice(0, MAX_DEALS));
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
  }, [lat, lng, user, nearbyRadiusKm, selectedCategory]);

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

  const firstName = user?.name ? String(user.name).split(' ')[0] : 'there';
  const locality = address || 'Locating...';
  const activeTheme = themeLayer.current;
  const activeCategory = CATEGORIES.find((item) => item.value === selectedCategory) || CATEGORIES[0];
  const isAllCategory = activeCategory.value === '';
  const showRecommendations = user && combinedRecommendations.length > 0;
  const showShops = nearbyShops.length > 0;
  const showDeals = deals.length > 0;
  const heroTranslateY = useLightMotion ? 0 : scrollY.interpolate({
    inputRange: [0, 220],
    outputRange: [0, -26],
    extrapolate: 'clamp',
  });
  const heroScale = useLightMotion ? 1 : scrollY.interpolate({
    inputRange: [0, 220],
    outputRange: [1, 0.97],
    extrapolate: 'clamp',
  });
  const heroOpacity = useLightMotion ? 1 : scrollY.interpolate({
    inputRange: [0, 220],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });
  const stickyShadowOpacity = useLightMotion ? 0 : scrollY.interpolate({
    inputRange: [40, 120],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const fadeInConfig = useMemo(
    () => ({
      reduceMotion: useLightMotion,
      duration: useLightMotion ? 180 : 360,
      delayStep: useLightMotion ? 18 : 70,
      distance: useLightMotion ? 8 : 18,
    }),
    [useLightMotion]
  );

  const orderedSectionKeys = useMemo(() => {
    const list = [];
    const isFastCategory = selectedCategory === 'Food' || selectedCategory === 'Grocery';

    list.push('products');

    if (selectedCategory) {
      if (isFastCategory && showDeals) list.push('deals');
      if (showShops) list.push('shops');
      if (showRecommendations) list.push('recommendations');
      list.push('recentlyViewed');
      if (!isFastCategory && showDeals) list.push('deals');
    } else {
      if (showRecommendations) list.push('recommendations');
      if (showShops) list.push('shops');
      list.push('recentlyViewed');
      if (showDeals) list.push('deals');
    }

    return list;
  }, [selectedCategory, showDeals, showRecommendations, showShops]);

  const classicSectionKeys = useMemo(() => {
    const list = [];
    if (showRecommendations) list.push('recommendations');
    list.push('products');
    if (showShops) list.push('shops');
    list.push('recentlyViewed');
    if (showDeals) list.push('deals');
    return list;
  }, [showDeals, showRecommendations, showShops]);

  const activeSectionKeys = layoutVariant === 'A' ? classicSectionKeys : orderedSectionKeys;

  if (loading) {
    return <HomeScreenSkeleton />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={activeTheme.gradient[0]} />
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[2]}
        scrollEventThrottle={16}
        onScroll={
          useLightMotion
            ? undefined
            : Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true }
            )
        }
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        )}
      >
        <Animated.View
          style={[
            styles.heroShell,
            {
              opacity: heroOpacity,
              transform: [{ translateY: heroTranslateY }, { scale: heroScale }],
            },
          ]}
        >
          {themeLayer.previous ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.heroGradientLayer,
                {
                  opacity: themeTransition.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                },
              ]}
            >
              <LinearGradient
                colors={themeLayer.previous.gradient}
                start={{ x: 0.12, y: 0 }}
                end={{ x: 0.88, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          ) : null}

          <Animated.View style={[styles.heroGradientLayer, { opacity: themeTransition }]}> 
            <LinearGradient
              colors={activeTheme.gradient}
              start={{ x: 0.12, y: 0 }}
              end={{ x: 0.88, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

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
                style={({ pressed }) => [styles.heroActionBtn, pressed && styles.heroActionBtnPressed]}
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
                style={({ pressed }) => [styles.heroActionBtn, pressed && styles.heroActionBtnPressed]}
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

          <View style={styles.heroMoodRow}>
            <View style={[styles.heroMoodPill, { borderColor: activeTheme.borderSoft }]}> 
              <Text style={styles.heroMoodIcon}>{activeTheme.icon}</Text>
              <Text style={styles.heroMoodText}>{activeTheme.title}</Text>
            </View>
          </View>

          <Pressable
            style={styles.searchBar}
            onPress={() => router.push('/(customer)/search')}
            accessibilityLabel="Search products and shops"
            accessibilityRole="search"
          >
            <Text style={styles.searchIcon}>🔍</Text>
            <Text style={styles.searchPlaceholder}>
              {isAllCategory ? 'Search products, shops...' : `Search ${activeCategory.label.toLowerCase()} products...`}
            </Text>
          </Pressable>

          <Text style={styles.heroSubtitle}>{activeTheme.subtitle}</Text>

          <View style={styles.layoutToggleRow}>
            <Text style={styles.layoutToggleLabel}>Home layout</Text>
            <View style={styles.layoutToggleShell}>
              <Pressable
                onPress={() => setLayoutVariant('A')}
                style={[styles.layoutToggleOption, layoutVariant === 'A' && styles.layoutToggleOptionActive]}
                accessibilityRole="button"
                accessibilityLabel="Switch to layout A"
              >
                <Text style={[styles.layoutToggleText, layoutVariant === 'A' && styles.layoutToggleTextActive]}>A</Text>
              </Pressable>
              <Pressable
                onPress={() => setLayoutVariant('B')}
                style={[styles.layoutToggleOption, layoutVariant === 'B' && styles.layoutToggleOptionActive]}
                accessibilityRole="button"
                accessibilityLabel="Switch to layout B"
              >
                <Text style={[styles.layoutToggleText, layoutVariant === 'B' && styles.layoutToggleTextActive]}>B</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>

        <View style={styles.noticeStack}>
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
        </View>

        <Animated.View style={styles.stickyCategoryWrap}>
          <View style={styles.stickyCategoryHeader}>
            <Text style={styles.stickyCategoryTitle}>Browse by category</Text>
            {selectedCategory ? (
              <TouchableOpacity onPress={() => setSelectedCategory('')} activeOpacity={0.7}>
                <Text style={[styles.seeAll, { color: activeTheme.accent }]}>Clear</Text>
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
                  style={[
                    styles.categoryPill,
                    active && {
                      backgroundColor: activeTheme.accent,
                      borderColor: activeTheme.accent,
                    },
                  ]}
                  onPress={() => setSelectedCategory(item.value)}
                  activeOpacity={0.78}
                >
                  <Text style={styles.categoryIcon}>{item.icon}</Text>
                  <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            }}
          />
          <Animated.View style={[styles.stickyShadow, { opacity: stickyShadowOpacity }]} pointerEvents="none" />
        </Animated.View>

        {stories.length > 0 ? (
          <FadeInItem {...fadeInConfig} index={0}>
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
          </FadeInItem>
        ) : null}

        <FadeInItem {...fadeInConfig} index={2}>
          <View style={styles.section}>
            <Animated.View
              style={[
                styles.categoryThemeCard,
                {
                  backgroundColor: activeTheme.accentSoft,
                  borderColor: activeTheme.borderSoft,
                },
                { transform: [{ scale: categoryCardPulse }] },
              ]}
            >
              <Text style={styles.categoryThemeCardTitle}>{activeTheme.title}</Text>
              <Text style={styles.categoryThemeCardSubtitle}>{activeTheme.subtitle}</Text>
            </Animated.View>
          </View>
        </FadeInItem>

        {activeSectionKeys.map((sectionKey, idx) => {
          if (sectionKey === 'products') {
            return (
              <FadeInItem {...fadeInConfig} key="products" index={idx + 3}>
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
                      <Text style={[styles.seeAll, { color: activeTheme.accent }]}>See all</Text>
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
              </FadeInItem>
            );
          }

          if (sectionKey === 'recommendations' && showRecommendations) {
            return (
              <FadeInItem {...fadeInConfig} key="recommendations" index={idx + 3}>
                <View style={[styles.forYouSection, { borderColor: activeTheme.borderSoft }]}>
                  <View style={[styles.forYouGradient, { backgroundColor: activeTheme.accentSoft }]}>
                    <View style={styles.sectionHeader}>
                      <View>
                        <Text style={styles.sectionTitle}>Recommended for you</Text>
                        <Text style={styles.sectionSubTitle}>AI + shoppers with similar activity</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => router.push('/(customer)/search')}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.seeAll, { color: activeTheme.accent }]}>See all</Text>
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
                            {item.price ? <Text style={[styles.forYouCardPrice, { color: activeTheme.accent }]}>₹{item.price}</Text> : null}
                            {item.shop_name ? (
                              <Text style={styles.forYouCardShop} numberOfLines={1}>{item.shop_name}</Text>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                </View>
              </FadeInItem>
            );
          }

          if (sectionKey === 'shops' && showShops) {
            return (
              <FadeInItem {...fadeInConfig} key="shops" index={idx + 3}>
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
                      <Text style={[styles.seeAll, { color: activeTheme.accent }]}>See all</Text>
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
              </FadeInItem>
            );
          }

          if (sectionKey === 'recentlyViewed') {
            return (
              <FadeInItem {...fadeInConfig} key="recentlyViewed" index={idx + 3}>
                <View style={styles.sectionCompact}>
                  <RecentlyViewed />
                </View>
              </FadeInItem>
            );
          }

          if (sectionKey === 'deals' && showDeals) {
            return (
              <FadeInItem {...fadeInConfig} key="deals" index={idx + 3}>
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Hot deals 🔥</Text>
                    <TouchableOpacity onPress={() => router.push('/(customer)/deals')} activeOpacity={0.7}>
                      <Text style={[styles.seeAll, { color: activeTheme.accent }]}>See all</Text>
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
              </FadeInItem>
            );
          }

          return null;
        })}

        <View style={styles.bottomSpacing} />
      </Animated.ScrollView>

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
    paddingBottom: 28,
  },
  heroShell: {
    overflow: 'hidden',
    paddingBottom: 14,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 2,
  },
  heroGradientLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
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
    color: COLORS.white,
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
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '500',
    flexShrink: 1,
  },
  locationChevron: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    marginLeft: 3,
  },
  heroActionBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  heroActionBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.28)',
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
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.gray200,
  },
  storiesList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  heroMoodRow: {
    paddingHorizontal: 16,
  },
  heroMoodPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  heroMoodIcon: {
    marginRight: 7,
    fontSize: 14,
  },
  heroMoodText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    ...SHADOWS.card,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchPlaceholder: {
    fontSize: 15,
    color: COLORS.gray500,
    fontWeight: '500',
  },
  heroSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.82)',
    marginHorizontal: 16,
    marginTop: 8,
    lineHeight: 17,
  },
  layoutToggleRow: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  layoutToggleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  layoutToggleShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  layoutToggleOption: {
    minWidth: 32,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  layoutToggleOptionActive: {
    backgroundColor: COLORS.white,
  },
  layoutToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  layoutToggleTextActive: {
    color: COLORS.gray900,
  },
  noticeStack: {
    paddingTop: 4,
  },
  stickyCategoryWrap: {
    backgroundColor: COLORS.gray100,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
    position: 'relative',
  },
  stickyCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  stickyCategoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  stickyShadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -8,
    height: 8,
    backgroundColor: '#0000001A',
  },
  section: {
    marginTop: 20,
  },
  sectionCompact: {
    marginTop: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
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
    lineHeight: 16,
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
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.gray200,
    ...SHADOWS.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryIcon: {
    fontSize: 13,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray600,
  },
  categoryTextActive: {
    color: COLORS.white,
  },
  categoryThemeCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  categoryThemeCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  categoryThemeCardSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.gray600,
    lineHeight: 17,
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
    borderWidth: 1,
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
    paddingBottom: 4,
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
    paddingBottom: 4,
  },
  dealSeparator: {
    width: 12,
  },
  dealCardWrap: {
    width: 300,
  },
  bottomSpacing: {
    height: 34,
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
