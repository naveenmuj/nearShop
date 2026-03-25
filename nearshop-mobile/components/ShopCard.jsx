import { View, Text, Image, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS, CATEGORY_COLORS } from '../constants/theme';
import { useEffect, useRef } from 'react';

const CATEGORY_EMOJI = {
  Electronics: '📱',
  Clothing: '👗',
  Fashion: '👗',
  Grocery: '🥬',
  Food: '🍰',
  Home: '🏠',
  Beauty: '💄',
};

export default function ShopCard({ shop, distance = null, showDelivery = true }) {
  const router = useRouter();
  const catColor = CATEGORY_COLORS[shop.category] || COLORS.primary;
  const emoji = CATEGORY_EMOJI[shop.category] || '🏪';

  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, []);

  const deliveryMode = shop.delivery_options?.includes('delivery') ? 'delivery' : 'pickup';
  const isOpenNow = shop.is_open_now;
  const rawDist = distance || shop.distance_km;
  const dist = rawDist != null ? Number(rawDist) : null;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={() => router.push(`/(customer)/shop/${shop.id}`)}
        activeOpacity={0.85}
        style={styles.card}
      >
        {/* Cover Image */}
        {shop.cover_image && (
          <Image source={{ uri: shop.cover_image }} style={styles.cover} />
        )}

        {/* Status Badge */}
        <View style={styles.badgeContainer}>
          <View style={[
            styles.statusBadge,
            { backgroundColor: isOpenNow ? COLORS.green : COLORS.gray400 }
          ]}>
            <Text style={styles.statusText}>
              {isOpenNow ? '● Open' : 'Closed'}
            </Text>
          </View>

          {/* Delivery Mode Badge */}
          {showDelivery && (
            <View style={[
              styles.deliveryBadge,
              { backgroundColor: deliveryMode === 'delivery' ? COLORS.primary : COLORS.orange }
            ]}>
              <Ionicons
                name={deliveryMode === 'delivery' ? 'car' : 'storefront'}
                size={12}
                color={COLORS.white}
              />
              <Text style={styles.deliveryText}>
                {deliveryMode === 'delivery' ? 'Delivery' : 'Pickup'}
              </Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={[styles.avatar, { backgroundColor: catColor + '20' }]}>
              <Text style={styles.avatarEmoji}>{emoji}</Text>
            </View>
            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>{shop.name}</Text>
                {shop.is_verified && (
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.green} />
                )}
              </View>
              <Text style={styles.category} numberOfLines={1}>
                {shop.category}
              </Text>
            </View>
          </View>

          {/* Rating & Distance */}
          <View style={styles.statsRow}>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color={COLORS.amber} />
              <Text style={styles.rating}>{(Number(shop.avg_rating) || 0).toFixed(1)}</Text>
              {shop.total_reviews ? (
                <Text style={styles.reviewCount}>({shop.total_reviews})</Text>
              ) : null}
            </View>

            {dist != null && !isNaN(dist) && (
              <View style={styles.distanceRow}>
                <MaterialCommunityIcons name="map-marker" size={12} color={COLORS.red} />
                <Text style={styles.distance}>{dist.toFixed(1)}km</Text>
              </View>
            )}
          </View>

          {/* Delivery Info */}
          {showDelivery && deliveryMode === 'delivery' && (
            <View style={styles.deliveryInfo}>
              <MaterialCommunityIcons name="truck-fast" size={14} color={COLORS.primary} />
              <Text style={styles.deliveryFee}>
                {shop.delivery_fee === 0 ? '🎉 Free' : `₹${shop.delivery_fee}`}
              </Text>
              {shop.min_order && (
                <Text style={styles.minOrder}>Min ₹{shop.min_order}</Text>
              )}
            </View>
          )}

          {/* Products Count */}
          {shop.total_products > 0 && (
            <Text style={styles.productCount}>{shop.total_products} products</Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    ...SHADOWS.card,
    width: '100%',
    marginBottom: 12,
  },
  cover: {
    width: '100%',
    height: 140,
    backgroundColor: COLORS.gray100,
  },
  badgeContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },
  deliveryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deliveryText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },
  content: {
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarEmoji: {
    fontSize: 26,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.gray900,
    flex: 1,
  },
  category: {
    fontSize: 12,
    color: COLORS.gray500,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray700,
  },
  reviewCount: {
    fontSize: 11,
    color: COLORS.gray500,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.red + '10',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  distance: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.red,
  },
  deliveryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
  },
  deliveryFee: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    flex: 1,
  },
  minOrder: {
    fontSize: 10,
    color: COLORS.gray500,
  },
  productCount: {
    fontSize: 11,
    color: COLORS.gray500,
  },
});
