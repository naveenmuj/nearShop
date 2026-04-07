import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Image,
  RefreshControl,
  Alert,
  Keyboard,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';

import { COLORS, SHADOWS } from '../../constants/theme';
import {
  getConversation,
  sendMessage,
  markConversationRead,
  createMessagingConnection,
  queueMessage,
  getQueuedConversationMessages,
  flushQueuedMessages,
  reactToMessage,
  unreactToMessage,
  getConversationPresence,
} from '../../lib/messaging';
import { uploadFile } from '../../lib/auth';
import { getStoredAccessToken } from '../../lib/api';
import useAuthStore from '../../store/authStore';

const PAGE_SIZE = 30;
const EMOJIS = ['😀', '😂', '😍', '🥳', '🙏', '👍', '🔥', '❤️', '🎉', '🤝', '💯', '👏'];
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🔥'];

function formatTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isImageUrl(url) {
  return /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test((url || '').split('?')[0]);
}

function attachmentName(url, fallback = 'Attachment') {
  if (!url) return fallback;
  const clean = url.split('?')[0];
  const idx = clean.lastIndexOf('/');
  return idx >= 0 ? decodeURIComponent(clean.slice(idx + 1)) : fallback;
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
    is_read: false,
  };
}

export default function ChatScreenBase({ viewerRole }) {
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
  const [showEmojiTray, setShowEmojiTray] = useState(false);
  const [showAttachTray, setShowAttachTray] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const [presence, setPresence] = useState({ role_online: { customer: false, business: false }, role_last_seen: {} });

  const flatListRef = useRef(null);
  const wsRef = useRef(null);
  const typingTimeout = useRef(null);
  const flushingQueueRef = useRef(false);
  const typingAnim = useRef(new Animated.Value(0)).current;
  const lastTypingSignalRef = useRef(0);

  const scrollToBottom = useCallback((animated = true) => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated }), 100);
  }, []);

  const replaceLocalMessage = useCallback((localId, incoming) => {
    setMessages((prev) => prev.map((m) => (m.local_id === localId ? { ...incoming, _local_state: undefined } : m)));
  }, []);

  const upsertServerMessage = useCallback((incoming) => {
    if (!incoming?.id) return;
    setMessages((prev) => {
      const idx = prev.findIndex((m) => String(m.id) === String(incoming.id));
      if (idx === -1) return prev;
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...incoming, _local_state: undefined };
      return copy;
    });
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

  const markMyMessagesAsRead = useCallback(() => {
    setMessages((prev) => prev.map((msg) => {
      if (msg.sender_role !== user?.active_role || msg.is_read) return msg;
      return { ...msg, is_read: true, read_at: new Date().toISOString() };
    }));
  }, [user?.active_role]);

  const emitReadReceipt = useCallback(async () => {
    try {
      await markConversationRead(conversationId);
      wsRef.current?.markRead();
    } catch {
      // no-op: read receipt failures should not break chat UX
    }
  }, [conversationId]);

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
          is_read: false,
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
      await emitReadReceipt();
      await hydrateQueuedMessages();
      if (!refresh) scrollToBottom(false);
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [conversationId, emitReadReceipt, hydrateQueuedMessages, scrollToBottom]);

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
        autoReconnect: true,
        onConnected: () => {
          setConnected(true);
          flushQueue();
          emitReadReceipt();
        },
        onDisconnected: () => setConnected(false),
        onMessage: (msg) => {
          if (!mounted) return;
          appendUniqueMessage(msg);
          if (msg?.sender_role !== user?.active_role) {
            emitReadReceipt();
          }
        },
        onTyping: () => {
          if (mounted) {
            setIsTyping(true);
            clearTimeout(typingTimeout.current);
            typingTimeout.current = setTimeout(() => setIsTyping(false), 3000);
          }
        },
        onRead: () => {
          if (mounted) {
            markMyMessagesAsRead();
          }
        },
        onReaction: (msg) => {
          if (mounted) {
            upsertServerMessage(msg);
          }
        },
        onPresence: (payload) => {
          if (mounted) {
            setPresence({
              role_online: payload?.role_online || { customer: false, business: false },
              role_last_seen: payload?.role_last_seen || {},
            });
          }
        },
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
  }, [conversationId, appendUniqueMessage, emitReadReceipt, flushQueue, markMyMessagesAsRead, upsertServerMessage, user?.active_role]);

  useEffect(() => {
    let mounted = true;
    const pullPresence = async () => {
      try {
        const data = await getConversationPresence(conversationId);
        if (!mounted) return;
        setPresence({
          role_online: data?.role_online || { customer: false, business: false },
          role_last_seen: data?.role_last_seen || {},
        });
      } catch {
        // no-op
      }
    };

    pullPresence();
    const timer = setInterval(pullPresence, 15000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [conversationId]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(typingAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(typingAnim, { toValue: 0.3, duration: 450, useNativeDriver: true }),
      ])
    ).start();
  }, [typingAnim]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setShowEmojiTray(false);
      setShowAttachTray(false);
      scrollToBottom(true);
    });

    return () => {
      showSub.remove();
    };
  }, [scrollToBottom]);

  const uploadSelectedFile = useCallback(async ({ uri, name, mimeType, kind }) => {
    setPendingAttachment({ localUri: uri, uploadedUrl: null, type: kind, name: name || 'Attachment' });
    setUploadingAttachment(true);
    setShowAttachTray(false);

    try {
      const response = await uploadFile(uri, {
        folder: 'chat',
        purpose: kind === 'image' ? 'media' : 'document',
        shopId: conversation?.shop_id,
        productId: conversation?.product_id,
        mimeType,
        fileName: name,
      });
      const data = response?.data ?? response;
      const uploadedUrl = data?.url || data?.file_url;
      if (!uploadedUrl) {
        throw new Error('Upload response missing file URL');
      }
      setPendingAttachment((prev) => ({ ...(prev || {}), uploadedUrl }));
    } catch (error) {
      console.error('Attachment upload failed:', error);
      setPendingAttachment(null);
      Alert.alert('Upload failed', `Could not upload ${kind}. Please try again.`);
    } finally {
      setUploadingAttachment(false);
    }
  }, [conversation?.product_id, conversation?.shop_id]);

  const handlePickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to attach images in chat.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];

    await uploadSelectedFile({
      uri: asset.uri,
      name: asset.fileName || `chat-image-${Date.now()}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
      kind: 'image',
    });
  }, [uploadSelectedFile]);

  const handlePickDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'image/*',
        'audio/*',
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.length) return;
    const doc = result.assets[0];

    await uploadSelectedFile({
      uri: doc.uri,
      name: doc.name || `chat-file-${Date.now()}`,
      mimeType: doc.mimeType || 'application/octet-stream',
      kind: doc.mimeType?.startsWith('image/')
        ? 'image'
        : (doc.mimeType?.startsWith('audio/') ? 'audio' : 'document'),
    });
  }, [uploadSelectedFile]);

  const handleInputChange = useCallback((text) => {
    setInputText(text);
    if (!text.trim()) return;
    const now = Date.now();
    if (now - lastTypingSignalRef.current > 1200) {
      wsRef.current?.sendTyping();
      lastTypingSignalRef.current = now;
    }
  }, []);

  const handleSend = async () => {
    const text = inputText.trim();
    const attachmentUrls = pendingAttachment?.uploadedUrl ? [pendingAttachment.uploadedUrl] : null;

    if ((!text && !attachmentUrls?.length) || sending || uploadingAttachment) return;

    const messageType = pendingAttachment?.type === 'document'
      ? 'file'
      : (pendingAttachment?.type === 'audio'
        ? 'audio'
        : (attachmentUrls?.length && !text ? 'image' : 'text'));

    const metadata = replyTarget ? {
      reply_to_message_id: replyTarget.id,
      reply_preview: (replyTarget.content || 'Attachment').slice(0, 120),
      reply_sender_role: replyTarget.sender_role,
    } : null;

    const localId = `local-${Date.now()}`;
    const optimistic = buildLocalMessage({
      localId,
      senderRole: user?.active_role,
      content: text,
      attachments: attachmentUrls,
      messageType,
      state: connected ? 'sending' : 'queued',
    });
    optimistic.message_metadata = metadata;

    appendUniqueMessage(optimistic);
    setInputText('');
    setPendingAttachment(null);
    setReplyTarget(null);
    setShowEmojiTray(false);
    setSending(true);

    try {
      const sent = await sendMessage(conversationId, text || null, messageType, attachmentUrls, metadata);
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
        metadata,
      });
      setMessages((prev) => prev.map((m) => (
        m.local_id === localId ? { ...m, _local_state: 'queued' } : m
      )));
    } finally {
      setSending(false);
      scrollToBottom(true);
    }
  };

  const handleToggleReaction = useCallback(async (item, emoji = '👍') => {
    if (!item?.id || item.local_id) return;
    const reactions = item?.message_metadata?.reactions || {};
    const mine = (reactions[emoji] || []).includes(String(user?.id));
    try {
      const updated = mine
        ? await unreactToMessage(conversationId, item.id, emoji)
        : await reactToMessage(conversationId, item.id, emoji);
      upsertServerMessage(updated);
    } catch (err) {
      console.error('Reaction update failed:', err);
    }
  }, [conversationId, upsertServerMessage, user?.id]);

  const renderReplyPreview = (item, isMe) => {
    const md = item?.message_metadata || {};
    if (!md.reply_to_message_id) return null;
    return (
      <View style={[styles.replyPreview, isMe && styles.replyPreviewMe]}>
        <Text style={[styles.replyLabel, isMe && styles.replyLabelMe]} numberOfLines={1}>
          {md.reply_sender_role === user?.active_role ? 'You' : 'Reply'}
        </Text>
        <Text style={[styles.replyText, isMe && styles.replyTextMe]} numberOfLines={1}>
          {md.reply_preview || 'Attachment'}
        </Text>
      </View>
    );
  };

  const renderReactions = (item) => {
    const reactions = item?.message_metadata?.reactions || {};
    const entries = Object.entries(reactions).filter(([, users]) => Array.isArray(users) && users.length > 0);
    if (!entries.length) return null;

    return (
      <View style={styles.reactionRow}>
        {entries.map(([emoji, users]) => {
          const mine = users.includes(String(user?.id));
          return (
            <TouchableOpacity
              key={`${item.id}-react-${emoji}`}
              style={[styles.reactionPill, mine && styles.reactionPillMine]}
              onPress={() => handleToggleReaction(item, emoji)}
            >
              <Text style={styles.reactionText}>{emoji} {users.length}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
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
              <TouchableOpacity
                style={[styles.attachmentFallback, isMe && styles.attachmentFallbackMe]}
                onPress={() => Linking.openURL(url)}
              >
                <Ionicons name="document-text-outline" size={16} color={isMe ? COLORS.white : COLORS.text} />
                <Text style={[styles.attachmentText, isMe && styles.attachmentTextMe]} numberOfLines={1}>
                  {attachmentName(url, 'Document')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderMessageStatus = (item, isMe) => {
    if (!isMe) return null;

    if (item._local_state === 'queued') {
      return <Ionicons name="time-outline" size={13} color={COLORS.warning} />;
    }

    if (item._local_state === 'sending') {
      return <Ionicons name="checkmark" size={13} color="rgba(255,255,255,0.8)" />;
    }

    const tickColor = item.is_read ? '#22a8ff' : 'rgba(255,255,255,0.85)';
    return <Ionicons name="checkmark-done" size={14} color={tickColor} />;
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
            {renderReplyPreview(item, isMe)}
            {Boolean(item.content) && (
              <Text style={[styles.messageText, isMe && styles.messageTextMe]}>{item.content}</Text>
            )}
            {renderAttachments(item, isMe)}
            {renderReactions(item)}
            <View style={styles.messageMetaRow}>
              <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>{formatTime(item.created_at)}</Text>
              {renderMessageStatus(item, isMe)}
            </View>
          </View>
          <View style={styles.messageActionsRow}>
            {QUICK_REACTIONS.map((emoji) => (
              <TouchableOpacity key={`${item.id || item.local_id}-${emoji}`} onPress={() => handleToggleReaction(item, emoji)} style={styles.quickReactionBtn}>
                <Text style={styles.quickReactionText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setReplyTarget(item)} style={styles.replyBtn}>
              <Ionicons name="arrow-undo-outline" size={14} color={COLORS.gray} />
            </TouchableOpacity>
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

  const headerTitle = viewerRole === 'customer'
    ? conversation?.shop_name
    : (conversation?.other_party_name || 'Customer');

  const otherRole = viewerRole === 'customer' ? 'business' : 'customer';
  const isOtherOnline = Boolean(presence?.role_online?.[otherRole]);
  const otherLastSeen = presence?.role_last_seen?.[otherRole];
  const typingCopy = viewerRole === 'customer' ? 'Shop is typing...' : 'Customer is typing...';
  const presenceSubtitle = isTyping
    ? 'typing...'
    : (isOtherOnline ? 'online' : (otherLastSeen ? `last seen ${formatTime(otherLastSeen)}` : 'offline'));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
          <Text style={styles.headerSubtitle}>{connected ? presenceSubtitle : 'connecting...'}</Text>
        </View>
        <TouchableOpacity onPress={() => loadConversation(true)}>
          <Ionicons name="refresh" size={22} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 86 : 14}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => String(item.id || item.local_id || `msg-${index}`)}
          renderItem={renderMessage}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => scrollToBottom(false)}
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
            <Text style={styles.typingText}>{typingCopy}</Text>
          </View>
        )}

        {showEmojiTray && (
          <View style={styles.emojiTray}>
            {EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.emojiBtn}
                onPress={() => setInputText((prev) => `${prev}${emoji}`)}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {showAttachTray && (
          <View style={styles.attachTray}>
            <TouchableOpacity style={styles.attachAction} onPress={handlePickImage}>
              <Ionicons name="image-outline" size={18} color={COLORS.primary} />
              <Text style={styles.attachActionText}>Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachAction} onPress={handlePickDocument}>
              <Ionicons name="document-outline" size={18} color={COLORS.primary} />
              <Text style={styles.attachActionText}>Doc / Voice</Text>
            </TouchableOpacity>
          </View>
        )}

        {replyTarget && (
          <View style={styles.replyComposerBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.replyComposerTitle}>Replying to {(replyTarget.sender_role === user?.active_role) ? 'yourself' : 'message'}</Text>
              <Text style={styles.replyComposerText} numberOfLines={1}>{replyTarget.content || 'Attachment'}</Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTarget(null)}>
              <Ionicons name="close" size={20} color={COLORS.gray} />
            </TouchableOpacity>
          </View>
        )}

        {pendingAttachment && (
          <View style={styles.pendingAttachmentRow}>
            {pendingAttachment.type === 'image' ? (
              <Image source={{ uri: pendingAttachment.localUri }} style={styles.pendingAttachmentPreview} />
            ) : (
              <View style={styles.pendingDocPreview}>
                <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
              </View>
            )}
            <View style={styles.pendingAttachmentTextWrap}>
              <Text style={styles.pendingAttachmentTitle} numberOfLines={1}>{pendingAttachment.name || 'Attachment'}</Text>
              <Text style={styles.pendingAttachmentText}>
                {uploadingAttachment ? 'Uploading...' : 'Ready to send'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setPendingAttachment(null)}>
              <Ionicons name="close-circle" size={22} color={COLORS.gray} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.composerWrap}>
          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                Keyboard.dismiss();
                setShowAttachTray(false);
                setShowEmojiTray((v) => !v);
              }}
            >
              <Ionicons name="happy-outline" size={22} color={COLORS.gray} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                Keyboard.dismiss();
                setShowEmojiTray(false);
                setShowAttachTray((v) => !v);
              }}
              disabled={uploadingAttachment || sending}
            >
              {uploadingAttachment ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Ionicons name="add-circle-outline" size={22} color={COLORS.primary} />
              )}
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={handleInputChange}
              placeholder="Message"
              placeholderTextColor={COLORS.gray}
              multiline
              maxLength={1000}
            />
          </View>

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
  container: { flex: 1, backgroundColor: '#e9f1f7' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#dce5ee', backgroundColor: '#f9fcff',
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  headerSubtitle: { fontSize: 12, color: COLORS.success },
  messagesList: { padding: 14, paddingBottom: 8 },
  loadOlderBtn: {
    alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12,
    backgroundColor: '#ffffff', marginBottom: 10,
  },
  loadOlderText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  dateContainer: { alignItems: 'center', marginVertical: 12 },
  dateText: {
    fontSize: 12, color: COLORS.gray, backgroundColor: '#d7e6f3',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12,
  },
  messageRow: { marginBottom: 8, flexDirection: 'row' },
  messageRowMe: { justifyContent: 'flex-end' },
  messageActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  messageBubble: { maxWidth: '84%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  bubbleOther: { backgroundColor: COLORS.white, borderBottomLeftRadius: 5, ...SHADOWS.small },
  bubbleMe: { backgroundColor: '#0d7a5f', borderBottomRightRadius: 5 },
  messageText: { fontSize: 15, color: COLORS.text, lineHeight: 20 },
  messageTextMe: { color: COLORS.white },
  replyPreview: {
    borderLeftWidth: 2,
    borderLeftColor: '#2f9fff',
    backgroundColor: '#eef4fa',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 6,
  },
  replyPreviewMe: {
    borderLeftColor: '#e8f5ff',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  replyLabel: { fontSize: 10, fontWeight: '700', color: '#2679bf' },
  replyLabelMe: { color: '#dff2ff' },
  replyText: { fontSize: 11, color: COLORS.text },
  replyTextMe: { color: '#f2fcff' },
  attachmentList: { marginTop: 6, gap: 6 },
  attachmentItem: { overflow: 'hidden', borderRadius: 10 },
  attachmentImage: { width: 190, height: 150, borderRadius: 10 },
  attachmentFallback: {
    flexDirection: 'row', alignItems: 'center', gap: 6, padding: 9,
    backgroundColor: '#eff4f8', borderRadius: 8,
  },
  attachmentFallbackMe: { backgroundColor: 'rgba(255,255,255,0.2)' },
  attachmentText: { color: COLORS.text, fontSize: 12, fontWeight: '600', maxWidth: 160 },
  attachmentTextMe: { color: COLORS.white },
  messageMetaRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    gap: 4, marginTop: 4,
  },
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  reactionPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#edf4fb',
    borderRadius: 12,
  },
  reactionPillMine: { backgroundColor: '#d4eaff' },
  reactionText: { fontSize: 11, color: '#215c8e' },
  quickReactionBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  quickReactionText: { fontSize: 11 },
  replyBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  messageTime: { fontSize: 10, color: COLORS.gray },
  messageTimeMe: { color: 'rgba(255,255,255,0.75)' },
  typingContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.gray },
  typingText: { fontSize: 12, color: COLORS.gray, marginLeft: 8 },
  emojiTray: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#f6fbff', borderTopWidth: 1, borderTopColor: '#dce8f2',
  },
  emojiBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center',
  },
  emojiText: { fontSize: 20 },
  attachTray: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#f6fbff', borderTopWidth: 1, borderTopColor: '#dce8f2',
  },
  attachAction: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#ffffff', borderRadius: 14,
  },
  attachActionText: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  pendingAttachmentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  pendingAttachmentPreview: { width: 42, height: 42, borderRadius: 8 },
  pendingDocPreview: {
    width: 42, height: 42, borderRadius: 8, backgroundColor: '#eef5fc',
    alignItems: 'center', justifyContent: 'center',
  },
  pendingAttachmentTextWrap: { flex: 1 },
  pendingAttachmentTitle: { fontSize: 12, color: COLORS.text, fontWeight: '700' },
  pendingAttachmentText: { fontSize: 11, color: COLORS.gray },
  replyComposerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f2f7fc',
    borderTopWidth: 1,
    borderTopColor: '#d9e6f2',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  replyComposerTitle: { fontSize: 12, fontWeight: '700', color: '#2a6da1' },
  replyComposerText: { fontSize: 12, color: COLORS.text },
  composerWrap: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: '#f9fcff', borderTopWidth: 1, borderTopColor: '#dce8f2',
  },
  inputContainer: {
    flex: 1, flexDirection: 'row', alignItems: 'flex-end', borderRadius: 24,
    backgroundColor: COLORS.white, paddingHorizontal: 8, paddingVertical: 6, ...SHADOWS.small,
  },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
  },
  input: {
    flex: 1, paddingHorizontal: 8, paddingVertical: 6,
    fontSize: 15, maxHeight: 110, color: COLORS.text,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#1c9f78',
    justifyContent: 'center', alignItems: 'center', marginLeft: 8,
  },
  sendBtnDisabled: { backgroundColor: '#9db9af' },
});