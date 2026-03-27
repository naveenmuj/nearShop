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
import { getWishlist, removeFromWishlist, getPriceDrops } from '../../lib/wishlists';
import { WishlistSkeleton } from '../../components/ui/ScreenSkeletons';
import { alert } from '../../components/ui/PremiumAlert';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2; // 16 padding each side + 16 gap

const TABS = {
  SAVED: 'saved',
  PRICE_DROPS: 'price_drops',
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
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`View ${item.product_name}`}
    >
      <ProductImage
        uri={item.image}
        onRemove={() => onRemove(item.product_id)}
        showRemove
      />
      <View style={styles.cardBody}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.product_name}
        </Text>
        <Text style={styles.price}>{formatPrice(item.price)}</Text>
        <Text style={styles.shopName} numberOfLines={1}>
          {item.shop_name}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function PriceDropCard({ item, onRemove, onPress }) {
  const name = item.product_name || item.name || 'Product';
  const imageUri = item.image || (item.images && item.images[0]) || null;
  const oldPrice = item.old_price ?? item.saved_price ?? 0;
  const newPrice = item.price ?? item.current_price ?? 0;
  const shopName = item.shop_name || '';

  const dropPercent =
    oldPrice && oldPrice > newPrice
      ? Math.round(((oldPrice - newPrice) / oldPrice) * 100)
      : item.drop_percentage ? Math.round(item.drop_percentage) : 0;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`View ${name}, price dropped ${dropPercent}%`}
    >
      <ProductImage
        uri={imageUri}
        onRemove={() => onRemove(item.product_id)}
        showRemove
      />
      {dropPercent > 0 && (
        <View style={styles.dropBadge}>
          <Text style={styles.dropBadgeText}>↓{dropPercent}%</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.productName} numberOfLines={2}>
          {name}
        </Text>
        <View style={styles.priceRow}>
          {oldPrice > newPrice && (
            <Text style={styles.oldPrice}>{formatPrice(oldPrice)}</Text>
          )}
          <Text style={styles.newPrice}>{formatPrice(newPrice)}</Text>
        </View>
        {shopName ? (
          <Text style={styles.shopName} numberOfLines={1}>
            {shopName}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ onStartShopping }) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>💔</Text>
      <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
      <Text style={styles.emptySubtitle}>
        Save items you love and never lose track of them.
      </Text>
      <TouchableOpacity
        style={styles.startShoppingButton}
        onPress={onStartShopping}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Start Shopping"
      >
        <Text style={styles.startShoppingText}>Start Shopping</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function WishlistScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState(TABS.SAVED);
  const [savedItems, setSavedItems] = useState([]);
  const [priceDropItems, setPriceDropItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [wishlistRes, priceDropsRes] = await Promise.allSettled([
        getWishlist(),
        getPriceDrops(),
      ]);
      if (wishlistRes.status === 'fulfilled') {
        setSavedItems(wishlistRes.value?.data?.items ?? []);
      }
      if (priceDropsRes.status === 'fulfilled') {
        setPriceDropItems(priceDropsRes.value?.data?.items ?? priceDropsRes.value?.data ?? []);
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
        setPriceDropItems((prev) =>
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

  const navigateToHome = useCallback(() => {
    router.push('/(customer)/home');
  }, [router]);

  // ── Derived state ────────────────────────────────────────────────────────────

  const activeItems = activeTab === TABS.SAVED ? savedItems : priceDropItems;
  const priceDropCount = priceDropItems.length;
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

  const renderPriceDropItem = useCallback(
    ({ item }) => (
      <PriceDropCard
        item={item}
        onRemove={handleRemove}
        onPress={() => navigateToProduct(item.product_id)}
      />
    ),
    [handleRemove, navigateToProduct]
  );

  const keyExtractor = useCallback((item) => String(item.product_id), []);

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
          <Text style={styles.headerTitle}>My Wishlist ❤️</Text>
          {savedCount > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{savedCount}</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Tab row ────────────────────────────────────────────────────── */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === TABS.SAVED && styles.tabActive]}
          onPress={() => setActiveTab(TABS.SAVED)}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === TABS.SAVED }}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === TABS.SAVED && styles.tabLabelActive,
            ]}
          >
            Saved Items
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === TABS.PRICE_DROPS && styles.tabActive,
          ]}
          onPress={() => setActiveTab(TABS.PRICE_DROPS)}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === TABS.PRICE_DROPS }}
        >
          <View style={styles.tabInner}>
            <Text
              style={[
                styles.tabLabel,
                activeTab === TABS.PRICE_DROPS && styles.tabLabelActive,
              ]}
            >
              Price Drops
            </Text>
            <Badge count={priceDropCount} />
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Content ────────────────────────────────────────────────────── */}
      {activeItems.length === 0 ? (
        <EmptyState onStartShopping={navigateToHome} />
      ) : (
        <FlatList
          key={activeTab} // forces re-mount on tab switch to reset scroll
          data={activeItems}
          keyExtractor={keyExtractor}
          renderItem={
            activeTab === TABS.SAVED ? renderSavedItem : renderPriceDropItem
          }
          numColumns={2}
          columnWrapperStyle={styles.row}
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
