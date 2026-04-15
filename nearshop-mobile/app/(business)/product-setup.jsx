import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import ProductAddOptionsPanel from '../../components/ProductAddOptionsPanel';
import { COLORS } from '../../constants/theme';

export default function ProductSetupScreen() {
  const { source } = useLocalSearchParams();
  const fromOnboarding = source === 'onboarding';

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.gray800} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Choose How To Add Products</Text>
          <Text style={styles.sub}>Start with one method. You can always add products in multiple ways.</Text>
        </View>
      </View>

      {fromOnboarding ? (
        <View style={styles.tipBar}>
          <Ionicons name="sparkles-outline" size={16} color={COLORS.primary} />
          <Text style={styles.tipText}>Your shop is ready. Add products to go live faster.</Text>
        </View>
      ) : null}

      <ProductAddOptionsPanel
        title="What works best for you today?"
        subtitle="Designed for quick setup for every shop owner."
        onSnap={() => router.push('/(business)/snap-list')}
        onBulk={() => router.push('/(business)/bulk-upload')}
        onCatalog={() => router.push('/(business)/catalog-browser')}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.replace('/(business)/dashboard')}
        >
          <Text style={styles.secondaryText}>Do this later</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.gray900,
  },
  sub: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.gray500,
  },
  tipBar: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
  },
  footer: {
    marginTop: 'auto',
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  secondaryBtn: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: COLORS.gray700,
    fontSize: 14,
    fontWeight: '700',
  },
});
