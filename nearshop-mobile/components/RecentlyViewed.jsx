import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { getRecentlyViewed, clearRecentlyViewed } from '../lib/engagement'
import { COLORS, SHADOWS, formatPrice } from '../constants/theme'

const PLACEHOLDER = 'https://placehold.co/200x200/eee/999?text=📦'

function RecentItem({ item }) {
  const router = useRouter()
  const imageUri =
    item.image_url || item.image || item.images?.[0] || PLACEHOLDER

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={() => router.push(`/(customer)/product/${item.product_id || item.id}`)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: imageUri }}
        style={styles.itemImage}
        resizeMode="cover"
      />
      <Text style={styles.itemName} numberOfLines={2}>
        {item.name || item.product_name}
      </Text>
      <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
    </TouchableOpacity>
  )
}

export default function RecentlyViewed() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchItems = useCallback(async () => {
    try {
      const res = await getRecentlyViewed(20)
      setItems(res?.data?.items ?? res?.data ?? [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const handleClear = async () => {
    try {
      await clearRecentlyViewed()
      setItems([])
    } catch {
      // ignore
    }
  }

  if (loading) {
    return null
  }

  if (!items || items.length === 0) {
    return null
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Continue shopping</Text>
        <TouchableOpacity onPress={handleClear} activeOpacity={0.7}>
          <Text style={styles.clearBtn}>Clear</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.product_id || item.id)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => <RecentItem item={item} />}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginTop: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  clearBtn: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.red,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 2,
  },
  separator: {
    width: 12,
  },
  item: {
    width: 112,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  itemImage: {
    width: 112,
    height: 88,
    backgroundColor: COLORS.gray100,
  },
  itemName: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.gray800,
    padding: 6,
    paddingBottom: 2,
    lineHeight: 16,
  },
  itemPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.gray900,
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
})
