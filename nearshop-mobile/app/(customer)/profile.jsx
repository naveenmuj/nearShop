import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import useAuthStore from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import { switchRole as apiSwitchRole, deleteAccount as apiDeleteAccount } from '../../lib/auth';
import { isSoundEnabled, setSoundEnabled, initSound } from '../../lib/sound';
import { getMyOrders } from '../../lib/orders';
import { getWishlist } from '../../lib/wishlists';
import { toast } from '../../components/ui/Toast/toastRef';
import { alert } from '../../components/ui/PremiumAlert';
import { COLORS, SHADOWS, formatDate } from '../../constants/theme';

// ── Helpers ────────────────────────────────────────────────────────────────────

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, onPress }) {
  return (
    <TouchableOpacity style={styles.statCard} onPress={onPress} activeOpacity={0.75}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function SectionHeader({ title }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function MenuRow({ icon, label, onPress, right, isLast }) {
  return (
    <TouchableOpacity
      style={[styles.menuRow, isLast && styles.menuRowLast]}
      onPress={onPress}
      activeOpacity={onPress ? 0.65 : 1}
    >
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
      <View style={styles.menuRight}>{right}</View>
    </TouchableOpacity>
  );
}

function MenuRowSwitch({ icon, label, value, onValueChange, isLast }) {
  return (
    <View style={[styles.menuRow, isLast && styles.menuRowLast]}>
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
      <View style={styles.menuRight}>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: COLORS.gray200, true: COLORS.primaryLight }}
          thumbColor={value ? COLORS.primary : COLORS.gray400}
          ios_backgroundColor={COLORS.gray200}
        />
      </View>
    </View>
  );
}

function Chevron() {
  return <Text style={styles.chevron}>›</Text>;
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, switchRole } = useAuthStore();
  const { address } = useLocationStore();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundOn, setSoundOn] = useState(false);
  const [orderCount, setOrderCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);

  const locality = address || 'Location not set';

  useEffect(() => {
    initSound().then(() => setSoundOn(isSoundEnabled()));
  }, []);

  // Fetch counts whenever screen is focused
  useFocusEffect(
    useCallback(() => {
      const loadCounts = async () => {
        try {
          const res = await getMyOrders({});
          const d = res?.data;
          const list = Array.isArray(d) ? d : d?.items ?? d?.orders ?? [];
          setOrderCount(list.length);
        } catch {}
        try {
          const res = await getWishlist();
          const d = res?.data;
          const list = Array.isArray(d) ? d : d?.items ?? [];
          setWishlistCount(list.length);
        } catch {}
      };
      loadCounts();
    }, [])
  );

  const handleSoundToggle = async (val) => {
    setSoundOn(val);
    await setSoundEnabled(val);
  };

  // ── Handlers ────────────────────────────────────────────────────────────────

  // 'business' is added to roles array only after completing business onboarding
  const hasBusiness = Array.isArray(user?.roles) && user.roles.includes('business');

  const handleSwitchToBusiness = async () => {
    if (hasBusiness) {
      // User already has a shop — just switch active role
      try {
        const response = await apiSwitchRole('business');
        
        // If backend provides new tokens, update them
        if (response?.data?.access_token) {
          const SecureStore = await import('expo-secure-store');
          await SecureStore.setItemAsync('access_token', response.data.access_token);
          if (response.data.refresh_token) {
            await SecureStore.setItemAsync('refresh_token', response.data.refresh_token);
          }
        }
        if (response?.data?.user) {
          await useAuthStore.getState().updateUser(response.data.user);
        } else {
          await switchRole('business');
        }
        toast.success('Business mode is ready.');
        router.replace('/(business)/dashboard');
      } catch (err) {
        const message = err?.response?.data?.detail || err?.message || 'Could not switch to business mode right now.';
        toast.error(message);
      }
    } else {
      // Not a business yet — send to registration
      router.push({ pathname: '/(auth)/onboard', params: { role: 'business' } });
    }
  };

  const handleSignOut = async () => {
    const confirmed = await alert.confirm({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      confirmText: 'Sign Out',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    
    if (confirmed) {
      await logout();
      router.replace('/(auth)/login');
    }
  };

  const handleDeleteAccount = async () => {
    const hasBizRole = Array.isArray(user?.roles) && user.roles.includes('business');

    if (hasBizRole) {
      // Show options for multi-role users using sequential confirms
      alert.show({
        title: 'Delete Account',
        message: 'You have both customer and business roles. Choose what to delete:',
        type: 'warning',
        buttons: [
          { text: 'Cancel', style: 'secondary' },
          { text: 'Business Only', style: 'secondary', onPress: () => confirmDelete(false, true) },
          { text: 'Customer Only', style: 'secondary', onPress: () => confirmDelete(true, false) },
          { text: 'Delete All', style: 'destructive', onPress: () => confirmDelete(true, true) },
        ],
      });
    } else {
      const confirmed = await alert.confirm({
        title: 'Delete Account',
        message: 'This will permanently delete your account and all data. This action cannot be undone.',
        confirmText: 'Delete My Account',
        cancelText: 'Cancel',
        variant: 'danger',
      });
      
      if (confirmed) {
        confirmDelete(true, false);
      }
    }
  };

  const confirmDelete = async (delCustomer, delBusiness) => {
    const isFull = delCustomer && delBusiness;
    
    const confirmed = await alert.confirm({
      title: isFull ? 'Permanently Delete?' : 'Confirm Deletion',
      message: isFull
        ? 'This will delete your account, shops, orders, and Firebase login. You cannot undo this.'
        : 'Are you sure? This cannot be undone.',
      confirmText: 'Yes, Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    
    if (!confirmed) return;
    
    try {
      await apiDeleteAccount(delCustomer, delBusiness);
      if (isFull) {
        await logout();
        router.replace('/(auth)/login');
      } else if (delBusiness) {
        toast.success('Business data deleted successfully.');
      } else {
        await logout();
        router.replace('/(auth)/login');
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to delete account');
    }
  };

  // ── Avatar ──────────────────────────────────────────────────────────────────

  const hasAvatar = Boolean(user?.avatar_url);
  const initials = getInitials(user?.name);
  const joinDate = user?.created_at ? `Member since ${formatDate(user.created_at)}` : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar section ──────────────────────────────────────── */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            {hasAvatar ? (
              <Image
                source={{ uri: user.avatar_url }}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
          </View>
          <Text style={styles.userName}>{user?.name || 'Guest User'}</Text>
          {user?.phone && (
            <Text style={styles.userPhone}>{user.phone}</Text>
          )}
          {joinDate && (
            <Text style={styles.joinDate}>{joinDate}</Text>
          )}
        </View>

        {/* ── Stats row ────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard
            label="Orders"
            value={orderCount}
            onPress={() => router.push('/(customer)/orders')}
          />
          <View style={styles.statDivider} />
          <StatCard
            label="Wishlist"
            value={wishlistCount}
            onPress={() => router.push('/(customer)/wishlist')}
          />
          <View style={styles.statDivider} />
          <StatCard
            label="Points"
            value={user?.shopcoin_balance ?? 0}
            onPress={() => router.push('/(customer)/wallet')}
          />
        </View>

        {/* ── My Account ───────────────────────────────────────────── */}
        <SectionHeader title="My Account" />
        <View style={styles.menuCard}>
          <MenuRow
            icon="📦"
            label="My Orders"
            onPress={() => router.push('/(customer)/orders')}
            right={<Chevron />}
          />
          <MenuRow
            icon="❤️"
            label="Wishlist"
            onPress={() => router.push('/(customer)/wishlist')}
            right={<Chevron />}
          />
          <MenuRow
            icon="💰"
            label="Wallet & Coins"
            onPress={() => router.push('/(customer)/wallet')}
            right={<Chevron />}
          />
          <MenuRow
            icon="🤝"
            label="My Haggles"
            onPress={() => router.push('/(customer)/haggle')}
            right={<Chevron />}
          />
          <MenuRow
            icon="🏆"
            label="Achievements"
            onPress={() => router.push('/(customer)/achievements')}
            right={<Chevron />}
          />
          <MenuRow
            icon="🎰"
            label="Daily Spin"
            onPress={() => router.push('/(customer)/spin')}
            right={<Chevron />}
            isLast
          />
        </View>

        {/* ── Shop ─────────────────────────────────────────────────── */}
        <SectionHeader title={hasBusiness ? 'Business' : 'Grow with NearShop'} />
        <View style={styles.menuCard}>
          <MenuRow
            icon={hasBusiness ? '🏪' : '🚀'}
            label={hasBusiness ? 'Switch to Business Mode' : 'Register Your Business'}
            onPress={handleSwitchToBusiness}
            right={<Chevron />}
            isLast
          />
        </View>

        {/* ── Admin ────────────────────────────────────────────────── */}
        <SectionHeader title="Admin" />
        <View style={styles.menuCard}>
          <MenuRow
            icon="📊"
            label="Admin Dashboard"
            onPress={() => router.push('/admin')}
            right={<Chevron />}
            isLast
          />
        </View>

        {/* ── Settings ─────────────────────────────────────────────── */}
        <SectionHeader title="Settings" />
        <View style={styles.menuCard}>
          <MenuRowSwitch
            icon="🔔"
            label="Notifications"
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
          />
          <MenuRowSwitch
            icon="🔊"
            label="Sound Effects"
            value={soundOn}
            onValueChange={handleSoundToggle}
          />
          <MenuRow
            icon="📍"
            label="Location"
            right={
              <Text style={styles.menuValueText} numberOfLines={1}>
                {locality}
              </Text>
            }
          />
          <MenuRow
            icon="ℹ️"
            label="About NearShop"
            right={<Text style={styles.menuValueText}>v1.0.0</Text>}
            isLast
          />
        </View>

        {/* ── Account ──────────────────────────────────────────────── */}
        <SectionHeader title="Account" />
        <View style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={handleSignOut}
            activeOpacity={0.65}
          >
            <Text style={styles.menuIcon}>🚪</Text>
            <Text style={[styles.menuLabel, styles.menuLabelDanger]}>Sign Out</Text>
            <View style={styles.menuRight}>
              <Text style={[styles.chevron, styles.chevronDanger]}>›</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuRow, styles.menuRowLast]}
            onPress={handleDeleteAccount}
            activeOpacity={0.65}
          >
            <Text style={styles.menuIcon}>🗑️</Text>
            <Text style={[styles.menuLabel, styles.menuLabelDanger]}>Delete Account</Text>
            <View style={styles.menuRight}>
              <Text style={[styles.chevron, styles.chevronDanger]}>›</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── App version ──────────────────────────────────────────── */}
        <Text style={styles.appVersion} onLongPress={() => router.push('/debug-logs')}>NearShop v1.0.0</Text>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Avatar section
  avatarSection: {
    backgroundColor: COLORS.white,
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
    ...SHADOWS.card,
  },
  avatarContainer: {
    marginBottom: 14,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: COLORS.primaryLight,
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.primaryLight,
  },
  avatarInitials: {
    fontSize: 34,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 1,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.gray900,
    textAlign: 'center',
    marginBottom: 4,
  },
  userPhone: {
    fontSize: 15,
    color: COLORS.gray500,
    fontWeight: '500',
    marginBottom: 4,
  },
  joinDate: {
    fontSize: 13,
    color: COLORS.gray400,
    fontWeight: '400',
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 16,
    ...SHADOWS.card,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.gray200,
    marginVertical: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 3,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Section header
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.gray400,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 8,
    marginHorizontal: 20,
  },

  // Menu card
  menuCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginHorizontal: 16,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray200,
  },
  menuRowLast: {
    borderBottomWidth: 0,
  },
  menuIcon: {
    fontSize: 20,
    width: 32,
    textAlign: 'center',
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.gray800,
  },
  menuLabelDanger: {
    color: COLORS.red,
  },
  menuRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 8,
  },
  menuValueText: {
    fontSize: 13,
    color: COLORS.gray400,
    fontWeight: '500',
    maxWidth: 140,
    textAlign: 'right',
  },
  chevron: {
    fontSize: 22,
    color: COLORS.gray300,
    fontWeight: '300',
    lineHeight: 24,
  },
  chevronDanger: {
    color: COLORS.red,
    opacity: 0.6,
  },

  // App version
  appVersion: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.gray300,
    fontWeight: '500',
    marginTop: 28,
  },

  bottomSpacing: {
    height: 32,
  },
});
