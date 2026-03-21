import { useState, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SHADOWS, formatPrice } from '../constants/theme';

const PLACEHOLDER = 'https://placehold.co/200x200/eee/999?text=🎁';

export default function DealCard({ deal, onClaim }) {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    if (!deal.expires_at) return;
    const tick = () => {
      const remaining = new Date(deal.expires_at) - Date.now();
      if (remaining <= 0) {
        setTimeLeft('Expired');
        clearInterval(timerRef.current);
        return;
      }
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      if (h > 0) setTimeLeft(`${h}h ${m}m`);
      else setTimeLeft(`${m}m ${s}s`);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [deal.expires_at]);

  const expired = timeLeft === 'Expired';
  const imageUri =
    deal.product?.images?.[0] ||
    deal.product_image ||
    deal.image ||
    PLACEHOLDER;

  const discountPct = deal.discount_pct ?? 0;
  const originalPrice = deal.original_price ?? deal.product?.price;
  const dealPrice = originalPrice
    ? originalPrice * (1 - discountPct / 100)
    : deal.price;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(customer)/product/${deal.product_id || deal.product?.id}`)}
      activeOpacity={0.85}
      style={[styles.card, expired && styles.cardExpired]}
    >
      <View style={styles.imageWrap}>
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        {discountPct > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{discountPct}% OFF</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text numberOfLines={1} style={styles.name}>
          {deal.product?.name || deal.product_name || deal.title}
        </Text>
        {deal.shop_name ? (
          <Text numberOfLines={1} style={styles.shop}>{deal.shop_name}</Text>
        ) : null}
        <View style={styles.priceRow}>
          <Text style={styles.dealPrice}>{formatPrice(dealPrice)}</Text>
          {originalPrice ? (
            <Text style={styles.origPrice}>{formatPrice(originalPrice)}</Text>
          ) : null}
        </View>
        {timeLeft ? (
          <Text style={[styles.timer, expired && styles.timerExpired]}>
            ⏱ {timeLeft}
          </Text>
        ) : null}
      </View>
      {onClaim && (
        <TouchableOpacity
          onPress={() => !expired && onClaim(deal.id)}
          style={[styles.claimBtn, expired && styles.claimBtnDisabled]}
          disabled={expired}
        >
          <Text style={styles.claimText}>{expired ? '✗' : 'Claim'}</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    ...SHADOWS.card,
    width: 300,
  },
  cardExpired: { opacity: 0.6 },
  imageWrap: { width: 80, height: 80, borderRadius: 12, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute', top: 0, left: 0,
    backgroundColor: COLORS.red,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: { color: COLORS.white, fontSize: 10, fontWeight: '700' },
  info: { flex: 1 },
  name: { fontSize: 13, fontWeight: '600', color: COLORS.gray800, lineHeight: 18 },
  shop: { fontSize: 11, color: COLORS.gray400, marginTop: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  dealPrice: { fontSize: 15, fontWeight: '700', color: COLORS.gray900 },
  origPrice: { fontSize: 11, color: COLORS.gray400, textDecorationLine: 'line-through' },
  timer: { fontSize: 11, color: COLORS.red, fontWeight: '600', marginTop: 3 },
  timerExpired: { color: COLORS.gray400 },
  claimBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    alignSelf: 'center',
  },
  claimBtnDisabled: { backgroundColor: COLORS.gray300 },
  claimText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
});
