import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, StatusBar, BackHandler, Linking, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import client from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import useMyShop from '../../hooks/useMyShop';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';

const PRIORITY_COLORS = {
  high: { bg: COLORS.redLight, text: COLORS.red, border: COLORS.red },
  medium: { bg: COLORS.amberLight, text: COLORS.amber, border: COLORS.amber },
  low: { bg: COLORS.greenLight, text: COLORS.green, border: COLORS.green },
};

const QUICK_QUESTIONS = [
  '💡 How can I get more customers?',
  '📈 How to increase my revenue?',
  '🎯 Which products should I promote?',
  '🏷️ Should I create any deals right now?',
  '📱 How to use NearShop features better?',
  '🎪 Any festival-related suggestions?',
];

const ACTION_ROUTES = {
  discount_or_remove: '/(business)/catalog',
  reduce_price: '/(business)/catalog',
  create_deal: '/(business)/deals',
  request_reviews: '/(business)/marketing',
  add_product: '/(business)/snap-list',
  share_shop: '/(business)/marketing',
};

export default function AdvisorScreen() {
  const { shopId, shop } = useMyShop();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('suggestions');
  const scrollRef = useRef(null);

  useEffect(() => { const h = BackHandler.addEventListener('hardwareBackPress', () => { router.navigate('/(business)/more'); return true; }); return () => h.remove(); }, []);

  const loadSuggestions = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await client.get('/advisor/suggestions');
      setSuggestions(res.data?.suggestions ?? res.data ?? []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSuggestions(); }, [loadSuggestions]);

  const handleAction = (suggestion) => {
    const route = ACTION_ROUTES[suggestion.action] || suggestion.action_route;
    if (route) router.push(route);
    else if (suggestion.action_url) Linking.openURL(suggestion.action_url).catch(() => {});
  };

  const sendChat = async (question) => {
    const q = question || chatInput.trim();
    if (!q) return;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: q }]);
    setChatLoading(true);

    try {
      const res = await client.post('/advisor/chat', { question: q });
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        text: res.data?.answer || 'I couldn\'t generate advice right now.',
        fallback: res.data?.fallback,
        retryable: res.data?.retryable,
      }]);
    } catch (err) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Sorry, I couldn\'t process your question. Please try again.',
        error: true,
      }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.navigate('/(business)/more')}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>🤖 AI Advisor</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Tab Pills */}
      <View style={s.tabRow}>
        {[
          { key: 'suggestions', label: '💡 Suggestions', count: suggestions.length },
          { key: 'chat', label: '💬 Ask AI' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[s.tabPill, activeTab === tab.key && s.tabPillActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>
              {tab.label}{tab.count > 0 ? ` (${tab.count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Suggestions Tab */}
      {activeTab === 'suggestions' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
          {loading ? (
            <View style={s.centerWrap}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={s.loadingText}>Analyzing your shop data...</Text>
            </View>
          ) : error ? (
            <View style={s.centerWrap}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>🤖</Text>
              <Text style={s.errorText}>{error}</Text>
              <TouchableOpacity onPress={loadSuggestions} style={s.retryBtn}>
                <Text style={s.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : suggestions.length === 0 ? (
            <View style={s.centerWrap}>
              <Text style={{ fontSize: 56, marginBottom: 12 }}>🎉</Text>
              <Text style={s.emptyTitle}>All clear!</Text>
              <Text style={s.emptySub}>No suggestions right now. Your shop is looking great!</Text>
              <TouchableOpacity style={s.chatPromptBtn} onPress={() => setActiveTab('chat')}>
                <Text style={s.chatPromptText}>💬 Ask AI for growth tips</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Summary Banner */}
              <View style={s.summaryBanner}>
                <Text style={s.summaryIcon}>🧠</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.summaryTitle}>
                    {suggestions.filter(s => s.priority === 'high').length} high priority actions
                  </Text>
                  <Text style={s.summarySub}>Based on your shop data analysis</Text>
                </View>
              </View>

              {suggestions.map((sg, i) => {
                const priority = (sg.priority || 'low').toLowerCase();
                const colors = PRIORITY_COLORS[priority] || PRIORITY_COLORS.low;
                return (
                  <View key={sg.id || i} style={[s.card, { borderLeftWidth: 4, borderLeftColor: colors.border }]}>
                    <View style={s.cardHeader}>
                      <Text style={s.cardIcon}>{sg.icon || '💡'}</Text>
                      <View style={[s.priBadge, { backgroundColor: colors.bg }]}>
                        <Text style={[s.priText, { color: colors.text }]}>{priority.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={s.cardTitle}>{sg.title}</Text>
                    <Text style={s.cardDesc}>{sg.body || sg.description}</Text>
                    {sg.impact && <Text style={s.cardImpact}>📊 Impact: {sg.impact}</Text>}
                    {sg.action && (
                      <TouchableOpacity onPress={() => handleAction(sg)} style={[s.actionBtn, { backgroundColor: colors.bg }]}>
                        <Text style={[s.actionText, { color: colors.text }]}>Take Action →</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </>
          )}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.chatContent}
          >
            {/* Welcome */}
            {chatMessages.length === 0 && (
              <View style={s.chatWelcome}>
                <Text style={{ fontSize: 48, marginBottom: 12 }}>🤖</Text>
                <Text style={s.chatWelcomeTitle}>Hi, {shop?.name || 'there'}!</Text>
                <Text style={s.chatWelcomeSub}>
                  I'm your AI business advisor. Ask me anything about growing your shop, pricing, marketing, or attracting customers.
                </Text>

                <Text style={s.quickLabel}>QUICK QUESTIONS</Text>
                {QUICK_QUESTIONS.map((q, i) => (
                  <TouchableOpacity key={i} style={s.quickBtn} onPress={() => sendChat(q)}>
                    <Text style={s.quickBtnText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Messages */}
            {chatMessages.map((msg, i) => (
              <View key={i} style={[s.chatBubble, msg.role === 'user' ? s.userBubble : s.aiBubble]}>
                {msg.role === 'assistant' && <Text style={s.aiAvatar}>🤖</Text>}
                <View style={[s.bubbleContent, msg.role === 'user' ? s.userContent : s.aiContent]}>
                  {msg.role === 'assistant' && msg.fallback && (
                    <Text style={s.fallbackBadge}>
                      {msg.retryable ? 'Live AI temporarily unavailable' : 'Using offline shop insights'}
                    </Text>
                  )}
                  <Text style={[s.bubbleText, msg.role === 'user' ? s.userText : s.aiText]}>{msg.text}</Text>
                </View>
              </View>
            ))}

            {chatLoading && (
              <View style={[s.chatBubble, s.aiBubble]}>
                <Text style={s.aiAvatar}>🤖</Text>
                <View style={[s.bubbleContent, s.aiContent]}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={s.typingText}>Thinking...</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Chat Input */}
          <View style={s.chatInputRow}>
            <TextInput
              style={s.chatInput}
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="Ask me anything about your shop..."
              placeholderTextColor={COLORS.gray400}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={() => sendChat()}
            />
            <TouchableOpacity
              style={[s.sendBtn, (!chatInput.trim() || chatLoading) && s.sendBtnDisabled]}
              onPress={() => sendChat()}
              disabled={!chatInput.trim() || chatLoading}
            >
              <Text style={s.sendBtnText}>→</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  back: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.gray900 },
  content: { padding: 16, paddingBottom: 40 },

  // Tabs
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  tabPill: { flex: 1, paddingVertical: 8, borderRadius: 12, backgroundColor: COLORS.gray100, alignItems: 'center' },
  tabPillActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.gray500 },
  tabTextActive: { color: COLORS.white },

  // States
  centerWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  loadingText: { fontSize: 14, color: COLORS.gray400, marginTop: 12 },
  errorText: { fontSize: 15, color: COLORS.red, textAlign: 'center', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.primaryLight },
  retryText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.gray800, marginBottom: 6 },
  emptySub: { fontSize: 14, color: COLORS.gray400, textAlign: 'center', marginBottom: 20 },
  chatPromptBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  chatPromptText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Summary
  summaryBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.primary, borderRadius: 16, padding: 16, marginBottom: 16 },
  summaryIcon: { fontSize: 28 },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  summarySub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  // Cards
  card: { backgroundColor: COLORS.white, borderRadius: 14, padding: 16, marginBottom: 12, ...SHADOWS.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardIcon: { fontSize: 24 },
  priBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  priText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.gray900, marginBottom: 4 },
  cardDesc: { fontSize: 13, color: COLORS.gray600, lineHeight: 19, marginBottom: 8 },
  cardImpact: { fontSize: 12, fontWeight: '600', color: COLORS.green, marginBottom: 10 },
  actionBtn: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  actionText: { fontSize: 13, fontWeight: '700' },

  // Chat
  chatContent: { padding: 16, paddingBottom: 20 },
  chatWelcome: { alignItems: 'center', paddingTop: 20 },
  chatWelcomeTitle: { fontSize: 22, fontWeight: '800', color: COLORS.gray900, marginBottom: 6 },
  chatWelcomeSub: { fontSize: 14, color: COLORS.gray500, textAlign: 'center', lineHeight: 20, marginBottom: 24, maxWidth: 300 },
  quickLabel: { fontSize: 11, fontWeight: '700', color: COLORS.gray400, letterSpacing: 0.8, marginBottom: 10, alignSelf: 'flex-start' },
  quickBtn: { width: '100%', backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.gray200 },
  quickBtnText: { fontSize: 14, color: COLORS.gray700, fontWeight: '500' },

  chatBubble: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  userBubble: { justifyContent: 'flex-end' },
  aiBubble: { justifyContent: 'flex-start' },
  aiAvatar: { fontSize: 20, marginTop: 4 },
  bubbleContent: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  userContent: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4, marginLeft: 'auto' },
  aiContent: { backgroundColor: COLORS.white, borderBottomLeftRadius: 4, ...SHADOWS.card, borderWidth: 1, borderColor: COLORS.gray100 },
  fallbackBadge: { fontSize: 11, fontWeight: '700', color: COLORS.amber, marginBottom: 6 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  userText: { color: '#fff' },
  aiText: { color: COLORS.gray800 },
  typingText: { fontSize: 13, color: COLORS.gray400, marginLeft: 8 },

  chatInputRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  chatInput: { flex: 1, backgroundColor: COLORS.gray50, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: COLORS.gray900, maxHeight: 80, borderWidth: 1, borderColor: COLORS.gray200 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: COLORS.gray300 },
  sendBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
