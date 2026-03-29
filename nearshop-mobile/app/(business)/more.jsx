import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import useMyShop from '../../hooks/useMyShop';
import useAuthStore from '../../store/authStore';
import { switchRole as apiSwitchRole } from '../../lib/auth';
import { COLORS, SHADOWS } from '../../constants/theme';

const SECTIONS = [
  {
    title: 'Operations',
    items: [
      { icon: 'receipt-outline', label: 'Billing', desc: 'Generate invoices & bills', screen: 'billing', color: '#1D9E75' },
      { icon: 'cube-outline', label: 'Inventory', desc: 'Stock levels & margins', screen: 'inventory', color: '#3B8BD4' },
      { icon: 'cash-outline', label: 'Expenses & P&L', desc: 'Track costs, see profit', screen: 'expenses', color: '#EF9F27' },
      { icon: 'document-text-outline', label: 'Daily Reports', desc: 'EOD summary & share', screen: 'reports', color: '#D85A30' },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { icon: 'pricetag-outline', label: 'Deals & Offers', desc: 'Create promotions', screen: 'deals', color: '#E24B4A' },
      { icon: 'logo-whatsapp', label: 'WhatsApp Studio', desc: 'Share catalogs & promos', screen: 'marketing', color: '#25D366' },
      { icon: 'megaphone-outline', label: 'Broadcasts', desc: 'Notify your customers', screen: 'broadcast', color: '#7F77DD' },
      { icon: 'calendar-outline', label: 'Festivals', desc: 'Seasonal promotions', screen: 'festivals', color: '#D4537E' },
      { icon: 'sparkles-outline', label: 'AI Advisor', desc: 'Smart suggestions', screen: 'advisor', color: '#534AB7' },
    ],
  },
  {
    title: 'Customers',
    items: [
      { icon: 'people-outline', label: 'Customers', desc: 'Order history & contacts', screen: 'customers', color: '#3B8BD4' },
      { icon: 'star-outline', label: 'Reviews', desc: 'Customer feedback', screen: 'reviews', color: '#EF9F27' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { icon: 'settings-outline', label: 'Shop Settings', desc: 'Hours, delivery, contact', screen: 'settings', color: '#6B7280' },
    ],
  },
];

export default function MoreScreen() {
  const { shop } = useMyShop();
  const { switchRole: storeSwitchRole, logout } = useAuthStore();

  const handleSwitchCustomer = async () => {
    try {
      const response = await apiSwitchRole('customer');
      // Tokens are automatically saved by auth.js switchRole function
      if (response?.data?.user) {
        await useAuthStore.getState().updateUser(response.data.user);
      } else {
        await storeSwitchRole('customer');
      }
    } catch (err) {
      // If role switch fails, still try to navigate but log the error
      console.warn('Role switch API failed:', err?.message);
      await storeSwitchRole('customer');
    }
    router.replace('/(customer)/home');
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>More</Text>
          <Text style={styles.headerSub}>{shop?.name || 'My Shop'}</Text>
        </View>

        {/* Feature sections */}
        {SECTIONS.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.card}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.screen}
                  style={[styles.menuRow, idx === section.items.length - 1 && styles.menuRowLast]}
                  onPress={() => router.push(`/(business)/${item.screen}`)}
                  activeOpacity={0.6}
                >
                  <View style={[styles.iconWrap, { backgroundColor: item.color + '15' }]}>
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>
                  <View style={styles.menuInfo}>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <Text style={styles.menuDesc}>{item.desc}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.gray300} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Account actions */}
        <View style={styles.section}>
          <View style={styles.card}>
            <TouchableOpacity style={styles.menuRow} onPress={handleSwitchCustomer} activeOpacity={0.6}>
              <View style={[styles.iconWrap, { backgroundColor: COLORS.primaryLight }]}>
                <Ionicons name="swap-horizontal" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.menuInfo}>
                <Text style={[styles.menuLabel, { color: COLORS.primary }]}>Switch to Customer</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuRow, styles.menuRowLast]} onPress={handleLogout} activeOpacity={0.6}>
              <View style={[styles.iconWrap, { backgroundColor: '#FCEBEB' }]}>
                <Ionicons name="log-out-outline" size={20} color={COLORS.red} />
              </View>
              <View style={styles.menuInfo}>
                <Text style={[styles.menuLabel, { color: COLORS.red }]}>Sign Out</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.version}>NearShop Business v1.0.0</Text>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 24 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.gray900 },
  headerSub: { fontSize: 13, color: COLORS.gray400, marginTop: 2 },
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: COLORS.gray400, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, paddingLeft: 4 },
  card: { backgroundColor: COLORS.white, borderRadius: 16, overflow: 'hidden', ...SHADOWS.card },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray100,
  },
  menuRowLast: { borderBottomWidth: 0 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  menuInfo: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: COLORS.gray800 },
  menuDesc: { fontSize: 12, color: COLORS.gray400, marginTop: 1 },
  version: { textAlign: 'center', fontSize: 12, color: COLORS.gray300, marginTop: 24 },
});
