import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  Animated,
  Share,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';

import { getShop, getShopProducts, getShopReviews, followShop, unfollowShop } from '../../../lib/shops';
import { trackEvent } from '../../../lib/analytics';
import ProductCard from '../../../components/ProductCard';
import { COLORS, SHADOWS, CATEGORY_COLORS, formatPrice } from '../../../constants/theme';
import useAuthStore from '../../../store/authStore';
import useLocationStore from '../../../store/locationStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 250;
const HEADER_HEIGHT = 56;
const TAB_BAR_HEIGHT = 48;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function StarRow({ rating = 0, size = 14, color = '#EF9F27' }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = rating >= star;
        const half = !filled && rating >= star - 0.5;
        return (
          <Text key={star} style={{ fontSize: size, color: filled || half ? color : COLORS.gray300 }}>
            ★
          </Text>
        );
      })}
    </View>
  );
}

function AvatarInitials({ name, size = 40 }) {
  const initials = name
    ? name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('')
    : '?';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.38, fontWeight: '700', color: COLORS.primary }}>{initials}</Text>
    </View>
  );
}

function formatReviewDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ShopDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuthStore();
  const { lat, lng } = useLocationStore();

  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('products');
  const [followLoading, setFollowLoading] = useState(false);
  const [isFollowed, setIsFollowed] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  // Parallax translate for hero image
  const heroTranslateY = scrollY.interpolate({
    inputRange: [-HERO_HEIGHT, 0, HERO_HEIGHT],
    outputRange: [HERO_HEIGHT / 2, 0, -HERO_HEIGHT / 3],
    extrapolate: 'clamp',
  });

  // Floating header opacity (appears when scrolled past hero)
  const headerOpacity = scrollY.interpolate({
    inputRange: [HERO_HEIGHT - HEADER_HEIGHT - 20, HERO_HEIGHT - HEADER_HEIGHT],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const loadShop = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getShop(id);
      const shopData = res?.data?.shop ?? res?.data ?? null;
      if (shopData) {
        setShop(shopData);
        setIsFollowed(shopData.is_followed ?? false);
        setFollowerCount(shopData.follower_count ?? 0);
        trackEvent({
          event_type: 'view',
          entity_type: 'shop',
          entity_id: id,
          lat,
          lng,
        }).catch(() => {});
      }
    } catch (err) {
      // silently fail — empty state handles it
    } finally {
      setLoading(false);
    }
  }, [id, lat, lng]);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const res = await getShopProducts(id);
      const data = res?.data;
      const items = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.products)
            ? data.products
            : [];
      setProducts(items);
    } catch {
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, [id]);

  const loadReviews = useCallback(async () => {
    if (reviewsLoaded) return;
    setReviewsLoading(true);
    try {
      const res = await getShopReviews(id);
      setReviews(res?.data?.reviews ?? []);
      setReviewsLoaded(true);
    } catch {
      setReviews([]);
      setReviewsLoaded(true);
    } finally {
      setReviewsLoading(false);
    }
  }, [id, reviewsLoaded]);

  useEffect(() => {
    loadShop();
    loadProducts();
  }, [loadShop, loadProducts]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'reviews' && !reviewsLoaded) {
      loadReviews();
    }
  };

  const handleFollowToggle = async () => {
    if (followLoading) return;
    setFollowLoading(true);
    const wasFollowed = isFollowed;
    // Optimistic update
    setIsFollowed(!wasFollowed);
    setFollowerCount((c) => (wasFollowed ? Math.max(0, c - 1) : c + 1));
    try {
      if (wasFollowed) {
        await unfollowShop(id);
      } else {
        await followShop(id);
      }
    } catch {
      // Revert on failure
      setIsFollowed(wasFollowed);
      setFollowerCount((c) => (wasFollowed ? c + 1 : Math.max(0, c - 1)));
    } finally {
      setFollowLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: shop ? `Check out ${shop.name} on NearShop!` : 'Check out this shop on NearShop!',
        title: shop?.name ?? 'Shop on NearShop',
      });
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!shop) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <Text style={styles.errorText}>Shop not found</Text>
        <TouchableOpacity style={styles.backButtonSolid} onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.backButtonSolidText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const categoryColor = CATEGORY_COLORS[shop.category] ?? COLORS.primary;
  const distanceText = shop.distance != null ? `${(shop.distance / 1000).toFixed(1)} km` : null;

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* ── Floating header (visible after scrolling past hero) ── */}
      <Animated.View style={[styles.floatingHeader, { opacity: headerOpacity }]}>
        <TouchableOpacity style={styles.floatingBackBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={styles.floatingBackIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.floatingHeaderTitle} numberOfLines={1}>
          {shop.name}
        </Text>
        <TouchableOpacity style={styles.floatingShareBtn} onPress={handleShare} activeOpacity={0.8}>
          <Text style={styles.floatingIcon}>⎙</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Hero ────────────────────────────────────────────────── */}
        <View style={styles.heroContainer}>
          <Animated.View style={[styles.heroImageWrap, { transform: [{ translateY: heroTranslateY }] }]}>
            {shop.cover_image ? (
              <Image source={{ uri: shop.cover_image }} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <View style={[styles.heroImage, { backgroundColor: categoryColor + '33' }]}>
                <Text style={styles.heroPlaceholderIcon}>🏪</Text>
              </View>
            )}
            {/* Dark gradient overlay */}
            <View style={styles.heroOverlay} />
          </Animated.View>

          {/* Overlay buttons — always on top of hero */}
          <View style={styles.heroButtons}>
            <TouchableOpacity style={styles.heroIconBtn} onPress={() => router.back()} activeOpacity={0.85}>
              <Text style={styles.heroIconText}>‹</Text>
            </TouchableOpacity>
            <View style={styles.heroRightBtns}>
              <TouchableOpacity style={styles.heroIconBtn} onPress={handleShare} activeOpacity={0.85}>
                <Text style={styles.heroIconText}>⎙</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Shop name on hero */}
          <View style={styles.heroNameWrap}>
            <Text style={styles.heroShopName} numberOfLines={2}>
              {shop.name}
            </Text>
            {shop.is_verified && (
              <View style={styles.verifiedBadgeHero}>
                <Text style={styles.verifiedBadgeHeroText}>✓ Verified</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Shop info card ───────────────────────────────────────── */}
        <View style={styles.shopCard}>
          {/* Category + rating row */}
          <View style={styles.metaRow}>
            <View style={[styles.categoryPill, { backgroundColor: categoryColor + '1A' }]}>
              <Text style={[styles.categoryPillText, { color: categoryColor }]}>{shop.category}</Text>
            </View>
            {shop.avg_rating != null && (
              <View style={styles.ratingRow}>
                <StarRow rating={shop.avg_rating} size={13} />
                <Text style={styles.ratingText}>
                  {Number(shop.avg_rating).toFixed(1)}
                  {shop.rating_count ? ` · ${shop.rating_count} reviews` : ''}
                </Text>
              </View>
            )}
            {distanceText && (
              <View style={styles.distancePill}>
                <Text style={styles.distanceText}>{distanceText}</Text>
              </View>
            )}
          </View>

          {/* Address */}
          {shop.address && (
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📍</Text>
              <Text style={styles.infoText} numberOfLines={2}>
                {shop.address}
              </Text>
            </View>
          )}

          {/* Hours / open status */}
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>🕒</Text>
            <View style={[styles.openBadge, { backgroundColor: shop.is_open ? COLORS.greenLight : COLORS.redLight }]}>
              <Text style={[styles.openBadgeText, { color: shop.is_open ? COLORS.green : COLORS.red }]}>
                {shop.is_open ? 'Open now' : 'Closed'}
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Follow row */}
          <View style={styles.followRow}>
            <View style={styles.followCountWrap}>
              <Text style={styles.followCount}>{followerCount}</Text>
              <Text style={styles.followLabel}>Followers</Text>
            </View>
            <TouchableOpacity
              style={[styles.followBtn, isFollowed && styles.followBtnActive]}
              onPress={handleFollowToggle}
              activeOpacity={0.8}
              disabled={followLoading}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color={isFollowed ? COLORS.primary : COLORS.white} />
              ) : (
                <>
                  <Text style={[styles.followBtnIcon, isFollowed && styles.followBtnIconActive]}>
                    {isFollowed ? '♥' : '♡'}
                  </Text>
                  <Text style={[styles.followBtnText, isFollowed && styles.followBtnTextActive]}>
                    {isFollowed ? 'Following' : 'Follow'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Tabs ─────────────────────────────────────────────────── */}
        <View style={styles.tabBar}>
          {['products', 'reviews', 'about'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => handleTabChange(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tab content ──────────────────────────────────────────── */}

        {/* Products tab */}
        {activeTab === 'products' && (
          <View style={styles.tabContent}>
            {productsLoading ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={styles.tabLoader} />
            ) : products.length === 0 ? (
              <EmptyState icon="📦" title="No products yet" subtitle="This shop hasn't listed any products yet." />
            ) : (
              <FlatList
                data={products}
                keyExtractor={(item) => String(item.id)}
                numColumns={2}
                scrollEnabled={false}
                columnWrapperStyle={styles.productRow}
                contentContainerStyle={styles.productGrid}
                renderItem={({ item }) => (
                  <View style={styles.productCardWrap}>
                    <ProductCard product={item} />
                  </View>
                )}
              />
            )}
          </View>
        )}

        {/* Reviews tab */}
        {activeTab === 'reviews' && (
          <View style={styles.tabContent}>
            {reviewsLoading ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={styles.tabLoader} />
            ) : reviews.length === 0 ? (
              <EmptyState icon="💬" title="No reviews yet" subtitle="Be the first to review this shop after a purchase." />
            ) : (
              <View style={styles.reviewsList}>
                {reviews.map((review) => (
                  <ReviewCard key={String(review.id)} review={review} />
                ))}
              </View>
            )}
          </View>
        )}

        {/* About tab */}
        {activeTab === 'about' && (
          <View style={styles.tabContent}>
            <AboutSection shop={shop} categoryColor={categoryColor} />
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </Animated.ScrollView>
    </View>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────── */

function EmptyState({ icon, title, subtitle }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function ReviewCard({ review }) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <AvatarInitials name={review.reviewer_name ?? review.user_name ?? 'User'} size={40} />
        <View style={styles.reviewMeta}>
          <Text style={styles.reviewerName}>{review.reviewer_name ?? review.user_name ?? 'Anonymous'}</Text>
          <Text style={styles.reviewDate}>{formatReviewDate(review.created_at)}</Text>
        </View>
      </View>
      <View style={styles.reviewStarsRow}>
        <StarRow rating={review.rating ?? 0} size={15} />
        <Text style={styles.reviewRatingNum}>{Number(review.rating ?? 0).toFixed(1)}</Text>
      </View>
      {review.comment ? <Text style={styles.reviewText}>{review.comment}</Text> : null}
    </View>
  );
}

function AboutSection({ shop, categoryColor }) {
  const hours = shop.working_hours ?? {};

  return (
    <View>
      {/* Description */}
      {shop.description ? (
        <View style={styles.aboutSection}>
          <Text style={styles.aboutSectionTitle}>About</Text>
          <Text style={styles.aboutDescription}>{shop.description}</Text>
        </View>
      ) : null}

      {/* Full address */}
      {shop.address ? (
        <View style={styles.aboutSection}>
          <Text style={styles.aboutSectionTitle}>Address</Text>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutRowIcon}>📍</Text>
            <Text style={styles.aboutRowText}>{shop.address}</Text>
          </View>
        </View>
      ) : null}

      {/* Working hours table */}
      <View style={styles.aboutSection}>
        <Text style={styles.aboutSectionTitle}>Working Hours</Text>
        <View style={styles.hoursTable}>
          {DAYS.map((day, idx) => {
            const key = DAY_KEYS[idx];
            const dayHours = hours[key] ?? hours[day.toLowerCase()] ?? null;
            const isToday = new Date().getDay() === (idx + 1) % 7;
            return (
              <View key={day} style={[styles.hoursRow, isToday && styles.hoursRowToday]}>
                <Text style={[styles.hoursDay, isToday && styles.hoursDayToday]}>{day}</Text>
                <Text style={[styles.hoursTime, isToday && styles.hoursTimeToday]}>
                  {dayHours
                    ? typeof dayHours === 'object'
                      ? dayHours.closed
                        ? 'Closed'
                        : `${dayHours.open ?? dayHours.from ?? ''} – ${dayHours.close ?? dayHours.to ?? ''}`
                      : String(dayHours)
                    : '—'}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Contact */}
      {(shop.phone || shop.email || shop.website) ? (
        <View style={styles.aboutSection}>
          <Text style={styles.aboutSectionTitle}>Contact</Text>
          {shop.phone ? (
            <View style={styles.aboutRow}>
              <Text style={styles.aboutRowIcon}>📞</Text>
              <Text style={styles.aboutRowText}>{shop.phone}</Text>
            </View>
          ) : null}
          {shop.email ? (
            <View style={styles.aboutRow}>
              <Text style={styles.aboutRowIcon}>✉️</Text>
              <Text style={styles.aboutRowText}>{shop.email}</Text>
            </View>
          ) : null}
          {shop.website ? (
            <View style={styles.aboutRow}>
              <Text style={styles.aboutRowIcon}>🌐</Text>
              <Text style={[styles.aboutRowText, { color: COLORS.primary }]}>{shop.website}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    padding: 24,
    gap: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.gray600,
  },
  backButtonSolid: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  backButtonSolidText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },

  // Floating header
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT + 44, // 44 for status bar
    paddingTop: 44,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 100,
    ...SHADOWS.cardHover,
  },
  floatingBackBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingBackIcon: {
    fontSize: 28,
    color: COLORS.gray800,
    lineHeight: 32,
  },
  floatingHeaderTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.gray900,
    marginHorizontal: 8,
  },
  floatingShareBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingIcon: {
    fontSize: 20,
    color: COLORS.gray700,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Hero
  heroContainer: {
    height: HERO_HEIGHT,
    overflow: 'hidden',
    backgroundColor: COLORS.gray200,
  },
  heroImageWrap: {
    height: HERO_HEIGHT + 80, // extra to allow parallax
    width: '100%',
    position: 'absolute',
    top: -40,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroPlaceholderIcon: {
    fontSize: 72,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  heroButtons: {
    position: 'absolute',
    top: 44, // status bar height
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  heroIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroIconText: {
    fontSize: 24,
    color: COLORS.white,
    lineHeight: 28,
  },
  heroRightBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  heroNameWrap: {
    position: 'absolute',
    bottom: 18,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  heroShopName: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.white,
    lineHeight: 32,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  verifiedBadgeHero: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  verifiedBadgeHeroText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },

  // Shop card
  shopCard: {
    backgroundColor: COLORS.white,
    marginTop: -20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 8,
    ...SHADOWS.card,
    zIndex: 5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  categoryPill: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ratingText: {
    fontSize: 13,
    color: COLORS.gray500,
    fontWeight: '500',
  },
  distancePill: {
    backgroundColor: COLORS.gray100,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  distanceText: {
    fontSize: 12,
    color: COLORS.gray600,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
    gap: 8,
  },
  infoIcon: {
    fontSize: 15,
    width: 20,
    textAlign: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.gray600,
    lineHeight: 20,
  },
  openBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  openBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.gray100,
    marginVertical: 12,
  },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  followCountWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  followCount: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.gray900,
  },
  followLabel: {
    fontSize: 14,
    color: COLORS.gray500,
    fontWeight: '500',
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 110,
    justifyContent: 'center',
    ...SHADOWS.card,
  },
  followBtnActive: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  followBtnIcon: {
    fontSize: 17,
    color: COLORS.white,
    lineHeight: 20,
  },
  followBtnIconActive: {
    color: COLORS.primary,
  },
  followBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  followBtnTextActive: {
    color: COLORS.primary,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  tab: {
    flex: 1,
    height: TAB_BAR_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray400,
  },
  tabTextActive: {
    color: COLORS.primary,
  },

  // Tab content
  tabContent: {
    backgroundColor: COLORS.bg,
    minHeight: 300,
  },
  tabLoader: {
    marginTop: 48,
  },

  // Products grid
  productGrid: {
    padding: 14,
  },
  productRow: {
    gap: 12,
    marginBottom: 12,
  },
  productCardWrap: {
    flex: 1,
  },

  // Reviews
  reviewsList: {
    padding: 14,
    gap: 12,
  },
  reviewCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    ...SHADOWS.card,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  reviewMeta: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.gray800,
  },
  reviewDate: {
    fontSize: 12,
    color: COLORS.gray400,
    marginTop: 2,
  },
  reviewStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  reviewRatingNum: {
    fontSize: 13,
    color: COLORS.gray500,
    fontWeight: '600',
  },
  reviewText: {
    fontSize: 14,
    color: COLORS.gray700,
    lineHeight: 20,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 32,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 52,
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.gray700,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.gray400,
    textAlign: 'center',
    lineHeight: 20,
  },

  // About
  aboutSection: {
    backgroundColor: COLORS.white,
    marginHorizontal: 0,
    marginTop: 0,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
    padding: 18,
  },
  aboutSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.gray800,
    marginBottom: 10,
  },
  aboutDescription: {
    fontSize: 14,
    color: COLORS.gray600,
    lineHeight: 22,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  aboutRowIcon: {
    fontSize: 16,
    width: 22,
    textAlign: 'center',
    marginTop: 1,
  },
  aboutRowText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.gray600,
    lineHeight: 20,
  },

  // Hours table
  hoursTable: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.gray100,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
    backgroundColor: COLORS.white,
  },
  hoursRowToday: {
    backgroundColor: COLORS.primaryLight,
  },
  hoursDay: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.gray700,
    width: 100,
  },
  hoursDayToday: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  hoursTime: {
    fontSize: 14,
    color: COLORS.gray500,
    fontWeight: '500',
  },
  hoursTimeToday: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Bottom spacing
  bottomSpacing: {
    height: 40,
  },
});
