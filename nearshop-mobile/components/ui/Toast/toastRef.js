/**
 * Global toast reference — allows calling toast from anywhere,
 * even outside React component tree (e.g. in API interceptors).
 *
 * Usage:
 *   import { toast } from '../components/ui/Toast/toastRef'
 *   toast.show({ type: 'error', text1: 'Oops', text2: 'Something went wrong' })
 */

let _showToast = null;

export const setToastRef = (fn) => {
  _showToast = fn;
};

export const toast = {
  /**
   * Compatible with react-native-toast-message API:
   *   toast.show({ type: 'error', text1: 'Title', text2: 'Subtitle' })
   */
  show: ({ type = 'info', text1, text2 } = {}) => {
    const message = [text1, text2].filter(Boolean).join(' — ');
    if (_showToast) {
      _showToast({ type, message });
    }
  },
  success: (message) => _showToast?.({ type: 'success', message }),
  error: (message) => _showToast?.({ type: 'error', message }),
  info: (message) => _showToast?.({ type: 'info', message }),
  warning: (message) => _showToast?.({ type: 'warning', message }),
  coins: (message, coins) => _showToast?.({ type: 'coins', message, coins }),
  order: (message) => _showToast?.({ type: 'order', message }),
  cart: (message) => _showToast?.({ type: 'cart', message }),
};
