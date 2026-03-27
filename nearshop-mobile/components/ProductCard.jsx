import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SHADOWS, formatPrice } from '../constants/theme';
import WishlistHeart from './WishlistHeart';
import DealCountdown from './DealCountdown';
import { getRankingReasonLabel, getRankingReasonTone } from '../lib/ranking';
import { rankingRouteParams, trackRankingClick } from '../lib/rankingTracking';

const PLACEHOLDER = 'https://placehold.co/200x200/eee/999?text=📦';

export default function ProductCard({ product, onWishlistToggle, isWishlisted, tracking = null }) {
  const router = useRouter();
  const imageUri = product.images?.[0] || product.image_url || product.image || PLACEHOLDER;
  const price = Number(product.price) || 0;
  const comparePrice = Number(product.compare_price || product.original_price) || 0;
  const discount = comparePrice > price && price > 0
    ? Math.round((1 - price / comparePrice) * 100)
    : 0;
  const reasonTone = getRankingReasonTone(product.reason);
  const reasonLabel = getRankingReasonLabel(product.reason, '');

  const handlePress = () => {
    if (tracking?.ranking_surface) {
      trackRankingClick(product, tracking);
      router.push({
        pathname: `/(customer)/product/${product.id}`,
        params: rankingRouteParams({
          ...tracking,
          ranking_reason: product.reason || tracking.ranking_reason,
        }),
      });
      return;
    }
    router.push(`/(customer)/product/${product.id}`);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      style={styles.card}
    >
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          resizeMode="cover"
        />
        {discount > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{discount}% OFF</Text>
          </View>
        )}
        {onWishlistToggle && (
          <WishlistHeart
            isWishlisted={!!isWishlisted}
            onToggle={() => onWishlistToggle(product.id)}
            size={32}
            style={styles.wishlistBtn}
          />
        )}
      </View>
      <View style={styles.info}>
        <Text numberOfLines={2} style={styles.name}>{product.name}</Text>
        {reasonLabel ? (
          <View style={[styles.reasonChip, { backgroundColor: reasonTone.backgroundColor }]}>
            <Text style={[styles.reasonText, { color: reasonTone.textColor }]} numberOfLines={1}>
              {reasonLabel}
            </Text>
          </View>
        ) : null}
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(price)}</Text>
          {comparePrice > price && (
            <Text style={styles.comparePrice}>{formatPrice(comparePrice)}</Text>
          )}
        </View>
        <View style={styles.metaRow}>
          {product.shop_name && (
            <Text numberOfLines={1} style={styles.shopMeta}>
              {product.shop_name}
              {product.distance ? ` · ${product.distance}` : ''}
            </Text>
          )}
          {(product.view_count > 0 || product.views > 0) && (
            <Text style={styles.viewCount}>
              👁 {product.view_count || product.views}
            </Text>
          )}
        </View>
        {product.deal_ends_at && (
          <DealCountdown dealEndsAt={product.deal_ends_at} compact />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  imageWrap: {
    height: 140,
    backgroundColor: COLORS.gray100,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: COLORS.red,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8,
  },
  discountText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  wishlistBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.white,
    justifyContent: 'center', alignItems: 'center',
    ...SHADOWS.card,
  },
  info: { padding: 10 },
  name: { fontSize: 13, fontWeight: '500', color: COLORS.gray800, lineHeight: 18, marginBottom: 4 },
  reasonChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  reasonText: {
    fontSize: 10,
    fontWeight: '700',
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  price: { fontSize: 15, fontWeight: '700', color: COLORS.gray900 },
  comparePrice: { fontSize: 12, color: COLORS.gray400, textDecorationLine: 'line-through' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shopMeta: { fontSize: 11, color: COLORS.gray400, flex: 1 },
  viewCount: { fontSize: 10, color: COLORS.gray400, fontWeight: '600' },
});
