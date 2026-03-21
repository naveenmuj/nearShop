import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

export default function StoryCircle({ story, onPress }) {
  const viewed = story.viewed || story.is_viewed;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={styles.wrap}>
      <View style={[styles.ring, viewed ? styles.ringViewed : styles.ringActive]}>
        <View style={styles.inner}>
          {story.shop_image ? (
            <Image source={{ uri: story.shop_image }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>
                {story.shop_name?.[0]?.toUpperCase() || '🏪'}
              </Text>
            </View>
          )}
        </View>
      </View>
      <Text numberOfLines={1} style={[styles.label, viewed && styles.labelViewed]}>
        {story.shop_name || 'Shop'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 5, width: 72 },
  ring: {
    width: 68, height: 68, borderRadius: 34,
    borderWidth: 2.5, padding: 2,
    justifyContent: 'center', alignItems: 'center',
  },
  ringActive: { borderColor: COLORS.primary },
  ringViewed: { borderColor: COLORS.gray300 },
  inner: {
    width: 58, height: 58, borderRadius: 29,
    overflow: 'hidden', backgroundColor: COLORS.white,
    borderWidth: 2, borderColor: COLORS.white,
  },
  image: { width: '100%', height: '100%' },
  placeholder: {
    width: '100%', height: '100%',
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  placeholderText: { fontSize: 22, fontWeight: '700', color: COLORS.primary },
  label: { fontSize: 10, color: COLORS.gray600, fontWeight: '500', textAlign: 'center' },
  labelViewed: { color: COLORS.gray400 },
});
