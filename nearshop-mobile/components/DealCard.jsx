import { useState, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SHADOWS, formatPrice } from '../constants/theme';

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

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
  const productId = deal.product_id || deal.product?.id || null;
  const shopId = deal.shop_id || null;
  const imageUri =
    deal.product?.images?.[0] ||
    deal.images?.[0] ||
    deal.product_image ||
    deal.image ||
    null;
  const discountPct = toNumber(deal.discount_pct) ?? 0;
  const discountAmount = toNumber(deal.discount_amount);
  const originalPrice =
    toNumber(deal.original_price) ??
    toNumber(deal.product?.price) ??
    toNumber(deal.price);
  const dealPrice =
    discountPct > 0 && originalPrice != null
      ? Math.max(0, originalPrice * (1 - discountPct / 100))
      : discountAmount != null && originalPrice != null
        ? Math.max(0, originalPrice - discountAmount)
        : null;
  const showPrice = dealPrice != null || originalPrice != null;
  const title = deal.product?.name || deal.product_name || deal.title || 'Nearby deal';

  const handleOpen = () => {
    if (productId) {
      router.push(`/(customer)/product/${productId}`);
      return;
    }
    if (shopId) {
      router.push(`/(customer)/shop/${shopId}`);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleOpen}
      activeOpacity={0.85}
      style={[styles.card, expired && styles.cardExpired]}
    >
      <View style={styles.imageWrap}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imageFallback}>
            <Text style={styles.imageFallbackEmoji}>🔥</Text>
          </View>
        )}
        {(discountPct > 0 || discountAmount != null) && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {discountPct > 0 ? `${discountPct}% OFF` : `${formatPrice(discountAmount)} OFF`}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text numberOfLines={1} style={styles.name}>
          {title}
        </Text>
        {deal.shop_name ? (
          <Text numberOfLines={1} style={styles.shop}>
            {deal.shop_name}
          </Text>
        ) : null}

        {showPrice ? (
          <View style={styles.priceRow}>
            {dealPrice != null ? (
              <Text style={styles.dealPrice}>{formatPrice(dealPrice)}</Text>
            ) : null}
            {originalPrice != null && dealPrice != null && originalPrice > dealPrice ? (
              <Text style={styles.origPrice}>{formatPrice(originalPrice)}</Text>
            ) : dealPrice == null && originalPrice != null ? (
              <Text style={styles.dealPrice}>{formatPrice(originalPrice)}</Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.offerHint}>Tap to view the offer</Text>
        )}

        {timeLeft ? (
          <Text style={[styles.timer, expired && styles.timerExpired]}>
            ⏱ {timeLeft}
          </Text>
        ) : null}
      </View>

      {onClaim ? (
        <TouchableOpacity
          onPress={() => !expired && onClaim(deal.id)}
          style={[styles.claimBtn, expired && styles.claimBtnDisabled]}
          disabled={expired}
        >
          <Text style={styles.claimText}>{expired ? 'Closed' : 'Claim'}</Text>
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    ...SHADOWS.card,
    width: 300,
  },
  cardExpired: {
    opacity: 0.6,
  },
  imageWrap: {
    width: 84,
    height: 84,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#EEF2FF',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E9EEFF',
  },
  imageFallbackEmoji: {
    fontSize: 28,
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.gray900,
    lineHeight: 19,
  },
  shop: {
    fontSize: 11,
    color: COLORS.gray500,
    marginTop: 3,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 7,
  },
  dealPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.gray900,
  },
  origPrice: {
    fontSize: 11,
    color: COLORS.gray400,
    textDecorationLine: 'line-through',
  },
  offerHint: {
    fontSize: 12,
    color: COLORS.gray500,
    marginTop: 8,
    fontWeight: '500',
  },
  timer: {
    fontSize: 11,
    color: COLORS.red,
    fontWeight: '700',
    marginTop: 5,
  },
  timerExpired: {
    color: COLORS.gray400,
  },
  claimBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'center',
  },
  claimBtnDisabled: {
    backgroundColor: COLORS.gray300,
  },
  claimText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
});
