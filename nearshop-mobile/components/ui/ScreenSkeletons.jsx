import { ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { COLORS, SHADOWS } from '../../constants/theme'
import Skeleton from './Skeleton'
import ProductGridSkeleton from './ProductGridSkeleton'

function SectionCard({ children, style }) {
  return <View style={[styles.sectionCard, style]}>{children}</View>
}

export function HomeScreenSkeleton() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Skeleton width="42%" height={16} borderRadius={8} style={styles.spaceXs} />
            <Skeleton width="72%" height={22} borderRadius={10} />
          </View>
          <Skeleton width={44} height={44} borderRadius={22} />
        </View>

        <SectionCard style={styles.searchHero}>
          <Skeleton width="55%" height={14} borderRadius={8} style={styles.spaceSm} />
          <Skeleton width="100%" height={54} borderRadius={18} style={styles.spaceSm} />
          <View style={styles.row}>
            <Skeleton width="31%" height={78} borderRadius={18} />
            <Skeleton width="31%" height={78} borderRadius={18} />
            <Skeleton width="31%" height={78} borderRadius={18} />
          </View>
        </SectionCard>

        <View style={styles.storyRow}>
          {Array.from({ length: 5 }).map((_, index) => (
            <View key={index} style={styles.storyItem}>
              <Skeleton width={68} height={68} borderRadius={34} />
              <Skeleton width="80%" height={10} borderRadius={6} style={styles.spaceXs} />
            </View>
          ))}
        </View>

        <SectionCard>
          <Skeleton width="34%" height={18} borderRadius={8} style={styles.spaceSm} />
          <ProductGridSkeleton count={4} />
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  )
}

export function SearchScreenSkeleton() {
  return (
    <View style={styles.screen}>
      <View style={styles.searchHeader}>
        <Skeleton width={36} height={36} borderRadius={18} />
        <Skeleton width="100%" height={48} borderRadius={18} style={{ flex: 1 }} />
      </View>
      <View style={styles.filterRow}>
        <Skeleton width="22%" height={34} borderRadius={17} />
        <Skeleton width="22%" height={34} borderRadius={17} />
        <Skeleton width="22%" height={34} borderRadius={17} />
      </View>
      <ProductGridSkeleton count={6} />
    </View>
  )
}

export function ProductDetailSkeleton() {
  return (
    <View style={styles.screen}>
      <Skeleton width="100%" height={320} borderRadius={0} baseColor="#E2E8F0" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Skeleton width="72%" height={28} borderRadius={10} style={styles.spaceSm} />
        <View style={styles.rowStart}>
          <Skeleton width="30%" height={18} borderRadius={9} />
          <Skeleton width="20%" height={18} borderRadius={9} />
        </View>
        <View style={styles.rowStart}>
          <Skeleton width="26%" height={32} borderRadius={10} />
          <Skeleton width="18%" height={22} borderRadius={8} />
        </View>

        <SectionCard>
          <Skeleton width="100%" height={72} borderRadius={18} />
        </SectionCard>
        <SectionCard>
          <Skeleton width="38%" height={16} borderRadius={8} style={styles.spaceSm} />
          <Skeleton width="100%" height={14} borderRadius={7} style={styles.spaceXs} />
          <Skeleton width="94%" height={14} borderRadius={7} style={styles.spaceXs} />
          <Skeleton width="76%" height={14} borderRadius={7} />
        </SectionCard>
        <SectionCard>
          <Skeleton width="42%" height={16} borderRadius={8} style={styles.spaceSm} />
          <View style={styles.row}>
            <Skeleton width={140} height={164} borderRadius={18} />
            <Skeleton width={140} height={164} borderRadius={18} />
          </View>
        </SectionCard>
      </ScrollView>
      <View style={styles.bottomBar}>
        <Skeleton width="48%" height={52} borderRadius={18} />
        <Skeleton width="48%" height={52} borderRadius={18} baseColor="#DADAFD" />
      </View>
    </View>
  )
}

export function ShopDetailSkeleton() {
  return (
    <View style={styles.screen}>
      <Skeleton width="100%" height={290} borderRadius={0} baseColor="#DBE7F5" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Skeleton width="64%" height={28} borderRadius={10} style={styles.spaceSm} />
        <Skeleton width="40%" height={16} borderRadius={8} style={styles.spaceSm} />
        <View style={styles.row}>
          <Skeleton width="48%" height={48} borderRadius={16} />
          <Skeleton width="48%" height={48} borderRadius={16} />
        </View>
        <SectionCard>
          <Skeleton width="36%" height={16} borderRadius={8} style={styles.spaceSm} />
          <ProductGridSkeleton count={4} />
        </SectionCard>
      </ScrollView>
    </View>
  )
}

export function WishlistSkeleton() {
  return (
    <View style={styles.screen}>
      <View style={styles.titleWrap}>
        <Skeleton width="44%" height={26} borderRadius={10} />
        <Skeleton width={28} height={28} borderRadius={14} />
      </View>
      <View style={styles.filterRow}>
        <Skeleton width="24%" height={36} borderRadius={18} />
        <Skeleton width="24%" height={36} borderRadius={18} />
      </View>
      <ProductGridSkeleton count={6} />
    </View>
  )
}

export function AdminConsoleSkeleton() {
  return (
    <View style={styles.screen}>
      <View style={styles.titleWrap}>
        <Skeleton width="40%" height={28} borderRadius={10} />
        <View style={styles.rowStart}>
          <Skeleton width={44} height={28} borderRadius={14} />
          <Skeleton width={44} height={28} borderRadius={14} />
          <Skeleton width={44} height={28} borderRadius={14} />
        </View>
      </View>
      <View style={styles.filterRow}>
        <Skeleton width="22%" height={36} borderRadius={18} />
        <Skeleton width="22%" height={36} borderRadius={18} />
        <Skeleton width="22%" height={36} borderRadius={18} />
        <Skeleton width="22%" height={36} borderRadius={18} />
      </View>
      <View style={styles.content}>
        <View style={styles.row}>
          <Skeleton width="48%" height={112} borderRadius={22} />
          <Skeleton width="48%" height={112} borderRadius={22} />
        </View>
        <View style={styles.row}>
          <Skeleton width="48%" height={112} borderRadius={22} />
          <Skeleton width="48%" height={112} borderRadius={22} />
        </View>
        <SectionCard>
          <Skeleton width="36%" height={18} borderRadius={8} style={styles.spaceSm} />
          <Skeleton width="100%" height={220} borderRadius={18} baseColor="#EDF2F7" />
        </SectionCard>
      </View>
    </View>
  )
}

export function GenericListSkeleton() {
  return (
    <View style={styles.screen}>
      <View style={styles.titleWrap}>
        <Skeleton width="42%" height={28} borderRadius={10} />
        <Skeleton width={36} height={36} borderRadius={18} />
      </View>
      <View style={styles.content}>
        <SectionCard>
          <Skeleton width="100%" height={86} borderRadius={18} style={styles.spaceSm} />
          <Skeleton width="100%" height={86} borderRadius={18} style={styles.spaceSm} />
          <Skeleton width="100%" height={86} borderRadius={18} />
        </SectionCard>
      </View>
    </View>
  )
}

export function GenericDetailSkeleton() {
  return (
    <View style={styles.screen}>
      <View style={styles.titleWrap}>
        <Skeleton width={36} height={36} borderRadius={18} />
        <Skeleton width="52%" height={24} borderRadius={10} />
        <Skeleton width={36} height={36} borderRadius={18} />
      </View>
      <View style={styles.content}>
        <SectionCard>
          <Skeleton width="52%" height={22} borderRadius={10} style={styles.spaceSm} />
          <Skeleton width="32%" height={16} borderRadius={8} style={styles.spaceSm} />
          <Skeleton width="100%" height={110} borderRadius={18} />
        </SectionCard>
        <SectionCard>
          <Skeleton width="100%" height={72} borderRadius={18} style={styles.spaceSm} />
          <Skeleton width="100%" height={72} borderRadius={18} />
        </SectionCard>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  screen: {
    flex: 1,
    backgroundColor: '#F7F8FC',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  searchHero: {
    backgroundColor: '#EEF4FF',
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 54,
    paddingBottom: 14,
    backgroundColor: COLORS.white,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  storyRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 2,
  },
  storyItem: {
    width: 72,
    alignItems: 'center',
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 14,
  },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 16,
    ...SHADOWS.card,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowStart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  spaceXs: {
    marginBottom: 8,
  },
  spaceSm: {
    marginBottom: 12,
  },
})
