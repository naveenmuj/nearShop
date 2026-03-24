import { View, StyleSheet } from 'react-native'
import ProductCardSkeleton from './ProductCardSkeleton'

export default function ProductGridSkeleton({ count = 6 }) {
  const items = Array.from({ length: count }, (_, i) => i)
  const rows = []
  for (let i = 0; i < items.length; i += 2) {
    rows.push([items[i], items[i + 1]])
  }

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.row}>
          <View style={styles.cardWrap}>
            <ProductCardSkeleton />
          </View>
          {row[1] !== undefined ? (
            <View style={styles.cardWrap}>
              <ProductCardSkeleton />
            </View>
          ) : (
            <View style={styles.cardWrap} />
          )}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  cardWrap: {
    flex: 1,
  },
})
