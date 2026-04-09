import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import useLocationStore from '../../store/locationStore';
import { getNearbyShops } from '../../lib/shops';
import ShopCard from '../../components/ShopCard';
import { COLORS, SHADOWS } from '../../constants/theme';
import { distanceKm, formatDistance } from '../../lib/distance';

const CATEGORIES = ['All', 'Grocery', 'Electronics', 'Clothing', 'Food', 'Beauty', 'Home'];

function normalizeCategory(value) {
  return value && value !== 'All' ? String(value) : 'All';
}

export default function ShopsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { lat, lng, address, lastUpdated, refreshLocation, preferredRadiusKm } = useLocationStore();

  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(normalizeCategory(params?.category));

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    setSelectedCategory(normalizeCategory(params?.category));
  }, [params?.category]);

  const nearbyRadiusKm = useMemo(() => {
    const parsed = Number(preferredRadiusKm);
    if (!Number.isFinite(parsed)) return 5;
    return Math.max(1, Math.min(50, parsed));
  }, [preferredRadiusKm]);

  const loadShops = useCallback(async () => {
    const res = await getNearbyShops(lat, lng, { radius_km: nearbyRadiusKm, limit: 80 });
    const items = res?.data?.items ?? res?.data ?? [];
    setShops(Array.isArray(items) ? items : []);
  }, [lat, lng, nearbyRadiusKm]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadShops()
      .catch(() => {
        if (!cancelled) setShops([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadShops]);

  const liveSortedShops = useMemo(() => {
    const filtered = shops.filter((shop) => {
      if (!selectedCategory || selectedCategory === 'All') return true;
      return String(shop?.category || '').toLowerCase() === selectedCategory.toLowerCase();
    });

    return filtered
      .map((shop) => {
        const liveKm = distanceKm(lat, lng, shop?.latitude, shop?.longitude);
        const fallbackKm = Number(shop?.distance_km);
        const normalizedKm = Number.isFinite(liveKm)
          ? liveKm
          : (Number.isFinite(fallbackKm) ? fallbackKm : null);

        return {
          ...shop,
          live_distance_km: normalizedKm,
          live_distance_label: formatDistance(normalizedKm),
        };
      })
      .sort((a, b) => Number(a?.live_distance_km ?? 9999) - Number(b?.live_distance_km ?? 9999));
  }, [shops, selectedCategory, lat, lng]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshLocation().catch(() => {});
    await loadShops().catch(() => {});
    setRefreshing(false);
  }, [loadShops, refreshLocation]);

  const liveUpdatedText = lastUpdated
    ? `Live updated ${new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Live distance enabled';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
              <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.heroTitle}>All Nearby Shops</Text>
            <View style={styles.backBtnGhost} />
          </View>
          <Text style={styles.heroSubtitle} numberOfLines={1}>{address || 'Current location'}</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricChip}>
              <Text style={styles.metricChipText}>{liveSortedShops.length} shops in {nearbyRadiusKm} km</Text>
            </View>
            <View style={styles.metricChipMuted}>
              <Text style={styles.metricChipMutedText}>{liveUpdatedText}</Text>
            </View>
          </View>
        </View>

        <FlatList
          data={CATEGORIES}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
          renderItem={({ item }) => {
            const active = selectedCategory === item;
            return (
              <TouchableOpacity
                style={[styles.categoryPill, active && styles.categoryPillActive]}
                onPress={() => setSelectedCategory(item)}
                activeOpacity={0.8}
              >
                <Text style={[styles.categoryPillText, active && styles.categoryPillTextActive]}>{item}</Text>
              </TouchableOpacity>
            );
          }}
        />

        <FlatList
          data={liveSortedShops}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.shopsList}
          showsVerticalScrollIndicator={false}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          )}
          renderItem={({ item }) => (
            <View style={styles.shopItemWrap}>
              <ShopCard
                shop={item}
                showDelivery
                forceEqualHeight
                showLocationText
                distance={item.live_distance_km}
                distanceLabel={item.live_distance_label}
              />
            </View>
          )}
          ListEmptyComponent={!loading ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No shops found</Text>
              <Text style={styles.emptySub}>Try a different category or refresh your location.</Text>
            </View>
          ) : null}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.gray50,
  },
  hero: {
    backgroundColor: '#F0ECFF',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...SHADOWS.card,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnGhost: {
    width: 34,
    height: 34,
  },
  backBtnText: {
    fontSize: 20,
    color: COLORS.gray800,
    marginTop: -1,
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.gray900,
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.gray600,
  },
  metricsRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricChip: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  metricChipText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },
  metricChipMuted: {
    backgroundColor: COLORS.white,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  metricChipMutedText: {
    color: COLORS.gray600,
    fontSize: 11,
    fontWeight: '600',
  },
  categoriesList: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 8,
  },
  categoryPill: {
    backgroundColor: COLORS.white,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  categoryPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryPillText: {
    color: COLORS.gray600,
    fontSize: 12,
    fontWeight: '700',
  },
  categoryPillTextActive: {
    color: COLORS.white,
  },
  shopsList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  shopItemWrap: {
    marginBottom: 2,
  },
  emptyWrap: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    marginTop: 12,
    paddingVertical: 24,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gray800,
  },
  emptySub: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.gray500,
  },
});
