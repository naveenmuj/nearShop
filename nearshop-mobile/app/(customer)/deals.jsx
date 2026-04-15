import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet, Pressable, ActivityIndicator,
  RefreshControl, ScrollView, StatusBar, Image, Animated, Dimensions,
  Easing, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';
import { getNearbyDeals, getPersonalizedDeals, claimDeal, addToWishlist, removeFromWishlist } from '../../lib/deals';
import { getWishlist } from '../../lib/wishlists';
import { toast } from '../../components/ui/Toast';
import useLocationStore from '../../store/locationStore';
import * as Haptics from 'expo-haptics';

// Try to import optional dependencies, fallback gracefully
let LinearGradient;
let BlurView;
try {
  LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch (e) {
  // Fallback: Simple View with background color
  LinearGradient = ({ colors, style, children, ...props }) => (
    <View style={[style, { backgroundColor: colors?.[0] || '#7C3AED' }]} {...props}>
      {children}
    </View>
  );
}
try {
  BlurView = require('expo-blur').BlurView;
} catch (e) {
  BlurView = ({ style, children, ...props }) => (
    <View style={[style, { backgroundColor: 'rgba(255,255,255,0.9)' }]} {...props}>
      {children}
    </View>
  );
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const CATEGORIES = [
  { key: 'All', emoji: '🔥', color: '#EF4444', label: 'Hot Deals' },
  { key: 'Electronics', emoji: '📱', color: '#3B82F6', label: 'Electronics' },
  { key: 'Clothing', emoji: '👕', color: '#8B5CF6', label: 'Fashion' },
  { key: 'Grocery', emoji: '🛒', color: '#10B981', label: 'Grocery' },
  { key: 'Food', emoji: '🍔', color: '#F59E0B', label: 'Food' },
  { key: 'Home', emoji: '🏠', color: '#6366F1', label: 'Home' },
  { key: 'Beauty', emoji: '💄', color: '#EC4899', label: 'Beauty' },
];

// Urgency color thresholds
const getUrgencyColor = (hoursLeft) => {
  if (hoursLeft <= 1) return { bg: '#FEE2E2', text: '#DC2626', glow: '#EF4444' };
  if (hoursLeft <= 6) return { bg: '#FEF3C7', text: '#D97706', glow: '#F59E0B' };
  return { bg: '#DCFCE7', text: '#16A34A', glow: '#22C55E' };
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED COUNTDOWN HOOK (Enhanced)
// ═══════════════════════════════════════════════════════════════════════════════
function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState({
    hours: 0, minutes: 0, seconds: 0,
    text: '', urgent: false, critical: false, expired: false, hoursLeft: 24
  });
  const timerRef = useRef(null);

  useEffect(() => {
    const tick = () => {
      const diff = new Date(expiresAt) - Date.now();
      if (diff <= 0) {
        setRemaining({ hours: 0, minutes: 0, seconds: 0, text: 'Expired', urgent: false, critical: false, expired: true, hoursLeft: 0 });
        clearInterval(timerRef.current);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const hoursLeft = diff / 3600000;
      const urgent = hoursLeft < 6;
      const critical = hoursLeft < 1;
      
      let text;
      if (h > 0) text = `${h}h ${m}m`;
      else if (m > 0) text = `${m}m ${s}s`;
      else text = `${s}s`;
      
      setRemaining({ hours: h, minutes: m, seconds: s, text, urgent, critical, expired: false, hoursLeft });
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [expiresAt]);

  return remaining;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED PARTICLES (Floating Effect)
// ═══════════════════════════════════════════════════════════════════════════════
function FloatingParticles({ count = 6 }) {
  const particles = useRef([...Array(count)].map(() => ({
    anim: new Animated.Value(0),
    x: Math.random() * SCREEN_W,
    size: 4 + Math.random() * 8,
    duration: 3000 + Math.random() * 2000,
    delay: Math.random() * 2000,
  }))).current;

  useEffect(() => {
    particles.forEach(p => {
      const animate = () => {
        p.anim.setValue(0);
        Animated.timing(p.anim, {
          toValue: 1,
          duration: p.duration,
          delay: p.delay,
          useNativeDriver: true,
          easing: Easing.linear,
        }).start(animate);
      };
      animate();
    });
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            width: p.size,
            height: p.size,
            borderRadius: p.size / 2,
            backgroundColor: 'rgba(255,255,255,0.3)',
            transform: [{
              translateY: p.anim.interpolate({
                inputRange: [0, 1],
                outputRange: [SCREEN_H * 0.3, -50]
              })
            }],
            opacity: p.anim.interpolate({
              inputRange: [0, 0.2, 0.8, 1],
              outputRange: [0, 0.6, 0.6, 0]
            })
          }}
        />
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHIMMER EFFECT
// ═══════════════════════════════════════════════════════════════════════════════
function ShimmerEffect({ style }) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
        easing: Easing.linear,
      })
    ).start();
  }, []);
  
  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{
            translateX: shimmerAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-200, 200]
            })
          }]
        }
      ]}
    >
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ width: 200, height: '100%' }}
      />
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PULSE ANIMATION COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function PulseView({ children, style, active = true, intensity = 1.05 }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    if (active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: intensity, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [active]);
  
  return (
    <Animated.View style={[style, { transform: [{ scale: pulseAnim }] }]}>
      {children}
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLIP CLOCK DIGIT
// ═══════════════════════════════════════════════════════════════════════════════
function FlipDigit({ value, color = '#1F2937' }) {
  return (
    <View style={flipStyles.digitContainer}>
      <LinearGradient
        colors={['#1F2937', '#374151']}
        style={flipStyles.digitBg}
      >
        <Text style={[flipStyles.digit, { color: '#fff' }]}>{String(value).padStart(2, '0')}</Text>
      </LinearGradient>
    </View>
  );
}

function FlipClock({ hours, minutes, seconds, urgent, critical }) {
  const bgColors = critical ? ['#DC2626', '#EF4444'] : urgent ? ['#D97706', '#F59E0B'] : ['#1F2937', '#374151'];
  
  return (
    <View style={flipStyles.container}>
      <View style={flipStyles.segment}>
        <LinearGradient colors={bgColors} style={flipStyles.digitBg}>
          <Text style={flipStyles.digit}>{String(hours).padStart(2, '0')}</Text>
        </LinearGradient>
        <Text style={flipStyles.label}>HRS</Text>
      </View>
      <Text style={flipStyles.colon}>:</Text>
      <View style={flipStyles.segment}>
        <LinearGradient colors={bgColors} style={flipStyles.digitBg}>
          <Text style={flipStyles.digit}>{String(minutes).padStart(2, '0')}</Text>
        </LinearGradient>
        <Text style={flipStyles.label}>MIN</Text>
      </View>
      <Text style={flipStyles.colon}>:</Text>
      <View style={flipStyles.segment}>
        <LinearGradient colors={bgColors} style={flipStyles.digitBg}>
          <Text style={flipStyles.digit}>{String(seconds).padStart(2, '0')}</Text>
        </LinearGradient>
        <Text style={flipStyles.label}>SEC</Text>
      </View>
    </View>
  );
}

const flipStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  segment: { alignItems: 'center' },
  digitBg: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  digit: { fontSize: 20, fontWeight: '900', color: '#fff', fontVariant: ['tabular-nums'] },
  label: { fontSize: 8, fontWeight: '700', color: COLORS.gray400, marginTop: 2, letterSpacing: 1 },
  colon: { fontSize: 18, fontWeight: '900', color: COLORS.gray400, marginBottom: 14 },
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS BAR (Claims Progress)
// ═══════════════════════════════════════════════════════════════════════════════
function ClaimsProgressBar({ current, max, style }) {
  const progress = max ? Math.min(current / max, 1) : 0;
  const remaining = max ? max - current : null;
  const progressAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: progress,
      friction: 8,
      useNativeDriver: false,
    }).start();
  }, [progress]);
  
  if (!max) return null;
  
  const isLow = remaining && remaining <= 5;
  
  return (
    <View style={[{ marginTop: 8 }, style]}>
      <View style={progressStyles.track}>
        <Animated.View
          style={[
            progressStyles.fill,
            {
              backgroundColor: isLow ? '#EF4444' : '#22C55E',
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%']
              })
            }
          ]}
        />
      </View>
      <View style={progressStyles.labelRow}>
        <Text style={[progressStyles.label, isLow && { color: '#EF4444', fontWeight: '700' }]}>
          {isLow ? `🔥 Only ${remaining} left!` : `${current}/${max} claimed`}
        </Text>
        <Text style={progressStyles.pct}>{Math.round(progress * 100)}%</Text>
      </View>
    </View>
  );
}

const progressStyles = StyleSheet.create({
  track: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  label: { fontSize: 11, color: COLORS.gray500 },
  pct: { fontSize: 11, fontWeight: '700', color: COLORS.gray600 },
});

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURED DEAL (Redesigned Hero Card)
// ═══════════════════════════════════════════════════════════════════════════════
function FeaturedDeal({ deal, onClaim, claiming, onSave, isSaved, isSaving }) {
  const { hours, minutes, seconds, text: countdown, urgent, critical, expired, hoursLeft } = useCountdown(deal.expires_at);
  const discount = deal.discount_pct || (deal.discount_amount ? Math.round(deal.discount_amount) : 0);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const urgencyColor = getUrgencyColor(hoursLeft);
  const hasPrice = Number(deal.final_price ?? 0) > 0;
  const savingsPct = Number(deal.savings_pct ?? 0);

  useEffect(() => {
    if (critical && !expired) {
      // Shake animation for critical urgency
      Animated.loop(
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -1, duration: 100, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
          Animated.delay(2000),
        ])
      ).start();
    }
    
    // Glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: false }),
      ])
    ).start();
  }, [critical, expired]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(customer)/product/${deal.product_id}`);
  };

  const handleClaim = () => {
    if (expired || claiming) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClaim(deal.id);
  };

  const handleSave = (e) => {
    e.stopPropagation();
    if (isSaving) return;
    onSave(deal.id, deal.product_id);
  };

  return (
    <Animated.View style={[
      styles.featuredCard,
      {
        transform: [
          { scale: scaleAnim },
          { translateX: shakeAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-3, 0, 3] }) }
        ]
      }
    ]}>
      <Pressable onPress={handlePress} style={styles.featuredPressable}>
        {/* Background Image or Gradient */}
        {deal.image_url ? (
          <Image source={{ uri: deal.image_url }} style={styles.featuredBgImage} blurRadius={1.5} />
        ) : (
          <LinearGradient
            colors={['#667EEA', '#764BA2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.featuredBgImage}
          />
        )}
        
        {/* Overlay */}
        <LinearGradient
          colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.72)']}
          style={styles.featuredOverlay}
        />
        
        {/* Discount Badge */}
        {discount > 0 && (
          <PulseView style={styles.featuredDiscountBadge} intensity={1.08}>
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              style={styles.featuredDiscountInner}
            >
              <Text style={styles.featuredDiscountText}>{discount}%</Text>
              <Text style={styles.featuredDiscountSub}>OFF</Text>
            </LinearGradient>
          </PulseView>
        )}
        
        {/* Content */}
        <View style={styles.featuredContent}>
          <View style={styles.featuredTopRow}>
            <View style={styles.featuredShopBadge}>
              <Text style={styles.featuredShopIcon}>🏪</Text>
              <Text style={styles.featuredShopName}>{deal.shop_name || 'Local Shop'}</Text>
            </View>
            <Pressable onPress={handleSave} disabled={isSaving} style={styles.featuredSaveBtn}>
              <Text style={{ fontSize: 20 }}>{isSaved ? '❤️' : '🤍'}</Text>
            </Pressable>
            {deal.current_claims > 0 && (
              <View style={styles.socialProofBadge}>
                <Text style={styles.socialProofText}>👥 {deal.current_claims} claimed</Text>
              </View>
            )}
          </View>
          {(deal.match_reason || deal.reason) && (
            <View style={styles.featuredReasonBadge}>
              <Text style={styles.featuredReasonText}>{deal.match_reason || deal.reason}</Text>
            </View>
          )}
          
          <View style={styles.featuredMiddle}>
            <Text style={styles.featuredTitle} numberOfLines={2}>
              {deal.title || deal.product_name || 'Special Deal'}
            </Text>
            {deal.description && (
              <Text style={styles.featuredDesc} numberOfLines={2}>{deal.description}</Text>
            )}
            {hasPrice && (
              <View style={styles.featuredPriceRow}>
                <Text style={styles.featuredFinalPrice}>{formatPrice(deal.final_price)}</Text>
                {Number(deal.base_price ?? 0) > Number(deal.final_price ?? 0) && (
                  <Text style={styles.featuredComparePrice}>{formatPrice(deal.base_price)}</Text>
                )}
                {savingsPct > 0 && (
                  <View style={styles.featuredSavingsChip}>
                    <Text style={styles.featuredSavingsText}>Save {savingsPct}%</Text>
                  </View>
                )}
              </View>
            )}
          </View>
          
          <View style={styles.featuredBottom}>
            {/* Timer Section */}
            <View style={styles.featuredTimerSection}>
              <Text style={styles.featuredTimerLabel}>
                {expired ? '⏰ Ended' : critical ? '🔥 HURRY!' : urgent ? '⚡ Ending Soon' : '⏱ Time Left'}
              </Text>
              {!expired && <FlipClock hours={hours} minutes={minutes} seconds={seconds} urgent={urgent} critical={critical} />}
            </View>
            
            {/* Claims Progress */}
            <ClaimsProgressBar current={deal.current_claims} max={deal.max_claims} />
          </View>
        </View>
      </Pressable>
      
      {/* CTA Button */}
      <Pressable
        style={[styles.featuredCTA, expired && styles.featuredCTADisabled]}
        onPress={handleClaim}
        disabled={expired || claiming}
      >
        <LinearGradient
          colors={expired ? ['#9CA3AF', '#6B7280'] : ['#FF7A18', '#FF5A1F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.featuredCTAGradient}
        >
          {claiming ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.featuredCTAText}>
                {expired ? 'Deal Ended' : 'Claim Deal'}
              </Text>
              <Text style={styles.featuredCTASubtext}>
                {expired ? 'This offer is no longer available' : 'Tap to reserve this offer now'}
              </Text>
              {!expired && <ShimmerEffect style={styles.ctaShimmer} />}
            </>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEAL CARD (Redesigned Grid Item)
// ═══════════════════════════════════════════════════════════════════════════════
function DealCard({ deal, onClaim, claiming, index, onSave, isSaved, isSaving }) {
  const { text: countdown, urgent, critical, expired, hoursLeft } = useCountdown(deal.expires_at);
  const discount = deal.discount_pct || (deal.discount_amount ? Math.round(deal.discount_amount) : 0);
  const urgencyColor = getUrgencyColor(hoursLeft);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const entryAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.spring(entryAnim, {
      toValue: 1,
      delay: index * 100,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, friction: 8 }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
  };

  const handleClaim = (e) => {
    e.stopPropagation();
    if (expired || claiming) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClaim(deal.id);
  };

  const handleSave = (e) => {
    e.stopPropagation();
    if (isSaving) return;
    onSave(deal.id, deal.product_id);
  };

  const categoryEmoji = CATEGORIES.find(c => c.key === deal.category)?.emoji ?? '🎁';
  const isLowStock = deal.max_claims && (deal.max_claims - deal.current_claims) <= 3;
  const hasPrice = Number(deal.final_price ?? 0) > 0;
  const savingsPct = Number(deal.savings_pct ?? 0);

  return (
    <Animated.View style={[
      styles.dealCard,
      {
        opacity: entryAnim,
        transform: [
          { scale: scaleAnim },
          { translateY: entryAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }
        ]
      },
      expired && styles.dealCardExpired
    ]}>
      <Pressable
        onPress={() => !expired && router.push(`/(customer)/product/${deal.product_id}`)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.dealCardInner}
      >
        {/* Image Section */}
        <View style={styles.dealImageWrap}>
          {deal.image_url ? (
            <Image source={{ uri: deal.image_url }} style={styles.dealImage} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={['#EEF2FF', '#E0E7FF']}
              style={styles.dealImagePlaceholder}
            >
              <Text style={{ fontSize: 40 }}>{categoryEmoji}</Text>
            </LinearGradient>
          )}
          
          {/* Save Heart Button */}
          <Pressable onPress={handleSave} disabled={isSaving} style={styles.dealHeartBtn}>
            <Text style={{ fontSize: 20 }}>{isSaved ? '❤️' : '🤍'}</Text>
          </Pressable>
          
          {/* Discount Badge */}
          {discount > 0 && !expired && (
            <View style={styles.dealDiscountBadge}>
              <LinearGradient
                colors={['#EF4444', '#DC2626']}
                style={styles.dealDiscountGradient}
              >
                <Text style={styles.dealDiscountText}>{discount}%</Text>
                <Text style={styles.dealDiscountOff}>OFF</Text>
              </LinearGradient>
            </View>
          )}
          
          {/* Hot Badge */}
          {deal.current_claims > 10 && !expired && (
            <View style={styles.hotBadge}>
              <Text style={styles.hotBadgeText}>🔥 HOT</Text>
            </View>
          )}
          
          {/* Low Stock Warning */}
          {isLowStock && !expired && (
            <View style={styles.lowStockBadge}>
              <Text style={styles.lowStockText}>⚡ {deal.max_claims - deal.current_claims} left!</Text>
            </View>
          )}
          
          {/* Expired Overlay */}
          {expired && (
            <View style={styles.expiredOverlay}>
              <Text style={styles.expiredText}>ENDED</Text>
            </View>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.dealBody}>
          <View style={styles.dealShopRow}>
            <Text style={styles.dealShopIcon}>🏪</Text>
            <Text style={styles.dealShop} numberOfLines={1}>{deal.shop_name || 'Local Shop'}</Text>
          </View>
          
          <Text style={[styles.dealName, expired && { color: COLORS.gray400 }]} numberOfLines={2}>
            {deal.title || deal.product_name || 'Special Deal'}
          </Text>

          {hasPrice && (
            <View style={styles.dealPriceRow}>
              <Text style={styles.dealFinalPrice}>{formatPrice(deal.final_price)}</Text>
              {Number(deal.base_price ?? 0) > Number(deal.final_price ?? 0) && (
                <Text style={styles.dealBasePrice}>{formatPrice(deal.base_price)}</Text>
              )}
              {savingsPct > 0 && (
                <View style={styles.dealSavingsChip}>
                  <Text style={styles.dealSavingsText}>Save {savingsPct}%</Text>
                </View>
              )}
            </View>
          )}

          {/* Timer */}
          <View style={[
            styles.dealTimer,
            { backgroundColor: urgencyColor.bg },
            expired && styles.dealTimerExpired
          ]}>
            <Text style={[styles.dealTimerText, { color: urgencyColor.text }]}>
              {expired ? '⏰ Ended' : critical ? `🔥 ${countdown}` : urgent ? `⚡ ${countdown}` : `⏱ ${countdown}`}
            </Text>
          </View>

          {/* Social Proof */}
          {deal.current_claims > 0 && !expired && (
            <Text style={styles.dealSocialProof}>
              👥 {deal.current_claims} claimed
            </Text>
          )}

          {/* Claim Button */}
          <Pressable
            style={[styles.dealClaimBtn, expired && styles.dealClaimBtnDisabled]}
            onPress={handleClaim}
            disabled={expired || claiming}
          >
            {claiming ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <LinearGradient
                colors={expired ? ['#D1D5DB', '#9CA3AF'] : ['#7F77DD', '#6366F1']}
                style={styles.dealClaimGradient}
              >
                <Text style={styles.dealClaimText}>{expired ? 'Ended' : '🎁 Claim'}</Text>
              </LinearGradient>
            )}
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY PILL (Animated)
// ═══════════════════════════════════════════════════════════════════════════════
function CategoryPill({ cat, isActive, onPress, dealCount }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 100, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    onPress();
  };
  
  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={[
          styles.catPill,
          isActive && { backgroundColor: cat.color + '20', borderColor: cat.color }
        ]}
        onPress={handlePress}
      >
        <Text style={styles.catEmoji}>{cat.emoji}</Text>
        <Text style={[styles.catText, isActive && { color: cat.color, fontWeight: '800' }]}>
          {cat.label || cat.key}
        </Text>
        {dealCount > 0 && (
          <View style={[styles.catCount, { backgroundColor: isActive ? cat.color : COLORS.gray300 }]}>
            <Text style={styles.catCountText}>{dealCount}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED HERO SECTION
// ═══════════════════════════════════════════════════════════════════════════════
function HeroSection({ activeDeals, timeOfDay }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  
  const greetings = {
    morning: { text: 'Good Morning', sub: 'Fresh local deals picked for today' },
    afternoon: { text: 'Good Afternoon', sub: 'Claim a few savings before you head out' },
    evening: { text: 'Good Evening', sub: 'Last chance deals from nearby shops' },
    night: { text: 'Night Deals', sub: 'Late-night picks that are still live' },
  };
  
  const greeting = greetings[timeOfDay] || greetings.morning;
  
  return (
    <LinearGradient
      colors={['#4F46E5', '#7C3AED', '#9333EA']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <FloatingParticles count={8} />
      
      <View style={styles.heroContent}>
        <Text style={styles.heroGreeting}>{greeting.text}</Text>
        <Text style={styles.heroTitle}>Deals & Offers</Text>
        <Text style={styles.heroSub}>{address ? `${greeting.sub} • ${address}` : greeting.sub}</Text>
        
        {activeDeals > 0 && (
          <Animated.View style={[styles.heroCountBadge, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.heroCountText}>🔥 {activeDeals} Hot Deal{activeDeals !== 1 ? 's' : ''} Near You</Text>
          </Animated.View>
        )}
      </View>
      
      <View style={styles.heroRight}>
        <Animated.Text style={[styles.heroEmoji, { transform: [{ scale: pulseAnim }] }]}>
          🎁
        </Animated.Text>
        <Text style={styles.heroEmojiSub}>Limited Time!</Text>
      </View>
    </LinearGradient>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKELETON LOADING
// ═══════════════════════════════════════════════════════════════════════════════
function SkeletonCard() {
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
        easing: Easing.linear,
      })
    ).start();
  }, []);
  
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonImage}>
        <Animated.View
          style={[styles.skeletonShimmer, {
            transform: [{
              translateX: shimmerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-100, 200]
              })
            }]
          }]}
        />
      </View>
      <View style={styles.skeletonBody}>
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, { width: '60%' }]} />
        <View style={[styles.skeletonLine, { width: '40%' }]} />
      </View>
    </View>
  );
}

function LoadingState() {
  return (
    <View style={styles.loadingContainer}>
      <View style={styles.skeletonGrid}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
export default function DealsScreen() {
  const { lat, lng, address } = useLocationStore();
  const [deals, setDeals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activePriceBand, setActivePriceBand] = useState('under-99');
  const [sortMode, setSortMode] = useState('Best');
  const [error, setError] = useState(null);
  const [claimingId, setClaimingId] = useState(null);
  const [scrollY, setScrollY] = useState(0);
  const [savedProductIds, setSavedProductIds] = useState(new Set());
  const [savingDealId, setSavingDealId] = useState(null);
  const [dismissedExpiryWarning, setDismissedExpiryWarning] = useState(false);

  // Get time of day for personalized greeting
  const timeOfDay = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
  }, []);

  const loadDeals = useCallback(async () => {
    try {
      setError(null);
      const baseLat = lat ?? 12.935;
      const baseLng = lng ?? 77.624;
      const nearbyParams = { limit: 60 };
      if (activeCategory !== 'All') nearbyParams.category = activeCategory;
      const matchesCategory = (item) => (
        activeCategory === 'All'
        || String(item?.category || '').toLowerCase() === activeCategory.toLowerCase()
      );

      const [nearbyRes, personalizedRes] = await Promise.allSettled([
        getNearbyDeals(baseLat, baseLng, nearbyParams),
        getPersonalizedDeals(baseLat, baseLng, { limit: 30 }),
      ]);

      const nearbyItems = nearbyRes.status === 'fulfilled'
        ? (nearbyRes.value.data?.items ?? nearbyRes.value.data?.deals ?? nearbyRes.value.data ?? [])
        : [];
      const personalizedItems = personalizedRes.status === 'fulfilled'
        ? (personalizedRes.value.data?.items ?? personalizedRes.value.data?.deals ?? personalizedRes.value.data ?? [])
        : [];

      const merged = [];
      const seen = new Set();
      [...personalizedItems, ...nearbyItems].forEach((item) => {
        if (!item?.id || seen.has(item.id)) return;
        if (!matchesCategory(item)) return;
        seen.add(item.id);
        merged.push(item);
      });

      if (merged.length === 0 && nearbyRes.status === 'rejected' && personalizedRes.status === 'rejected') {
        throw new Error('Failed to load deals');
      }

      setDeals(merged);
    } catch {
      setError('Could not load deals. Check your connection.');
    }
  }, [lat, lng, activeCategory]);

  useEffect(() => {
    setIsLoading(true);
    loadDeals().finally(() => setIsLoading(false));
  }, [loadDeals]);

  const loadSavedDeals = useCallback(async () => {
    try {
      const res = await getWishlist();
      const items = res?.data?.items ?? [];
      const ids = new Set(
        items
          .map((item) => String(item.product_id || ''))
          .filter(Boolean)
      );
      setSavedProductIds(ids);
    } catch {
      // Keep UX resilient even if wishlist fetch fails.
    }
  }, []);

  useEffect(() => {
    loadSavedDeals();
  }, [loadSavedDeals]);

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Promise.all([loadDeals(), loadSavedDeals()]);
    setRefreshing(false);
  };

  const handleClaim = async (id) => {
    setClaimingId(id);
    try {
      await claimDeal(id);
      toast.show({ type: 'success', text1: '🎉 Deal claimed! Check your orders.' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadDeals();
    } catch (err) {
      toast.show({ type: 'error', text1: err?.response?.data?.detail || 'Failed to claim deal' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setClaimingId(null);
    }
  };

  const handleSaveDeal = async (dealId, productId) => {
    if (!productId) {
      toast.show({ type: 'error', text1: 'This deal cannot be saved right now' });
      return;
    }
    const productKey = String(productId);
    setSavingDealId(dealId);
    try {
      if (savedProductIds.has(productKey)) {
        await removeFromWishlist(productId);
        setSavedProductIds(prev => {
          const updated = new Set(prev);
          updated.delete(productKey);
          return updated;
        });
        toast.show({ type: 'info', text1: '❤️ Removed from saved' });
      } else {
        await addToWishlist(productId);
        setSavedProductIds(prev => new Set(prev).add(productKey));
        toast.show({ type: 'success', text1: '❤️ Saved to wishlist!' });
      }
      Haptics.selectionAsync();
    } catch (err) {
      toast.show({ type: 'error', text1: 'Failed to save deal' });
    } finally {
      setSavingDealId(null);
    }
  };

  const activeDeals = deals.filter(d => new Date(d.expires_at) > Date.now());
  const expiredDeals = deals.filter(d => new Date(d.expires_at) <= Date.now());
  const getDealBasePrice = useCallback((deal) => {
    const original = Number(deal?.original_price ?? 0);
    if (Number.isFinite(original) && original > 0) return original;
    if (Number.isFinite(Number(deal?.deal_price)) && Number(deal?.deal_price) > 0) return Number(deal.deal_price);
    if (Number.isFinite(Number(deal?.discount_amount)) && Number(deal?.discount_amount) > 0) return Number(deal.discount_amount);
    return 0;
  }, []);

  const getDealFinalPrice = useCallback((deal) => {
    const finalPrice = Number(deal?.deal_price ?? 0);
    if (Number.isFinite(finalPrice) && finalPrice > 0) return finalPrice;
    const basePrice = Number(deal?.original_price ?? 0);
    const discountPct = Number(deal?.discount_pct ?? 0);
    const discountAmount = Number(deal?.discount_amount ?? 0);
    if (basePrice > 0 && discountPct > 0) return Math.max(0, basePrice * (1 - discountPct / 100));
    if (basePrice > 0 && discountAmount > 0) return Math.max(0, basePrice - discountAmount);
    return basePrice || 0;
  }, []);

  const getDealSavingsPct = useCallback((deal) => {
    const basePrice = getDealBasePrice(deal);
    const finalPrice = getDealFinalPrice(deal);
    if (!basePrice || finalPrice >= basePrice) return 0;
    return Math.round(((basePrice - finalPrice) / basePrice) * 100);
  }, [getDealBasePrice, getDealFinalPrice]);

  const normalizedCategory = activeCategory === 'All' ? null : activeCategory.toLowerCase();
  const filteredActiveDeals = useMemo(() => {
    return activeDeals.filter((deal) => {
      if (normalizedCategory && String(deal.category || '').toLowerCase() !== normalizedCategory) {
        return false;
      }
      const finalPrice = getDealFinalPrice(deal);
      const hoursLeft = (new Date(deal.expires_at) - Date.now()) / 3600000;
      if (activePriceBand === 'All') return true;
      if (activePriceBand === 'Hot') return getDealSavingsPct(deal) >= 25;
      if (activePriceBand === 'EndingSoon') return hoursLeft > 0 && hoursLeft <= 6;
      const bandMatch = activePriceBand.match(/^under-(\d+)$/);
      if (!bandMatch) return true;
      return finalPrice > 0 && finalPrice <= Number(bandMatch[1]);
    });
  }, [activeCategory, activePriceBand, activeDeals, getDealFinalPrice, getDealSavingsPct, normalizedCategory]);

  const priceBands = useMemo(() => {
    const activeList = filteredActiveDeals.length > 0 ? filteredActiveDeals : activeDeals;
    const under99 = activeList.filter((deal) => getDealFinalPrice(deal) > 0 && getDealFinalPrice(deal) <= 99).length;
    const under199 = activeList.filter((deal) => getDealFinalPrice(deal) > 0 && getDealFinalPrice(deal) <= 199).length;
    const under299 = activeList.filter((deal) => getDealFinalPrice(deal) > 0 && getDealFinalPrice(deal) <= 299).length;
    const hot = activeList.filter((deal) => getDealSavingsPct(deal) >= 25).length;
    const endingSoon = activeList.filter((deal) => {
      const hoursLeft = (new Date(deal.expires_at) - Date.now()) / 3600000;
      return hoursLeft > 0 && hoursLeft <= 6;
    }).length;
    return [
      { key: 'All', label: 'All', count: activeList.length },
      { key: 'under-99', label: 'Under ₹99', count: under99 },
      { key: 'under-199', label: 'Under ₹199', count: under199 },
      { key: 'under-299', label: 'Under ₹299', count: under299 },
      { key: 'Hot', label: 'Big savings', count: hot },
      { key: 'EndingSoon', label: 'Ending soon', count: endingSoon },
    ];
  }, [activeDeals, filteredActiveDeals, getDealFinalPrice, getDealSavingsPct]);

  const matchesSearch = useCallback((deal) => {
    const haystack = [
      deal?.title,
      deal?.description,
      deal?.shop_name,
      deal?.product_name,
      deal?.category,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return haystack.includes(q);
  }, [searchQuery]);

  const visibleActiveDeals = useMemo(
    () => filteredActiveDeals.filter(matchesSearch),
    [filteredActiveDeals, matchesSearch]
  );

  const visibleExpiredDeals = useMemo(
    () => expiredDeals.filter((deal) => (!normalizedCategory || String(deal.category || '').toLowerCase() === normalizedCategory) && matchesSearch(deal)),
    [expiredDeals, matchesSearch, normalizedCategory]
  );

  const sortedVisibleActiveDeals = useMemo(() => {
    const items = [...visibleActiveDeals];
    items.sort((left, right) => {
      if (sortMode === 'Cheap') {
        return getDealFinalPrice(left) - getDealFinalPrice(right);
      }
      if (sortMode === 'Fast') {
        return new Date(left.expires_at) - new Date(right.expires_at);
      }

      const leftScore = (getDealSavingsPct(left) * 2)
        + Math.max(0, 24 - ((new Date(left.expires_at) - Date.now()) / 3600000));
      const rightScore = (getDealSavingsPct(right) * 2)
        + Math.max(0, 24 - ((new Date(right.expires_at) - Date.now()) / 3600000));
      return rightScore - leftScore;
    });
    return items;
  }, [getDealFinalPrice, getDealSavingsPct, sortMode, visibleActiveDeals]);

  const displayDeals = useMemo(() => {
    return [...sortedVisibleActiveDeals.slice(1), ...visibleExpiredDeals].map((deal) => ({
      ...deal,
      base_price: getDealBasePrice(deal),
      final_price: getDealFinalPrice(deal),
      savings_pct: getDealSavingsPct(deal),
    }));
  }, [getDealBasePrice, getDealFinalPrice, getDealSavingsPct, sortedVisibleActiveDeals, visibleExpiredDeals]);

  const featuredVisibleDeal = sortedVisibleActiveDeals.length > 0
    ? {
        ...sortedVisibleActiveDeals[0],
        base_price: getDealBasePrice(sortedVisibleActiveDeals[0]),
        final_price: getDealFinalPrice(sortedVisibleActiveDeals[0]),
        savings_pct: getDealSavingsPct(sortedVisibleActiveDeals[0]),
      }
    : null;

  // Find deals expiring in next 30 minutes
  const expiringDeals = useMemo(() => {
    return visibleActiveDeals.filter(deal => {
      const hoursLeft = (new Date(deal.expires_at) - Date.now()) / 3600000;
      return hoursLeft > 0 && hoursLeft < 0.5; // Less than 30 minutes
    });
  }, [visibleActiveDeals]);

  // Determine if we should show sticky featured deal (scroll past featured section)
  const showStickyFeatured = scrollY > 400 && featuredVisibleDeal;

  useEffect(() => {
    if (expiringDeals.length === 0 && dismissedExpiryWarning) {
      setDismissedExpiryWarning(false);
    }
  }, [dismissedExpiryWarning, expiringDeals.length]);

  const topPicks = sortedVisibleActiveDeals.slice(0, 3).map((deal) => ({
    ...deal,
    base_price: getDealBasePrice(deal),
    final_price: getDealFinalPrice(deal),
    savings_pct: getDealSavingsPct(deal),
  }));

  // Count deals per category
  const categoryDealCounts = useMemo(() => {
    const counts = { All: activeDeals.length };
    CATEGORIES.forEach(cat => {
      if (cat.key !== 'All') {
        counts[cat.key] = activeDeals.filter(d => d.category === cat.key).length;
      }
    });
    return counts;
  }, [activeDeals]);

  const activeCatColor = CATEGORIES.find(c => c.key === activeCategory)?.color || COLORS.primary;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />

      <FlatList
        data={isLoading ? [] : displayDeals}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item, index }) => (
          <DealCard 
            deal={item} 
            onClaim={handleClaim} 
            claiming={claimingId === item.id} 
            index={index}
            onSave={handleSaveDeal}
            isSaved={savedProductIds.has(String(item.product_id || ''))}
            isSaving={savingDealId === item.id}
          />
        )}
        contentContainerStyle={[
          styles.list,
          displayDeals.length === 0 && !isLoading && styles.listEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor="#fff" 
            progressBackgroundColor="#4F46E5"
            colors={['#fff']}
          />
        }
        stickyHeaderIndices={[1]}
        ListHeaderComponent={
          <>
            {/* Animated Hero Header */}
            <HeroSection activeDeals={activeDeals.length} timeOfDay={timeOfDay} />

            <View style={styles.stickyControls}>
              <View style={styles.searchShell}>
              <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>🔎</Text>
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search products, shops, offers"
                  placeholderTextColor={COLORS.gray400}
                  style={styles.searchInput}
                />
                {searchQuery ? (
                  <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                    <Text style={styles.searchClear}>✕</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
              <View style={styles.controlStack}>
                <View style={styles.summaryStrip}>
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryValue}>{visibleActiveDeals.length}</Text>
                    <Text style={styles.summaryLabel}>Live deals</Text>
                  </View>
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryValue}>{visibleActiveDeals.filter((deal) => {
                      const hoursLeft = (new Date(deal.expires_at) - Date.now()) / 3600000;
                      return hoursLeft > 0 && hoursLeft <= 6;
                    }).length}</Text>
                    <Text style={styles.summaryLabel}>Ending soon</Text>
                  </View>
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryValue}>{visibleActiveDeals.filter((deal) => getDealSavingsPct(deal) >= 25).length}</Text>
                    <Text style={styles.summaryLabel}>Big savings</Text>
                  </View>
                </View>

                {/* Category Pills */}
                <View style={styles.catSection}>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={styles.catRow}
                    snapToInterval={100}
                    decelerationRate="fast"
                  >
                    {CATEGORIES.map((cat) => (
                      <CategoryPill
                        key={cat.key}
                        cat={cat}
                        isActive={activeCategory === cat.key}
                        onPress={() => setActiveCategory(cat.key)}
                        dealCount={categoryDealCounts[cat.key] || 0}
                      />
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.bandSection}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bandRow}>
                    {priceBands.map((band) => (
                      <Pressable
                        key={band.key}
                        onPress={() => setActivePriceBand(band.key)}
                        style={[
                          styles.bandChip,
                          activePriceBand === band.key && styles.bandChipActive,
                        ]}
                      >
                        <Text style={[
                          styles.bandLabel,
                          activePriceBand === band.key && styles.bandLabelActive,
                        ]}>
                          {band.label}
                        </Text>
                        <Text style={[
                          styles.bandCount,
                          activePriceBand === band.key && styles.bandCountActive,
                        ]}>
                          {band.count}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.sortSection}>
                  {['Best', 'Fast', 'Cheap'].map((mode) => (
                    <Pressable
                      key={mode}
                      onPress={() => setSortMode(mode)}
                      style={[styles.sortChip, sortMode === mode && styles.sortChipActive]}
                    >
                      <Text style={[styles.sortChipText, sortMode === mode && styles.sortChipTextActive]}>
                        {mode === 'Best' ? 'Best value' : mode === 'Fast' ? 'Ending soon' : 'Lowest price'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {topPicks.length > 0 && (
              <View style={styles.topPicksSection}>
                <View style={styles.sectionHeaderCompact}>
                  <Text style={styles.sectionTitleSmall}>Top picks for you</Text>
                  <Text style={styles.sectionMeta}>Best value first</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topPicksRow}>
                  {topPicks.map((deal) => (
                    <Pressable
                      key={`top-pick-${deal.id}`}
                      style={styles.topPickCard}
                      onPress={() => {
                        if (new Date(deal.expires_at) <= Date.now() || !deal.product_id) return;
                        router.push(`/(customer)/product/${deal.product_id}`);
                      }}
                    >
                      <View style={styles.topPickImageWrap}>
                        {deal.image_url ? (
                          <Image source={{ uri: deal.image_url }} style={styles.topPickImage} />
                        ) : (
                          <LinearGradient colors={['#F3F4F6', '#E5E7EB']} style={styles.topPickImagePlaceholder}>
                            <Text style={styles.topPickEmoji}>{CATEGORIES.find((c) => c.key === deal.category)?.emoji || '🎁'}</Text>
                          </LinearGradient>
                        )}
                        <View style={styles.topPickBadge}>
                          <Text style={styles.topPickBadgeText}>{deal.savings_pct > 0 ? `${deal.savings_pct}% off` : 'Top pick'}</Text>
                        </View>
                      </View>
                      <Text style={styles.topPickShop} numberOfLines={1}>{deal.shop_name || 'Local Shop'}</Text>
                      <Text style={styles.topPickName} numberOfLines={2}>{deal.title || deal.product_name || 'Special Deal'}</Text>
                      <View style={styles.topPickPriceRow}>
                        <Text style={styles.topPickPrice}>{formatPrice(deal.final_price)}</Text>
                        {Number(deal.base_price || 0) > Number(deal.final_price || 0) && (
                          <Text style={styles.topPickCompare}>{formatPrice(deal.base_price)}</Text>
                        )}
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Featured Deal */}
            {featuredVisibleDeal && !isLoading && (
              <View style={styles.featuredSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>⭐ Top Deal</Text>
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                </View>
                <FeaturedDeal 
                  deal={featuredVisibleDeal} 
                  onClaim={handleClaim} 
                  claiming={claimingId === featuredVisibleDeal.id}
                  onSave={handleSaveDeal}
                  isSaved={savedProductIds.has(String(featuredVisibleDeal.product_id || ''))}
                  isSaving={savingDealId === featuredVisibleDeal.id}
                />
              </View>
            )}

            {/* Loading State */}
            {isLoading && <LoadingState />}

            {/* Grid Section Title */}
            {!isLoading && displayDeals.length > 0 && (
              <View style={styles.sectionHeader2}>
                <Text style={styles.sectionTitle}>
                  {activeCategory === 'All' ? '🔥 All Deals' : `${CATEGORIES.find(c => c.key === activeCategory)?.emoji ?? ''} ${activeCategory}`}
                </Text>
                <View style={[styles.countBadge, { backgroundColor: activeCatColor + '18' }]}>
                  <Text style={[styles.countText, { color: activeCatColor }]}>{filteredActiveDeals.length} active</Text>
                </View>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          !isLoading && (
            error ? (
              <View style={styles.centerContent}>
                <Text style={{ fontSize: 56, marginBottom: 12 }}>😕</Text>
                <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
                <Text style={styles.errorSub}>{error}</Text>
                <Pressable style={styles.retryBtn} onPress={loadDeals}>
                  <LinearGradient
                    colors={['#7F77DD', '#6366F1']}
                    style={styles.retryBtnGradient}
                  >
                    <Text style={styles.retryText}>🔄 Try Again</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            ) : (
              <View style={styles.centerContent}>
                <Text style={{ fontSize: 64, marginBottom: 12 }}>🎁</Text>
                <Text style={styles.emptyTitle}>No deals right now</Text>
                <Text style={styles.emptySub}>Pull down to refresh or check back soon!</Text>
                <Text style={styles.emptyHint}>💡 Deals are updated frequently</Text>
              </View>
            )
          )
        }
      />

      {/* Expiry Warning Bar - Sticky at Top */}
      {!dismissedExpiryWarning && expiringDeals.length > 0 && (
        <View style={styles.expiryWarningBar}>
          <View style={styles.expiryWarningContent}>
            <Text style={styles.expiryWarningIcon}>🔥 HURRY!</Text>
            <Text style={styles.expiryWarningText}>
              {expiringDeals.length} deal{expiringDeals.length > 1 ? 's' : ''} expiring in &lt;30min
            </Text>
          </View>
          <Pressable onPress={() => setDismissedExpiryWarning(true)} hitSlop={8}>
            <Text style={styles.expiryWarningClose}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* Sticky Featured Deal - Appears on Scroll */}
      {showStickyFeatured && (
        <View style={styles.stickyFeaturedContainer}>
          <View style={styles.stickyFeaturedHero}>
            <View style={styles.stickyFeaturedImage}>
              {featuredVisibleDeal.image_url ? (
                <Image source={{ uri: featuredVisibleDeal.image_url }} style={{ width: 60, height: 60, borderRadius: 6 }} />
              ) : (
                <LinearGradient colors={['#667EEA', '#764BA2']} style={{ width: 60, height: 60, borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 28 }}>📦</Text>
                </LinearGradient>
              )}
            </View>
            <View style={styles.stickyFeaturedInfo}>
              <Text style={styles.stickyFeaturedTitle} numberOfLines={1}>
                {featuredVisibleDeal.title || featuredVisibleDeal.product_name}
              </Text>
              <Text style={styles.stickyFeaturedPrice}>
                {formatPrice(featuredVisibleDeal.final_price)}
              </Text>
            </View>
            <Pressable
              style={styles.stickyFeaturedCTA}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                handleClaim(featuredVisibleDeal.id);
              }}
            >
              <LinearGradient
                colors={['#FF7A18', '#FF5A1F']}
                style={styles.stickyFeaturedCTAGradient}
              >
                <Text style={styles.stickyFeaturedCTAText}>Claim</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#4F46E5' },

  // ═══════════════════════════════════════════════════════════════════════════════
  // HERO SECTION
  // ═══════════════════════════════════════════════════════════════════════════════
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  heroContent: { flex: 1 },
  heroGreeting: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 32,
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
  },
  heroCountBadge: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  heroCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  heroRight: {
    alignItems: 'center',
    marginLeft: 16,
  },
  heroEmoji: {
    fontSize: 56,
  },
  heroEmojiSub: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // STICKY CONTROLS
  // ═══════════════════════════════════════════════════════════════════════════════
  stickyControls: {
    backgroundColor: COLORS.bg,
    paddingTop: 8,
    paddingBottom: 8,
    zIndex: 20,
    elevation: 8,
  },
  controlStack: {
    backgroundColor: COLORS.bg,
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // SEARCH
  // ═══════════════════════════════════════════════════════════════════════════════
  searchShell: {
    marginTop: -2,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.gray100,
    ...SHADOWS.card,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.gray900,
    paddingVertical: 0,
  },
  searchClear: {
    fontSize: 16,
    color: COLORS.gray400,
    fontWeight: '700',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // TOP PICKS / SORT
  // ═══════════════════════════════════════════════════════════════════════════════
  topPicksSection: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  topPicksRow: {
    gap: 12,
    paddingRight: 16,
  },
  topPickCard: {
    width: 170,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.gray100,
    ...SHADOWS.card,
  },
  topPickImageWrap: {
    height: 110,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  topPickImage: {
    width: '100%',
    height: '100%',
  },
  topPickImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topPickEmoji: {
    fontSize: 30,
  },
  topPickBadge: {
    position: 'absolute',
    left: 8,
    top: 8,
    backgroundColor: 'rgba(17,24,39,0.78)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  topPickBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  topPickShop: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  topPickName: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    color: COLORS.gray900,
  },
  topPickPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  topPickPrice: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.green,
  },
  topPickCompare: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.gray400,
    textDecorationLine: 'line-through',
  },
  sectionHeaderCompact: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitleSmall: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.gray900,
  },
  sectionMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gray500,
  },
  sortSection: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  sortChipActive: {
    backgroundColor: COLORS.gray900,
    borderColor: COLORS.gray900,
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.gray700,
  },
  sortChipTextActive: {
    color: '#fff',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // CATEGORIES
  // ═══════════════════════════════════════════════════════════════════════════════
  catSection: { 
    backgroundColor: '#fff', 
    paddingVertical: 14,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -12,
  },
  catRow: { paddingHorizontal: 16, gap: 10 },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: COLORS.gray100,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  catEmoji: { fontSize: 16 },
  catText: { fontSize: 13, fontWeight: '600', color: COLORS.gray600 },
  catCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  catCountText: { fontSize: 10, fontWeight: '800', color: '#fff' },

  // ═══════════════════════════════════════════════════════════════════════════════
  // FEATURED DEAL
  // ═══════════════════════════════════════════════════════════════════════════════
  featuredSection: { 
    paddingHorizontal: 16, 
    paddingTop: 20, 
    backgroundColor: COLORS.bg,
  },
  featuredCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 12,
    ...SHADOWS.cardHover,
  },
  featuredPressable: {
    minHeight: 340,
    position: 'relative',
  },
  featuredBgImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  featuredOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  featuredDiscountBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
  },
  featuredDiscountInner: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.cardHover,
  },
  featuredDiscountText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
  },
  featuredDiscountSub: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.9)',
    marginTop: -2,
  },
  featuredContent: {
    flex: 1,
    padding: 18,
    justifyContent: 'space-between',
  },
  featuredTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  featuredShopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  featuredShopIcon: { fontSize: 12 },
  featuredShopName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.gray700,
  },
  socialProofBadge: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  socialProofText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.gray600,
  },
  featuredReasonBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  featuredReasonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  featuredMiddle: {
    marginTop: 'auto',
  },
  featuredTitle: {
    fontSize: 23,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  featuredDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.84)',
    marginTop: 4,
    maxWidth: '90%',
  },
  featuredPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  featuredFinalPrice: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
  },
  featuredComparePrice: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.72)',
    textDecorationLine: 'line-through',
  },
  featuredSavingsChip: {
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.32)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  featuredSavingsText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D1FAE5',
  },
  featuredBottom: {
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    padding: 12,
    borderRadius: 18,
  },
  featuredTimerSection: {
    alignItems: 'center',
  },
  featuredTimerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gray500,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  featuredCTA: {
    overflow: 'hidden',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  featuredCTADisabled: {
    opacity: 0.7,
  },
  featuredCTAGradient: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  featuredCTAText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.6,
  },
  featuredCTASubtext: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
  },
  ctaShimmer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // SECTION HEADERS
  // ═══════════════════════════════════════════════════════════════════════════════
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionHeader2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
    backgroundColor: COLORS.bg,
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: COLORS.gray900,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 1,
  },
  countBadge: { 
    paddingHorizontal: 12, 
    paddingVertical: 5, 
    borderRadius: 14,
  },
  countText: { fontSize: 12, fontWeight: '700' },

  // ═══════════════════════════════════════════════════════════════════════════════
  // GRID & LIST
  // ═══════════════════════════════════════════════════════════════════════════════
  list: { 
    backgroundColor: COLORS.bg, 
    paddingHorizontal: 12, 
    paddingBottom: 100,
  },
  listEmpty: { flexGrow: 1 },
  gridRow: { gap: 12, marginBottom: 12 },

  // ═══════════════════════════════════════════════════════════════════════════════
  // DEAL CARD
  // ═══════════════════════════════════════════════════════════════════════════════
  dealCard: {
    flex: 1,
    maxWidth: (SCREEN_W - 36) / 2,
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    ...SHADOWS.cardHover,
  },
  dealCardExpired: { opacity: 0.6 },
  dealCardInner: { flex: 1 },
  dealImageWrap: { 
    width: '100%', 
    height: 130, 
    position: 'relative',
    overflow: 'hidden',
  },
  dealImage: { width: '100%', height: '100%' },
  dealImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dealDiscountBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 10,
  },
  dealDiscountGradient: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  dealDiscountText: { 
    fontSize: 14, 
    fontWeight: '900', 
    color: '#fff',
  },
  dealDiscountOff: {
    fontSize: 8,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.9)',
  },
  hotBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  hotBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  lowStockBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(239,68,68,0.95)',
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  lowStockText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },
  expiredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expiredText: { 
    fontSize: 16, 
    fontWeight: '900', 
    color: '#fff', 
    letterSpacing: 3,
  },
  dealBody: { 
    padding: 12, 
    gap: 4,
  },
  dealShopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dealShopIcon: { fontSize: 10 },
  dealShop: { 
    fontSize: 11, 
    fontWeight: '700', 
    color: COLORS.primary,
    flex: 1,
  },
  dealName: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: COLORS.gray900, 
    lineHeight: 18,
    marginTop: 2,
  },
  dealPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  dealFinalPrice: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.green,
  },
  dealBasePrice: {
    fontSize: 12,
    color: COLORS.gray400,
    textDecorationLine: 'line-through',
    fontWeight: '600',
  },
  dealSavingsChip: {
    backgroundColor: COLORS.greenLight,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dealSavingsText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.green,
  },
  dealTimer: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  dealTimerExpired: { backgroundColor: COLORS.gray100 },
  dealTimerText: { 
    fontSize: 11, 
    fontWeight: '700',
  },
  dealSocialProof: {
    fontSize: 10,
    color: COLORS.gray500,
    marginTop: 4,
  },
  dealClaimBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  dealClaimBtnDisabled: { opacity: 0.6 },
  dealClaimGradient: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealClaimText: { 
    fontSize: 13, 
    fontWeight: '800', 
    color: '#fff',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // LOADING / SKELETON
  // ═══════════════════════════════════════════════════════════════════════════════
  loadingContainer: {
    padding: 16,
    backgroundColor: COLORS.bg,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  skeletonCard: {
    width: (SCREEN_W - 36) / 2,
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  skeletonImage: {
    width: '100%',
    height: 130,
    backgroundColor: COLORS.gray200,
    overflow: 'hidden',
  },
  skeletonShimmer: {
    width: 100,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  skeletonBody: {
    padding: 12,
    gap: 8,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: COLORS.gray200,
    borderRadius: 6,
    width: '80%',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // STATES (Error, Empty)
  // ═══════════════════════════════════════════════════════════════════════════════
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
    gap: 8,
  },
  loadingText: { 
    fontSize: 14, 
    color: COLORS.gray400, 
    marginTop: 12,
  },
  errorTitle: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: COLORS.gray800,
    textAlign: 'center',
  },
  errorSub: { 
    fontSize: 14, 
    color: COLORS.gray500, 
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  retryBtnGradient: {
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  retryText: { 
    color: '#fff', 
    fontWeight: '800', 
    fontSize: 15,
  },
  emptyTitle: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: COLORS.gray800,
  },
  emptySub: { 
    fontSize: 14, 
    color: COLORS.gray500, 
    textAlign: 'center', 
    lineHeight: 22,
  },
  emptyHint: {
    fontSize: 13,
    color: COLORS.gray400,
    marginTop: 8,
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // HEART BUTTONS & WISHLIST
  // ═══════════════════════════════════════════════════════════════════════════════
  dealHeartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
    zIndex: 5,
  },
  featuredSaveBtn: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // EXPIRY WARNING BAR
  // ═══════════════════════════════════════════════════════════════════════════════
  expiryWarningBar: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  expiryWarningContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  expiryWarningIcon: {
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
  },
  expiryWarningText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  expiryWarningClose: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '800',
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // STICKY FEATURED DEAL
  // ═══════════════════════════════════════════════════════════════════════════════
  stickyFeaturedContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stickyFeaturedHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stickyFeaturedImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  stickyFeaturedInfo: {
    flex: 1,
    gap: 2,
  },
  stickyFeaturedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  stickyFeaturedPrice: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.green,
  },
  stickyFeaturedCTA: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  stickyFeaturedCTAGradient: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickyFeaturedCTAText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
});
