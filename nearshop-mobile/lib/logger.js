/**
 * Development-only logging utility
 * 
 * Automatically wraps all console statements in __DEV__ checks
 * to prevent logging in production builds
 */

const logger = {
  /**
   * Log debug information (only in development)
   * @param {...any} args - Arguments to log
   */
  log: (...args) => {
    if (__DEV__) {
      console.log(...args);
    }
  },

  /**
   * Log warning information (only in development)
   * @param {...any} args - Arguments to log
   */
  warn: (...args) => {
    if (__DEV__) {
      console.warn(...args);
    }
  },

  /**
   * Log error information (only in development)
   * @param {...any} args - Arguments to log
   */
  error: (...args) => {
    if (__DEV__) {
      console.error(...args);
    }
  },

  /**
   * Log debug information with group (only in development)
   * @param {string} label - Group label
   * @param {...any} args - Arguments to log
   */
  group: (label, ...args) => {
    if (__DEV__) {
      console.group(label);
      console.log(...args);
      console.groupEnd();
    }
  },

  /**
   * Log table data (only in development)
   * @param {any} data - Data to display in table format
   */
  table: (data) => {
    if (__DEV__) {
      console.table(data);
    }
  },
};

export default logger;
