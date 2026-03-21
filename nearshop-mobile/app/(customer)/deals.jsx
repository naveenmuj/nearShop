import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator,
  RefreshControl, ScrollView, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';
import { getNearbyDeals, claimDeal } from '../../lib/deals';
import useLocationStore from '../../store/locationStore';

const CATEGORIES = ['All', 'Electronics', 'Clothing', 'Grocery', 'Food', 'Home', 'Beauty'];

function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    const tick = () => {
      const diff = new Date(expiresAt) - Date.now();
      if (diff <= 0) {
        setRemaining('Expired');
        clearInterval(timerRef.current);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 0) setRemaining(`${h}h ${m}m`);
      else if (m > 0) setRemaining(`${m}m ${s}s`);
      else setRemaining(`${s}s`);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [expiresAt]);

  return remaining;
}

function DealCard({ deal, onClaim }) {
  const countdown = useCountdown(deal.expires_at);
  const expired = countdown === 'Expired';
  const discount = deal.original_price
    ? Math.round((1 - deal.price / deal.original_price) * 100)
    : null;

  return (
    <Pressable
      style={[styles.card, expired && styles.cardExpired]}
      onPress={() => router.push(`/(customer)/product/${deal.product_id}`)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.shopRow}>
          <Text style={styles.shopName}>{deal.shop_name}</Text>
          {discount != null && discount > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{discount}% OFF</Text>
            </View>
          )}
        </View>
        <View style={[styles.timerBadge, expired && styles.timerExpired]}>
          <Text style={styles.timerIcon}>⏱</Text>
          <Text style={[styles.timerText, expired && styles.timerTextExpired]}>{countdown}</Text>
        </View>
      </View>

      <Text style={styles.productName} numberOfLines={2}>{deal.product_name}</Text>
      {deal.description ? (
        <Text style={styles.description} numberOfLines={2}>{deal.description}</Text>
      ) : null}

      <View style={styles.priceRow}>
        <View>
          <Text style={styles.dealPrice}>{formatPrice(deal.price)}</Text>
          {deal.original_price ? (
            <Text style={styles.originalPrice}>{formatPrice(deal.original_price)}</Text>
          ) : null}
        </View>
        <Pressable
          style={[styles.claimBtn, expired && styles.claimBtnDisabled]}
          onPress={() => !expired && onClaim(deal.id)}
          disabled={expired}
        >
          <Text style={styles.claimBtnText}>{expired ? 'Expired' : 'Claim'}</Text>
        </Pressable>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.footerText}>📍 {deal.shop_address || deal.shop_name}</Text>
        {deal.claims_count != null && (
          <Text style={styles.footerText}>{deal.claims_count} claimed</Text>
        )}
      </View>
    </Pressable>
  );
}

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
      setError('Failed to load deals');
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Deals Near You</Text>
        <Text style={styles.headerSub}>{deals.length} active deals</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
      >
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            style={[styles.catPill, activeCategory === cat && styles.catPillActive]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text style={[styles.catText, activeCategory === cat && styles.catTextActive]}>
              {cat}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={loadDeals}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : deals.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🎁</Text>
          <Text style={styles.emptyTitle}>No deals right now</Text>
          <Text style={styles.emptySub}>Check back soon for great offers</Text>
        </View>
      ) : (
        <FlatList
          data={deals}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <DealCard deal={item} onClaim={handleClaim} />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {claimingId != null && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={COLORS.white} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: COLORS.gray900 },
  headerSub: { fontSize: 13, color: COLORS.gray500, marginTop: 2 },
  categoryRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  catPill: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray200,
  },
  catPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catText: { fontSize: 13, fontWeight: '500', color: COLORS.gray600 },
  catTextActive: { color: COLORS.white },
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: 12 },
  card: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 16,
    ...SHADOWS.card,
  },
  cardExpired: { opacity: 0.6 },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 8,
  },
  shopRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  shopName: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  discountBadge: {
    backgroundColor: COLORS.redLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  discountText: { fontSize: 11, fontWeight: '700', color: COLORS.red },
  timerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.amberLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  timerExpired: { backgroundColor: COLORS.gray100 },
  timerIcon: { fontSize: 11 },
  timerText: { fontSize: 12, fontWeight: '600', color: COLORS.amber },
  timerTextExpired: { color: COLORS.gray400 },
  productName: { fontSize: 16, fontWeight: '700', color: COLORS.gray900, marginBottom: 4 },
  description: { fontSize: 13, color: COLORS.gray500, lineHeight: 18, marginBottom: 12 },
  priceRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10, marginTop: 4,
  },
  dealPrice: { fontSize: 18, fontWeight: '700', color: COLORS.green },
  originalPrice: { fontSize: 13, color: COLORS.gray400, textDecorationLine: 'line-through', marginTop: 2 },
  claimBtn: {
    backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12,
  },
  claimBtnDisabled: { backgroundColor: COLORS.gray300 },
  claimBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.gray100,
  },
  footerText: { fontSize: 12, color: COLORS.gray400 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  errorText: { color: COLORS.red, fontSize: 14 },
  retryBtn: {
    marginTop: 8, paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: COLORS.primary, borderRadius: 10,
  },
  retryText: { color: COLORS.white, fontWeight: '600' },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: COLORS.gray700 },
  emptySub: { fontSize: 13, color: COLORS.gray400 },
  overlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
});
