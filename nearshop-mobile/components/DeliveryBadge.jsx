import { View, Text, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

/**
 * DeliveryBadge - Shows shop delivery status for mobile
 */
export default function DeliveryBadge({ deliveryInfo, compact = false }) {
  if (!deliveryInfo) return null;

  const { can_deliver, distance_km, delivery_fee, min_order, reason } = deliveryInfo;

  if (compact) {
    return (
      <View style={[
        styles.compactBadge,
        { backgroundColor: can_deliver ? COLORS.green + '20' : COLORS.red + '20' }
      ]}>
        <Ionicons
          name={can_deliver ? 'checkmark-circle' : 'close-circle'}
          size={14}
          color={can_deliver ? COLORS.green : COLORS.red}
        />
        <Text style={[
          styles.compactText,
          { color: can_deliver ? COLORS.green : COLORS.red }
        ]}>
          {can_deliver ? 'Delivers' : 'No deliver'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[
      styles.container,
      { borderLeftColor: can_deliver ? COLORS.green : COLORS.red }
    ]}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          {can_deliver ? (
            <MaterialCommunityIcons name="check-circle" size={24} color={COLORS.green} />
          ) : (
            <MaterialCommunityIcons name="alert-circle" size={24} color={COLORS.red} />
          )}
        </View>
        <Text style={[
          styles.title,
          { color: can_deliver ? COLORS.green : COLORS.red }
        ]}>
          {reason}
        </Text>
      </View>

      {can_deliver && (
        <View style={styles.details}>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="map-marker" size={16} color={COLORS.gray500} />
            <Text style={styles.detailText}>{distance_km} km away</Text>
          </View>

          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="truck-fast" size={16} color={COLORS.gray500} />
            <Text style={styles.detailText}>
              {delivery_fee === 0 ? 'Free delivery' : `₹${delivery_fee} delivery`}
            </Text>
          </View>

          {min_order && (
            <View style={styles.detailRow}>
              <Ionicons name="cart" size={16} color={COLORS.gray500} />
              <Text style={styles.detailText}>Min order: ₹{min_order}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  details: {
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray100,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailText: {
    fontSize: 13,
    color: COLORS.gray700,
    fontWeight: '500',
  },
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  compactText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
