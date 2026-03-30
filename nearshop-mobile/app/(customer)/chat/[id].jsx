/**
 * Chat Screen - Real-time messaging with a shop
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Image, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { COLORS, SHADOWS } from '../../../constants/theme';
import { getConversation, sendMessage, markConversationRead, createMessagingConnection } from '../../../lib/messaging';
import { getStoredAccessToken } from '../../../lib/api';
import useAuthStore from '../../../store/authStore';

function formatTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatScreen() {
  const { id: conversationId } = useLocalSearchParams();
  const { user } = useAuthStore();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [connected, setConnected] = useState(false);
  
  const flatListRef = useRef(null);
  const wsRef = useRef(null);
  const typingTimeout = useRef(null);
  const typingAnim = useRef(new Animated.Value(0)).current;

  const loadConversation = useCallback(async () => {
    try {
      const data = await getConversation(conversationId);
      setConversation(data);
      setMessages(data.messages || []);
      markConversationRead(conversationId);
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // WebSocket connection
  useEffect(() => {
    let mounted = true;
    
    const connectWs = async () => {
      const token = await getStoredAccessToken();
      if (!token || !mounted) return;
      
      wsRef.current = createMessagingConnection(conversationId, token, {
        onConnected: () => setConnected(true),
        onDisconnected: () => setConnected(false),
        onMessage: (msg) => {
          if (mounted) {
            setMessages(prev => [...prev, msg]);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
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
    
    return () => {
      mounted = false;
      wsRef.current?.close();
      clearTimeout(typingTimeout.current);
    };
  }, [conversationId]);

  // Typing animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(typingAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(typingAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    
    const text = inputText.trim();
    setInputText('');
    setSending(true);
    
    try {
      const msg = await sendMessage(conversationId, text);
      setMessages(prev => [...prev, msg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      console.error('Error sending message:', error);
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item, index }) => {
    const isMe = item.sender_role === user?.active_role;
    const showDate = index === 0 || 
      new Date(item.created_at).toDateString() !== new Date(messages[index - 1]?.created_at).toDateString();
    
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
            <Text style={[styles.messageText, isMe && styles.messageTextMe]}>{item.content}</Text>
            <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>{formatTime(item.created_at)}</Text>
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
        <TouchableOpacity>
          <Ionicons name="ellipsis-vertical" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => item.id || `msg-${index}`}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {isTyping && (
        <View style={styles.typingContainer}>
          <Animated.View style={[styles.typingDot, { opacity: typingAnim }]} />
          <Animated.View style={[styles.typingDot, { opacity: typingAnim, marginLeft: 4 }]} />
          <Animated.View style={[styles.typingDot, { opacity: typingAnim, marginLeft: 4 }]} />
          <Text style={styles.typingText}>Shop is typing...</Text>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
        <View style={styles.inputContainer}>
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
            style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
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
  dateContainer: { alignItems: 'center', marginVertical: 12 },
  dateText: { fontSize: 12, color: COLORS.gray, backgroundColor: COLORS.background, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  messageRow: { marginBottom: 8, flexDirection: 'row' },
  messageRowMe: { justifyContent: 'flex-end' },
  messageBubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  bubbleOther: { backgroundColor: COLORS.white, borderBottomLeftRadius: 4, ...SHADOWS.small },
  bubbleMe: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  messageText: { fontSize: 15, color: COLORS.text, lineHeight: 20 },
  messageTextMe: { color: COLORS.white },
  messageTime: { fontSize: 10, color: COLORS.gray, marginTop: 4, alignSelf: 'flex-end' },
  messageTimeMe: { color: 'rgba(255,255,255,0.7)' },
  typingContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.gray },
  typingText: { fontSize: 12, color: COLORS.gray, marginLeft: 8 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 12, backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.border,
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
