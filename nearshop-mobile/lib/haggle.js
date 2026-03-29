import { authGet, authPost } from './api';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// REST APIs - all require auth
export const startHaggle = (data) => authPost('/haggle/start', data);
export const sendOffer = (id, data) => authPost(`/haggle/${id}/offer`, data);
export const acceptHaggle = (id) => authPost(`/haggle/${id}/accept`);
export const rejectHaggle = (id) => authPost(`/haggle/${id}/reject`);
export const getMyHaggles = () => authGet('/haggle/my');
export const getShopHaggles = (shopId) => authGet(`/haggle/shop/${shopId}`);

// ═══════════════════════════════════════════════════════════════════════════════
// WEBSOCKET FOR REAL-TIME HAGGLE CHAT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a WebSocket connection for real-time haggle communication.
 * @param {string} sessionId - The haggle session ID
 * @param {Object} handlers - Event handlers
 * @returns {Promise<Object>} - Connection object with send and close methods
 */
export const createHaggleConnection = async (sessionId, handlers = {}) => {
  // Get token from SecureStore (consistent with the rest of the app)
  const token = await SecureStore.getItemAsync('access_token');
  if (!token) {
    throw new Error('No auth token found');
  }
  
  const apiUrl = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:8000';
  const wsUrl = apiUrl.replace(/^http/, 'ws') + `/api/v1/haggle/ws/${sessionId}?token=${token}`;
  
  const ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('Haggle WebSocket connected');
    handlers.onConnect?.();
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'connected':
          handlers.onConnected?.(data);
          break;
        case 'offer':
          handlers.onOffer?.(data);
          break;
        case 'accepted':
          handlers.onAccepted?.(data);
          break;
        case 'rejected':
          handlers.onRejected?.(data);
          break;
        case 'typing':
          handlers.onTyping?.(data);
          break;
        case 'message':
          handlers.onMessage?.(data);
          break;
        case 'error':
          handlers.onError?.(data.message);
          break;
        default:
          console.log('Unknown message type:', data);
      }
    } catch (e) {
      console.error('Error parsing WebSocket message:', e);
    }
  };
  
  ws.onclose = (event) => {
    console.log('Haggle WebSocket closed:', event.code, event.reason);
    handlers.onDisconnect?.(event);
  };
  
  ws.onerror = (error) => {
    console.error('Haggle WebSocket error:', error);
    handlers.onError?.('Connection error');
  };
  
  return {
    // Send an offer
    sendOffer: (amount, message = '') => {
      ws.send(JSON.stringify({ type: 'offer', amount, message }));
    },
    
    // Accept current offer
    accept: () => {
      ws.send(JSON.stringify({ type: 'accept' }));
    },
    
    // Reject haggle
    reject: () => {
      ws.send(JSON.stringify({ type: 'reject' }));
    },
    
    // Send typing indicator
    sendTyping: () => {
      ws.send(JSON.stringify({ type: 'typing' }));
    },
    
    // Send chat message
    sendMessage: (text) => {
      ws.send(JSON.stringify({ type: 'message', text }));
    },
    
    // Close connection
    close: () => {
      ws.close();
    },
    
    // Get WebSocket state
    getState: () => ws.readyState,
  };
};
