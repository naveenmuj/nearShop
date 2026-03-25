import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, BackHandler, Image, Linking, Share, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import client from '../../lib/api';
import useMyShop from '../../hooks/useMyShop';
import { getShopStats } from '../../lib/analytics';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';

const DELIVERY_LABELS = { pickup: '🏪 Pickup', delivery: '🚚 Delivery', both: '🏪+🚚 Both' };

export default function ShopProfileScreen() {
  const { shop, shopId, loading: shopLoading } = useMyShop();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { const h = BackHandler.addEventListener('hardwareBackPress', () => { router.back(); return true; }); return () => h.remove(); }, []);

  const loadData = useCallback(async () => {
    if (!shopId) { setLoading(false); return; }
    try {
      const res = await getShopStats(shopId, '30d');
      setStats(res.data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [shopId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${shop?.name} on NearShop! Find amazing products and deals near you.`,
        title: shop?.name,
      });
    } catch {}
  };

  const handleCall = () => {
    if (shop?.phone) Linking.openURL(`tel:${shop.phone}`).catch(() => {});
  };

  const handleWhatsApp = () => {
    const num = shop?.whatsapp || shop?.phone;
    if (num) Linking.openURL(`whatsapp://send?phone=${num}`).catch(() => {});
  };

  if (shopLoading || loading) {
    return (
      <SafeAreaView style={s.safe}><View style={s.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View></SafeAreaView>
    );
  }

  const deliveryOpts = Array.isArray(shop?.delivery_options) ? shop.delivery_options : [];
  const joinDate = shop?.created_at ? new Date(shop.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#fff" />}
      >
        {/* Hero */}
        <View style={s.hero}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backText}>←</Text>
          </TouchableOpacity>
          <View style={s.heroContent}>
            {shop?.logo_url ? (
              <Image source={{ uri: shop.logo_url }} style={s.logo} />
            ) : (
              <View style={s.logoPlaceholder}><Text style={{ fontSize: 40 }}>🏪</Text></View>
            )}
            <Text style={s.shopName}>{shop?.name || 'Your Shop'}</Text>
            {shop?.category && <Text style={s.shopCategory}>{shop.category}</Text>}
            {joinDate && <Text style={s.joinDate}>Member since {joinDate}</Text>}
          </View>
          <View style={s.heroActions}>
            <TouchableOpacity style={s.heroBtn} onPress={handleShare}>
              <Text style={s.heroBtnIcon}>📤</Text><Text style={s.heroBtnText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.heroBtn} onPress={() => router.push('/(business)/settings')}>
              <Text style={s.heroBtnIcon}>⚙️</Text><Text style={s.heroBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.body}>
          {/* Stats Grid */}
          <Text style={s.sectionTitle}>THIS MONTH</Text>
          <View style={s.statsGrid}>
            {[
              { label: 'Orders', value: stats?.total_orders ?? 0, icon: '📦', color: COLORS.primary, route: '/(business)/orders' },
              { label: 'Revenue', value: formatPrice(stats?.total_revenue ?? 0), icon: '💰', color: COLORS.green, route: '/(business)/analytics' },
              { label: 'Views', value: stats?.total_views ?? 0, icon: '👁️', color: COLORS.amber, route: '/(business)/analytics' },
              { label: 'Visitors', value: stats?.unique_visitors ?? 0, icon: '👥', color: COLORS.blue, route: '/(business)/customers' },
              { label: 'Products', value: stats?.total_products ?? shop?.products_count ?? 0, icon: '🏷️', color: '#8B5CF6', route: '/(business)/catalog' },
              { label: 'Reviews', value: stats?.total_reviews ?? shop?.total_reviews ?? 0, icon: '⭐', color: '#F59E0B', route: '/(business)/reviews' },
            ].map(st => (
              <TouchableOpacity key={st.label} style={[s.statCard, { borderTopColor: st.color }]} onPress={() => router.push(st.route)}>
                <Text style={s.statIcon}>{st.icon}</Text>
                <Text style={s.statValue}>{st.value}</Text>
                <Text style={s.statLabel}>{st.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Shop Details */}
          <Text style={s.sectionTitle}>SHOP DETAILS</Text>
          <View style={s.detailsCard}>
            {shop?.description && (
              <View style={s.detailRow}>
                <Text style={s.detailIcon}>📝</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.detailLabel}>Description</Text>
                  <Text style={s.detailValue}>{shop.description}</Text>
                </View>
              </View>
            )}
            {shop?.address && (
              <View style={s.detailRow}>
                <Text style={s.detailIcon}>📍</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.detailLabel}>Address</Text>
                  <Text style={s.detailValue}>{shop.address}</Text>
                </View>
              </View>
            )}
            {shop?.phone && (
              <TouchableOpacity style={s.detailRow} onPress={handleCall}>
                <Text style={s.detailIcon}>📞</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.detailLabel}>Phone</Text>
                  <Text style={[s.detailValue, { color: COLORS.primary }]}>{shop.phone}</Text>
                </View>
              </TouchableOpacity>
            )}
            {(shop?.whatsapp || shop?.phone) && (
              <TouchableOpacity style={s.detailRow} onPress={handleWhatsApp}>
                <Text style={s.detailIcon}>💬</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.detailLabel}>WhatsApp</Text>
                  <Text style={[s.detailValue, { color: '#25D366' }]}>{shop.whatsapp || shop.phone}</Text>
                </View>
              </TouchableOpacity>
            )}
            {deliveryOpts.length > 0 && (
              <View style={s.detailRow}>
                <Text style={s.detailIcon}>🚚</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.detailLabel}>Delivery Options</Text>
                  <Text style={s.detailValue}>{deliveryOpts.join(', ')}</Text>
                </View>
              </View>
            )}
            {shop?.avg_rating > 0 && (
              <View style={s.detailRow}>
                <Text style={s.detailIcon}>⭐</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.detailLabel}>Rating</Text>
                  <Text style={s.detailValue}>{Number(shop.avg_rating).toFixed(1)} / 5.0</Text>
                </View>
              </View>
            )}
          </View>

          {/* Quick Links */}
          <Text style={s.sectionTitle}>MANAGE</Text>
          <View style={s.linksGrid}>
            {[
              { icon: '📸', label: 'Add Product', route: '/(business)/snap-list' },
              { icon: '🎁', label: 'Create Deal', route: '/(business)/deals' },
              { icon: '📊', label: 'Analytics', route: '/(business)/analytics' },
              { icon: '📢', label: 'Broadcast', route: '/(business)/broadcast' },
              { icon: '🎪', label: 'Festivals', route: '/(business)/festivals' },
              { icon: '🤖', label: 'AI Advisor', route: '/(business)/advisor' },
            ].map(link => (
              <TouchableOpacity key={link.label} style={s.linkCard} onPress={() => router.push(link.route)}>
                <Text style={s.linkIcon}>{link.icon}</Text>
                <Text style={s.linkLabel}>{link.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.primary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },

  hero: { backgroundColor: COLORS.primary, paddingBottom: 24, position: 'relative' },
  backBtn: { position: 'absolute', top: 12, left: 16, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  backText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  heroContent: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 20 },
  logo: { width: 80, height: 80, borderRadius: 20, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  logoPlaceholder: { width: 80, height: 80, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  shopName: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 12, textAlign: 'center' },
  shopCategory: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginTop: 4, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 3, borderRadius: 10 },
  joinDate: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 6 },
  heroActions: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 16 },
  heroBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  heroBtnIcon: { fontSize: 16 },
  heroBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  body: { backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -16, paddingTop: 20, paddingHorizontal: 16, minHeight: 400 },

  sectionTitle: { fontSize: 11, fontWeight: '700', color: COLORS.gray400, letterSpacing: 0.8, marginBottom: 12, marginTop: 8 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: { width: '31%', backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', borderTopWidth: 3, ...SHADOWS.card },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: '800', color: COLORS.gray900 },
  statLabel: { fontSize: 10, color: COLORS.gray400, fontWeight: '600', marginTop: 2 },

  detailsCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 20, ...SHADOWS.card },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.gray100, gap: 12 },
  detailIcon: { fontSize: 18, marginTop: 2 },
  detailLabel: { fontSize: 11, fontWeight: '600', color: COLORS.gray400, marginBottom: 2 },
  detailValue: { fontSize: 14, color: COLORS.gray800, lineHeight: 20 },

  linksGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  linkCard: { width: '31%', backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', gap: 6, ...SHADOWS.card },
  linkIcon: { fontSize: 24 },
  linkLabel: { fontSize: 11, fontWeight: '600', color: COLORS.gray600, textAlign: 'center' },
});
