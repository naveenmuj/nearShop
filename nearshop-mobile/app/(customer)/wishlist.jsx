import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getWishlist, removeFromWishlist } from '../../lib/wishlists';
import { getFollowingShops, unfollowShop } from '../../lib/shops';
import { WishlistSkeleton } from '../../components/ui/ScreenSkeletons';
import { alert } from '../../components/ui/PremiumAlert';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2; // 16 padding each side + 16 gap

const TABS = {
  PRODUCTS: 'products',
  SHOPS: 'shops',
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function Badge({ count, color = COLORS.red }) {
  if (!count || count < 1) return null;
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

function ProductImage({ uri, onRemove, showRemove = true }) {
  return (
    <View style={styles.imageContainer}>
      <Image
        source={uri ? { uri } : require('../../assets/icon.png')}
        style={styles.productImage}
        resizeMode="cover"
        defaultSource={require('../../assets/icon.png')}
      />
      {showRemove && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={onRemove}
          hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
          accessibilityLabel="Remove from wishlist"
          accessibilityRole="button"
        >
          <Text style={styles.removeIcon}>❌</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function SavedItemCard({ item, onRemove, onPress }) {
  // Map backend response to component props
  const imageUrl = item.image || (item.product_images && item.product_images[0]) || null;
  const price = item.price ?? item.product_price ?? 0;
  
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`View ${item.product_name}`}
    >
      <ProductImage
        uri={imageUrl}
        onRemove={() => onRemove(item.product_id)}
        showRemove
      />
      <View style={styles.cardBody}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.product_name}
        </Text>
        <Text style={styles.price}>{formatPrice(price)}</Text>
        <Text style={styles.shopName} numberOfLines={1}>
          {item.shop_name}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function FollowedShopCard({ item, onPress, onUnfollow }) {
  const image = item.logo_url || item.cover_image || null;
  const rating = Number(item.avg_rating || 0);
  const followedDate = item.followed_at ? new Date(item.followed_at) : null;
  const followedSince = (() => {
    if (!followedDate || Number.isNaN(followedDate.getTime())) return null;
    const diffMs = Date.now() - followedDate.getTime();
    const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    if (diffDays < 1) return 'today';
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    if (diffDays < 30) {
      const weeks = Math.max(1, Math.floor(diffDays / 7));
      return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
    }
    const months = Math.max(1, Math.floor(diffDays / 30));
    return `${months} month${months === 1 ? '' : 's'} ago`;
  })();

  return (
    <TouchableOpacity
      style={styles.shopCard}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`View shop ${item.name}`}
    >
      <View style={styles.shopMediaWrap}>
        <Image
          source={image ? { uri: image } : require('../../assets/icon.png')}
          style={styles.shopMedia}
          resizeMode="cover"
          defaultSource={require('../../assets/icon.png')}
        />
      </View>
      <View style={styles.shopBody}>
        <View style={styles.shopTitleRow}>
          <Text style={styles.shopTitle} numberOfLines={1}>{item.name}</Text>
          {item.is_verified ? <Text style={styles.verifiedBadge}>✅</Text> : null}
        </View>
        <Text style={styles.shopMeta} numberOfLines={1}>
          {item.category || 'Local Shop'}
        </Text>
        <View style={styles.shopStatsRow}>
          <Text style={styles.shopStatText}>⭐ {rating.toFixed(1)}</Text>
          <Text style={styles.shopStatDot}>•</Text>
          <Text style={styles.shopStatText}>{item.total_products || 0} products</Text>
        </View>
        {followedSince ? (
          <Text style={styles.followedSinceText}>Following since {followedSince}</Text>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={() => onUnfollow(item.id)}
        style={styles.unfollowBtn}
        accessibilityRole="button"
        accessibilityLabel={`Unfollow ${item.name}`}
      >
        <Text style={styles.unfollowText}>Following</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function EmptyState({ tab, onStartShopping, onExploreShops }) {
  const isProductsTab = tab === TABS.PRODUCTS;
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>{isProductsTab ? '💔' : '🏪'}</Text>
      <Text style={styles.emptyTitle}>
        {isProductsTab ? 'No saved products yet' : 'No followed shops yet'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {isProductsTab
          ? 'Save products you love and revisit them quickly.'
          : 'Follow shops to see them in one place for faster reorders.'}
      </Text>
      <TouchableOpacity
        style={styles.startShoppingButton}
        onPress={isProductsTab ? onStartShopping : onExploreShops}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={isProductsTab ? 'Start Shopping' : 'Explore Shops'}
      >
        <Text style={styles.startShoppingText}>{isProductsTab ? 'Start Shopping' : 'Explore Shops'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function WishlistScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState(TABS.PRODUCTS);
  const [savedItems, setSavedItems] = useState([]);
  const [followedShops, setFollowedShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [wishlistRes, followingRes] = await Promise.allSettled([
        getWishlist(),
        getFollowingShops({ page: 1, per_page: 50 }),
      ]);
      if (wishlistRes.status === 'fulfilled') {
        setSavedItems(wishlistRes.value?.data?.items ?? []);
      }
      if (followingRes.status === 'fulfilled') {
        setFollowedShops(followingRes.value?.data?.items ?? []);
      }
    } catch (err) {
      setError('Failed to load wishlist. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  // ── Remove item ──────────────────────────────────────────────────────────────

  const handleRemove = useCallback(
    async (productId) => {
      const confirmed = await alert.confirm({
        title: 'Remove from Wishlist',
        message: 'Are you sure you want to remove this item?',
        confirmText: 'Remove',
        cancelText: 'Cancel',
        type: 'danger',
      });
      
      if (confirmed) {
        // Optimistic update
        setSavedItems((prev) =>
          prev.filter((i) => i.product_id !== productId)
        );
        try {
          await removeFromWishlist(productId);
        } catch {
          // Roll back on failure by re-fetching
          alert.error({ title: 'Error', message: 'Could not remove item. Please try again.' });
          fetchData(true);
        }
      }
    },
    [fetchData]
  );

  // ── Navigation ───────────────────────────────────────────────────────────────

  const navigateToProduct = useCallback(
    (productId) => {
      router.push(`/(customer)/product/${productId}`);
    },
    [router]
  );

  const navigateToShop = useCallback(
    (shopId) => {
      router.push(`/(customer)/shop/${shopId}`);
    },
    [router]
  );

  const navigateToHome = useCallback(() => {
    router.push('/(customer)/home');
  }, [router]);

  const navigateToShops = useCallback(() => {
    router.push('/(customer)/shops');
  }, [router]);

  // ── Derived state ────────────────────────────────────────────────────────────

  const activeItems = activeTab === TABS.PRODUCTS ? savedItems : followedShops;
  const followedShopsCount = followedShops.length;
  const savedCount = savedItems.length;

  // ── Render helpers ───────────────────────────────────────────────────────────

  const renderSavedItem = useCallback(
    ({ item }) => (
      <SavedItemCard
        item={item}
        onRemove={handleRemove}
        onPress={() => navigateToProduct(item.product_id)}
      />
    ),
    [handleRemove, navigateToProduct]
  );

  const handleUnfollowShop = useCallback(
    async (shopId) => {
      const confirmed = await alert.confirm({
        title: 'Unfollow Shop',
        message: 'Do you want to unfollow this shop?',
        confirmText: 'Unfollow',
        cancelText: 'Cancel',
        type: 'warning',
      });

      if (!confirmed) return;

      const prevShops = followedShops;
      setFollowedShops((prev) => prev.filter((s) => String(s.id) !== String(shopId)));
      try {
        await unfollowShop(shopId);
      } catch {
        setFollowedShops(prevShops);
        alert.error({ title: 'Error', message: 'Could not unfollow shop. Please try again.' });
      }
    },
    [followedShops]
  );

  const renderFollowedShop = useCallback(
    ({ item }) => (
      <FollowedShopCard
        item={item}
        onUnfollow={handleUnfollowShop}
        onPress={() => navigateToShop(item.id)}
      />
    ),
    [handleUnfollowShop, navigateToShop]
  );

  const keyExtractor = useCallback(
    (item) => String(activeTab === TABS.PRODUCTS ? item.product_id : item.id),
    [activeTab]
  );

  // ── Loading state ────────────────────────────────────────────────────────────

  if (loading) {
    return <WishlistSkeleton />;
  }

  // ── Error state ──────────────────────────────────────────────────────────────

  if (error) {
    return (
      <View style={styles.loaderContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => fetchData()}
          accessibilityRole="button"
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────

  return (
    <View style={styles.screen}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Saved & Following</Text>
          {(activeTab === TABS.PRODUCTS ? savedCount : followedShopsCount) > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {activeTab === TABS.PRODUCTS ? savedCount : followedShopsCount}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Tab row ────────────────────────────────────────────────────── */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === TABS.PRODUCTS && styles.tabActive]}
          onPress={() => setActiveTab(TABS.PRODUCTS)}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === TABS.PRODUCTS }}
        >
          <View style={styles.tabInner}>
            <Text
              style={[
                styles.tabLabel,
                activeTab === TABS.PRODUCTS && styles.tabLabelActive,
              ]}
            >
              Saved Products
            </Text>
            <Badge count={savedCount} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === TABS.SHOPS && styles.tabActive,
          ]}
          onPress={() => setActiveTab(TABS.SHOPS)}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === TABS.SHOPS }}
        >
          <View style={styles.tabInner}>
            <Text
              style={[
                styles.tabLabel,
                activeTab === TABS.SHOPS && styles.tabLabelActive,
              ]}
            >
              Followed Shops
            </Text>
            <Badge count={followedShopsCount} />
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Content ────────────────────────────────────────────────────── */}
      {activeItems.length === 0 ? (
        <EmptyState tab={activeTab} onStartShopping={navigateToHome} onExploreShops={navigateToShops} />
      ) : (
        <FlatList
          key={activeTab} // forces re-mount on tab switch to reset scroll
          data={activeItems}
          keyExtractor={keyExtractor}
          renderItem={
            activeTab === TABS.PRODUCTS ? renderSavedItem : renderFollowedShop
          }
          numColumns={activeTab === TABS.PRODUCTS ? 2 : 1}
          columnWrapperStyle={activeTab === TABS.PRODUCTS ? styles.row : undefined}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.red]}
              tintColor={COLORS.red}
            />
          }
        />
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  // ── Loader / error ────────────────────────────────────────────────────────
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    gap: 12,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.gray500,
  },
  errorText: {
    fontSize: 15,
    color: COLORS.red,
    textAlign: 'center',
    marginHorizontal: 32,
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
  },
  retryText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 14,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.gray900,
    letterSpacing: -0.3,
  },
  countBadge: {
    backgroundColor: COLORS.redLight,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.red,
  },

  // ── Tabs ──────────────────────────────────────────────────────────────────
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray100,
  },
  tabActive: {
    backgroundColor: COLORS.redLight,
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray500,
  },
  tabLabelActive: {
    color: COLORS.red,
  },

  // ── Badge ─────────────────────────────────────────────────────────────────
  badge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.white,
  },

  // ── List ─────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 32,
  },
  row: {
    gap: 16,
    marginBottom: 16,
  },

  // ── Followed shop card ───────────────────────────────────────────────────
  shopCard: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.gray100,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...SHADOWS.card,
    marginBottom: 12,
  },
  shopMediaWrap: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.gray100,
  },
  shopMedia: {
    width: '100%',
    height: '100%',
  },
  shopBody: {
    flex: 1,
    gap: 4,
  },
  shopTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shopTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  verifiedBadge: {
    fontSize: 13,
  },
  shopMeta: {
    fontSize: 12,
    color: COLORS.gray500,
  },
  shopStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shopStatText: {
    fontSize: 12,
    color: COLORS.gray700,
    fontWeight: '600',
  },
  shopStatDot: {
    fontSize: 12,
    color: COLORS.gray400,
  },
  followedSinceText: {
    fontSize: 11,
    color: COLORS.gray500,
    marginTop: 2,
  },
  unfollowBtn: {
    backgroundColor: COLORS.redLight,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  unfollowText: {
    fontSize: 12,
    color: COLORS.red,
    fontWeight: '700',
  },

  // ── Card ─────────────────────────────────────────────────────────────────
  card: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: COLORS.gray100,
  },

  // ── Image ─────────────────────────────────────────────────────────────────
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: COLORS.gray100,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.card,
  },
  removeIcon: {
    fontSize: 12,
    lineHeight: 14,
  },

  // ── Price drop badge (overlaid on image) ───────────────────────────────────
  dropBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: COLORS.green,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    zIndex: 2,
  },
  dropBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: -0.2,
  },

  // ── Card body ─────────────────────────────────────────────────────────────
  cardBody: {
    padding: 10,
    gap: 3,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray800,
    lineHeight: 18,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.gray900,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  oldPrice: {
    fontSize: 12,
    color: COLORS.gray400,
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  newPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.green,
  },
  shopName: {
    fontSize: 12,
    color: COLORS.gray500,
    marginTop: 1,
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.gray800,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  startShoppingButton: {
    backgroundColor: COLORS.red,
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 14,
    ...SHADOWS.cardHover,
  },
  startShoppingText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
