import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SHADOWS } from '../constants/theme';

export default function LocationFallbackBanner({
  visible,
  title = 'Location permission is disabled',
  message = 'Location-based accuracy may be reduced. Please refresh location for better nearby results.',
  actionLabel = 'Retry precise location',
  onRetry,
  children = null,
}) {
  if (!visible) return null;

  return (
    <View style={[styles.card, SHADOWS.card]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {children}
      {onRetry ? (
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
          <Text style={styles.retryBtnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#FBBF24',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  title: {
    color: '#92400E',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 6,
  },
  message: {
    color: '#78350F',
    fontSize: 12,
    lineHeight: 17,
  },
  retryBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.warning,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 12,
  },
});
