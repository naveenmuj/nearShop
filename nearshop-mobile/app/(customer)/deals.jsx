import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator,
  RefreshControl, ScrollView, StatusBar, Image, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';
import { getNearbyDeals, claimDeal } from '../../lib/deals';
import useLocationStore from '../../store/locationStore';

const CATEGORIES = [
  { key: 'All',         emoji: '🔥' },
  { key: 'Electronics', emoji: '📱' },
  { key: 'Clothing',   emoji: '👕' },
  { key: 'Grocery',    emoji: '🛒' },
  { key: 'Food',       emoji: '🍔' },
  { key: 'Home',       emoji: '🏠' },
  { key: 'Beauty',     emoji: '💄' },
];

// ── Countdown hook ────────────────────────────────────────────────────────────
function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState({ text: '', urgent: false });
  const timerRef = useRef(null);

  useEffect(() => {
    const tick = () => {
      const diff = new Date(expiresAt) - Date.now();
      if (diff <= 0) {
        setRemaining({ text: 'Expired', urgent: false });
        clearInterval(timerRef.current);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const urgent = diff < 3600000; // < 1 hour
      if (h > 0) setRemaining({ text: `${h}h ${m}m`, urgent: false });
      else if (m > 0) setRemaining({ text: `${m}m ${s}s`, urgent });
      else setRemaining({ text: `${s}s`, urgent: true });
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [expiresAt]);

  return remaining;
}

// ── Deal card ─────────────────────────────────────────────────────────────────
function DealCard({ deal, onClaim, claiming }) {
  const { text: countdown, urgent } = useCountdown(deal.expires_at);
  const expired = countdown === 'Expired';
  const discount = deal.original_price && deal.original_price > deal.price
    ? Math.round((1 - deal.price / deal.original_price) * 100)
    : null;

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (urgent && !expired) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [urgent, expired]);

  return (
    <Pressable
      style={[styles.card, expired && styles.cardExpired]}
      onPress={() => !expired && router.push(`/(customer)/product/${deal.product_id}`)}
      android_ripple={{ color: 'rgba(127,119,221,0.08)' }}
    >
      {/* Image or gradient placeholder */}
      <View style={styles.cardImageWrap}>
        {deal.image_url ? (
          <Image source={{ uri: deal.image_url }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImagePlaceholder, expired && styles.cardImagePlaceholderExpired]}>
            <Text style={styles.placeholderEmoji}>
              {CATEGORIES.find(c => c.key === deal.category)?.emoji ?? '🎁'}
            </Text>
          </View>
        )}

        {/* Discount badge */}
        {discount != null && discount > 0 && !expired && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{discount}% OFF</Text>
          </View>
        )}

        {/* Expired overlay */}
        {expired && (
          <View style={styles.expiredOverlay}>
            <Text style={styles.expiredOverlayText}>EXPIRED</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.cardBody}>
        {/* Shop + timer row */}
        <View style={styles.shopTimerRow}>
          <Text style={styles.shopName} numberOfLines={1}>{deal.shop_name}</Text>
          <Animated.View style={[styles.timerBadge, urgent && styles.timerBadgeUrgent, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.timerIcon}>{expired ? '⏰' : urgent ? '🔥' : '⏱'}</Text>
            <Text style={[styles.timerText, urgent && !expired && styles.timerTextUrgent, expired && styles.timerTextExpired]}>
              {countdown}
            </Text>
          </Animated.View>
        </View>

        {/* Product name */}
        <Text style={[styles.productName, expired && styles.textMuted]} numberOfLines={2}>
          {deal.product_name}
        </Text>

        {/* Description */}
        {deal.description ? (
          <Text style={styles.description} numberOfLines={2}>{deal.description}</Text>
        ) : null}

        {/* Price + claim */}
        <View style={styles.priceClaimRow}>
          <View>
            <Text style={[styles.dealPrice, expired && styles.textMuted]}>
              {formatPrice(deal.price)}
            </Text>
            {deal.original_price && deal.original_price > deal.price ? (
              <Text style={styles.originalPrice}>{formatPrice(deal.original_price)}</Text>
            ) : null}
          </View>

          <Pressable
            style={[
              styles.claimBtn,
              expired && styles.claimBtnExpired,
              claiming && styles.claimBtnLoading,
            ]}
            onPress={() => !expired && !claiming && onClaim(deal.id)}
            disabled={expired || claiming}
            android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
          >
            {claiming ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={[styles.claimBtnText, (expired || claiming) && styles.claimBtnTextMuted]}>
                {expired ? 'Expired' : 'Claim Deal'}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Footer: location + claims count */}
        <View style={styles.cardFooter}>
          <Text style={styles.footerText} numberOfLines={1}>
            📍 {deal.shop_address || deal.shop_name}
          </Text>
          {deal.claims_count != null && deal.claims_count > 0 && (
            <View style={styles.claimsCountBadge}>
              <Text style={styles.claimsCountText}>{deal.claims_count} claimed</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ── Hero header ───────────────────────────────────────────────────────────────
function HeroHeader({ count }) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroContent}>
        <Text style={styles.heroLabel}>NEAR YOU TODAY</Text>
        <Text style={styles.heroTitle}>Deals & Offers</Text>
        <Text style={styles.heroSub}>
          {count > 0 ? `${count} active deal${count !== 1 ? 's' : ''} nearby` : 'Checking deals near you…'}
        </Text>
      </View>
      <Text style={styles.heroEmoji}>🎁</Text>
    </View>
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
      setDeals(res.data?.items ?? res.data ?? []);
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
      await loadDeals();
    } catch {
      // silently ignore
    } finally {
      setClaimingId(null);
    }
  };

  const activeDeals = deals.filter(d => new Date(d.expires_at) > Date.now());
  const expiredDeals = deals.filter(d => new Date(d.expires_at) <= Date.now());
  const orderedDeals = [...activeDeals, ...expiredDeals];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#4338CA" />

      <FlatList
        data={isLoading ? [] : orderedDeals}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <DealCard
            deal={item}
            onClaim={handleClaim}
            claiming={claimingId === item.id}
          />
        )}
        contentContainerStyle={[
          styles.list,
          orderedDeals.length === 0 && !isLoading && styles.listEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.white}
            progressBackgroundColor={COLORS.primary}
          />
        }
        ListHeaderComponent={
          <>
            <HeroHeader count={activeDeals.length} />

            {/* Category pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}
              style={styles.categoryScroll}
            >
              {CATEGORIES.map(({ key, emoji }) => (
                <Pressable
                  key={key}
                  style={[styles.catPill, activeCategory === key && styles.catPillActive]}
                  onPress={() => setActiveCategory(key)}
                  android_ripple={{ color: 'rgba(127,119,221,0.15)' }}
                >
                  <Text style={styles.catEmoji}>{emoji}</Text>
                  <Text style={[styles.catText, activeCategory === key && styles.catTextActive]}>{key}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Section label */}
            {!isLoading && orderedDeals.length > 0 && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {activeCategory === 'All' ? '🔥 Hot Deals' : `${CATEGORIES.find(c => c.key === activeCategory)?.emoji ?? ''} ${activeCategory} Deals`}
                </Text>
                <Text style={styles.sectionCount}>{activeDeals.length} active</Text>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Finding deals near you…</Text>
            </View>
          ) : error ? (
            <View style={styles.centerContent}>
              <Text style={styles.errorEmoji}>😕</Text>
              <Text style={styles.errorTitle}>Couldn't load deals</Text>
              <Text style={styles.errorSub}>{error}</Text>
              <Pressable style={styles.retryBtn} onPress={loadDeals}>
                <Text style={styles.retryText}>Try Again</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.centerContent}>
              <Text style={styles.emptyEmoji}>🎁</Text>
              <Text style={styles.emptyTitle}>No deals right now</Text>
              <Text style={styles.emptySub}>Pull down to refresh or check back soon!</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#4338CA' },

  // Hero
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    backgroundColor: '#4338CA',
  },
  heroContent: { flex: 1 },
  heroLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 2,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.white,
    lineHeight: 32,
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 6,
  },
  heroEmoji: { fontSize: 52, marginLeft: 12 },

  // Category pills
  categoryScroll: { backgroundColor: COLORS.white },
  categoryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: COLORS.white,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.gray100,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  catPillActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  catEmoji: { fontSize: 14 },
  catText: { fontSize: 13, fontWeight: '600', color: COLORS.gray600 },
  catTextActive: { color: COLORS.primaryDark, fontWeight: '700' },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: COLORS.bg,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.gray900 },
  sectionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },

  // List
  list: { backgroundColor: COLORS.bg, paddingHorizontal: 16, paddingBottom: 32, gap: 14 },
  listEmpty: { flexGrow: 1 },

  // Card
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  cardExpired: { opacity: 0.55 },

  // Card image
  cardImageWrap: { width: '100%', height: 160, position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4338CA',
  },
  cardImagePlaceholderExpired: {
    backgroundColor: COLORS.gray200,
  },
  placeholderEmoji: { fontSize: 52 },
  discountBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: COLORS.red,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  discountText: { fontSize: 12, fontWeight: '800', color: COLORS.white },
  expiredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expiredOverlayText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 3,
  },

  // Card body
  cardBody: { padding: 16, gap: 6 },
  shopTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  shopName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    flex: 1,
    marginRight: 8,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.amberLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  timerBadgeUrgent: { backgroundColor: COLORS.redLight },
  timerIcon: { fontSize: 12 },
  timerText: { fontSize: 12, fontWeight: '700', color: COLORS.amber },
  timerTextUrgent: { color: COLORS.red },
  timerTextExpired: { color: COLORS.gray400 },
  productName: { fontSize: 17, fontWeight: '800', color: COLORS.gray900, lineHeight: 22 },
  textMuted: { color: COLORS.gray400 },
  description: {
    fontSize: 13,
    color: COLORS.gray500,
    lineHeight: 18,
  },

  // Price + claim
  priceClaimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  dealPrice: { fontSize: 22, fontWeight: '800', color: COLORS.green },
  originalPrice: {
    fontSize: 13,
    color: COLORS.gray400,
    textDecorationLine: 'line-through',
    marginTop: 1,
  },
  claimBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
    minWidth: 110,
    alignItems: 'center',
  },
  claimBtnExpired: { backgroundColor: COLORS.gray200 },
  claimBtnLoading: { opacity: 0.8 },
  claimBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
  claimBtnTextMuted: { color: COLORS.gray400 },

  // Footer
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.gray100,
  },
  footerText: { fontSize: 12, color: COLORS.gray400, flex: 1 },
  claimsCountBadge: {
    backgroundColor: COLORS.greenLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  claimsCountText: { fontSize: 11, fontWeight: '700', color: COLORS.green },

  // States
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
    gap: 8,
  },
  loadingText: { fontSize: 14, color: COLORS.gray400, marginTop: 8 },
  errorEmoji: { fontSize: 44, marginBottom: 4 },
  errorTitle: { fontSize: 17, fontWeight: '700', color: COLORS.gray700 },
  errorSub: { fontSize: 13, color: COLORS.gray400, textAlign: 'center' },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
  },
  retryText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  emptyEmoji: { fontSize: 52, marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.gray700 },
  emptySub: { fontSize: 13, color: COLORS.gray400, textAlign: 'center', lineHeight: 20 },
});
