/**
 * Messaging API - Direct chat with shops
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE, authGet, authPost } from './api';

const MESSAGE_QUEUE_KEY = '@nearshop:message_queue:v1';

function buildMessagingWsBase() {
  try {
    const parsed = new URL(API_BASE);
    const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${parsed.host}`;
  } catch {
    return 'ws://165.232.182.130';
  }
}

// Get all conversations
export async function getConversations(limit = 20, offset = 0) {
  const response = await authGet(`/messaging/conversations?limit=${limit}&offset=${offset}`);
  return response.data;
}

// Get or create conversation with a shop
export async function startConversation(shopId, productId = null, orderId = null, initialMessage = null) {
  const response = await authPost('/messaging/conversations', {
    shop_id: shopId,
    product_id: productId,
    order_id: orderId,
    initial_message: initialMessage,
  });
  return response.data;
}

// Get or create conversation as business with a customer
export async function startConversationAsBusiness(customerId, options = {}) {
  const response = await authPost('/messaging/conversations/business', {
    customer_id: customerId,
    shop_id: options.shopId || null,
    product_id: options.productId || null,
    order_id: options.orderId || null,
    initial_message: options.initialMessage || null,
  });
  return response.data;
}

// Get conversation with messages
export async function getConversation(conversationId, options = {}) {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.beforeId) params.set('before_id', String(options.beforeId));
  const qs = params.toString();
  const response = await authGet(`/messaging/conversations/${conversationId}${qs ? `?${qs}` : ''}`);
  return response.data;
}

// Send message
export async function sendMessage(conversationId, content, messageType = 'text', attachments = null) {
  const response = await authPost(`/messaging/conversations/${conversationId}/messages`, {
    content,
    message_type: messageType,
    attachments,
  });
  return response.data;
}

// Mark messages as read
export async function markConversationRead(conversationId) {
  const response = await authPost(`/messaging/conversations/${conversationId}/read`);
  return response.data;
}

// Get message templates (for business)
export async function getMessageTemplates() {
  const response = await authGet('/messaging/templates');
  return response.data;
}

// Create message template
export async function createTemplate(title, content, category = 'general') {
  const response = await authPost('/messaging/templates', { title, content, category });
  return response.data;
}

async function readQueue() {
  try {
    const raw = await AsyncStorage.getItem(MESSAGE_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(items) {
  await AsyncStorage.setItem(MESSAGE_QUEUE_KEY, JSON.stringify(items));
}

export async function queueMessage(conversationId, payload) {
  const queue = await readQueue();
  const item = {
    local_id: payload.local_id,
    conversation_id: String(conversationId),
    content: payload.content || '',
    message_type: payload.message_type || 'text',
    attachments: payload.attachments || null,
    created_at: payload.created_at || new Date().toISOString(),
    sender_role: payload.sender_role,
  };
  await writeQueue([...queue, item]);
  return item;
}

export async function getQueuedConversationMessages(conversationId) {
  const queue = await readQueue();
  return queue.filter((item) => String(item.conversation_id) === String(conversationId));
}

export async function removeQueuedMessage(localId) {
  const queue = await readQueue();
  await writeQueue(queue.filter((item) => item.local_id !== localId));
}

export async function flushQueuedMessages(conversationId, onSent) {
  const queued = await getQueuedConversationMessages(conversationId);
  for (const item of queued) {
    try {
      const sent = await sendMessage(item.conversation_id, item.content, item.message_type, item.attachments);
      await removeQueuedMessage(item.local_id);
      onSent?.(item.local_id, sent);
    } catch {
      // Keep unsent messages in queue and stop on first failure.
      break;
    }
  }
}

// WebSocket connection for real-time messaging
export function createMessagingConnection(conversationId, token, handlers) {
  const wsBase = buildMessagingWsBase();
  const wsUrl = `${wsBase}/api/v1/messaging/ws/${conversationId}?token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('[Messaging] Connected');
    handlers.onConnected?.();
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'connected':
          handlers.onConnected?.(data);
          break;
        case 'new_message':
          handlers.onMessage?.(data.message);
          break;
        case 'typing':
          handlers.onTyping?.(data.sender_role);
          break;
        case 'read':
          handlers.onRead?.(data.by);
          break;
        case 'error':
          handlers.onError?.(data.message);
          break;
      }
    } catch (e) {
      console.error('[Messaging] Parse error:', e);
    }
  };
  
  ws.onerror = (error) => {
    console.error('[Messaging] WebSocket error:', error);
    handlers.onError?.('Connection error');
  };
  
  ws.onclose = () => {
    console.log('[Messaging] Disconnected');
    handlers.onDisconnected?.();
  };
  
  return {
    send: (content, messageType = 'text') => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'message', content, message_type: messageType }));
      }
    },
    sendTyping: () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'typing' }));
      }
    },
    markRead: () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'read' }));
      }
    },
    close: () => ws.close(),
  };
}
