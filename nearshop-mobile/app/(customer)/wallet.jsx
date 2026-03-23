import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Animated,
  StatusBar,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect, useCallback, useRef } from 'react';

import useAuthStore from '../../store/authStore';
import { getBalance, getCoinHistory, getBadges, getStreak, dailyCheckin } from '../../lib/loyalty';
import { COLORS, SHADOWS, formatDate } from '../../constants/theme';

// ─── Level tier labels ───────────────────────────────────────────────────────
const LEVEL_LABELS = {
  1: 'Newcomer',
  2: 'Explorer',
  3: 'Regular',
  4: 'Silver',
  5: 'Gold',
  6: 'Platinum',
  7: 'Legend',
};

function getLevelLabel(level) {
  return LEVEL_LABELS[level] ?? `Level ${level}`;
}

function formatCoins(n) {
  if (!n && n !== 0) return '0';
  return Number(n).toLocaleString('en-IN');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeroCard({ balance, level, totalEarned, totalSpent, streakDays }) {
  return (
    <View style={styles.hero}>
      {/* Decorative circles for visual depth */}
      <View style={styles.heroBubble1} />
      <View style={styles.heroBubble2} />

      <Text style={styles.heroLabel}>ShopCoins</Text>

      <Text style={styles.heroBalance}>
        {formatCoins(balance)} <Text style={styles.heroCoinEmoji}>🪙</Text>
      </Text>

      <Text style={styles.heroEquiv}>
        ₹{formatCoins(Math.floor((balance ?? 0) / 10))} equivalent
        {'  '}
        <Text style={styles.heroRate}>(10 coins = ₹1)</Text>
      </Text>

      <View style={styles.heroDivider} />

      <View style={styles.heroRow}>
        {/* Level badge */}
        <View style={styles.heroBadgePill}>
          <Text style={styles.heroBadgeIcon}>⭐</Text>
          <Text style={styles.heroBadgeText}>{getLevelLabel(level ?? 1)}</Text>
        </View>

        {/* Streak counter */}
        <View style={styles.heroStreakPill}>
          <Text style={styles.heroStreakIcon}>🔥</Text>
          <Text style={styles.heroStreakText}>
            {streakDays ?? 0} day{streakDays !== 1 ? 's' : ''} streak
          </Text>
        </View>
      </View>

      {/* Totals row */}
      <View style={styles.heroStatsRow}>
        <View style={styles.heroStat}>
          <Text style={styles.heroStatValue}>{formatCoins(totalEarned)}</Text>
          <Text style={styles.heroStatLabel}>Total Earned</Text>
        </View>
        <View style={styles.heroStatDivider} />
        <View style={styles.heroStat}>
          <Text style={styles.heroStatValue}>{formatCoins(totalSpent)}</Text>
          <Text style={styles.heroStatLabel}>Total Spent</Text>
        </View>
      </View>
    </View>
  );
}

function CheckInButton({ checkedInToday, onPress, loading }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  };

  return (
    <View style={styles.checkinSection}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[styles.checkinBtn, checkedInToday && styles.checkinBtnDone]}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={checkedInToday || loading}
          activeOpacity={0.85}
          accessibilityLabel={checkedInToday ? 'Already checked in today' : 'Daily check-in'}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator size="small" color={checkedInToday ? COLORS.gray400 : COLORS.white} />
          ) : (
            <>
              <Text style={styles.checkinIcon}>{checkedInToday ? '✅' : '🎁'}</Text>
              <Text style={[styles.checkinText, checkedInToday && styles.checkinTextDone]}>
                {checkedInToday ? 'Checked In Today' : 'Check In Today  (+10 coins)'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

function BadgeCard({ badge }) {
  const earned = Boolean(badge.earned);
  return (
    <View style={[styles.badgeCard, !earned && styles.badgeCardUnearned]}>
      <Text style={[styles.badgeIcon, !earned && styles.badgeIconUnearned]}>
        {badge.icon ?? '🏅'}
      </Text>
      <Text style={[styles.badgeName, !earned && styles.badgeNameUnearned]} numberOfLines={1}>
        {badge.name}
      </Text>
      <Text style={[styles.badgeDesc, !earned && styles.badgeDescUnearned]} numberOfLines={2}>
        {badge.description}
      </Text>
      {earned && <View style={styles.badgeEarnedDot} />}
    </View>
  );
}

function TransactionRow({ tx }) {
  const earned = tx.type === 'earned' || Number(tx.amount) > 0;
  const amountColor = earned ? COLORS.green : COLORS.red;
  const amountPrefix = earned ? '+' : '-';
  const absAmount = Math.abs(Number(tx.amount));

  return (
    <View style={styles.txRow}>
      <View style={styles.txIconWrap}>
        <Text style={styles.txIcon}>{earned ? '🟢' : '🔴'}</Text>
      </View>
      <View style={styles.txBody}>
        <Text style={styles.txDesc} numberOfLines={1}>
          {tx.description}
        </Text>
        <Text style={styles.txDate}>{formatDate(tx.created_at)}</Text>
      </View>
      <Text style={[styles.txAmount, { color: amountColor }]}>
        {amountPrefix}{formatCoins(absAmount)}
        <Text style={styles.txCoin}> 🪙</Text>
      </Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function WalletScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      router.navigate('/(customer)/profile');
      return true;
    });
    return () => handler.remove();
  }, [router]);

  // Data state
  const [balance, setBalance] = useState(null);
  const [level, setLevel] = useState(1);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [badges, setBadges] = useState([]);
  const [streakDays, setStreakDays] = useState(0);
  const [checkedInToday, setCheckedInToday] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinMessage, setCheckinMessage] = useState('');
  const [error, setError] = useState(null);

  // Fade-in animation for success message
  const msgOpacity = useRef(new Animated.Value(0)).current;

  const showMessage = useCallback(
    (msg) => {
      setCheckinMessage(msg);
      msgOpacity.setValue(1);
      Animated.timing(msgOpacity, {
        toValue: 0,
        duration: 2500,
        delay: 1200,
        useNativeDriver: true,
      }).start(() => setCheckinMessage(''));
    },
    [msgOpacity],
  );

  const loadData = useCallback(async () => {
    setError(null);
    const [balRes, histRes, badgeRes, streakRes] = await Promise.allSettled([
      getBalance(),
      getCoinHistory(),
      getBadges(),
      getStreak(),
    ]);

    if (balRes.status === 'fulfilled') {
      const d = balRes.value?.data;
      setBalance(d?.balance ?? 0);
      setLevel(d?.level ?? 1);
      setTotalEarned(d?.total_earned ?? 0);
      setTotalSpent(d?.total_spent ?? 0);
    } else {
      setError('Failed to load balance. Pull down to retry.');
    }

    if (histRes.status === 'fulfilled') {
      setTransactions(histRes.value?.data?.transactions ?? []);
    }

    if (badgeRes.status === 'fulfilled') {
      setBadges(badgeRes.value?.data?.badges ?? []);
    }

    if (streakRes.status === 'fulfilled') {
      const d = streakRes.value?.data;
      setStreakDays(d?.streak_days ?? 0);
      setCheckedInToday(Boolean(d?.checked_in_today));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadData().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleCheckin = useCallback(async () => {
    if (checkedInToday || checkinLoading) return;
    setCheckinLoading(true);
    try {
      await dailyCheckin();
      setCheckedInToday(true);
      setStreakDays((prev) => prev + 1);
      setBalance((prev) => (prev ?? 0) + 10);
      setTotalEarned((prev) => prev + 10);
      showMessage('You earned +10 coins! Come back tomorrow.');
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        (err?.response?.status === 400 ? 'Already checked in today.' : 'Check-in failed. Try again.');
      showMessage(msg);
    } finally {
      setCheckinLoading(false);
    }
  }, [checkedInToday, checkinLoading, showMessage]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading your wallet…</Text>
      </SafeAreaView>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const earnedBadges = badges.filter((b) => b.earned);
  const unearnedBadges = badges.filter((b) => !b.earned);
  const orderedBadges = [...earnedBadges, ...unearnedBadges];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* ── Hero card ──────────────────────────────────────────────── */}
        <HeroCard
          balance={balance}
          level={level}
          totalEarned={totalEarned}
          totalSpent={totalSpent}
          streakDays={streakDays}
        />

        {/* ── Error banner ───────────────────────────────────────────── */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Daily check-in ─────────────────────────────────────────── */}
        <CheckInButton
          checkedInToday={checkedInToday}
          onPress={handleCheckin}
          loading={checkinLoading}
        />

        {/* Animated check-in message */}
        {checkinMessage !== '' && (
          <Animated.View style={[styles.checkinMsg, { opacity: msgOpacity }]}>
            <Text style={styles.checkinMsgText}>{checkinMessage}</Text>
          </Animated.View>
        )}

        {/* ── Badges section ─────────────────────────────────────────── */}
        {orderedBadges.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Badges</Text>
              <Text style={styles.sectionSub}>
                {earnedBadges.length}/{badges.length} earned
              </Text>
            </View>
            <FlatList
              data={orderedBadges}
              keyExtractor={(item, index) => `badge-${item.name ?? index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.badgeList}
              ItemSeparatorComponent={() => <View style={styles.badgeSep} />}
              renderItem={({ item }) => <BadgeCard badge={item} />}
            />
          </View>
        )}

        {/* ── Coin history ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Coin History</Text>
          </View>

          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🪙</Text>
              <Text style={styles.emptyTitle}>No transactions yet</Text>
              <Text style={styles.emptySubtitle}>
                Start shopping to earn ShopCoins!
              </Text>
            </View>
          ) : (
            <View style={styles.txList}>
              {transactions.map((tx, idx) => (
                <TransactionRow
                  key={`tx-${tx.id ?? idx}`}
                  tx={tx}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    gap: 14,
  },
  loadingText: {
    fontSize: 15,
    color: COLORS.gray500,
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
    overflow: 'hidden',
  },
  heroBubble1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -60,
    right: -50,
  },
  heroBubble2: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: -40,
    left: -30,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  heroBalance: {
    fontSize: 48,
    fontWeight: '800',
    color: COLORS.white,
    lineHeight: 58,
  },
  heroCoinEmoji: {
    fontSize: 38,
  },
  heroEquiv: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    marginTop: 4,
  },
  heroRate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '400',
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  heroBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 5,
  },
  heroBadgeIcon: {
    fontSize: 14,
  },
  heroBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  heroStreakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 5,
  },
  heroStreakIcon: {
    fontSize: 14,
  },
  heroStreakText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
  },
  heroStatLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  // ── Error banner ───────────────────────────────────────────────────────────
  errorBanner: {
    backgroundColor: COLORS.redLight,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.red,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.red,
    fontWeight: '500',
  },

  // ── Check-in ───────────────────────────────────────────────────────────────
  checkinSection: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  checkinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 8,
    ...SHADOWS.cardHover,
  },
  checkinBtnDone: {
    backgroundColor: COLORS.gray200,
    ...SHADOWS.card,
  },
  checkinIcon: {
    fontSize: 20,
  },
  checkinText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  checkinTextDone: {
    color: COLORS.gray500,
  },
  checkinMsg: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: COLORS.greenLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.green,
  },
  checkinMsgText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.green,
  },

  // ── Sections ───────────────────────────────────────────────────────────────
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  sectionSub: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray400,
  },

  // ── Badges ─────────────────────────────────────────────────────────────────
  badgeList: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  badgeSep: {
    width: 10,
  },
  badgeCard: {
    width: 110,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    ...SHADOWS.card,
    borderWidth: 1.5,
    borderColor: COLORS.primaryLight,
    position: 'relative',
  },
  badgeCardUnearned: {
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray200,
  },
  badgeIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  badgeIconUnearned: {
    opacity: 0.35,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.gray800,
    textAlign: 'center',
    marginBottom: 4,
  },
  badgeNameUnearned: {
    color: COLORS.gray400,
  },
  badgeDesc: {
    fontSize: 10,
    fontWeight: '400',
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 14,
  },
  badgeDescUnearned: {
    color: COLORS.gray400,
  },
  badgeEarnedDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.green,
  },

  // ── Transaction list ───────────────────────────────────────────────────────
  txList: {
    marginHorizontal: 16,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    overflow: 'hidden',
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: COLORS.gray100,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  txIconWrap: {
    width: 32,
    alignItems: 'center',
    marginRight: 10,
  },
  txIcon: {
    fontSize: 18,
  },
  txBody: {
    flex: 1,
    marginRight: 10,
  },
  txDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray800,
    marginBottom: 2,
  },
  txDate: {
    fontSize: 11,
    fontWeight: '400',
    color: COLORS.gray400,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  txCoin: {
    fontSize: 12,
  },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.gray700,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: COLORS.gray400,
    textAlign: 'center',
    lineHeight: 20,
  },

  bottomSpacing: {
    height: 40,
  },
});
