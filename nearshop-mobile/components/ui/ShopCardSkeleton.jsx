import { View, StyleSheet } from 'react-native'
import Skeleton from './Skeleton'
import { COLORS } from '../../constants/theme'

export default function ShopCardSkeleton() {
  return (
    <View style={styles.card}>
      {/* Shop image/banner */}
      <Skeleton width={160} height={100} borderRadius={0} />

      {/* Shop info */}
      <View style={styles.info}>
        <Skeleton width="80%" height={14} borderRadius={4} style={styles.row} />
        <Skeleton width="55%" height={12} borderRadius={4} style={styles.row} />
        <View style={styles.metaRow}>
          <Skeleton width={50} height={11} borderRadius={4} />
          <Skeleton width={40} height={11} borderRadius={4} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: 160,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  info: {
    padding: 10,
  },
  row: {
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
})
