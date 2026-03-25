import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator,
  RefreshControl, ScrollView, StatusBar, Image, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';
import { getNearbyDeals, claimDeal } from '../../lib/deals';
import { toast } from '../../components/ui/Toast';
import useLocationStore from '../../store/locationStore';

const { width: SCREEN_W } = Dimensions.get('window');

const CATEGORIES = [
  { key: 'All', emoji: '🔥', color: '#EF4444' },
  { key: 'Electronics', emoji: '📱', color: '#3B82F6' },
  { key: 'Clothing', emoji: '👕', color: '#8B5CF6' },
  { key: 'Grocery', emoji: '🛒', color: '#10B981' },
  { key: 'Food', emoji: '🍔', color: '#F59E0B' },
  { key: 'Home', emoji: '🏠', color: '#6366F1' },
  { key: 'Beauty', emoji: '💄', color: '#EC4899' },
];

// ── Countdown hook ────────────────────────────────────────────────────────────
function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState({ text: '', urgent: false, expired: false });
  const timerRef = useRef(null);

  useEffect(() => {
    const tick = () => {
      const diff = new Date(expiresAt) - Date.now();
      if (diff <= 0) {
        setRemaining({ text: 'Expired', urgent: false, expired: true });
        clearInterval(timerRef.current);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const urgent = diff < 3600000;
      if (h > 0) setRemaining({ text: `${h}h ${m}m left`, urgent: false, expired: false });
      else if (m > 0) setRemaining({ text: `${m}m ${s}s left`, urgent, expired: false });
      else setRemaining({ text: `${s}s left`, urgent: true, expired: false });
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [expiresAt]);

  return remaining;
}

// ── Featured Deal (top banner) ────────────────────────────────────────────────
function FeaturedDeal({ deal, onClaim, claiming }) {
  const { text: countdown, urgent, expired } = useCountdown(deal.expires_at);
  const discount = deal.original_price && deal.original_price > deal.price
    ? Math.round((1 - deal.price / deal.original_price) * 100) : 0;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (urgent && !expired) {
      Animated.loop(Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.03, duration: 800, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])).start();
    }
  }, [urgent, expired]);

  return (
    <Animated.View style={[styles.featuredCard, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        style={styles.featuredInner}
        onPress={() => router.push(`/(customer)/product/${deal.product_id}`)}
      >
        <View style={styles.featuredLeft}>
          {discount > 0 && (
            <View style={styles.featuredDiscountBadge}>
              <Text style={styles.featuredDiscountText}>{discount}%</Text>
              <Text style={styles.featuredDiscountSub}>OFF</Text>
            </View>
          )}
          <View style={styles.featuredInfo}>
            <Text style={styles.featuredShop} numberOfLines={1}>{deal.shop_name}</Text>
            <Text style={styles.featuredName} numberOfLines={2}>{deal.product_name}</Text>
            <View style={styles.featuredPriceRow}>
              <Text style={styles.featuredPrice}>{formatPrice(deal.price)}</Text>
              {deal.original_price > deal.price && (
                <Text style={styles.featuredOriginal}>{formatPrice(deal.original_price)}</Text>
              )}
            </View>
          </View>
        </View>
        <View style={styles.featuredRight}>
          {deal.image_url ? (
            <Image source={{ uri: deal.image_url }} style={styles.featuredImage} resizeMode="cover" />
          ) : (
            <View style={styles.featuredImagePlaceholder}>
              <Text style={{ fontSize: 48 }}>🎁</Text>
            </View>
          )}
          <View style={[styles.featuredTimer, urgent && styles.featuredTimerUrgent]}>
            <Text style={styles.featuredTimerText}>{expired ? '⏰' : urgent ? '🔥' : '⏱'} {countdown}</Text>
          </View>
        </View>
      </Pressable>
      <Pressable
        style={[styles.featuredClaimBtn, expired && styles.featuredClaimBtnDisabled]}
        onPress={() => !expired && !claiming && onClaim(deal.id)}
        disabled={expired || claiming}
      >
        {claiming ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.featuredClaimText}>{expired ? 'Expired' : '🎉 Grab This Deal'}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ── Deal Card (grid item) ─────────────────────────────────────────────────────
function DealCard({ deal, onClaim, claiming }) {
  const { text: countdown, urgent, expired } = useCountdown(deal.expires_at);
  const discount = deal.original_price && deal.original_price > deal.price
    ? Math.round((1 - deal.price / deal.original_price) * 100) : 0;

  return (
    <Pressable
      style={[styles.dealCard, expired && styles.dealCardExpired]}
      onPress={() => !expired && router.push(`/(customer)/product/${deal.product_id}`)}
    >
      {/* Image */}
      <View style={styles.dealImageWrap}>
        {deal.image_url ? (
          <Image source={{ uri: deal.image_url }} style={styles.dealImage} resizeMode="cover" />
        ) : (
          <View style={styles.dealImagePlaceholder}>
            <Text style={{ fontSize: 32 }}>
              {CATEGORIES.find(c => c.key === deal.category)?.emoji ?? '🎁'}
            </Text>
          </View>
        )}
        {discount > 0 && !expired && (
          <View style={styles.dealDiscountBadge}>
            <Text style={styles.dealDiscountText}>{discount}%</Text>
          </View>
        )}
        {expired && (
          <View style={styles.expiredOverlay}>
            <Text style={styles.expiredText}>EXPIRED</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.dealBody}>
        <Text style={styles.dealShop} numberOfLines={1}>{deal.shop_name}</Text>
        <Text style={[styles.dealName, expired && { color: COLORS.gray400 }]} numberOfLines={2}>{deal.product_name}</Text>

        <View style={styles.dealPriceRow}>
          <Text style={[styles.dealPrice, expired && { color: COLORS.gray400 }]}>{formatPrice(deal.price)}</Text>
          {deal.original_price > deal.price && (
            <Text style={styles.dealOriginal}>{formatPrice(deal.original_price)}</Text>
          )}
        </View>

        {/* Timer */}
        <View style={[styles.dealTimer, urgent && styles.dealTimerUrgent, expired && styles.dealTimerExpired]}>
          <Text style={[styles.dealTimerText, urgent && { color: COLORS.red }, expired && { color: COLORS.gray400 }]}>
            {expired ? '⏰ Expired' : urgent ? `🔥 ${countdown}` : `⏱ ${countdown}`}
          </Text>
        </View>

        {/* Claim button */}
        <Pressable
          style={[styles.dealClaimBtn, expired && styles.dealClaimBtnDisabled]}
          onPress={(e) => { e.stopPropagation(); !expired && !claiming && onClaim(deal.id); }}
          disabled={expired || claiming}
        >
          {claiming ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.dealClaimText}>{expired ? 'Expired' : 'Claim'}</Text>
          )}
        </Pressable>
      </View>
    </Pressable>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function DealsScreen() {
  const { lat, lng } = useLocationStore();
  const [deals, setDeals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [error, setError] = useState(null);
  const [claimingId, setClaimingId] = useState(null);

  const loadDeals = useCallback(async () => {
    try {
      setError(null);
      const params = { limit: 50 };
      if (activeCategory !== 'All') params.category = activeCategory;
      const res = await getNearbyDeals(lat ?? 12.935, lng ?? 77.624, params);
      const data = res.data?.items ?? res.data?.deals ?? res.data ?? [];
      setDeals(Array.isArray(data) ? data : []);
    } catch {
      setError('Could not load deals. Check your connection.');
    }
  }, [lat, lng, activeCategory]);

  useEffect(() => {
    setIsLoading(true);
    loadDeals().finally(() => setIsLoading(false));
  }, [loadDeals]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDeals();
    setRefreshing(false);
  };

  const handleClaim = async (id) => {
    setClaimingId(id);
    try {
      await claimDeal(id);
      toast.show({ type: 'success', text1: 'Deal claimed! Check your orders.' });
      await loadDeals();
    } catch (err) {
      toast.show({ type: 'error', text1: err?.response?.data?.detail || 'Failed to claim deal' });
    } finally {
      setClaimingId(null);
    }
  };

  const activeDeals = deals.filter(d => new Date(d.expires_at) > Date.now());
  const expiredDeals = deals.filter(d => new Date(d.expires_at) <= Date.now());
  const featuredDeal = activeDeals.length > 0 ? activeDeals[0] : null;
  const remainingDeals = activeDeals.slice(1);
  const allDisplayDeals = [...remainingDeals, ...expiredDeals];

  const activeCatColor = CATEGORIES.find(c => c.key === activeCategory)?.color || COLORS.primary;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#312E81" />

      <FlatList
        data={isLoading ? [] : allDisplayDeals}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => (
          <DealCard deal={item} onClaim={handleClaim} claiming={claimingId === item.id} />
        )}
        contentContainerStyle={[
          styles.list,
          allDisplayDeals.length === 0 && !isLoading && styles.listEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" progressBackgroundColor={COLORS.primary} />
        }
        ListHeaderComponent={
          <>
            {/* Hero Header */}
            <View style={styles.hero}>
              <View style={styles.heroBubble1} />
              <View style={styles.heroBubble2} />
              <View style={styles.heroContent}>
                <Text style={styles.heroLabel}>NEAR YOU TODAY</Text>
                <Text style={styles.heroTitle}>Deals & Offers</Text>
                <Text style={styles.heroSub}>
                  {activeDeals.length > 0 ? `${activeDeals.length} active deal${activeDeals.length !== 1 ? 's' : ''} nearby` : 'Check for deals near you'}
                </Text>
              </View>
              <Text style={styles.heroEmoji}>🎁</Text>
            </View>

            {/* Category Pills */}
            <View style={styles.catSection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
                {CATEGORIES.map(({ key, emoji, color }) => {
                  const isActive = activeCategory === key;
                  return (
                    <Pressable
                      key={key}
                      style={[styles.catPill, isActive && { backgroundColor: color + '18', borderColor: color }]}
                      onPress={() => setActiveCategory(key)}
                    >
                      <Text style={styles.catEmoji}>{emoji}</Text>
                      <Text style={[styles.catText, isActive && { color, fontWeight: '700' }]}>{key}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Featured Deal */}
            {featuredDeal && !isLoading && (
              <View style={styles.featuredSection}>
                <Text style={styles.sectionTitle}>🌟 Top Deal</Text>
                <FeaturedDeal deal={featuredDeal} onClaim={handleClaim} claiming={claimingId === featuredDeal.id} />
              </View>
            )}

            {/* Grid Section Title */}
            {!isLoading && allDisplayDeals.length > 0 && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {activeCategory === 'All' ? '🔥 All Deals' : `${CATEGORIES.find(c => c.key === activeCategory)?.emoji ?? ''} ${activeCategory} Deals`}
                </Text>
                <View style={[styles.countBadge, { backgroundColor: activeCatColor + '18' }]}>
                  <Text style={[styles.countText, { color: activeCatColor }]}>{activeDeals.length} active</Text>
                </View>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Finding deals near you...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerContent}>
              <Text style={{ fontSize: 48, marginBottom: 8 }}>😕</Text>
              <Text style={styles.errorTitle}>Couldn't load deals</Text>
              <Text style={styles.errorSub}>{error}</Text>
              <Pressable style={styles.retryBtn} onPress={loadDeals}>
                <Text style={styles.retryText}>Try Again</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.centerContent}>
              <Text style={{ fontSize: 56, marginBottom: 8 }}>🎁</Text>
              <Text style={styles.emptyTitle}>No deals right now</Text>
              <Text style={styles.emptySub}>Pull down to refresh or check back soon!</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#312E81' },

  // Hero
  hero: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, backgroundColor: '#312E81',
    overflow: 'hidden', position: 'relative',
  },
  heroBubble1: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.05)', top: -50, right: -40,
  },
  heroBubble2: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)', bottom: -30, left: -20,
  },
  heroContent: { flex: 1 },
  heroLabel: {
    fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2, marginBottom: 4,
  },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#fff', lineHeight: 30 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  heroEmoji: { fontSize: 48, marginLeft: 12 },

  // Categories
  catSection: { backgroundColor: '#fff', paddingVertical: 12 },
  catRow: { paddingHorizontal: 16, gap: 8 },
  catPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.gray100, borderWidth: 1.5, borderColor: 'transparent',
  },
  catEmoji: { fontSize: 14 },
  catText: { fontSize: 13, fontWeight: '600', color: COLORS.gray600 },

  // Featured
  featuredSection: { paddingHorizontal: 16, paddingTop: 16, backgroundColor: COLORS.bg },
  featuredCard: {
    backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden',
    marginTop: 10, ...SHADOWS.cardHover,
  },
  featuredInner: { flexDirection: 'row', padding: 16 },
  featuredLeft: { flex: 1, marginRight: 12 },
  featuredDiscountBadge: {
    backgroundColor: '#EF4444', width: 52, height: 52, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  featuredDiscountText: { fontSize: 18, fontWeight: '900', color: '#fff' },
  featuredDiscountSub: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.8)', marginTop: -2 },
  featuredInfo: { flex: 1 },
  featuredShop: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  featuredName: { fontSize: 16, fontWeight: '800', color: COLORS.gray900, lineHeight: 21, marginBottom: 8 },
  featuredPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featuredPrice: { fontSize: 22, fontWeight: '800', color: COLORS.green },
  featuredOriginal: { fontSize: 14, color: COLORS.gray400, textDecorationLine: 'line-through' },
  featuredRight: { width: 120, alignItems: 'center' },
  featuredImage: { width: 120, height: 100, borderRadius: 12 },
  featuredImagePlaceholder: {
    width: 120, height: 100, borderRadius: 12, backgroundColor: '#EEF2FF',
    justifyContent: 'center', alignItems: 'center',
  },
  featuredTimer: {
    marginTop: 8, backgroundColor: COLORS.amberLight, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  featuredTimerUrgent: { backgroundColor: COLORS.redLight },
  featuredTimerText: { fontSize: 11, fontWeight: '700', color: COLORS.amber },
  featuredClaimBtn: {
    backgroundColor: COLORS.primary, paddingVertical: 14, alignItems: 'center',
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
  },
  featuredClaimBtnDisabled: { backgroundColor: COLORS.gray300 },
  featuredClaimText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  // Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, backgroundColor: COLORS.bg,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.gray900 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  countText: { fontSize: 12, fontWeight: '700' },

  // Grid
  list: { backgroundColor: COLORS.bg, paddingHorizontal: 12, paddingBottom: 32 },
  listEmpty: { flexGrow: 1 },
  gridRow: { gap: 10, marginBottom: 10 },

  // Deal card
  dealCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    maxWidth: (SCREEN_W - 34) / 2, ...SHADOWS.card,
  },
  dealCardExpired: { opacity: 0.5 },
  dealImageWrap: { width: '100%', height: 110, position: 'relative' },
  dealImage: { width: '100%', height: '100%' },
  dealImagePlaceholder: {
    width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#EEF2FF',
  },
  dealDiscountBadge: {
    position: 'absolute', top: 8, left: 8, backgroundColor: '#EF4444',
    width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  dealDiscountText: { fontSize: 13, fontWeight: '900', color: '#fff' },
  expiredOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  expiredText: { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: 2 },
  dealBody: { padding: 10, gap: 4 },
  dealShop: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  dealName: { fontSize: 13, fontWeight: '700', color: COLORS.gray900, lineHeight: 17 },
  dealPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dealPrice: { fontSize: 16, fontWeight: '800', color: COLORS.green },
  dealOriginal: { fontSize: 11, color: COLORS.gray400, textDecorationLine: 'line-through' },
  dealTimer: {
    backgroundColor: COLORS.amberLight, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 2,
  },
  dealTimerUrgent: { backgroundColor: COLORS.redLight },
  dealTimerExpired: { backgroundColor: COLORS.gray100 },
  dealTimerText: { fontSize: 10, fontWeight: '700', color: COLORS.amber },
  dealClaimBtn: {
    backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 8,
    alignItems: 'center', marginTop: 6,
  },
  dealClaimBtnDisabled: { backgroundColor: COLORS.gray200 },
  dealClaimText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // States
  centerContent: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingTop: 60, paddingHorizontal: 40, gap: 6,
  },
  loadingText: { fontSize: 14, color: COLORS.gray400, marginTop: 8 },
  errorTitle: { fontSize: 17, fontWeight: '700', color: COLORS.gray700 },
  errorSub: { fontSize: 13, color: COLORS.gray400, textAlign: 'center' },
  retryBtn: {
    marginTop: 14, paddingHorizontal: 28, paddingVertical: 12,
    backgroundColor: COLORS.primary, borderRadius: 14,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.gray700 },
  emptySub: { fontSize: 13, color: COLORS.gray400, textAlign: 'center', lineHeight: 20 },
});
