import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, StatusBar, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getUserAchievements } from '../../lib/engagement';
import AchievementUnlock from '../../components/AchievementUnlock';
import { useToast } from '../../components/ui/Toast';
import { GenericListSkeleton } from '../../components/ui/ScreenSkeletons';
import { COLORS, SHADOWS } from '../../constants/theme';

function AchievementBadge({ item, onPress }) {
  const isUnlocked = item.unlocked === true || item.completed === true;

  return (
    <TouchableOpacity
      style={[styles.badge, !isUnlocked && styles.badgeLocked]}
      onPress={() => isUnlocked && onPress(item)}
      activeOpacity={isUnlocked ? 0.8 : 1}
    >
      <View style={styles.iconWrap}>
        <Text style={[styles.icon, !isUnlocked && styles.iconLocked]}>
          {item.icon || '🏅'}
        </Text>
        {!isUnlocked && (
          <View style={styles.lockOverlay}>
            <Text style={styles.lockIcon}>🔒</Text>
          </View>
        )}
      </View>
      <Text
        style={[styles.badgeName, !isUnlocked && styles.textLocked]}
        numberOfLines={2}
      >
        {item.name}
      </Text>
      {(item.coins_reward > 0 || item.coins > 0) && (
        <Text style={styles.coins}>+{item.coins_reward || item.coins} 🪙</Text>
      )}
      {isUnlocked && item.unlocked_at && (
        <Text style={styles.unlockedDate}>
          {new Date(item.unlocked_at).toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function AchievementsScreen() {
  const router = useRouter();
  const { showToast } = useToast();

  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [celebrateItem, setCelebrateItem] = useState(null);

  const fetchAchievements = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await getUserAchievements();
      const data = res?.data?.items ?? res?.data ?? [];
      setAchievements(Array.isArray(data) ? data : []);
    } catch {
      setError('Could not load achievements. Pull to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAchievements(true);
  };

  const handleBadgePress = (item) => {
    setCelebrateItem(item);
  };

  const handleDismissCelebration = () => {
    const item = celebrateItem;
    setCelebrateItem(null);
    const coins = item?.coins_reward || item?.coins;
    if (coins) {
      showToast({ type: 'coins', message: `${item.name} reward`, coins });
    }
  };

  const unlocked = achievements.filter((a) => a.unlocked || a.completed);
  const locked = achievements.filter((a) => !a.unlocked && !a.completed);
  const items = [...unlocked, ...locked];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Achievements</Text>
        <View style={styles.back} />
      </View>

      {loading ? (
        <GenericListSkeleton />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchAchievements()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Progress summary */}
          <View style={styles.progressCard}>
            <Text style={styles.progressLabel}>Your Progress</Text>
            <Text style={styles.progressCount}>
              {unlocked.length} / {achievements.length} Unlocked
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: achievements.length > 0
                      ? `${(unlocked.length / achievements.length) * 100}%`
                      : '0%',
                  },
                ]}
              />
            </View>
          </View>

          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id || item.key || item.name)}
            renderItem={({ item }) => (
              <AchievementBadge item={item} onPress={handleBadgePress} />
            )}
            numColumns={3}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={styles.row}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={COLORS.amber}
                colors={[COLORS.amber]}
              />
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>🏆</Text>
                <Text style={styles.emptyTitle}>No achievements yet</Text>
                <Text style={styles.emptySubtitle}>
                  Keep shopping to unlock achievements!
                </Text>
              </View>
            }
          />
        </>
      )}

      <AchievementUnlock
        visible={!!celebrateItem}
        achievement={celebrateItem}
        onDismiss={handleDismissCelebration}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
    backgroundColor: COLORS.white,
    ...SHADOWS.card,
  },
  back: { width: 40, alignItems: 'flex-start' },
  backText: { color: COLORS.primary, fontSize: 28, lineHeight: 32 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.gray900 },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  loadingText: { fontSize: 14, color: COLORS.gray500 },
  errorText: { fontSize: 15, color: COLORS.red, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
  },
  retryText: { color: COLORS.white, fontWeight: '600', fontSize: 14 },

  progressCard: {
    backgroundColor: COLORS.white,
    margin: 16,
    borderRadius: 16,
    padding: 16,
    ...SHADOWS.card,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.gray400,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  progressCount: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.amber,
    marginBottom: 10,
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.gray100,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.amber,
    borderRadius: 4,
  },

  grid: { paddingHorizontal: 16, paddingBottom: 32 },
  row: { justifyContent: 'flex-start', gap: 10, marginBottom: 10 },

  badge: {
    flex: 1,
    maxWidth: '31%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.amber + '44',
    ...SHADOWS.card,
  },
  badgeLocked: {
    opacity: 0.5,
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray200,
  },
  iconWrap: { position: 'relative', marginBottom: 8 },
  icon: { fontSize: 36 },
  iconLocked: { opacity: 0.6 },
  lockOverlay: {
    position: 'absolute',
    bottom: -4,
    right: -8,
    backgroundColor: COLORS.gray400,
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockIcon: { fontSize: 10 },
  badgeName: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.gray800,
    textAlign: 'center',
  },
  textLocked: { color: COLORS.gray400 },
  coins: { fontSize: 11, color: COLORS.amber, fontWeight: '700', marginTop: 4 },
  unlockedDate: { fontSize: 10, color: COLORS.gray400, marginTop: 2 },

  empty: {
    paddingTop: 60,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gray700,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 20,
  },
});
