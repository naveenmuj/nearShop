import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, StatusBar, BackHandler, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import client from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import useMyShop from '../../hooks/useMyShop';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';

const STARS = [5, 4, 3, 2, 1];

export default function ReviewsScreen() {
  const { shopId } = useMyShop();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [replyText, setReplyText] = useState({});
  const [replyingId, setReplyingId] = useState(null);

  useEffect(() => { const h = BackHandler.addEventListener('hardwareBackPress', () => { router.navigate('/(business)/more'); return true; }); return () => h.remove(); }, []);

  const loadData = useCallback(async (silent = false) => {
    if (!shopId) { setLoading(false); return; }
    if (!silent) setLoading(true);
    setError(null);
    try {
      // Use correct endpoint
      const res = await client.get(`/reviews/shop/${shopId}`);
      const d = res.data;
      setReviews(Array.isArray(d) ? d : d?.items ?? d?.reviews ?? []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load reviews');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [shopId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleReply = async (reviewId) => {
    const text = replyText[reviewId]?.trim();
    if (!text) return;
    setReplyingId(reviewId);
    try {
      await client.post(`/reviews/${reviewId}/reply`, { reply: text });
      toast.show({ type: 'success', text1: 'Reply posted!' });
      setReplyText(prev => ({ ...prev, [reviewId]: '' }));
      loadData(true);
    } catch (err) {
      toast.show({ type: 'error', text1: err?.response?.data?.detail || 'Failed to reply' });
    } finally {
      setReplyingId(null);
    }
  };

  const safeReviews = Array.isArray(reviews) ? reviews : [];
  const avgRating = safeReviews.length > 0 ? (safeReviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / safeReviews.length).toFixed(1) : '0.0';
  const distribution = STARS.map(star => ({ star, count: safeReviews.filter(r => Math.round(Number(r.rating) || 0) === star).length }));
  const counts = distribution.map(d => d.count);
  const maxCount = counts.length > 0 ? Math.max(...counts, 1) : 1;

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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(true); }} tintColor={COLORS.primary} />}
      >
        {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} /> :
         error ? (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>⭐</Text>
            <Text style={s.empty}>{error}</Text>
            <TouchableOpacity onPress={() => loadData()} style={s.retryBtn}><Text style={s.retryText}>Retry</Text></TouchableOpacity>
          </View>
        ) : null}

        {!loading && safeReviews.length > 0 && (
          <View style={s.summaryCard}>
            <View style={s.summaryLeft}>
              <Text style={s.avgRating}>{avgRating}</Text>
              <Text style={s.avgStars}>{renderStars(Number(avgRating))}</Text>
              <Text style={s.reviewCount}>{safeReviews.length} review{safeReviews.length !== 1 ? 's' : ''}</Text>
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

        {!loading && safeReviews.length === 0 && !error && (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Text style={{ fontSize: 52, marginBottom: 12 }}>⭐</Text>
            <Text style={s.emptyTitle}>No reviews yet</Text>
            <Text style={s.emptySub}>Reviews will appear here when customers leave feedback</Text>
          </View>
        )}

        {!loading && safeReviews.map((r, i) => (
          <View key={r.id || i} style={s.card}>
            <View style={s.cardTop}>
              <View style={s.reviewerRow}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{(r.customer_name || 'A')[0].toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={s.reviewer}>{r.customer_name || r.user_name || 'Customer'}</Text>
                  <Text style={s.reviewDate}>{r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</Text>
                </View>
              </View>
              <View style={s.ratingBadge}>
                <Text style={s.ratingText}>{r.rating?.toFixed?.(1) ?? Number(r.rating || 0).toFixed(1)} {'\u2605'}</Text>
              </View>
            </View>
            {r.comment && <Text style={s.comment}>{r.comment}</Text>}
            {r.product_name && <Text style={s.productTag}>📦 {r.product_name}</Text>}

            {/* Reply section */}
            {(r.reply || r.shop_reply) ? (
              <View style={s.replyBox}>
                <Text style={s.replyLabel}>Your reply</Text>
                <Text style={s.replyText}>{r.reply || r.shop_reply}</Text>
              </View>
            ) : (
              <View style={s.replyInputRow}>
                <TextInput
                  style={s.replyInput}
                  value={replyText[r.id] || ''}
                  onChangeText={(t) => setReplyText(prev => ({ ...prev, [r.id]: t }))}
                  placeholder="Write a reply..."
                  placeholderTextColor={COLORS.gray400}
                />
                <TouchableOpacity
                  onPress={() => handleReply(r.id)}
                  disabled={replyingId === r.id}
                  style={s.replyBtn}
                >
                  <Text style={s.replyBtnText}>{replyingId === r.id ? '...' : 'Reply'}</Text>
                </TouchableOpacity>
              </View>
            )}
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
  reviewerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  comment: { fontSize: 14, color: COLORS.gray700, lineHeight: 20, marginBottom: 6 },
  productTag: { fontSize: 12, color: COLORS.gray500, marginBottom: 8 },
  replyBox: { backgroundColor: COLORS.gray50, borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: COLORS.green, marginTop: 8 },
  replyLabel: { fontSize: 11, fontWeight: '700', color: COLORS.green, marginBottom: 4 },
  replyText: { fontSize: 13, color: COLORS.gray600, lineHeight: 18 },
  replyInputRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  replyInput: { flex: 1, borderWidth: 1, borderColor: COLORS.gray200, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: COLORS.gray900 },
  replyBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, justifyContent: 'center' },
  replyBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  retryBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.primaryLight },
  retryText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.gray700, marginBottom: 6 },
  emptySub: { fontSize: 14, color: COLORS.gray400, textAlign: 'center' },
});
