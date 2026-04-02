import React, { useState } from 'react';
import { Image, View, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';

/**
 * SafeImage - Image component with loading and error states
 * 
 * @param {string} source - Image URI or source object
 * @param {object} style - Image style
 * @param {string} placeholderIcon - Ionicon name for error placeholder (default: 'image-outline')
 * @param {string} placeholderColor - Color for error icon (default: COLORS.gray400)
 * @param {boolean} showLoader - Show loading indicator (default: true)
 * @param {function} onLoad - Callback when image loads
 * @param {function} onError - Callback when image fails
 */
export default function SafeImage({ 
  source, 
  style, 
  placeholderIcon = 'image-outline',
  placeholderColor = COLORS.gray400,
  showLoader = true,
  onLoad,
  onError,
  ...props 
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleLoad = () => {
    setLoading(false);
    setError(false);
    onLoad?.();
  };

  const handleError = (e) => {
    setLoading(false);
    setError(true);
    onError?.(e);
  };

  // Extract size from style for placeholder
  const flatStyle = StyleSheet.flatten(style);
  const width = flatStyle?.width || 100;
  const height = flatStyle?.height || 100;
  const borderRadius = flatStyle?.borderRadius || 0;

  if (error) {
    return (
      <View style={[
        styles.placeholder, 
        { width, height, borderRadius, backgroundColor: COLORS.gray100 }
      ]}>
        <Ionicons 
          name={placeholderIcon} 
          size={Math.min(width, height) * 0.4} 
          color={placeholderColor} 
        />
      </View>
    );
  }

  return (
    <View style={[{ width, height, borderRadius }, style]}>
      <Image
        source={typeof source === 'string' ? { uri: source } : source}
        style={[style, { width, height }]}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
      {loading && showLoader && (
        <View style={[styles.loader, { width, height, borderRadius }]}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
  },
});
