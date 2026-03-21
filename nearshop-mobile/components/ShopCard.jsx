import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, CATEGORY_COLORS } from '../constants/theme';

const CATEGORY_EMOJI = {
  Electronics: '📱',
  Clothing: '👗',
  Fashion: '👗',
  Grocery: '🥬',
  Food: '🍰',
  Home: '🏠',
  Beauty: '💄',
};

export default function ShopCard({ shop }) {
  const router = useRouter();
  const catColor = CATEGORY_COLORS[shop.category] || COLORS.primary;
  const emoji = CATEGORY_EMOJI[shop.category] || '🏪';

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(customer)/shop/${shop.id}`)}
      activeOpacity={0.85}
      style={styles.card}
    >
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
          {shop.distance ? ` · ${shop.distance}` : ''}
        </Text>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={12} color={COLORS.amber} />
          <Text style={styles.rating}>{(shop.avg_rating || 0).toFixed(1)}</Text>
          {shop.total_reviews ? (
            <Text style={styles.reviewCount}>{shop.total_reviews} reviews</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    ...SHADOWS.card,
    width: 240,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  avatarEmoji: { fontSize: 26 },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  name: { fontSize: 14, fontWeight: '700', color: COLORS.gray900, flex: 1 },
  category: { fontSize: 12, color: COLORS.gray500, marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { fontSize: 12, fontWeight: '600', color: COLORS.gray700 },
  reviewCount: { fontSize: 11, color: COLORS.gray400 },
});
