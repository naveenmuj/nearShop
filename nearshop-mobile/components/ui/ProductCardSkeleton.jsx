import { View, StyleSheet } from 'react-native'
import Skeleton from './Skeleton'
import { COLORS } from '../../constants/theme'

export default function ProductCardSkeleton() {
  return (
    <View style={styles.card}>
      {/* Image area */}
      <Skeleton width="100%" height={140} borderRadius={0} />

      {/* Info area */}
      <View style={styles.info}>
        <Skeleton width="85%" height={13} borderRadius={4} style={styles.row} />
        <Skeleton width="60%" height={13} borderRadius={4} style={styles.row} />
        <Skeleton width="45%" height={15} borderRadius={4} style={styles.row} />
        <Skeleton width="70%" height={11} borderRadius={4} style={styles.row} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
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
})
