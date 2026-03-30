/**
 * Push Notification Service for NearShop
 * Handles FCM registration, notification listeners, and deep linking
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import client, { buildAuthConfig } from './api';
import useAuthStore from '../store/authStore';

// Dynamic imports with fallbacks
let Notifications = null;
let Device = null;
let notificationsAvailable = false;

try {
  Notifications = require('expo-notifications');
  Device = require('expo-device');
  notificationsAvailable = true;
  
  // Configure notification behavior when app is foregrounded
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (e) {
  console.log('Push notifications not available:', e.message);
}

class PushNotificationService {
  constructor() {
    this.expoPushToken = null;
    this.notificationListener = null;
    this.responseListener = null;
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
      // Get push token
      const token = await this.registerForPushNotifications();
      
      if (token) {
        this.expoPushToken = token;
        // Register token with backend
        await this.registerTokenWithBackend(token);
      }

      // Set up notification listeners
      this.setupListeners();

      return token;
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
    
    let token;

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
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied');
      return null;
    }

    // Get Expo push token
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      })).data;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }

    // Configure Android channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7F77DD',
        sound: 'default',
      });

      // Order notifications channel
      await Notifications.setNotificationChannelAsync('orders', {
        name: 'Orders',
        description: 'Order updates and status changes',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1D9E75',
        sound: 'default',
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
        sound: 'default',
      });
    }

    return token;
  }

  /**
   * Register push token with backend
   */
  async registerTokenWithBackend(token) {
    try {
      const config = await buildAuthConfig();
      await client.post('/notifications/register-token', {
        fcm_token: token,
        device_type: Platform.OS,
        device_name: Device?.modelName || 'Unknown',
      }, config);
      console.log('Push token registered with backend');
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
    const { data } = notification.request.content;
    
    if (!data) return;

    const { type, reference_type, reference_id } = data;

    switch (type || reference_type) {
      // Order-related notifications
      case 'new_order':
      case 'order_confirmed':
      case 'order_ready':
      case 'order_delivered':
      case 'order_cancelled':
        if (reference_id) {
          router.push(`/(customer)/order-detail/${reference_id}`);
        } else {
          router.push('/(customer)/orders');
        }
        break;

      // Haggle notifications
      case 'haggle_offer':
      case 'haggle_counter_offer':
      case 'haggle_accepted':
      case 'haggle_rejected':
        if (reference_id) {
          router.push(`/(customer)/haggle?id=${reference_id}`);
        }
        break;

      // Deal notifications
      case 'deal_expiring':
      case 'price_drop':
        if (reference_id) {
          router.push(`/(customer)/product/${reference_id}`);
        } else {
          router.push('/(customer)/deals');
        }
        break;

      // Review notifications
      case 'new_review':
        router.push('/(business)/reviews');
        break;

      // Follower notifications
      case 'new_follower':
      case 'follow':
        router.push('/(business)/followers');
        break;

      // Message notifications
      case 'new_message':
      case 'chat':
        if (reference_id) {
          const activeRole = useAuthStore.getState()?.user?.active_role;
          const targetRole = data.target_role || activeRole || 'customer';
          if (targetRole === 'business') {
            router.push(`/(business)/chat/${reference_id}`);
          } else {
            router.push(`/(customer)/chat/${reference_id}`);
          }
        }
        break;

      // Reservation notifications
      case 'reservation_confirmed':
      case 'reservation_expiring':
        router.push('/(customer)/orders');
        break;

      // Loyalty notifications
      case 'coins_earned':
      case 'badge_earned':
        router.push('/(customer)/achievements');
        break;

      // Default: go to notifications screen
      default:
        router.push('/(customer)/notifications');
    }
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
    
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }

  /**
   * Unregister token from backend (call on logout)
   */
  async unregisterToken() {
    if (!this.expoPushToken) return;

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
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
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
