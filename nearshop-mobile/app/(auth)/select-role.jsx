import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SHADOWS } from '../../constants/theme';

const ROLES = [
  {
    role: 'customer',
    emoji: '🛍️',
    title: 'I want to shop',
    desc: 'Discover nearby shops, browse products, grab great deals',
    bg: COLORS.primaryLight,
    border: COLORS.primary,
  },
  {
    role: 'business',
    emoji: '🏪',
    title: 'I own a shop',
    desc: 'List your products, reach nearby customers, grow your business',
    bg: COLORS.greenLight,
    border: COLORS.green,
  },
];

export default function SelectRoleScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        {/* Back button */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>How do you want to{'\n'}use NearShop?</Text>
        <Text style={styles.subtitle}>You can always switch later in settings</Text>

        <View style={styles.cards}>
          {ROLES.map((item) => (
            <TouchableOpacity
              key={item.role}
              onPress={() => router.push({ pathname: '/(auth)/onboard', params: { role: item.role } })}
              activeOpacity={0.8}
              style={[styles.roleCard, { borderColor: item.border }]}
            >
              <View style={[styles.roleEmoji, { backgroundColor: item.bg }]}>
                <Text style={{ fontSize: 36 }}>{item.emoji}</Text>
              </View>
              <Text style={styles.roleTitle}>{item.title}</Text>
              <Text style={styles.roleDesc}>{item.desc}</Text>
              <View style={[styles.roleChevron, { backgroundColor: item.border }]}>
                <Text style={{ color: COLORS.white, fontWeight: '700', fontSize: 18 }}>→</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  backBtn: { position: 'absolute', top: 16, left: 0, paddingVertical: 8 },
  backText: { fontSize: 16, fontWeight: '600', color: COLORS.primary },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.gray900, marginBottom: 8, lineHeight: 36 },
  subtitle: { fontSize: 14, color: COLORS.gray500, marginBottom: 32 },
  cards: { gap: 16 },
  roleCard: {
    backgroundColor: COLORS.white, borderRadius: 24, padding: 24,
    borderWidth: 1.5, ...SHADOWS.card,
  },
  roleEmoji: {
    width: 64, height: 64, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  roleTitle: { fontSize: 20, fontWeight: '700', color: COLORS.gray900, marginBottom: 6 },
  roleDesc: { fontSize: 14, color: COLORS.gray500, lineHeight: 20, marginBottom: 20 },
  roleChevron: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end',
  },
});
