import client from './client'
import { useAuthStore } from '../store/authStore'

function buildWsBase() {
  const baseUrl = client?.defaults?.baseURL || ''
  try {
    const parsed = new URL(baseUrl)
    const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${wsProtocol}//${parsed.host}`
  } catch {
    return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
  }
}

export const getConversations = (limit = 20, offset = 0, options = {}) => {
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  params.set('offset', String(offset))
  if (options.slaRiskLevel) params.set('sla_risk_level', options.slaRiskLevel)
  if (options.sortBy) params.set('sort_by', options.sortBy)
  return client.get(`/messaging/conversations?${params.toString()}`).then((res) => res.data)
}

export const startConversation = (shopId, productId = null, orderId = null, initialMessage = null) =>
  client.post('/messaging/conversations', {
    shop_id: shopId,
    product_id: productId,
    order_id: orderId,
    initial_message: initialMessage,
  }).then((res) => res.data)

export const startConversationAsBusiness = (customerId, options = {}) =>
  client.post('/messaging/conversations/business', {
    customer_id: customerId,
    shop_id: options.shopId || null,
    product_id: options.productId || null,
    order_id: options.orderId || null,
    initial_message: options.initialMessage || null,
  }).then((res) => res.data)

export const getConversation = (conversationId, options = {}) => {
  const params = new URLSearchParams()
  if (options.limit) params.set('limit', String(options.limit))
  if (options.beforeId) params.set('before_id', String(options.beforeId))
  const qs = params.toString()
  return client.get(`/messaging/conversations/${conversationId}${qs ? `?${qs}` : ''}`).then((res) => res.data)
}

export const sendMessage = (conversationId, content, messageType = 'text', attachments = null, metadata = null) =>
  client.post(`/messaging/conversations/${conversationId}/messages`, {
    content,
    message_type: messageType,
    attachments,
    metadata,
  }).then((res) => res.data)

export const assignConversation = (conversationId, assignedToUserId = null) =>
  client.post(`/messaging/conversations/${conversationId}/assign`, {
    assigned_to_user_id: assignedToUserId,
  }).then((res) => res.data)

export const markConversationRead = (conversationId) =>
  client.post(`/messaging/conversations/${conversationId}/read`).then((res) => res.data)

export const reactToMessage = (conversationId, messageId, emoji) =>
  client.post(`/messaging/conversations/${conversationId}/messages/${messageId}/reactions`, { emoji }).then((res) => res.data)

export const unreactToMessage = (conversationId, messageId, emoji) =>
  client.delete(`/messaging/conversations/${conversationId}/messages/${messageId}/reactions`, {
    params: { emoji },
  }).then((res) => res.data)

export const getConversationPresence = (conversationId) =>
  client.get(`/messaging/conversations/${conversationId}/presence`).then((res) => res.data)

export function createMessagingConnection(conversationId, handlers = {}) {
  const token = useAuthStore.getState().token
  if (!token) return null

  const wsUrl = `${buildWsBase()}/api/v1/messaging/ws/${conversationId}?token=${encodeURIComponent(token)}`
  const ws = new WebSocket(wsUrl)

  ws.onopen = () => handlers.onConnected?.()

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.type === 'new_message') handlers.onMessage?.(data.message)
      if (data.type === 'typing') handlers.onTyping?.(data.sender_role)
      if (data.type === 'read') handlers.onRead?.(data)
      if (data.type === 'message_reaction') handlers.onReaction?.(data.message)
      if (data.type === 'presence') handlers.onPresence?.(data)
      if (data.type === 'error') handlers.onError?.(data.message)
    } catch (error) {
      handlers.onError?.(error?.message || 'Failed to parse websocket message')
    }
  }

  ws.onerror = () => handlers.onError?.('Messaging connection error')
  ws.onclose = () => handlers.onDisconnected?.()

  return {
    send: (content, messageType = 'text') => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'message', content, message_type: messageType }))
      }
    },
    sendTyping: () => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'typing' }))
    },
    markRead: () => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'read' }))
    },
    close: () => ws.close(),
  }
}
