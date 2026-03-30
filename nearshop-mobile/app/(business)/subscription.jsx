/**
 * Subscription Screen - Manage business subscription
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, SHADOWS } from '../../constants/theme';

// Dynamic import with fallback for LinearGradient
let LinearGradient;
try {
  LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch (e) {
  LinearGradient = ({ colors, style, children, ...props }) => (
    <View style={[style, { backgroundColor: colors?.[0] || '#7C3AED' }]} {...props}>
      {children}
    </View>
  );
}
import { getMySubscription, getSubscriptionTiers, getSubscriptionUsage, upgradeSubscription } from '../../lib/subscriptions';
import { toast } from '../../components/ui/Toast/toastRef';

const TIER_GRADIENTS = {
  free: ['#9CA3AF', '#6B7280'],
  pro: ['#3B82F6', '#2563EB'],
  business: ['#8B5CF6', '#7C3AED'],
};

const TIER_ICONS = {
  free: 'leaf-outline',
  pro: 'rocket-outline',
  business: 'diamond-outline',
};

export default function SubscriptionScreen() {
  const [subscription, setSubscription] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [subData, tiersData, usageData] = await Promise.all([
        getMySubscription(),
        getSubscriptionTiers(),
        getSubscriptionUsage(),
      ]);
      setSubscription(subData);
      setTiers(tiersData);
      setUsage(usageData);
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpgrade = async (tier, cycle = 'monthly') => {
    setUpgrading(tier);
    try {
      await upgradeSubscription(tier, cycle);
      toast.show(`Upgraded to ${tier.toUpperCase()}!`, 'success');
      loadData();
    } catch (error) {
      toast.show(error.response?.data?.detail || 'Upgrade failed', 'error');
    } finally {
      setUpgrading(null);
    }
  };

  const formatLimit = (limit) => limit === -1 ? 'Unlimited' : limit.toString();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Subscription</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Current Plan */}
        {subscription && (
          <LinearGradient
            colors={TIER_GRADIENTS[subscription.tier] || TIER_GRADIENTS.free}
            style={styles.currentPlan}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.currentPlanHeader}>
              <Ionicons name={TIER_ICONS[subscription.tier]} size={32} color="white" />
              <View style={styles.currentPlanInfo}>
                <Text style={styles.currentPlanLabel}>Current Plan</Text>
                <Text style={styles.currentPlanName}>{subscription.tier_name}</Text>
              </View>
              {subscription.tier !== 'free' && (
                <View style={styles.priceTag}>
                  <Text style={styles.priceAmount}>₹{subscription.price}</Text>
                  <Text style={styles.priceCycle}>/{subscription.billing_cycle === 'yearly' ? 'year' : 'mo'}</Text>
                </View>
              )}
            </View>
            {subscription.current_period_end && (
              <Text style={styles.renewsAt}>
                Renews: {new Date(subscription.current_period_end).toLocaleDateString()}
              </Text>
            )}
          </LinearGradient>
        )}

        {/* Usage Stats */}
        {usage && (
          <View style={styles.usageSection}>
            <Text style={styles.sectionTitle}>This Month's Usage</Text>
            <View style={styles.usageGrid}>
              <UsageMeter label="Products" current={usage.products_count} limit={usage.products_limit} />
              <UsageMeter label="Orders" current={usage.orders_count} limit={usage.orders_limit} />
              <UsageMeter label="Broadcasts" current={usage.broadcasts_count} limit={usage.broadcasts_limit} />
            </View>
          </View>
        )}

        {/* Available Plans */}
        <Text style={styles.sectionTitle}>Available Plans</Text>
        {tiers.map((tier) => (
          <View key={tier.key} style={styles.tierCard}>
            <View style={styles.tierHeader}>
              <Ionicons name={TIER_ICONS[tier.key]} size={24} color={TIER_GRADIENTS[tier.key]?.[0] || COLORS.gray} />
              <Text style={styles.tierName}>{tier.name}</Text>
              {subscription?.tier === tier.key && (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>Current</Text>
                </View>
              )}
            </View>
            
            <View style={styles.tierPricing}>
              <Text style={styles.tierPrice}>₹{tier.price_monthly}</Text>
              <Text style={styles.tierCycle}>/month</Text>
              {tier.price_yearly > 0 && (
                <Text style={styles.tierYearly}>or ₹{tier.price_yearly}/year (save {Math.round((1 - tier.price_yearly / (tier.price_monthly * 12)) * 100)}%)</Text>
              )}
            </View>
            
            <View style={styles.tierFeatures}>
              <FeatureRow label="Products" value={formatLimit(tier.features.products_limit)} />
              <FeatureRow label="Orders/month" value={formatLimit(tier.features.orders_per_month)} />
              <FeatureRow label="Staff members" value={tier.features.staff_members.toString()} />
              <FeatureRow label="Commission" value={`${tier.features.commission_rate}%`} />
              <FeatureRow label="AI Features" value={tier.features.ai_features ? '✓' : '✗'} />
              <FeatureRow label="Priority Listing" value={tier.features.priority_listing ? '✓' : '✗'} />
            </View>
            
            {subscription?.tier !== tier.key && tier.key !== 'free' && (
              <TouchableOpacity
                style={[styles.upgradeBtn, upgrading === tier.key && styles.upgradeBtnDisabled]}
                onPress={() => handleUpgrade(tier.key)}
                disabled={upgrading === tier.key}
              >
                {upgrading === tier.key ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.upgradeBtnText}>Upgrade to {tier.name}</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function UsageMeter({ label, current, limit }) {
  const percentage = limit === -1 ? 0 : Math.min((current / limit) * 100, 100);
  const isUnlimited = limit === -1;
  
  return (
    <View style={styles.usageItem}>
      <Text style={styles.usageLabel}>{label}</Text>
      <View style={styles.usageBar}>
        <View style={[styles.usageFill, { width: `${percentage}%`, backgroundColor: percentage > 80 ? COLORS.error : COLORS.primary }]} />
      </View>
      <Text style={styles.usageValue}>
        {current} / {isUnlimited ? '∞' : limit}
      </Text>
    </View>
  );
}

function FeatureRow({ label, value }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureLabel}>{label}</Text>
      <Text style={styles.featureValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  content: { padding: 16 },
  currentPlan: { borderRadius: 16, padding: 20, marginBottom: 20 },
  currentPlanHeader: { flexDirection: 'row', alignItems: 'center' },
  currentPlanInfo: { flex: 1, marginLeft: 12 },
  currentPlanLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  currentPlanName: { fontSize: 24, fontWeight: '700', color: 'white' },
  priceTag: { flexDirection: 'row', alignItems: 'baseline' },
  priceAmount: { fontSize: 24, fontWeight: '700', color: 'white' },
  priceCycle: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  renewsAt: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 12 },
  usageSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 12 },
  usageGrid: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, ...SHADOWS.small },
  usageItem: { marginBottom: 12 },
  usageLabel: { fontSize: 13, color: COLORS.gray, marginBottom: 4 },
  usageBar: { height: 6, backgroundColor: COLORS.border, borderRadius: 3 },
  usageFill: { height: 6, borderRadius: 3 },
  usageValue: { fontSize: 12, color: COLORS.text, marginTop: 4 },
  tierCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginBottom: 12, ...SHADOWS.small },
  tierHeader: { flexDirection: 'row', alignItems: 'center' },
  tierName: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginLeft: 8, flex: 1 },
  currentBadge: { backgroundColor: COLORS.success + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  currentBadgeText: { fontSize: 12, color: COLORS.success, fontWeight: '600' },
  tierPricing: { flexDirection: 'row', alignItems: 'baseline', marginTop: 12 },
  tierPrice: { fontSize: 28, fontWeight: '700', color: COLORS.text },
  tierCycle: { fontSize: 14, color: COLORS.gray, marginLeft: 2 },
  tierYearly: { fontSize: 12, color: COLORS.success, marginLeft: 8 },
  tierFeatures: { marginTop: 16, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 16 },
  featureRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  featureLabel: { fontSize: 14, color: COLORS.gray },
  featureValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  upgradeBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  upgradeBtnDisabled: { opacity: 0.7 },
  upgradeBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
});
