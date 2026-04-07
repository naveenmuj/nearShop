import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { alert } from '../../components/ui/PremiumAlert';
import useMyShop from '../../hooks/useMyShop';
import { getShopFollowers } from '../../lib/shops';
import { startConversationAsBusiness } from '../../lib/messaging';

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
};

const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
};

export default function FollowersScreen() {
  const { shopId, loading: shopLoading } = useMyShop();
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [startingConversationWith, setStartingConversationWith] = useState(null);

  const openFollowerChat = useCallback(async (follower) => {
    if (!follower?.id || !shopId || startingConversationWith) return;
    setStartingConversationWith(follower.id);
    try {
      const convo = await startConversationAsBusiness(follower.id, { shopId });
      if (convo?.id) {
        router.push(`/(business)/chat/${convo.id}`);
      } else {
        throw new Error('Conversation could not be started');
      }
    } catch (err) {
      console.error('Failed to start follower chat:', err);
      alert.error({ title: 'Unable to open chat', message: 'Please try again in a moment.' });
    } finally {
      setStartingConversationWith(null);
    }
  }, [shopId, startingConversationWith]);

  const loadFollowers = useCallback(async (reset = false) => {
    if (!shopId) return;
    
    const currentPage = reset ? 1 : page;
    if (!reset && !hasMore) return;
    
    try {
      const response = await getShopFollowers(shopId, { page: currentPage, per_page: 20 });
      const data = response.data;
      
      setTotal(data.total || 0);
      setHasMore((data.items?.length || 0) === 20);
      
      if (reset) {
        setFollowers(data.items || []);
        setPage(2);
      } else {
        setFollowers(prev => [...prev, ...(data.items || [])]);
        setPage(currentPage + 1);
      }
    } catch (err) {
      console.error('Failed to load followers:', err);
      if (reset) {
        alert.error({ title: 'Error', message: 'Failed to load followers' });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [shopId, page, hasMore]);

  useFocusEffect(
    useCallback(() => {
      if (shopId && followers.length === 0) {
        setLoading(true);
        loadFollowers(true);
      }
    }, [shopId, followers.length, loadFollowers])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadFollowers(true);
  };

  const onEndReached = () => {
    if (!loading && hasMore) {
      loadFollowers();
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const renderFollower = ({ item }) => (
    <View style={styles.followerCard}>
      <Image
        source={{ uri: item.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=7F77DD&color=fff` }}
        style={styles.avatar}
      />
      <View style={styles.followerInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.followerName}>{item.name}</Text>
          {item.is_new && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}
        </View>
        <Text style={styles.followedAt}>Followed {formatDate(item.followed_at)}</Text>
      </View>
      <TouchableOpacity 
        style={styles.messageBtn}
        onPress={() => openFollowerChat(item)}
        disabled={startingConversationWith === item.id}
      >
        {startingConversationWith === item.id ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <Ionicons name="chatbubble-outline" size={18} color={COLORS.primary} />
        )}
      </TouchableOpacity>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={64} color={COLORS.gray300} />
      <Text style={styles.emptyTitle}>No Followers Yet</Text>
      <Text style={styles.emptyText}>
        Share your shop link and create engaging content to attract followers
      </Text>
      <TouchableOpacity 
        style={styles.shareBtn}
        onPress={() => router.push('/(business)/marketing')}
      >
        <Ionicons name="share-social-outline" size={18} color={COLORS.white} />
        <Text style={styles.shareBtnText}>Marketing Tools</Text>
      </TouchableOpacity>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.statsCard}>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{total}</Text>
        <Text style={styles.statLabel}>Total Followers</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue}>
          {followers.filter(f => f.is_new).length}
        </Text>
        <Text style={styles.statLabel}>New This Week</Text>
      </View>
    </View>
  );

  if (shopLoading || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={COLORS.gray700} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Followers</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading followers...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.gray700} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Followers</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={followers}
        renderItem={renderFollower}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={total > 0 ? renderHeader : null}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          hasMore && followers.length > 0 ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
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
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.gray500,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...SHADOWS.card,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.gray200,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.gray500,
    fontWeight: '500',
  },
  followerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    ...SHADOWS.card,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.gray100,
  },
  followerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  followerName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.gray900,
  },
  newBadge: {
    backgroundColor: COLORS.green,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.white,
  },
  followedAt: {
    fontSize: 13,
    color: COLORS.gray500,
    marginTop: 2,
  },
  messageBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.gray700,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 21,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 24,
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
