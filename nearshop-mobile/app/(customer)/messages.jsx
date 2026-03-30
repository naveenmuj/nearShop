/**
 * Messages Screen - List of conversations
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, SHADOWS } from '../../constants/theme';
import { getConversations } from '../../lib/messaging';
import useAuthStore from '../../store/authStore';

function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
  return date.toLocaleDateString();
}

export default function MessagesScreen() {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const data = await getConversations();
      setConversations(data.items || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };

  const renderConversation = ({ item }) => (
    <TouchableOpacity
      style={styles.conversationCard}
      onPress={() => router.push(`/(customer)/chat/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        {item.other_party_avatar ? (
          <Image source={{ uri: item.other_party_avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="storefront" size={24} color={COLORS.primary} />
          </View>
        )}
        {item.unread_count > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unread_count > 9 ? '9+' : item.unread_count}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.conversationInfo}>
        <View style={styles.headerRow}>
          <Text style={styles.shopName} numberOfLines={1}>{item.shop_name || item.other_party_name}</Text>
          <Text style={styles.time}>{formatTime(item.last_message_at)}</Text>
        </View>
        {item.product_name && (
          <Text style={styles.productTag}>Re: {item.product_name}</Text>
        )}
        <Text style={[styles.preview, item.unread_count > 0 && styles.previewUnread]} numberOfLines={1}>
          {item.last_message_preview || 'No messages yet'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Messages</Text>
        <View style={{ width: 24 }} />
      </View>

      {conversations.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="chatbubbles-outline" size={64} color={COLORS.gray} />
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptySubtitle}>Start chatting with shops about products</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  list: { paddingVertical: 8 },
  conversationCard: {
    flexDirection: 'row', padding: 16, backgroundColor: COLORS.white,
    marginHorizontal: 16, marginVertical: 4, borderRadius: 12, ...SHADOWS.small,
  },
  avatarContainer: { position: 'relative' },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: {
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  unreadBadge: {
    position: 'absolute', top: -4, right: -4, backgroundColor: COLORS.primary,
    borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center',
  },
  unreadText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  conversationInfo: { flex: 1, marginLeft: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  shopName: { fontSize: 16, fontWeight: '600', color: COLORS.text, flex: 1 },
  time: { fontSize: 12, color: COLORS.gray, marginLeft: 8 },
  productTag: { fontSize: 12, color: COLORS.primary, marginTop: 2 },
  preview: { fontSize: 14, color: COLORS.gray, marginTop: 4 },
  previewUnread: { fontWeight: '600', color: COLORS.text },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: COLORS.gray, marginTop: 4, textAlign: 'center' },
});
