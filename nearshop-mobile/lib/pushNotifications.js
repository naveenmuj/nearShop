/**
 * Push Notification Service for NearShop
 * Handles FCM registration, notification listeners, and deep linking
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import client, { buildAuthConfig } from './api';
import useAuthStore from '../store/authStore';
import { initSound, isSoundEnabled } from './sound';

// Dynamic imports with fallbacks
let Notifications = null;
let Device = null;
let notificationsAvailable = false;

try {
  Notifications = require('expo-notifications');
  Device = require('expo-device');
  notificationsAvailable = true;
} catch (e) {
  console.log('Push notifications not available:', e.message);
}

class PushNotificationService {
  constructor() {
    this.pushToken = null;
    this.notificationListener = null;
    this.responseListener = null;
    this.playSound = true;
  }

  resolveNotificationRoute(notification) {
    const payload = notification?.request?.content?.data || {};
    const title = String(notification?.request?.content?.title || '').toLowerCase();
    const body = String(notification?.request?.content?.body || '').toLowerCase();

    const customRoute = payload.route || payload.pathname || payload.screen || payload.link || payload.deep_link;
    if (typeof customRoute === 'string' && customRoute.trim().startsWith('/')) {
      return customRoute.trim();
    }

    const { type, reference_type, reference_id } = payload;
    const normalizedType = type || reference_type;

    switch (normalizedType) {
      case 'new_order':
      case 'order_confirmed':
      case 'order_ready':
      case 'order_delivered':
      case 'order_cancelled':
        return reference_id ? `/(customer)/order-detail/${reference_id}` : '/(customer)/orders';

      case 'haggle_offer':
      case 'haggle_counter_offer':
      case 'haggle_accepted':
      case 'haggle_rejected':
        return reference_id ? `/(customer)/haggle?id=${reference_id}` : '/(customer)/haggle';

      case 'deal_expiring':
      case 'price_drop':
        return reference_id ? `/(customer)/product/${reference_id}` : '/(customer)/deals';

      case 'new_review':
        return '/(business)/reviews';

      case 'new_follower':
      case 'follow':
        return '/(business)/followers';

      case 'new_message':
      case 'chat': {
        if (reference_id) {
          const activeRole = useAuthStore.getState()?.user?.active_role;
          const targetRole = payload.target_role || activeRole || 'customer';
          return targetRole === 'business'
            ? `/(business)/chat/${reference_id}`
            : `/(customer)/chat/${reference_id}`;
        }
        return '/(customer)/messages';
      }

      case 'reservation_confirmed':
      case 'reservation_expiring':
        return '/(customer)/orders';

      case 'coins_earned':
      case 'badge_earned':
        return '/(customer)/achievements';

      default:
        break;
    }

    // Fallback heuristic based on title/body when backend payload is incomplete.
    const combined = `${title} ${body}`;
    if (combined.includes('order')) return '/(customer)/orders';
    if (combined.includes('deal') || combined.includes('offer') || combined.includes('price')) return '/(customer)/deals';
    if (combined.includes('message') || combined.includes('chat')) return '/(customer)/messages';
    return '/(customer)/notifications';
  }

  async syncSoundPreference() {
    try {
      await initSound();
      this.playSound = isSoundEnabled();
    } catch {
      this.playSound = true;
    }
  }

  /**
   * Initialize push notifications - call this on app startup
   */
  async initialize() {
    if (!notificationsAvailable) {
      console.log('Push notifications not available - skipping initialization');
      return null;
    }
    
    try {
      await this.syncSoundPreference();

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: this.playSound,
          shouldSetBadge: true,
        }),
      });

      // Get push token
      const tokenInfo = await this.registerForPushNotifications();
      
      if (tokenInfo?.token) {
        this.pushToken = tokenInfo.token;
        // Register token with backend
        await this.registerTokenWithBackend(tokenInfo.token, tokenInfo.provider);
      }

      // Set up notification listeners
      this.setupListeners();

      // Handle notification tap when app is opened from a killed state.
      if (typeof Notifications.getLastNotificationResponseAsync === 'function') {
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse?.notification) {
          this.handleNotificationTap(lastResponse.notification);
          if (typeof Notifications.clearLastNotificationResponseAsync === 'function') {
            await Notifications.clearLastNotificationResponseAsync();
          }
        }
      }

      return tokenInfo?.token || null;
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      return null;
    }
  }

  /**
   * Register for push notifications and get token
   */
  async registerForPushNotifications() {
    if (!notificationsAvailable || !Notifications || !Device) {
      return null;
    }
    
    let token = null;
    let provider = null;

    // Check if physical device (notifications don't work on simulator)
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: false,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied');
      return null;
    }

    // Prefer native token (FCM on Android) when available.
    try {
      if (typeof Notifications.getDevicePushTokenAsync === 'function') {
        const nativeTokenResponse = await Notifications.getDevicePushTokenAsync();
        const nativeType = String(nativeTokenResponse?.type || '').toLowerCase();
        const nativeToken = nativeTokenResponse?.data || null;
        if (nativeToken && nativeType === 'fcm') {
          token = nativeToken;
          provider = 'fcm';
        }
      }
    } catch (error) {
      console.warn('Could not get native push token, trying Expo token:', error?.message || error);
    }

    // Fallback to Expo token if native FCM token is unavailable.
    if (!token) {
      try {
        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId
          || Constants?.easConfig?.projectId
          || Constants?.manifest2?.extra?.expoClient?.extra?.eas?.projectId
          || Constants?.manifest?.extra?.eas?.projectId;

        const tokenResponse = projectId
          ? await Notifications.getExpoPushTokenAsync({ projectId })
          : await Notifications.getExpoPushTokenAsync();

        token = tokenResponse?.data || null;
        provider = token ? 'expo' : null;
      } catch (error) {
        console.error('Error getting push token:', error);
        return null;
      }
    }

    // Configure Android channel
    if (Platform.OS === 'android') {
      const selectedSound = this.playSound ? 'default' : null;
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7F77DD',
        sound: selectedSound,
      });

      // Order notifications channel
      await Notifications.setNotificationChannelAsync('orders', {
        name: 'Orders',
        description: 'Order updates and status changes',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1D9E75',
        sound: selectedSound,
      });

      // Deals and promotions channel
      await Notifications.setNotificationChannelAsync('deals', {
        name: 'Deals & Promotions',
        description: 'Special offers and deals',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#EF9F27',
      });

      // Messages channel
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        description: 'Chat messages and replies',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 100, 100, 100],
        lightColor: '#3B8BD4',
        sound: selectedSound,
      });
    }

    return token ? { token, provider } : null;
  }

  /**
   * Register push token with backend
   */
  async registerTokenWithBackend(token, provider = 'unknown') {
    try {
      const config = await buildAuthConfig();
      await client.post('/notifications/register-token', {
        fcm_token: token,
        device_type: `${Platform.OS}_${provider}`,
        device_name: Device?.modelName || 'Unknown',
      }, config);
      console.log(`Push token registered with backend (${provider})`);
    } catch (error) {
      console.error('Failed to register token with backend:', error);
    }
  }

  /**
   * Set up notification listeners
   */
  setupListeners() {
    if (!notificationsAvailable || !Notifications) return;
    
    // Listener for when a notification is received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
        this.handleForegroundNotification(notification);
      }
    );

    // Listener for when user taps on a notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('Notification tapped:', response);
        this.handleNotificationTap(response.notification);
      }
    );
  }

  /**
   * Handle notification received in foreground
   */
  handleForegroundNotification(notification) {
    const { data } = notification.request.content;
    
    // You can show an in-app alert or update UI here
    // The notification will also appear in the system tray based on handler config
    
    // Emit event for components to listen
    if (this.onForegroundNotification) {
      this.onForegroundNotification(notification);
    }
  }

  /**
   * Handle notification tap - deep link to appropriate screen
   */
  handleNotificationTap(notification) {
    const target = this.resolveNotificationRoute(notification);
    if (!target) return;
    router.push(target);
  }

  /**
   * Get the current badge count
   */
  async getBadgeCount() {
    if (!notificationsAvailable || !Notifications) return 0;
    return await Notifications.getBadgeCountAsync();
  }

  /**
   * Set badge count
   */
  async setBadgeCount(count) {
    if (!notificationsAvailable || !Notifications) return;
    await Notifications.setBadgeCountAsync(count);
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications() {
    if (!notificationsAvailable || !Notifications) return;
    await Notifications.dismissAllNotificationsAsync();
    await this.setBadgeCount(0);
  }

  /**
   * Cleanup listeners - call on logout or app unmount
   */
  cleanup() {
    if (!notificationsAvailable || !Notifications) return;
    
    const removeListener = (subscription) => {
      if (!subscription) return;
      if (typeof subscription.remove === 'function') {
        subscription.remove();
        return;
      }
      if (typeof Notifications.removeNotificationSubscription === 'function') {
        Notifications.removeNotificationSubscription(subscription);
      }
    };

    removeListener(this.notificationListener);
    removeListener(this.responseListener);
    this.notificationListener = null;
    this.responseListener = null;
  }

  /**
   * Unregister token from backend (call on logout)
   */
  async unregisterToken() {
    if (!this.pushToken) return;

    try {
      const config = await buildAuthConfig();
      await client.delete('/notifications/unregister-token', config);
      console.log('Push token unregistered from backend');
    } catch (error) {
      console.error('Failed to unregister token:', error);
    }
  }

  /**
   * Schedule a local notification (for testing or reminders)
   */
  async scheduleLocalNotification(title, body, data = {}, seconds = 1) {
    if (!notificationsAvailable || !Notifications) return;
    await this.syncSoundPreference();
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        channelId: Platform.OS === 'android' ? 'default' : undefined,
        sound: this.playSound ? 'default' : null,
      },
      trigger: { seconds },
    });
  }
}

// Export singleton instance
const pushService = new PushNotificationService();
export default pushService;

// Export individual functions for convenience
export const initializePushNotifications = () => pushService.initialize();
export const registerPushToken = () => pushService.registerForPushNotifications();
export const clearNotifications = () => pushService.clearAllNotifications();
export const setBadgeCount = (count) => pushService.setBadgeCount(count);
export const cleanupPushNotifications = () => pushService.cleanup();
export const unregisterPushToken = () => pushService.unregisterToken();
