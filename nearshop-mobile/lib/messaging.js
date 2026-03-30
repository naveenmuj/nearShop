/**
 * Messaging API - Direct chat with shops
 */
import { authGet, authPost } from './api';

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

// Get conversation with messages
export async function getConversation(conversationId) {
  const response = await authGet(`/messaging/conversations/${conversationId}`);
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

// WebSocket connection for real-time messaging
export function createMessagingConnection(conversationId, token, handlers) {
  const wsUrl = `ws://165.232.182.130/api/v1/messaging/ws/${conversationId}?token=${token}`;
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
      ws.send(JSON.stringify({ type: 'message', content, message_type: messageType }));
    },
    sendTyping: () => {
      ws.send(JSON.stringify({ type: 'typing' }));
    },
    markRead: () => {
      ws.send(JSON.stringify({ type: 'read' }));
    },
    close: () => ws.close(),
  };
}
