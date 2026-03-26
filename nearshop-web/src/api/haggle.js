import client from './client'

// REST APIs
export const startHaggle = (data) => client.post('/haggle/start', data)
export const sendOffer = (id, data) => client.post(`/haggle/${id}/offer`, data)
export const acceptHaggle = (id) => client.post(`/haggle/${id}/accept`)
export const rejectHaggle = (id) => client.post(`/haggle/${id}/reject`)
export const getMyHaggles = () => client.get('/haggle/my')
export const getShopHaggles = (shopId) => client.get(`/haggle/shop/${shopId}`)

// ═══════════════════════════════════════════════════════════════════════════════
// WEBSOCKET FOR REAL-TIME HAGGLE CHAT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a WebSocket connection for real-time haggle communication.
 * @param {string} sessionId - The haggle session ID
 * @param {string} token - JWT auth token
 * @param {Object} handlers - Event handlers
 * @returns {Object} - Connection object with send and close methods
 */
export const createHaggleConnection = (sessionId, token, handlers = {}) => {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsHost = import.meta.env.VITE_API_URL?.replace(/^https?:\/\//, '') || window.location.host
  const wsUrl = `${wsProtocol}//${wsHost}/api/v1/haggle/ws/${sessionId}?token=${token}`
  
  const ws = new WebSocket(wsUrl)
  
  ws.onopen = () => {
    console.log('Haggle WebSocket connected')
    handlers.onConnect?.()
  }
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      
      switch (data.type) {
        case 'connected':
          handlers.onConnected?.(data)
          break
        case 'offer':
          handlers.onOffer?.(data)
          break
        case 'accepted':
          handlers.onAccepted?.(data)
          break
        case 'rejected':
          handlers.onRejected?.(data)
          break
        case 'typing':
          handlers.onTyping?.(data)
          break
        case 'message':
          handlers.onMessage?.(data)
          break
        case 'error':
          handlers.onError?.(data.message)
          break
        default:
          console.log('Unknown message type:', data)
      }
    } catch (e) {
      console.error('Error parsing WebSocket message:', e)
    }
  }
  
  ws.onclose = (event) => {
    console.log('Haggle WebSocket closed:', event.code, event.reason)
    handlers.onDisconnect?.(event)
  }
  
  ws.onerror = (error) => {
    console.error('Haggle WebSocket error:', error)
    handlers.onError?.('Connection error')
  }
  
  return {
    // Send an offer
    sendOffer: (amount, message = '') => {
      ws.send(JSON.stringify({ type: 'offer', amount, message }))
    },
    
    // Accept current offer
    accept: () => {
      ws.send(JSON.stringify({ type: 'accept' }))
    },
    
    // Reject haggle
    reject: () => {
      ws.send(JSON.stringify({ type: 'reject' }))
    },
    
    // Send typing indicator
    sendTyping: () => {
      ws.send(JSON.stringify({ type: 'typing' }))
    },
    
    // Send chat message
    sendMessage: (text) => {
      ws.send(JSON.stringify({ type: 'message', text }))
    },
    
    // Close connection
    close: () => {
      ws.close()
    },
    
    // Get WebSocket state
    getState: () => ws.readyState,
  }
}
