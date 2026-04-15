import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';

const OPTIONS = [
  {
    key: 'snap',
    title: 'Snap & List',
    subtitle: 'Take a photo and auto-fill product details with AI.',
    icon: 'camera-outline',
    accent: COLORS.primary,
    bg: '#F4F1FF',
  },
  {
    key: 'bulk',
    title: 'Spreadsheet Import',
    subtitle: 'Upload many products at once using Excel or CSV.',
    icon: 'document-text-outline',
    accent: COLORS.green,
    bg: '#ECF8F3',
  },
  {
    key: 'catalog',
    title: 'Shared Product Library',
    subtitle: 'Pick products from NearShop catalog and set your own prices.',
    icon: 'grid-outline',
    accent: COLORS.blue,
    bg: '#EDF5FC',
  },
];

export default function ProductAddOptionsPanel({
  title = 'Add Products Your Way',
  subtitle = 'Choose one option to start. You can use the others anytime.',
  onSnap,
  onBulk,
  onCatalog,
}) {
  const actionMap = {
    snap: onSnap,
    bulk: onBulk,
    catalog: onCatalog,
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {OPTIONS.map((option) => (
        <TouchableOpacity
          key={option.key}
          activeOpacity={0.86}
          onPress={actionMap[option.key]}
          style={[styles.card, { backgroundColor: option.bg, borderColor: option.accent }]}
        >
          <View style={[styles.iconWrap, { backgroundColor: option.accent }]}>
            <Ionicons name={option.icon} size={20} color={COLORS.white} />
          </View>

          <View style={styles.copyWrap}>
            <Text style={styles.cardTitle}>{option.title}</Text>
            <Text style={styles.cardSubtitle}>{option.subtitle}</Text>
          </View>

          <Ionicons name="chevron-forward" size={18} color={COLORS.gray400} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    gap: 10,
    ...SHADOWS.card,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.gray900,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.gray500,
    lineHeight: 18,
    marginBottom: 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.gray900,
    marginBottom: 1,
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.gray600,
    lineHeight: 17,
  },
});
