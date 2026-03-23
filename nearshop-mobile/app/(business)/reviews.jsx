import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import client from '../../lib/api';
import useMyShop from '../../hooks/useMyShop';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';

const STARS = [5, 4, 3, 2, 1];

export default function ReviewsScreen() {
  const { shopId } = useMyShop();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { const h = BackHandler.addEventListener('hardwareBackPress', () => { router.navigate('/(business)/more'); return true; }); return () => h.remove(); }, []);

  const loadData = useCallback(async () => {
    if (!shopId) return;
    setLoading(true); setError(null);
    try {
      const [rRes] = await Promise.allSettled([client.get(`/shops/${shopId}/reviews`)]);
      if (rRes.status === 'fulfilled') setReviews(rRes.value.data?.reviews ?? rRes.value.data ?? []);
      else setError('Failed to load reviews');
    } catch { setError('Failed to load data'); }
    finally { setLoading(false); }
  }, [shopId]);

  useEffect(() => { loadData(); }, [loadData]);

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1) : '0.0';
  const distribution = STARS.map(star => ({ star, count: reviews.filter(r => Math.round(r.rating) === star).length }));
  const maxCount = Math.max(...distribution.map(d => d.count), 1);

  const renderStars = (rating) => {
    const full = Math.floor(rating);
    return Array.from({ length: 5 }, (_, i) => i < full ? '\u2605' : '\u2606').join('');
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.navigate('/(business)/more')}><Text style={s.back}>← Back</Text></TouchableOpacity>
        <Text style={s.title}>Reviews</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} /> :
         error ? <Text style={s.empty}>{error}</Text> : null}

        {!loading && reviews.length > 0 && (
          <View style={s.summaryCard}>
            <View style={s.summaryLeft}>
              <Text style={s.avgRating}>{avgRating}</Text>
              <Text style={s.avgStars}>{renderStars(Number(avgRating))}</Text>
              <Text style={s.reviewCount}>{reviews.length} review{reviews.length !== 1 ? 's' : ''}</Text>
            </View>
            <View style={s.summaryRight}>
              {distribution.map(d => (
                <View key={d.star} style={s.distRow}>
                  <Text style={s.distStar}>{d.star}</Text>
                  <View style={s.barBg}>
                    <View style={[s.barFill, { width: `${(d.count / maxCount) * 100}%` }]} />
                  </View>
                  <Text style={s.distCount}>{d.count}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {!loading && reviews.length === 0 && !error && (
          <Text style={s.empty}>No reviews yet</Text>
        )}

        {!loading && reviews.map((r, i) => (
          <View key={r.id || i} style={s.card}>
            <View style={s.cardTop}>
              <View>
                <Text style={s.reviewer}>{r.customer_name || r.user_name || 'Anonymous'}</Text>
                <Text style={s.reviewDate}>{r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</Text>
              </View>
              <View style={s.ratingBadge}>
                <Text style={s.ratingText}>{r.rating?.toFixed(1) ?? '0'} {'\u2605'}</Text>
              </View>
            </View>
            {r.comment && <Text style={s.comment}>{r.comment}</Text>}
            {r.product_name && <Text style={s.productTag}>Product: {r.product_name}</Text>}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  back: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.gray900 },
  content: { padding: 16, paddingBottom: 40 },
  empty: { textAlign: 'center', color: COLORS.gray400, marginTop: 40 },
  summaryCard: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 14, padding: 16, marginBottom: 16, ...SHADOWS.card },
  summaryLeft: { alignItems: 'center', justifyContent: 'center', paddingRight: 20, borderRightWidth: 1, borderRightColor: COLORS.gray100 },
  avgRating: { fontSize: 36, fontWeight: '800', color: COLORS.gray900 },
  avgStars: { fontSize: 16, color: COLORS.amber, marginTop: 2 },
  reviewCount: { fontSize: 12, color: COLORS.gray400, marginTop: 4 },
  summaryRight: { flex: 1, paddingLeft: 16, justifyContent: 'center' },
  distRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  distStar: { fontSize: 12, fontWeight: '600', color: COLORS.gray500, width: 14 },
  barBg: { flex: 1, height: 8, backgroundColor: COLORS.gray100, borderRadius: 4, marginHorizontal: 8, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: COLORS.amber, borderRadius: 4 },
  distCount: { fontSize: 11, color: COLORS.gray400, width: 20, textAlign: 'right' },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 10, ...SHADOWS.card },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  reviewer: { fontSize: 14, fontWeight: '600', color: COLORS.gray800 },
  reviewDate: { fontSize: 11, color: COLORS.gray400, marginTop: 2 },
  ratingBadge: { backgroundColor: COLORS.amberLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  ratingText: { fontSize: 13, fontWeight: '700', color: COLORS.amber },
  comment: { fontSize: 14, color: COLORS.gray700, lineHeight: 20, marginBottom: 6 },
  productTag: { fontSize: 12, color: COLORS.gray500, fontStyle: 'italic' },
});
