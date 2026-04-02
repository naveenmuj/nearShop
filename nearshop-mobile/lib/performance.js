/**
 * Performance monitoring utilities for React Native
 * 
 * Tracks component render times, API latency, and memory usage
 */

import { useEffect, useRef } from 'react';
import logger from './logger';

/**
 * Track component performance
 * Logs warning if component takes > threshold ms to mount/unmount
 * 
 * @param {string} componentName - Name of the component
 * @param {number} threshold - Warning threshold in ms (default: 1000)
 * 
 * @example
 * function MyComponent() {
 *   usePerformanceMonitor('MyComponent', 500);
 *   return <View>...</View>;
 * }
 */
export const usePerformanceMonitor = (componentName, threshold = 1000) => {
  const mountTime = useRef(Date.now());

  useEffect(() => {
    const renderTime = Date.now() - mountTime.current;
    
    if (renderTime > threshold) {
      logger.warn(`⚠️ Performance: ${componentName} took ${renderTime}ms to render (threshold: ${threshold}ms)`);
    } else if (renderTime > threshold / 2) {
      logger.log(`📊 Performance: ${componentName} rendered in ${renderTime}ms`);
    }

    // Track unmount time
    return () => {
      const unmountTime = Date.now() - mountTime.current;
      if (unmountTime > threshold * 2) {
        logger.warn(`⚠️ Performance: ${componentName} was mounted for ${unmountTime}ms (possible memory leak?)`);
      }
    };
  }, [componentName, threshold]);
};

/**
 * Measure async operation performance
 * 
 * @param {string} operationName - Name of the operation
 * @param {Function} operation - Async function to measure
 * @returns {Promise<any>} - Result of the operation
 * 
 * @example
 * const products = await measureAsync('Load Products', async () => {
 *   return await getProducts();
 * });
 */
export const measureAsync = async (operationName, operation) => {
  const startTime = Date.now();
  
  try {
    const result = await operation();
    const duration = Date.now() - startTime;
    
    if (duration > 3000) {
      logger.warn(`⚠️ Slow API: ${operationName} took ${duration}ms`);
    } else {
      logger.log(`⏱️ API: ${operationName} completed in ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`❌ API Error: ${operationName} failed after ${duration}ms:`, error.message);
    throw error;
  }
};

/**
 * Create performance-aware API interceptor
 * Logs slow API calls automatically
 * 
 * @param {number} slowThreshold - Threshold in ms to consider API call slow (default: 2000)
 * @returns {Object} - Interceptor config for axios
 * 
 * @example
 * import { createPerformanceInterceptor } from './lib/performance';
 * 
 * client.interceptors.request.use(createPerformanceInterceptor().request);
 * client.interceptors.response.use(createPerformanceInterceptor().response);
 */
export const createPerformanceInterceptor = (slowThreshold = 2000) => {
  return {
    request: (config) => {
      config.metadata = { startTime: Date.now() };
      return config;
    },
    
    response: (response) => {
      if (response.config.metadata) {
        const duration = Date.now() - response.config.metadata.startTime;
        const endpoint = `${response.config.method?.toUpperCase()} ${response.config.url}`;
        
        if (duration > slowThreshold) {
          logger.warn(`🐌 Slow API: ${endpoint} took ${duration}ms`);
        } else if (duration > slowThreshold / 2) {
          logger.log(`⏱️ API: ${endpoint} took ${duration}ms`);
        }
      }
      
      return response;
    },
    
    error: (error) => {
      if (error.config?.metadata) {
        const duration = Date.now() - error.config.metadata.startTime;
        const endpoint = `${error.config.method?.toUpperCase()} ${error.config.url}`;
        logger.error(`❌ API Failed: ${endpoint} after ${duration}ms:`, error.message);
      }
      
      return Promise.reject(error);
    },
  };
};

/**
 * Log memory warning if usage is high
 * (Only works in development with Hermes engine)
 */
export const checkMemoryUsage = () => {
  if (__DEV__ && global.HermesInternal) {
    try {
      const memoryInfo = global.HermesInternal.getInstrumentedStats();
      const usedMB = (memoryInfo.js_allocatedBytes / (1024 * 1024)).toFixed(2);
      
      if (usedMB > 50) {
        logger.warn(`⚠️ Memory: ${usedMB}MB allocated (high usage)`);
      } else {
        logger.log(`💾 Memory: ${usedMB}MB allocated`);
      }
    } catch (e) {
      logger.error('Failed to check memory:', e);
    }
  }
};

/**
 * FlatList optimization config
 * Returns optimized props for FlatList to improve scroll performance
 * 
 * @param {number} itemHeight - Estimated height of each item
 * @returns {Object} - FlatList props
 * 
 * @example
 * <FlatList
 *   data={items}
 *   {...getFlatListOptimizations(100)}
 *   renderItem={renderItem}
 * />
 */
export const getFlatListOptimizations = (itemHeight = 100) => {
  return {
    removeClippedSubviews: true,
    maxToRenderPerBatch: 10,
    updateCellsBatchingPeriod: 50,
    initialNumToRender: 10,
    windowSize: 10,
    getItemLayout: (data, index) => ({
      length: itemHeight,
      offset: itemHeight * index,
      index,
    }),
  };
};
