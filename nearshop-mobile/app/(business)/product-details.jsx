import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { alert } from '../../components/ui/PremiumAlert';
import client, { buildAuthConfig } from '../../lib/api';
import { toggleAvailability, deleteProduct } from '../../lib/products';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#7F77DD',
  green: '#1D9E75',
  amber: '#EF9F27',
  red: '#E24B4A',
  blue: '#3B8BD4',
  white: '#FFFFFF',
  bg: '#F9FAFB',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  primaryLight: '#EEEDFE',
  greenLight: '#E1F5EE',
  redLight: '#FEE2E2',
  amberLight: '#FEF3C7',
  blueLight: '#DBEAFE',
};

const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
};

const formatPrice = (p) => '₹' + Number(p || 0).toLocaleString('en-IN');
const formatNumber = (n) => Number(n || 0).toLocaleString('en-IN');

export default function ProductDetailsScreen() {
  const { id } = useLocalSearchParams();
  const [product, setProduct] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProductData = useCallback(async () => {
    if (!id) return;
    
    try {
      const config = await buildAuthConfig();
      
      // Load product details
      const productRes = await client.get(`/products/${id}`, config);
      setProduct(productRes.data);
      
      // Load product analytics (views, orders, wishlists)
      try {
        const analyticsRes = await client.get(`/products/${id}/analytics`, config);
        setAnalytics(analyticsRes.data);
      } catch (analyticsErr) {
        // Analytics endpoint may not exist yet, use defaults
        setAnalytics({
          total_views: product?.view_count || 0,
          unique_views: Math.floor((product?.view_count || 0) * 0.7),
          total_orders: 0,
          total_quantity_sold: 0,
          total_revenue: 0,
          wishlist_count: 0,
          cart_count: 0,
          conversion_rate: 0,
          avg_rating: 0,
          review_count: 0,
          last_30_days: {
            views: 0,
            orders: 0,
            revenue: 0,
          },
        });
      }
    } catch (err) {
      console.error('Failed to load product:', err);
      alert.error({ title: 'Error', message: 'Failed to load product details' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadProductData();
  }, [loadProductData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadProductData();
  };

  const handleToggleAvailability = async () => {
    if (!product) return;
    
    const isLive = product.is_available ?? product.available ?? true;
    const confirmed = await alert.confirm({
      title: isLive ? 'Hide Product' : 'Make Live',
      message: `Are you sure you want to ${isLive ? 'hide' : 'make live'} "${product.name}"?`,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
    });
    
    if (confirmed) {
      try {
        await toggleAvailability(id);
        loadProductData();
        alert.success({ 
          title: 'Updated', 
          message: `Product is now ${isLive ? 'hidden' : 'live'}` 
        });
      } catch {
        alert.error({ title: 'Error', message: 'Failed to update availability' });
      }
    }
  };

  const handleDelete = async () => {
    if (!product) return;
    
    const confirmed = await alert.confirm({
      title: 'Delete Product',
      message: `Are you sure you want to delete "${product.name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    
    if (confirmed) {
      try {
        await deleteProduct(id);
        alert.success({ title: 'Deleted', message: 'Product has been deleted' });
        router.back();
      } catch {
        alert.error({ title: 'Error', message: 'Failed to delete product' });
      }
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading product details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.gray400} />
          <Text style={styles.loadingText}>Product not found</Text>
          <TouchableOpacity style={styles.backBtnLarge} onPress={() => router.back()}>
            <Text style={styles.backBtnLargeText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isLive = product.is_available ?? product.available ?? true;
  const imageUrl = product.images?.[0] ?? product.image_url;
  const conversionRate = analytics?.conversion_rate || 
    (analytics?.total_views > 0 ? ((analytics?.total_orders / analytics?.total_views) * 100).toFixed(1) : 0);

  // Performance assessment
  const getPerformanceLevel = () => {
    if (conversionRate >= 5) return { level: 'Excellent', color: COLORS.green, icon: 'trending-up' };
    if (conversionRate >= 2) return { level: 'Good', color: COLORS.blue, icon: 'analytics' };
    if (conversionRate >= 0.5) return { level: 'Average', color: COLORS.amber, icon: 'remove' };
    return { level: 'Needs Attention', color: COLORS.red, icon: 'trending-down' };
  };

  const performance = getPerformanceLevel();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.gray700} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Product Details</Text>
        <TouchableOpacity style={styles.menuBtn} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={22} color={COLORS.red} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Product Image */}
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: imageUrl || 'https://via.placeholder.com/400' }} 
            style={styles.productImage}
            resizeMode="cover"
          />
          <View style={[styles.statusBadge, isLive ? styles.statusLive : styles.statusHidden]}>
            <View style={[styles.statusDot, { backgroundColor: isLive ? COLORS.green : COLORS.gray400 }]} />
            <Text style={[styles.statusText, { color: isLive ? COLORS.green : COLORS.gray500 }]}>
              {isLive ? 'Live' : 'Hidden'}
            </Text>
          </View>
        </View>

        {/* Product Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>
          {product.category && (
            <View style={styles.categoryBadge}>
              <Ionicons name="pricetag-outline" size={14} color={COLORS.primary} />
              <Text style={styles.categoryText}>{product.category}</Text>
            </View>
          )}
          {product.description && (
            <Text style={styles.description}>{product.description}</Text>
          )}
        </View>

        {/* Performance Summary */}
        <View style={[styles.performanceCard, { borderLeftColor: performance.color }]}>
          <View style={styles.performanceHeader}>
            <Ionicons name={performance.icon} size={24} color={performance.color} />
            <View style={styles.performanceInfo}>
              <Text style={styles.performanceLabel}>Overall Performance</Text>
              <Text style={[styles.performanceLevel, { color: performance.color }]}>
                {performance.level}
              </Text>
            </View>
          </View>
          <Text style={styles.performanceSummary}>
            {conversionRate >= 2 
              ? `Great job! Your product converts ${conversionRate}% of views into orders.`
              : analytics?.total_views < 10
                ? 'Not enough data yet. Keep promoting your product!'
                : `Consider updating your product description or images to improve conversions.`
            }
          </Text>
        </View>

        {/* Key Metrics Grid */}
        <Text style={styles.sectionTitle}>Key Metrics</Text>
        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { backgroundColor: COLORS.blueLight }]}>
            <Ionicons name="eye-outline" size={24} color={COLORS.blue} />
            <Text style={styles.metricValue}>{formatNumber(analytics?.total_views || product.view_count || 0)}</Text>
            <Text style={styles.metricLabel}>Total Views</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: COLORS.greenLight }]}>
            <Ionicons name="bag-check-outline" size={24} color={COLORS.green} />
            <Text style={styles.metricValue}>{formatNumber(analytics?.total_orders || 0)}</Text>
            <Text style={styles.metricLabel}>Orders</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: COLORS.amberLight }]}>
            <Ionicons name="heart-outline" size={24} color={COLORS.amber} />
            <Text style={styles.metricValue}>{formatNumber(analytics?.wishlist_count || 0)}</Text>
            <Text style={styles.metricLabel}>Wishlisted</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: COLORS.primaryLight }]}>
            <Ionicons name="cart-outline" size={24} color={COLORS.primary} />
            <Text style={styles.metricValue}>{formatNumber(analytics?.cart_count || 0)}</Text>
            <Text style={styles.metricLabel}>In Carts</Text>
          </View>
        </View>

        {/* Revenue Stats */}
        <Text style={styles.sectionTitle}>Revenue Statistics</Text>
        <View style={styles.revenueCard}>
          <View style={styles.revenueRow}>
            <View style={styles.revenueItem}>
              <Text style={styles.revenueLabel}>Total Revenue</Text>
              <Text style={styles.revenueValue}>{formatPrice(analytics?.total_revenue || 0)}</Text>
            </View>
            <View style={styles.revenueDivider} />
            <View style={styles.revenueItem}>
              <Text style={styles.revenueLabel}>Quantity Sold</Text>
              <Text style={styles.revenueValue}>{formatNumber(analytics?.total_quantity_sold || 0)} units</Text>
            </View>
          </View>
          <View style={styles.revenueRow}>
            <View style={styles.revenueItem}>
              <Text style={styles.revenueLabel}>Conversion Rate</Text>
              <Text style={[styles.revenueValue, { color: performance.color }]}>{conversionRate}%</Text>
            </View>
            <View style={styles.revenueDivider} />
            <View style={styles.revenueItem}>
              <Text style={styles.revenueLabel}>Avg Rating</Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={16} color={COLORS.amber} />
                <Text style={styles.revenueValue}>
                  {analytics?.avg_rating ? analytics.avg_rating.toFixed(1) : 'N/A'}
                </Text>
                {analytics?.review_count > 0 && (
                  <Text style={styles.reviewCount}>({analytics.review_count})</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Last 30 Days */}
        {analytics?.last_30_days && (
          <>
            <Text style={styles.sectionTitle}>Last 30 Days</Text>
            <View style={styles.last30Card}>
              <View style={styles.last30Item}>
                <Ionicons name="eye" size={20} color={COLORS.blue} />
                <Text style={styles.last30Value}>{formatNumber(analytics.last_30_days.views)}</Text>
                <Text style={styles.last30Label}>Views</Text>
              </View>
              <View style={styles.last30Item}>
                <Ionicons name="bag-handle" size={20} color={COLORS.green} />
                <Text style={styles.last30Value}>{formatNumber(analytics.last_30_days.orders)}</Text>
                <Text style={styles.last30Label}>Orders</Text>
              </View>
              <View style={styles.last30Item}>
                <Ionicons name="cash" size={20} color={COLORS.primary} />
                <Text style={styles.last30Value}>{formatPrice(analytics.last_30_days.revenue)}</Text>
                <Text style={styles.last30Label}>Revenue</Text>
              </View>
            </View>
          </>
        )}

        {/* AI Insights */}
        <View style={styles.insightsCard}>
          <View style={styles.insightsHeader}>
            <Ionicons name="sparkles" size={20} color={COLORS.primary} />
            <Text style={styles.insightsTitle}>AI Insights</Text>
          </View>
          <View style={styles.insightsList}>
            {analytics?.total_views > 50 && (analytics?.wishlist_count / analytics?.total_views) > 0.1 && (
              <View style={styles.insightItem}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.green} />
                <Text style={styles.insightText}>
                  High wishlist ratio indicates strong customer interest
                </Text>
              </View>
            )}
            {analytics?.total_views > 20 && conversionRate < 1 && (
              <View style={styles.insightItem}>
                <Ionicons name="bulb" size={16} color={COLORS.amber} />
                <Text style={styles.insightText}>
                  Consider adding more product images or details to boost conversions
                </Text>
              </View>
            )}
            {analytics?.cart_count > analytics?.total_orders && (
              <View style={styles.insightItem}>
                <Ionicons name="information-circle" size={16} color={COLORS.blue} />
                <Text style={styles.insightText}>
                  {analytics.cart_count - analytics.total_orders} customers have this in cart - consider a promotional offer
                </Text>
              </View>
            )}
            {(!analytics?.total_views || analytics?.total_views < 10) && (
              <View style={styles.insightItem}>
                <Ionicons name="rocket" size={16} color={COLORS.primary} />
                <Text style={styles.insightText}>
                  Promote this product through stories or deals to increase visibility
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionBtn, isLive ? styles.hideBtn : styles.liveBtn]}
            onPress={handleToggleAvailability}
          >
            <Ionicons 
              name={isLive ? 'eye-off-outline' : 'eye-outline'} 
              size={20} 
              color={isLive ? COLORS.amber : COLORS.white} 
            />
            <Text style={[styles.actionBtnText, isLive && styles.hideBtnText]}>
              {isLive ? 'Hide Product' : 'Make Live'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionBtn, styles.createDealBtn]}
            onPress={() => router.push({ pathname: '/(business)/deals', params: { productId: id } })}
          >
            <Ionicons name="pricetags-outline" size={20} color={COLORS.white} />
            <Text style={styles.actionBtnText}>Create Deal</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: COLORS.gray500,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray50,
  },
  backBtnLarge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
  },
  backBtnLargeText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 15,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.redLight,
  },
  content: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
  },
  productImage: {
    width: width,
    height: 250,
    backgroundColor: COLORS.gray100,
  },
  statusBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusLive: {
    backgroundColor: COLORS.greenLight,
  },
  statusHidden: {
    backgroundColor: COLORS.gray100,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: -30,
    borderRadius: 16,
    padding: 20,
    ...SHADOWS.card,
  },
  productName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.gray900,
    marginBottom: 6,
  },
  productPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryLight,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  description: {
    fontSize: 14,
    color: COLORS.gray600,
    lineHeight: 21,
  },
  performanceCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    ...SHADOWS.card,
  },
  performanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  performanceInfo: {
    flex: 1,
  },
  performanceLabel: {
    fontSize: 12,
    color: COLORS.gray500,
    fontWeight: '500',
  },
  performanceLevel: {
    fontSize: 18,
    fontWeight: '700',
  },
  performanceSummary: {
    fontSize: 13,
    color: COLORS.gray600,
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gray900,
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  metricCard: {
    width: (width - 48) / 2,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.gray900,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.gray600,
  },
  revenueCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    ...SHADOWS.card,
  },
  revenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  revenueItem: {
    flex: 1,
    alignItems: 'center',
  },
  revenueDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.gray200,
  },
  revenueLabel: {
    fontSize: 12,
    color: COLORS.gray500,
    fontWeight: '500',
    marginBottom: 4,
  },
  revenueValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewCount: {
    fontSize: 13,
    color: COLORS.gray400,
    marginLeft: 2,
  },
  last30Card: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    ...SHADOWS.card,
  },
  last30Item: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  last30Value: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  last30Label: {
    fontSize: 11,
    color: COLORS.gray500,
    fontWeight: '500',
  },
  insightsCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 12,
    padding: 16,
    ...SHADOWS.card,
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  insightsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  insightsList: {
    gap: 10,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.gray600,
    lineHeight: 19,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 24,
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  liveBtn: {
    backgroundColor: COLORS.green,
  },
  hideBtn: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.amber,
  },
  createDealBtn: {
    backgroundColor: COLORS.primary,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
  hideBtnText: {
    color: COLORS.amber,
  },
});
