import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { getMyHaggles } from '../../lib/haggle';
import { GenericListSkeleton } from '../../components/ui/ScreenSkeletons';

const COLORS = {
  primary: '#7F77DD',
  green: '#1D9E75',
  amber: '#EF9F27',
  red: '#E24B4A',
  blue: '#3B8BD4',
  white: '#FFFFFF',
  bg: '#F9FAFB',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  primaryLight: '#EEEDFE',
  greenLight: '#E1F5EE',
  amberLight: '#FAEEDA',
  redLight: '#FCEBEB',
  blueLight: '#E6F1FB',
};

const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
};

const formatPrice = (p) => '₹' + Number(p).toLocaleString('en-IN');

const STATUS_STYLE = {
  pending: { bg: COLORS.amberLight, text: COLORS.amber },
  accepted: { bg: COLORS.greenLight, text: COLORS.green },
  rejected: { bg: COLORS.redLight, text: COLORS.red },
  countered: { bg: COLORS.blueLight, text: COLORS.blue },
};

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

export default function HaggleScreen() {
  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(customer)/profile');
  }, []);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => handler.remove();
  }, [goBack]);

  const [haggles, setHaggles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState(null);

  const loadHaggles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMyHaggles();
      const d = res?.data;
      setHaggles(Array.isArray(d) ? d : d?.items ?? d?.haggles ?? []);
    } catch {
      setError('Failed to load negotiations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHaggles();
  }, [loadHaggles]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHaggles();
    setRefreshing(false);
  };

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const renderHaggle = ({ item }) => {
    const statusStyle = STATUS_STYLE[item.status] || STATUS_STYLE.pending;
    const isExpanded = expandedId === item.id;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => toggleExpand(item.id)}
        activeOpacity={0.85}
      >
        {/* Top row */}
        <View style={styles.cardTop}>
          <View style={styles.cardTitles}>
            <Text style={styles.productName} numberOfLines={1}>{item.product_name}</Text>
            <Text style={styles.shopName} numberOfLines={1}>{item.shop_name}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>
              {item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'Pending'}
            </Text>
          </View>
        </View>

        {/* Price row */}
        <View style={styles.priceRow}>
          <View style={styles.priceBlock}>
            <Text style={styles.priceLabel}>Your Offer</Text>
            <Text style={styles.offerPrice}>{formatPrice(item.offer_price)}</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={COLORS.gray400} style={{ marginTop: 16 }} />
          <View style={styles.priceBlock}>
            <Text style={styles.priceLabel}>Listed Price</Text>
            <Text style={styles.listedPrice}>{formatPrice(item.listed_price)}</Text>
          </View>
        </View>

        {/* Last message + time */}
        {item.last_message && (
          <Text style={styles.lastMessage} numberOfLines={1}>{item.last_message}</Text>
        )}
        <Text style={styles.timeAgo}>{timeAgo(item.updated_at || item.created_at)}</Text>

        {/* Action Buttons */}
        {item.status === 'accepted' && (
          <TouchableOpacity
            style={styles.orderNowBtn}
            onPress={() => router.push({ pathname: '/(customer)/product', params: { id: item.product_id } })}
          >
            <Ionicons name="bag-check-outline" size={16} color={COLORS.white} />
            <Text style={styles.orderNowText}>Order Now</Text>
          </TouchableOpacity>
        )}

        {item.status === 'countered' && (
          <TouchableOpacity
            style={styles.counterBtn}
            onPress={() => toggleExpand(item.id)}
          >
            <Text style={styles.counterBtnText}>View Counter Offer</Text>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={COLORS.blue}
            />
          </TouchableOpacity>
        )}

        {/* Expanded thread */}
        {isExpanded && (
          <View style={styles.thread}>
            <View style={styles.threadDivider} />
            <Text style={styles.threadTitle}>Negotiation Thread</Text>

            <View style={styles.threadRow}>
              <View style={styles.threadBubbleYou}>
                <Text style={styles.threadBubbleLabel}>Your Offer</Text>
                <Text style={styles.threadBubblePrice}>{formatPrice(item.offer_price)}</Text>
                {item.message && (
                  <Text style={styles.threadBubbleMsg}>{item.message}</Text>
                )}
              </View>
            </View>

            {item.response && (
              <View style={styles.threadRow}>
                <View style={styles.threadBubbleShop}>
                  <Text style={styles.threadBubbleLabel}>
                    {item.status === 'countered' ? 'Counter Offer' : 'Shop Response'}
                  </Text>
                  {item.counter_price && (
                    <Text style={styles.threadBubblePrice}>{formatPrice(item.counter_price)}</Text>
                  )}
                  <Text style={styles.threadBubbleMsg}>{item.response}</Text>
                </View>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={goBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.gray800} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Negotiations</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Content */}
      {loading && haggles.length === 0 ? (
        <GenericListSkeleton />
      ) : (
        <FlatList
          data={haggles}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderHaggle}
          contentContainerStyle={haggles.length === 0 ? { flex: 1 } : { paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🤝</Text>
              <Text style={styles.emptyTitle}>No negotiations yet</Text>
              <Text style={styles.emptySubtitle}>Browse products to start haggling</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  card: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 14,
    ...SHADOWS.card,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardTitles: {
    flex: 1,
    marginRight: 10,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.gray900,
    marginBottom: 2,
  },
  shopName: {
    fontSize: 13,
    color: COLORS.gray500,
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  priceBlock: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 11,
    color: COLORS.gray400,
    fontWeight: '500',
    marginBottom: 2,
  },
  offerPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  listedPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gray600,
    textDecorationLine: 'line-through',
  },
  lastMessage: {
    fontSize: 13,
    color: COLORS.gray500,
    marginBottom: 4,
  },
  timeAgo: {
    fontSize: 11,
    color: COLORS.gray400,
    marginBottom: 4,
  },
  orderNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.green,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 10,
  },
  orderNowText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  counterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: COLORS.blue,
    borderRadius: 10,
    paddingVertical: 9,
    marginTop: 10,
  },
  counterBtnText: {
    color: COLORS.blue,
    fontWeight: '700',
    fontSize: 14,
  },
  thread: {
    marginTop: 4,
  },
  threadDivider: {
    height: 1,
    backgroundColor: COLORS.gray100,
    marginVertical: 12,
  },
  threadTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray400,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  threadRow: {
    marginBottom: 10,
  },
  threadBubbleYou: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    padding: 12,
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  threadBubbleShop: {
    backgroundColor: COLORS.gray100,
    borderRadius: 10,
    padding: 12,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  threadBubbleLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.gray500,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  threadBubblePrice: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.gray900,
    marginBottom: 4,
  },
  threadBubbleMsg: {
    fontSize: 13,
    color: COLORS.gray700,
    lineHeight: 18,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  emptyEmoji: {
    fontSize: 52,
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gray700,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.gray400,
  },
});
