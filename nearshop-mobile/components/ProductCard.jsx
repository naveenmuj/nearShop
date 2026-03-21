import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, formatPrice } from '../constants/theme';

const PLACEHOLDER = 'https://placehold.co/200x200/eee/999?text=📦';

export default function ProductCard({ product, onWishlistToggle, isWishlisted }) {
  const router = useRouter();
  const imageUri = product.images?.[0] || product.image_url || product.image || PLACEHOLDER;
  const comparePrice = product.compare_price || product.original_price;
  const discount = comparePrice && comparePrice > product.price
    ? Math.round((1 - product.price / comparePrice) * 100)
    : 0;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(customer)/product/${product.id}`)}
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
          <TouchableOpacity
            onPress={() => onWishlistToggle(product.id)}
            style={styles.wishlistBtn}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons
              name={isWishlisted ? 'heart' : 'heart-outline'}
              size={18}
              color={isWishlisted ? COLORS.red : COLORS.gray400}
            />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.info}>
        <Text numberOfLines={2} style={styles.name}>{product.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(product.price)}</Text>
          {comparePrice > product.price && (
            <Text style={styles.comparePrice}>{formatPrice(comparePrice)}</Text>
          )}
        </View>
        {product.shop_name && (
          <Text numberOfLines={1} style={styles.shopMeta}>
            {product.shop_name}
            {product.distance ? ` · ${product.distance}` : ''}
          </Text>
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
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  price: { fontSize: 15, fontWeight: '700', color: COLORS.gray900 },
  comparePrice: { fontSize: 12, color: COLORS.gray400, textDecorationLine: 'line-through' },
  shopMeta: { fontSize: 11, color: COLORS.gray400 },
});
