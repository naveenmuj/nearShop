import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
  TextInput,
  ScrollView,
  Keyboard,
  Vibration,
  Animated,
  Easing,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getWishlist, removeFromWishlist, getPriceDrops } from '../../lib/wishlists';
import { getFollowingShops, unfollowShop } from '../../lib/shops';
import { WishlistSkeleton } from '../../components/ui/ScreenSkeletons';
import { alert } from '../../components/ui/PremiumAlert';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';
import useWishlistStore from '../../store/wishlistStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2; // 16 padding each side + 16 gap

const TABS = {
  PRODUCTS: 'products',
  SHOPS: 'shops',
};

const SORT_OPTIONS = {
  NEWEST: 'newest',
  PRICE_LOW: 'price_low',
  PRICE_HIGH: 'price_high',
  NAME_ASC: 'name_asc',
  NAME_DESC: 'name_desc',
  PRICE_DROP: 'price_drop',
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

function ProductImage({ uri, onRemove, showRemove = true, isSelected = false }) {
  return (
    <View style={[styles.imageContainer, isSelected && styles.selectedImageContainer]}>
      <Image
        source={uri ? { uri } : require('../../assets/icon.png')}
        style={styles.productImage}
        resizeMode="cover"
        defaultSource={require('../../assets/icon.png')}
      />
      {isSelected && (
        <View style={styles.selectionCheckmark}>
          <Text style={styles.checkmarkText}>✓</Text>
        </View>
      )}
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

function StockBadge({ isAvailable, stockQuantity, lowStockThreshold }) {
  if (!isAvailable) {
    return (
      <View style={[styles.stockBadge, styles.stockUnavailable]}>
        <Text style={styles.stockBadgeText}>Out of Stock</Text>
      </View>
    );
  }
  
  if (stockQuantity !== null && stockQuantity !== undefined && stockQuantity <= lowStockThreshold) {
    return (
      <View style={[styles.stockBadge, styles.stockLow]}>
        <Text style={styles.stockBadgeText}>Low Stock ({stockQuantity})</Text>
      </View>
    );
  }
  
  if (stockQuantity !== null && stockQuantity !== undefined && stockQuantity > lowStockThreshold) {
    return (
      <View style={[styles.stockBadge, styles.stockAvailable]}>
        <Text style={styles.stockBadgeText}>In Stock</Text>
      </View>
    );
  }
  
  return null;
}

function SavedItemCard({ item, onRemove, onPress, isSelected = false, onToggleSelect, hasPriceDrop = false }) {
  const imageUrl = item.image || (item.product_images && item.product_images[0]) || null;
  const price = item.price ?? item.product_price ?? 0;
  
  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={onPress}
      onLongPress={onToggleSelect}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`View ${item.product_name}`}
    >
      {hasPriceDrop && (
        <View style={styles.priceDropBadge}>
          <Text style={styles.priceDropText}>🔥</Text>
        </View>
      )}
      <ProductImage
        uri={imageUrl}
        onRemove={() => onRemove(item.product_id)}
        showRemove
        isSelected={isSelected}
      />
      <View style={styles.cardBody}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.product_name}
        </Text>
        <Text style={styles.price}>{formatPrice(price)}</Text>
        <Text style={styles.shopName} numberOfLines={1}>
          {item.shop_name}
        </Text>
        {item.is_available !== undefined && (
          <StockBadge 
            isAvailable={item.is_available}
            stockQuantity={item.stock_quantity}
            lowStockThreshold={item.low_stock_threshold}
          />
        )}
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
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState(TABS.PRODUCTS);
  const [savedItems, setSavedItems] = useState([]);
  const [followedShops, setFollowedShops] = useState([]);
  const [priceDrops, setPriceDrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState(SORT_OPTIONS.NEWEST);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [toast, setToast] = useState(null);
  const [deletedItem, setDeletedItem] = useState(null);
  const [operatingItems, setOperatingItems] = useState(new Set());
  const scaleAnim = useCallback(() => new Animated.Value(0), [])();
  const setWishlistSummary = useWishlistStore((state) => state.setWishlistSummary);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [wishlistRes, followingRes, priceDropsRes] = await Promise.allSettled([
        getWishlist(),
        getFollowingShops({ page: 1, per_page: 50 }),
        getPriceDrops(),
      ]);
      const wishlistItems = wishlistRes.status === 'fulfilled'
        ? (wishlistRes.value?.data?.items ?? [])
        : [];
      const followedItems = followingRes.status === 'fulfilled'
        ? (followingRes.value?.data?.items ?? [])
        : [];
      const priceDropItems = priceDropsRes.status === 'fulfilled'
        ? (priceDropsRes.value?.data?.items ?? priceDropsRes.value?.data ?? [])
        : [];
      if (wishlistRes.status === 'fulfilled') {
        setSavedItems(wishlistItems);
      }
      if (followingRes.status === 'fulfilled') {
        setFollowedShops(followedItems);
      }
      setPriceDrops(priceDropItems);
      setWishlistSummary({
        savedCount: wishlistItems.length,
        followedCount: followedItems.length,
        priceDropCount: priceDropItems.length,
      });
    } catch (err) {
      setError('Failed to load wishlist. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setWishlistSummary]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [fetchData]);

  // ── Search & Filter ──────────────────────────────────────────────────────────

  const filteredAndSortedItems = useMemo(() => {
    let items = activeTab === TABS.PRODUCTS ? savedItems : followedShops;
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      items = items.filter(item => {
        const name = activeTab === TABS.PRODUCTS 
          ? item.product_name?.toLowerCase() 
          : item.name?.toLowerCase();
        const shop = activeTab === TABS.PRODUCTS
          ? item.shop_name?.toLowerCase()
          : '';
        return (name?.includes(query) || false) || (shop?.includes(query) || false);
      });
    }

    // Sort
    if (activeTab === TABS.PRODUCTS) {
      switch (sortBy) {
        case SORT_OPTIONS.NEWEST:
          // Already in newest order from API
          break;
        case SORT_OPTIONS.PRICE_LOW:
          items = [...items].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
          break;
        case SORT_OPTIONS.PRICE_HIGH:
          items = [...items].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
          break;
        case SORT_OPTIONS.NAME_ASC:
          items = [...items].sort((a, b) => a.product_name.localeCompare(b.product_name));
          break;
        case SORT_OPTIONS.NAME_DESC:
          items = [...items].sort((a, b) => b.product_name.localeCompare(a.product_name));
          break;
        case SORT_OPTIONS.PRICE_DROP:
          items = [...items].sort((a, b) => {
            const aHasDrop = priceDrops.some(p => p.product_id === a.product_id);
            const bHasDrop = priceDrops.some(p => p.product_id === b.product_id);
            return bHasDrop - aHasDrop; // Price drops first
          });
          break;
        default:
          break;
      }
    }

    return items;
  }, [activeTab, savedItems, followedShops, searchQuery, sortBy, priceDrops]);

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
        Vibration.vibrate(50);
        const removedItem = savedItems.find(i => i.product_id === productId);
        setSavedItems((prev) =>
          prev.filter((i) => i.product_id !== productId)
        );
        setDeletedItem(removedItem);
        setToast({ type: 'undo', message: 'Item removed. Undo?' });
        
        try {
          await removeFromWishlist(productId);
          setTimeout(() => {
            setDeletedItem(null);
            setToast(null);
          }, 3000);
        } catch {
          setSavedItems((prev) => [...prev, removedItem]);
          setDeletedItem(null);
          setToast(null);
          alert.error({ title: 'Error', message: 'Could not remove item. Please try again.' });
        }
      }
    },
    [fetchData, savedItems]
  );

  const handleUndoRemove = useCallback(async () => {
    if (deletedItem) {
      setSavedItems((prev) => [...prev, deletedItem]);
      setDeletedItem(null);
      setToast(null);
    }
  }, [deletedItem]);

  // ── Bulk Actions ──────────────────────────────────────────────────────────────

  const toggleSelectItem = useCallback((itemId) => {
    Vibration.vibrate(30);
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    Vibration.vibrate([30, 20, 30]);
    if (selectedItems.size === filteredAndSortedItems.length) {
      setSelectedItems(new Set());
    } else {
      const allIds = new Set(
        filteredAndSortedItems.map(item => 
          activeTab === TABS.PRODUCTS ? item.product_id : item.id
        )
      );
      setSelectedItems(allIds);
    }
  }, [filteredAndSortedItems, selectedItems.size, activeTab]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedItems.size === 0) return;

    const confirmed = await alert.confirm({
      title: 'Remove Items',
      message: `Are you sure you want to remove ${selectedItems.size} item${selectedItems.size !== 1 ? 's' : ''}?`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      type: 'danger',
    });

    if (!confirmed) return;

    Vibration.vibrate(100);
    Keyboard.dismiss();
    
    // Optimistic update
    const itemsToRemove = new Set(selectedItems);
    const removedItems = savedItems.filter(i => itemsToRemove.has(i.product_id));
    setSavedItems(prev => prev.filter(i => !itemsToRemove.has(i.product_id)));
    setOperatingItems(itemsToRemove);
    setSelectedItems(new Set());
    setIsSelectMode(false);
    setToast({ type: 'progress', message: `Removing ${selectedItems.size} item${selectedItems.size !== 1 ? 's' : ''}...` });

    try {
      await Promise.all(
        Array.from(selectedItems).map(id => removeFromWishlist(id))
      );
      setToast({ type: 'success', message: '✓ Items removed' });
      setTimeout(() => setToast(null), 2000);
      setOperatingItems(new Set());
    } catch {
      setSavedItems(prev => [...prev, ...removedItems]);
      setOperatingItems(new Set());
      alert.error({ title: 'Error', message: 'Could not remove some items. Please try again.' });
      setToast(null);
    }
  }, [selectedItems, fetchData, savedItems]);

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

  const activeItems = filteredAndSortedItems;
  const followedShopsCount = followedShops.length;
  const savedCount = savedItems.length;
  const priceDropCount = priceDrops.length;

  // ── Stats calculation ────────────────────────────────────────────────────────

  const wishlistStats = useMemo(() => {
    if (activeTab !== TABS.PRODUCTS || savedItems.length === 0) {
      return {
        totalItems: 0,
        totalValue: 0,
        avgPrice: 0,
        totalSavings: 0,
      };
    }

    const items = savedItems;
    const totalValue = items.reduce((sum, item) => sum + (item.price ?? 0), 0);
    const totalSavings = items.reduce((sum, item) => {
      const savings = (item.original_price ?? 0) - (item.price ?? 0);
      return sum + Math.max(0, savings);
    }, 0);
    const avgPrice = items.length > 0 ? totalValue / items.length : 0;

    return {
      totalItems: items.length,
      totalValue,
      avgPrice,
      totalSavings,
    };
  }, [activeTab, savedItems]);

  // ── Share wishlist ───────────────────────────────────────────────────────────

  const handleShareWishlist = useCallback(async () => {
    if (savedItems.length === 0) {
      alert.warning({ title: 'Empty Wishlist', message: 'Add items to share your wishlist.' });
      return;
    }

    const itemsList = savedItems
      .slice(0, 5)
      .map(item => `• ${item.product_name} - ${formatPrice(item.price ?? 0)}`)
      .join('\n');

    const moreItems = savedItems.length > 5 ? `\n... and ${savedItems.length - 5} more items` : '';

    const message = `Check out my wishlist on NearShop! 🛍️\n\n${itemsList}${moreItems}\n\nTotal Value: ${formatPrice(wishlistStats.totalValue)}\n\nDownload NearShop to see my full wishlist and find great deals nearby!`;

    try {
      await Share.share({
        message,
        title: 'Share My Wishlist',
      });
    } catch (error) {
      alert.error({ title: 'Share Error', message: 'Could not share wishlist. Please try again.' });
    }
  }, [savedItems, wishlistStats.totalValue]);

  // ── Stats calculation ────────────────────────────────────────────────────────

  const wishlistStats = useMemo(() => {
    if (activeTab !== TABS.PRODUCTS || savedItems.length === 0) {
      return {
        totalItems: 0,
        totalValue: 0,
        avgPrice: 0,
        totalSavings: 0,
      };
    }

    const items = savedItems;
    const totalValue = items.reduce((sum, item) => sum + (item.price ?? 0), 0);
    const totalSavings = items.reduce((sum, item) => {
      const savings = (item.original_price ?? 0) - (item.price ?? 0);
      return sum + Math.max(0, savings);
    }, 0);
    const avgPrice = items.length > 0 ? totalValue / items.length : 0;

    return {
      totalItems: items.length,
      totalValue,
      avgPrice,
      totalSavings,
    };
  }, [activeTab, savedItems]);

  // ── Share wishlist ───────────────────────────────────────────────────────────

  const handleShareWishlist = useCallback(async () => {
    if (savedItems.length === 0) {
      alert.warning({ title: 'Empty Wishlist', message: 'Add items to share your wishlist.' });
      return;
    }

    const itemsList = savedItems
      .slice(0, 5)
      .map(item => `• ${item.product_name} - ${formatPrice(item.price ?? 0)}`)
      .join('\n');

    const moreItems = savedItems.length > 5 ? `\n... and ${savedItems.length - 5} more items` : '';

    const message = `Check out my wishlist on NearShop! 🛍️\n\n${itemsList}${moreItems}\n\nTotal Value: ${formatPrice(wishlistStats.totalValue)}\n\nDownload NearShop to see my full wishlist and find great deals nearby!`;

    try {
      await Share.share({
        message,
        title: 'Share My Wishlist',
      });
    } catch (error) {
      alert.error({ title: 'Share Error', message: 'Could not share wishlist. Please try again.' });
    }
  }, [savedItems, wishlistStats.totalValue]);

  // ── Render helpers ───────────────────────────────────────────────────────────

  const renderSavedItem = useCallback(
    ({ item }) => {
      const isSelected = selectedItems.has(item.product_id);
      const hasPriceDrop = priceDrops.some(p => p.product_id === item.product_id);
      return (
        <SavedItemCard
          item={item}
          onRemove={handleRemove}
          onPress={() => navigateToProduct(item.product_id)}
          isSelected={isSelected && isSelectMode}
          onToggleSelect={() => {
            if (!isSelectMode) setIsSelectMode(true);
            toggleSelectItem(item.product_id);
          }}
          hasPriceDrop={hasPriceDrop}
        />
      );
    },
    [handleRemove, navigateToProduct, selectedItems, isSelectMode, priceDrops, toggleSelectItem]
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

      Vibration.vibrate(50);
      const prevShops = followedShops;
      setFollowedShops((prev) => prev.filter((s) => String(s.id) !== String(shopId)));
      setToast({ type: 'info', message: 'Shop unfollowed' });
      try {
        await unfollowShop(shopId);
        setTimeout(() => setToast(null), 2000);
      } catch {
        setFollowedShops(prevShops);
        setToast(null);
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
        {activeTab === TABS.PRODUCTS && savedCount > 0 && (
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShareWishlist}
            accessibilityRole="button"
            accessibilityLabel="Share wishlist"
          >
            <Text style={styles.shareIcon}>↗️</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Stats Panel ────────────────────────────────────────────────── */}
      {activeTab === TABS.PRODUCTS && savedCount > 0 && (
        <View style={styles.statsPanel}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Items</Text>
            <Text style={styles.statValue}>{wishlistStats.totalItems}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Value</Text>
            <Text style={styles.statValue}>{formatPrice(wishlistStats.totalValue)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Avg Price</Text>
            <Text style={styles.statValue}>{formatPrice(wishlistStats.avgPrice)}</Text>
          </View>
          {wishlistStats.totalSavings > 0 && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Potential Savings</Text>
                <Text style={[styles.statValue, styles.savingsValue]}>
                  {formatPrice(wishlistStats.totalSavings)}
                </Text>
              </View>
            </>
          )}
        </View>
      )}

      {/* ── Tab row ────────────────────────────────────────────────────── */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === TABS.PRODUCTS && styles.tabActive]}
          onPress={() => {
            setActiveTab(TABS.PRODUCTS);
            setSearchQuery('');
            setSortBy(SORT_OPTIONS.NEWEST);
            setIsSelectMode(false);
            setSelectedItems(new Set());
          }}
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
          onPress={() => {
            setActiveTab(TABS.SHOPS);
            setSearchQuery('');
            setSortBy(SORT_OPTIONS.NEWEST);
            setIsSelectMode(false);
            setSelectedItems(new Set());
          }}
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

      {/* ── Search Bar ─────────────────────────────────────────────────── */}
      {activeItems.length > 0 && (
        <View style={styles.searchSection}>
          <View style={styles.searchInputWrapper}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder={activeTab === TABS.PRODUCTS ? 'Search products...' : 'Search shops...'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={COLORS.gray400}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={styles.clearIcon}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Sort & Select Controls */}
          <View style={styles.controlsRow}>
            {activeTab === TABS.PRODUCTS && (
              <>
                <TouchableOpacity
                  style={styles.controlBtn}
                  onPress={() => setShowSortMenu(!showSortMenu)}
                >
                  <Text style={styles.controlBtnText}>Sort</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.controlBtn, isSelectMode && styles.controlBtnActive]}
                  onPress={() => {
                    if (isSelectMode) {
                      setIsSelectMode(false);
                      setSelectedItems(new Set());
                    } else {
                      setIsSelectMode(true);
                    }
                  }}
                >
                  <Text style={styles.controlBtnText}>Select</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

      {/* ── Sort Menu ──────────────────────────────────────────────────── */}
      {showSortMenu && activeTab === TABS.PRODUCTS && (
        <ScrollView style={styles.sortMenu} scrollEnabled={false}>
          {Object.entries(SORT_OPTIONS).map(([key, value]) => (
            <TouchableOpacity
              key={value}
              style={[styles.sortOption, sortBy === value && styles.sortOptionActive]}
              onPress={() => {
                setSortBy(value);
                setShowSortMenu(false);
              }}
            >
              <Text style={[styles.sortOptionText, sortBy === value && styles.sortOptionTextActive]}>
                {key === 'NEWEST' && '🆕 Newest First'}
                {key === 'PRICE_LOW' && '💰 Price: Low to High'}
                {key === 'PRICE_HIGH' && '💵 Price: High to Low'}
                {key === 'NAME_ASC' && '🔤 Name: A to Z'}
                {key === 'NAME_DESC' && '🔤 Name: Z to A'}
                {key === 'PRICE_DROP' && '🔥 Price Drops First'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Bulk Action Bar ────────────────────────────────────────────── */}
      {isSelectMode && activeTab === TABS.PRODUCTS && selectedItems.size > 0 && (
        <View style={styles.bulkActionBar}>
          <TouchableOpacity
            onPress={handleSelectAll}
            style={styles.bulkActionBtn}
          >
            <Text style={styles.bulkActionBtnText}>
              {selectedItems.size === filteredAndSortedItems.length ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.bulkActionCount}>
            {selectedItems.size} selected
          </Text>
          <TouchableOpacity
            onPress={handleBulkDelete}
            style={[styles.bulkActionBtn, styles.bulkDeleteBtn]}
          >
            <Text style={[styles.bulkActionBtnText, styles.bulkDeleteText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Content ────────────────────────────────────────────────────── */}
      {activeItems.length === 0 ? (
        <EmptyState tab={activeTab} onStartShopping={navigateToHome} onExploreShops={navigateToShops} />
      ) : (
        <FlatList
          key={activeTab}
          data={activeItems}
          keyExtractor={keyExtractor}
          renderItem={
            activeTab === TABS.PRODUCTS ? renderSavedItem : renderFollowedShop
          }
          numColumns={activeTab === TABS.PRODUCTS ? 2 : 1}
          columnWrapperStyle={activeTab === TABS.PRODUCTS ? styles.row : undefined}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={() => Keyboard.dismiss()}
          scrollEnabled={true}
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

      {activeTab === TABS.PRODUCTS && priceDropCount > 0 ? (
        <View style={styles.savedAlertStrip}>
          <Text style={styles.savedAlertStripText}>🔥 {priceDropCount} saved item{priceDropCount === 1 ? '' : 's'} dropped in price</Text>
        </View>
      ) : null}

      {/* ── Toast Notifications ────────────────────────────────────────── */}
      {toast && (
        <View style={[styles.toastContainer, { bottom: insets.bottom + 16 }]}>
          {toast.type === 'undo' ? (
            <View style={styles.toastContent}>
              <Text style={styles.toastMessage}>{toast.message}</Text>
              <TouchableOpacity
                onPress={handleUndoRemove}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <Text style={styles.toastAction}>Undo</Text>
              </TouchableOpacity>
            </View>
          ) : toast.type === 'progress' ? (
            <View style={styles.toastContent}>
              <Text style={styles.toastMessage}>⏳ {toast.message}</Text>
            </View>
          ) : toast.type === 'success' ? (
            <View style={styles.toastContent}>
              <Text style={styles.toastMessage}>{toast.message}</Text>
            </View>
          ) : (
            <View style={styles.toastContent}>
              <Text style={styles.toastMessage}>{toast.message}</Text>
            </View>
          )}
        </View>
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

  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    gap: 12,
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
  shareButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareIcon: {
    fontSize: 18,
  },

  statsPanel: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.gray500,
    fontWeight: '600',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.gray900,
  },
  savingsValue: {
    color: COLORS.green,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.gray200,
  },

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

  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
    gap: 10,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: COLORS.gray100,
    borderWidth: 1.5,
    borderColor: COLORS.gray200,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
    color: COLORS.gray500,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.gray900,
    fontWeight: '500',
  },
  clearIcon: {
    fontSize: 16,
    color: COLORS.gray400,
    marginLeft: 10,
    fontWeight: '600',
  },

  controlsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  controlBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.gray200,
  },
  controlBtnActive: {
    backgroundColor: COLORS.redLight,
    borderColor: COLORS.red,
  },
  controlBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.gray700,
    letterSpacing: 0.3,
  },

  sortMenu: {
    maxHeight: 220,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  sortOption: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: COLORS.gray50,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sortOptionActive: {
    backgroundColor: COLORS.redLight,
    borderColor: COLORS.red,
  },
  sortOptionText: {
    fontSize: 13,
    color: COLORS.gray700,
    fontWeight: '600',
  },
  sortOptionTextActive: {
    color: COLORS.red,
    fontWeight: '700',
  },

  bulkActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.redLight,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.red,
  },
  bulkActionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bulkDeleteBtn: {
    backgroundColor: COLORS.red,
  },
  bulkActionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.red,
    letterSpacing: 0.3,
  },
  bulkDeleteText: {
    color: COLORS.white,
  },
  bulkActionCount: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.red,
    textAlign: 'center',
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 32,
  },
  row: {
    gap: 16,
    marginBottom: 16,
  },

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

  card: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: COLORS.gray100,
  },
  cardSelected: {
    borderColor: COLORS.red,
    borderWidth: 2,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: COLORS.gray100,
    position: 'relative',
  },
  selectedImageContainer: {
    borderColor: COLORS.red,
    borderWidth: 2,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  selectionCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.red,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: '700',
  },
  priceDropBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
  },
  priceDropText: {
    fontSize: 20,
  },
  removeButton: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 4,
    ...SHADOWS.sm,
  },
  removeIcon: {
    fontSize: 14,
  },
  cardBody: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.gray900,
    lineHeight: 16,
  },
  price: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.red,
  },
  shopName: {
    fontSize: 11,
    color: COLORS.gray500,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gray900,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 20,
  },
  startShoppingButton: {

  // ── Toast Notifications ────────────────────────────────────────────
  toastContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: COLORS.gray900,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...SHADOWS.lg,
    zIndex: 999,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toastMessage: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.white,
    lineHeight: 18,
  },
  toastAction: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.red,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginLeft: 8,
  },
    marginTop: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
  },
  startShoppingText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },

  savedAlertStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF3CD',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#FFE69C',
  },
  savedAlertStripText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#856404',
    textAlign: 'center',
  },
});
