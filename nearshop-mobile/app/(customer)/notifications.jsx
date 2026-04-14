import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { COLORS, SHADOWS } from '../../constants/theme';
import { getNotifications, getUnreadCount, markAllRead, markRead } from '../../lib/notifications';
import pushService from '../../lib/pushNotifications';

function formatDateTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolveNotificationTarget(item) {
  const customRoute = item?.route || item?.pathname || item?.screen || item?.deep_link || item?.link;
  if (typeof customRoute === 'string' && customRoute.trim().startsWith('/')) {
    return customRoute.trim();
  }

  if (typeof item?.payload === 'string') {
    try {
      const parsed = JSON.parse(item.payload);
      const payloadRoute = parsed?.route || parsed?.pathname || parsed?.screen || parsed?.deep_link || parsed?.link;
      if (typeof payloadRoute === 'string' && payloadRoute.trim().startsWith('/')) {
        return payloadRoute.trim();
      }
    } catch {
      // Non-JSON payload; ignore and use standard routing.
    }
  }

  const type = item?.notification_type || item?.reference_type;
  const referenceId = item?.reference_id;

  switch (type) {
    case 'new_order':
    case 'order_confirmed':
    case 'order_ready':
    case 'order_delivered':
    case 'order_cancelled':
      return referenceId ? `/(customer)/order-detail/${referenceId}` : '/(customer)/orders';
    case 'haggle_offer':
    case 'haggle_counter_offer':
    case 'haggle_accepted':
    case 'haggle_rejected':
      return referenceId ? `/(customer)/haggle?id=${referenceId}` : '/(customer)/orders';
    case 'deal_expiring':
    case 'price_drop':
      return referenceId ? `/(customer)/product/${referenceId}` : '/(customer)/deals';
    case 'new_message':
    case 'chat':
      return referenceId ? `/(customer)/chat/${referenceId}` : '/(customer)/messages';
    case 'reservation_confirmed':
    case 'reservation_expiring':
      return '/(customer)/orders';
    case 'coins_earned':
    case 'badge_earned':
      return '/(customer)/achievements';
    default:
      break;
  }

  const title = String(item?.title || '').toLowerCase();
  const body = String(item?.body || '').toLowerCase();
  const combined = `${title} ${body}`;
  if (combined.includes('order')) return '/(customer)/orders';
  if (combined.includes('deal') || combined.includes('offer') || combined.includes('price')) return '/(customer)/deals';
  if (combined.includes('message') || combined.includes('chat')) return '/(customer)/messages';
  return '/(customer)/notifications';
}

function NotificationCard({ item, onPress, onMarkRead, loadingId }) {
  const isMarking = loadingId === item.id;
  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityLabel={`Notification ${item.title || ''}`}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title || 'Notification'}</Text>
        {!item.is_read ? <View style={styles.unreadDot} /> : null}
      </View>
      <Text style={styles.cardBody}>{item.body || ''}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.cardDate}>{formatDateTime(item.created_at)}</Text>
        {!item.is_read ? (
          <Pressable
            style={({ pressed }) => [styles.markReadBtn, pressed && styles.markReadBtnPressed]}
            onPress={onMarkRead}
            accessibilityLabel="Mark Read"
            disabled={isMarking}
          >
            {isMarking ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.markReadText}>Mark Read</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function CustomerNotificationsScreen() {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingId, setMarkingId] = useState(null);
  const [markAllPending, setMarkAllPending] = useState(false);

  const loadNotifications = useCallback(async ({ showLoader = false } = {}) => {
    if (showLoader) setLoading(true);
    try {
      const [listRes, unreadRes] = await Promise.all([
        getNotifications(),
        getUnreadCount(),
      ]);
      const loadedItems = Array.isArray(listRes?.data?.items) ? listRes.data.items : [];
      const count = Number(unreadRes?.data?.unread_count ?? 0);
      setItems(loadedItems);
      setUnreadCount(Number.isFinite(count) ? Math.max(0, count) : 0);
      try {
        await pushService.setBadgeCount(Number.isFinite(count) ? Math.max(0, count) : 0);
      } catch {
        // Keep in-app behavior resilient when native badge update is unavailable.
      }
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotifications({ showLoader: true });
    }, [loadNotifications])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, [loadNotifications]);

  const handleNotificationPress = useCallback(
    async (item) => {
      if (!item?.is_read && item?.id) {
        try {
          await markRead(item.id);
          setItems((prev) => prev.map((entry) => (
            entry.id === item.id ? { ...entry, is_read: true } : entry
          )));
          setUnreadCount((prev) => Math.max(0, prev - 1));
        } catch {
          // Navigation should still work even if mark-read API fails.
        }
      }
      router.push(resolveNotificationTarget(item));
    },
    []
  );

  const handleMarkRead = useCallback(async (itemId) => {
    setMarkingId(itemId);
    try {
      await markRead(itemId);
      setItems((prev) => prev.map((item) => (
        item.id === itemId ? { ...item, is_read: true } : item
      )));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } finally {
      setMarkingId(null);
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    if (markAllPending || unreadCount === 0) return;
    setMarkAllPending(true);
    try {
      await markAllRead();
      setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
      try {
        await pushService.setBadgeCount(0);
      } catch {
        // No-op when native badge API is unavailable.
      }
    } finally {
      setMarkAllPending(false);
    }
  }, [markAllPending, unreadCount]);

  const hasUnread = useMemo(() => unreadCount > 0, [unreadCount]);
  const latestNotification = useMemo(() => items[0] || null, [items]);
  const latestResolvedRoute = useMemo(
    () => (latestNotification ? resolveNotificationTarget(latestNotification) : null),
    [latestNotification]
  );
  const latestPayloadText = useMemo(() => {
    if (!latestNotification) return '';
    const payload = latestNotification?.payload ?? latestNotification?.data ?? null;
    if (!payload) return '';
    if (typeof payload === 'string') return payload;
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  }, [latestNotification]);

  const sendTestPush = useCallback(async () => {
    await pushService.scheduleLocalNotification(
      'NearShop QA Test',
      'Tap to open your notifications inbox',
      { type: 'qa_test_notification' },
      1
    );
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Back">
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>Unread: {unreadCount}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.markAllBtn, pressed && styles.markAllBtnPressed, !hasUnread && styles.markAllBtnDisabled]}
          onPress={handleMarkAllRead}
          accessibilityLabel="Mark All Read"
          disabled={!hasUnread || markAllPending}
        >
          {markAllPending ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Text style={[styles.markAllText, !hasUnread && styles.markAllTextDisabled]}>Mark All</Text>
          )}
        </Pressable>
      </View>

      {__DEV__ ? (
        <View style={styles.devPanel}>
          <View style={styles.devActions}>
            <Pressable
              style={({ pressed }) => [styles.devBtn, pressed && styles.devBtnPressed]}
              onPress={sendTestPush}
              accessibilityLabel="Send Test Push"
            >
              <Text style={styles.devBtnText}>Send Test Push</Text>
            </Pressable>
          </View>

          <View style={styles.devDebugCard}>
            <Text style={styles.devDebugTitle}>Push Debug</Text>
            <Text style={styles.devDebugLabel}>Latest route</Text>
            <Text style={styles.devDebugValue}>{latestResolvedRoute || 'No notification loaded yet'}</Text>
            <Text style={styles.devDebugLabel}>Latest payload</Text>
            <Text style={styles.devDebugPayload} numberOfLines={6}>
              {latestPayloadText || 'No payload data found on latest notification.'}
            </Text>
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          )}
          renderItem={({ item }) => (
            <NotificationCard
              item={item}
              loadingId={markingId}
              onPress={() => handleNotificationPress(item)}
              onMarkRead={() => handleMarkRead(item.id)}
            />
          )}
          ListEmptyComponent={(
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🔔</Text>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyText}>You will see order updates, offers, and activity here.</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.gray100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
    ...SHADOWS.card,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray100,
  },
  backIcon: {
    fontSize: 24,
    color: COLORS.gray700,
    lineHeight: 24,
    marginTop: -1,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.gray900,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.gray500,
    marginTop: 2,
    fontWeight: '600',
  },
  markAllBtn: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 999,
    minWidth: 88,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
  },
  markAllBtnPressed: {
    opacity: 0.75,
  },
  markAllBtnDisabled: {
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.gray100,
  },
  markAllText: {
    color: COLORS.primaryDark,
    fontWeight: '700',
    fontSize: 13,
  },
  markAllTextDisabled: {
    color: COLORS.gray500,
  },
  devActions: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  devPanel: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  devBtn: {
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  devBtnPressed: {
    opacity: 0.8,
  },
  devBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  devDebugCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    backgroundColor: '#F8FAFC',
  },
  devDebugTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.gray900,
    marginBottom: 8,
  },
  devDebugLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 6,
    marginBottom: 4,
  },
  devDebugValue: {
    fontSize: 13,
    color: COLORS.gray800,
    fontWeight: '600',
  },
  devDebugPayload: {
    fontSize: 12,
    color: COLORS.gray700,
    lineHeight: 17,
    fontFamily: 'monospace',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.gray600,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 44,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.gray900,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 21,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    ...SHADOWS.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.gray900,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  cardBody: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.gray700,
    lineHeight: 21,
  },
  cardFooter: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardDate: {
    fontSize: 12,
    color: COLORS.gray500,
    fontWeight: '600',
    flex: 1,
  },
  markReadBtn: {
    minWidth: 86,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  markReadBtnPressed: {
    backgroundColor: COLORS.primaryLight,
  },
  markReadText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
});