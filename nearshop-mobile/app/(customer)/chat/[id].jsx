/**
 * Chat Screen - Real-time messaging with a shop
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Animated, Image,
  RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { COLORS, SHADOWS } from '../../../constants/theme';
import {
  getConversation,
  sendMessage,
  markConversationRead,
  createMessagingConnection,
  queueMessage,
  getQueuedConversationMessages,
  flushQueuedMessages,
} from '../../../lib/messaging';
import { uploadFile } from '../../../lib/auth';
import { getStoredAccessToken } from '../../../lib/api';
import useAuthStore from '../../../store/authStore';

const PAGE_SIZE = 30;

function formatTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isImageUrl(url) {
  return /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test((url || '').split('?')[0]);
}

function buildLocalMessage({ localId, senderRole, content, attachments, messageType, state }) {
  return {
    id: localId,
    local_id: localId,
    sender_role: senderRole,
    content: content || '',
    attachments: attachments || null,
    message_type: messageType || 'text',
    created_at: new Date().toISOString(),
    _local_state: state,
  };
}

export default function ChatScreen() {
  const { id: conversationId } = useLocalSearchParams();
  const { user } = useAuthStore();

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [connected, setConnected] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextBeforeId, setNextBeforeId] = useState(null);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const flatListRef = useRef(null);
  const wsRef = useRef(null);
  const typingTimeout = useRef(null);
  const flushingQueueRef = useRef(false);
  const typingAnim = useRef(new Animated.Value(0)).current;

  const scrollToBottom = useCallback((animated = true) => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated }), 100);
  }, []);

  const replaceLocalMessage = useCallback((localId, incoming) => {
    setMessages((prev) => prev.map((m) => (m.local_id === localId ? incoming : m)));
  }, []);

  const appendUniqueMessage = useCallback((incoming, shouldScroll = true) => {
    if (!incoming) return;
    setMessages((prev) => {
      const exists = prev.some((m) => {
        if (incoming.id && m.id) return String(m.id) === String(incoming.id);
        return (
          m.sender_role === incoming.sender_role
          && m.content === incoming.content
          && m.created_at === incoming.created_at
        );
      });
      return exists ? prev : [...prev, incoming];
    });
    if (shouldScroll) scrollToBottom(true);
  }, [scrollToBottom]);

  const prependUniqueMessages = useCallback((incoming) => {
    if (!incoming?.length) return;
    setMessages((prev) => {
      const unique = incoming.filter((m) => !prev.some((e) => String(e.id) === String(m.id)));
      return [...unique, ...prev];
    });
  }, []);

  const hydrateQueuedMessages = useCallback(async () => {
    const queued = await getQueuedConversationMessages(conversationId);
    if (!queued.length) return;
    setMessages((prev) => {
      const localQueueMessages = queued
        .filter((q) => !prev.some((m) => m.local_id === q.local_id))
        .map((q) => ({
          id: q.local_id,
          local_id: q.local_id,
          sender_role: q.sender_role,
          content: q.content,
          attachments: q.attachments,
          message_type: q.message_type,
          created_at: q.created_at,
          _local_state: 'queued',
        }));
      return [...prev, ...localQueueMessages];
    });
  }, [conversationId]);

  const flushQueue = useCallback(async () => {
    if (flushingQueueRef.current) return;
    flushingQueueRef.current = true;
    try {
      await flushQueuedMessages(conversationId, (localId, sent) => {
        replaceLocalMessage(localId, sent);
      });
    } finally {
      flushingQueueRef.current = false;
    }
  }, [conversationId, replaceLocalMessage]);

  const loadConversation = useCallback(async (refresh = false) => {
    try {
      const data = await getConversation(conversationId, { limit: PAGE_SIZE });
      setConversation(data);
      setMessages(data.messages || []);
      setHasMoreMessages(Boolean(data.messages_has_more));
      setNextBeforeId(data.messages_next_before_id || null);
      await markConversationRead(conversationId);
      await hydrateQueuedMessages();
      if (!refresh) scrollToBottom(false);
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [conversationId, hydrateQueuedMessages, scrollToBottom]);

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !hasMoreMessages || !nextBeforeId) return;
    setLoadingOlder(true);
    try {
      const data = await getConversation(conversationId, {
        limit: PAGE_SIZE,
        beforeId: nextBeforeId,
      });
      prependUniqueMessages(data.messages || []);
      setHasMoreMessages(Boolean(data.messages_has_more));
      setNextBeforeId(data.messages_next_before_id || null);
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, hasMoreMessages, loadingOlder, nextBeforeId, prependUniqueMessages]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    let mounted = true;

    const connectWs = async () => {
      const token = await getStoredAccessToken();
      if (!token || !mounted) return;

      wsRef.current = createMessagingConnection(conversationId, token, {
        onConnected: () => {
          setConnected(true);
          flushQueue();
        },
        onDisconnected: () => setConnected(false),
        onMessage: (msg) => {
          if (mounted) {
            appendUniqueMessage(msg);
          }
        },
        onTyping: () => {
          if (mounted) {
            setIsTyping(true);
            clearTimeout(typingTimeout.current);
            typingTimeout.current = setTimeout(() => setIsTyping(false), 3000);
          }
        },
        onRead: () => {},
        onError: (err) => console.error('WS error:', err),
      });
    };

    connectWs();
    const retryTimer = setInterval(() => flushQueue(), 12000);

    return () => {
      mounted = false;
      wsRef.current?.close();
      clearTimeout(typingTimeout.current);
      clearInterval(retryTimer);
    };
  }, [conversationId, appendUniqueMessage, flushQueue]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(typingAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(typingAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])
    ).start();
  }, [typingAnim]);

  const handlePickAttachment = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to attach images in chat.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setPendingAttachment({ localUri: asset.uri, uploadedUrl: null });
    setUploadingAttachment(true);

    try {
      const response = await uploadFile(asset.uri, {
        folder: 'chat',
        purpose: 'messaging',
        shopId: conversation?.shop_id,
        productId: conversation?.product_id,
      });
      const data = response?.data ?? response;
      const uploadedUrl = data?.url || data?.file_url;
      if (!uploadedUrl) {
        throw new Error('Upload response missing file URL');
      }
      setPendingAttachment({ localUri: asset.uri, uploadedUrl });
    } catch (error) {
      console.error('Attachment upload failed:', error);
      setPendingAttachment(null);
      Alert.alert('Upload failed', 'Could not upload image. Please try again.');
    } finally {
      setUploadingAttachment(false);
    }
  }, [conversation?.product_id, conversation?.shop_id]);

  const handleSend = async () => {
    const text = inputText.trim();
    const attachmentUrls = pendingAttachment?.uploadedUrl ? [pendingAttachment.uploadedUrl] : null;

    if ((!text && !attachmentUrls?.length) || sending || uploadingAttachment) return;

    const messageType = attachmentUrls?.length && !text ? 'image' : 'text';
    const localId = `local-${Date.now()}`;
    const optimistic = buildLocalMessage({
      localId,
      senderRole: user?.active_role,
      content: text,
      attachments: attachmentUrls,
      messageType,
      state: 'sending',
    });

    appendUniqueMessage(optimistic);
    setInputText('');
    setPendingAttachment(null);
    setSending(true);

    try {
      const sent = await sendMessage(conversationId, text || null, messageType, attachmentUrls);
      replaceLocalMessage(localId, sent);
      await flushQueue();
    } catch (error) {
      console.error('Error sending message:', error);
      await queueMessage(conversationId, {
        local_id: localId,
        content: text,
        message_type: messageType,
        attachments: attachmentUrls,
        sender_role: user?.active_role,
      });
      setMessages((prev) => prev.map((m) => (
        m.local_id === localId ? { ...m, _local_state: 'queued' } : m
      )));
    } finally {
      setSending(false);
    }
  };

  const renderAttachments = (item, isMe) => {
    if (!item.attachments?.length) return null;

    return (
      <View style={styles.attachmentList}>
        {item.attachments.map((url, idx) => (
          <View key={`${item.id || item.local_id}-att-${idx}`} style={styles.attachmentItem}>
            {isImageUrl(url) ? (
              <Image source={{ uri: url }} style={styles.attachmentImage} resizeMode="cover" />
            ) : (
              <View style={[styles.attachmentFallback, isMe && styles.attachmentFallbackMe]}>
                <Ionicons name="document-text-outline" size={16} color={isMe ? COLORS.white : COLORS.text} />
                <Text style={[styles.attachmentText, isMe && styles.attachmentTextMe]}>Attachment</Text>
              </View>
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderMessage = ({ item, index }) => {
    const isMe = item.sender_role === user?.active_role;
    const showDate = index === 0
      || new Date(item.created_at).toDateString() !== new Date(messages[index - 1]?.created_at).toDateString();

    return (
      <>
        {showDate && (
          <View style={styles.dateContainer}>
            <Text style={styles.dateText}>
              {new Date(item.created_at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
          </View>
        )}
        <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
          <View style={[styles.messageBubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
            {Boolean(item.content) && (
              <Text style={[styles.messageText, isMe && styles.messageTextMe]}>{item.content}</Text>
            )}
            {renderAttachments(item, isMe)}
            <View style={styles.messageMetaRow}>
              <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>{formatTime(item.created_at)}</Text>
              {isMe && item._local_state === 'queued' && <Text style={styles.messageStatus}>Queued</Text>}
              {isMe && item._local_state === 'sending' && <Text style={styles.messageStatus}>Sending</Text>}
            </View>
          </View>
        </View>
      </>
    );
  };

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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{conversation?.shop_name}</Text>
          <Text style={styles.headerSubtitle}>
            {connected ? (isTyping ? 'typing...' : 'online') : 'connecting...'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => loadConversation(true)}>
          <Ionicons name="refresh" size={22} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => String(item.id || item.local_id || `msg-${index}`)}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          ListHeaderComponent={(
            hasMoreMessages ? (
              <TouchableOpacity style={styles.loadOlderBtn} onPress={loadOlderMessages} disabled={loadingOlder}>
                {loadingOlder ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Text style={styles.loadOlderText}>Load older messages</Text>
                )}
              </TouchableOpacity>
            ) : null
          )}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadConversation(true);
              }}
              tintColor={COLORS.primary}
            />
          )}
        />

        {isTyping && (
          <View style={styles.typingContainer}>
            <Animated.View style={[styles.typingDot, { opacity: typingAnim }]} />
            <Animated.View style={[styles.typingDot, { opacity: typingAnim, marginLeft: 4 }]} />
            <Animated.View style={[styles.typingDot, { opacity: typingAnim, marginLeft: 4 }]} />
            <Text style={styles.typingText}>Shop is typing...</Text>
          </View>
        )}

        {pendingAttachment && (
          <View style={styles.pendingAttachmentRow}>
            <Image source={{ uri: pendingAttachment.localUri }} style={styles.pendingAttachmentPreview} />
            <View style={styles.pendingAttachmentTextWrap}>
              <Text style={styles.pendingAttachmentText}>
                {uploadingAttachment ? 'Uploading image...' : 'Image ready to send'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setPendingAttachment(null)}>
              <Ionicons name="close-circle" size={22} color={COLORS.gray} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachBtn} onPress={handlePickAttachment} disabled={uploadingAttachment || sending}>
            {uploadingAttachment ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons name="attach" size={20} color={COLORS.primary} />
            )}
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor={COLORS.gray}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, ((!inputText.trim() && !pendingAttachment) || sending || uploadingAttachment) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={(!inputText.trim() && !pendingAttachment) || sending || uploadingAttachment}
          >
            {sending ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="send" size={20} color={COLORS.white} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.white,
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  headerSubtitle: { fontSize: 12, color: COLORS.success },
  messagesList: { padding: 16, paddingBottom: 8 },
  loadOlderBtn: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: COLORS.white, marginBottom: 10 },
  loadOlderText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  dateContainer: { alignItems: 'center', marginVertical: 12 },
  dateText: { fontSize: 12, color: COLORS.gray, backgroundColor: COLORS.background, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  messageRow: { marginBottom: 8, flexDirection: 'row' },
  messageRowMe: { justifyContent: 'flex-end' },
  messageBubble: { maxWidth: '84%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  bubbleOther: { backgroundColor: COLORS.white, borderBottomLeftRadius: 4, ...SHADOWS.small },
  bubbleMe: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  messageText: { fontSize: 15, color: COLORS.text, lineHeight: 20 },
  messageTextMe: { color: COLORS.white },
  attachmentList: { marginTop: 6, gap: 6 },
  attachmentItem: { overflow: 'hidden', borderRadius: 10 },
  attachmentImage: { width: 180, height: 140, borderRadius: 10 },
  attachmentFallback: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, backgroundColor: COLORS.background, borderRadius: 8 },
  attachmentFallbackMe: { backgroundColor: 'rgba(255,255,255,0.2)' },
  attachmentText: { color: COLORS.text, fontSize: 12, fontWeight: '600' },
  attachmentTextMe: { color: COLORS.white },
  messageMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 4 },
  messageTime: { fontSize: 10, color: COLORS.gray },
  messageTimeMe: { color: 'rgba(255,255,255,0.7)' },
  messageStatus: { fontSize: 10, color: COLORS.warning, fontWeight: '600' },
  typingContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.gray },
  typingText: { fontSize: 12, color: COLORS.gray, marginLeft: 8 },
  pendingAttachmentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  pendingAttachmentPreview: { width: 42, height: 42, borderRadius: 8 },
  pendingAttachmentTextWrap: { flex: 1 },
  pendingAttachmentText: { fontSize: 12, color: COLORS.text },
  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 12, backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  attachBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.background, marginRight: 8,
  },
  input: {
    flex: 1, backgroundColor: COLORS.background, borderRadius: 20, paddingHorizontal: 16,
    paddingVertical: 10, fontSize: 15, maxHeight: 100, color: COLORS.text,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },
  sendBtnDisabled: { backgroundColor: COLORS.gray },
});
