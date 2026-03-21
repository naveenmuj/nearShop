import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Keyboard,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useRef, useState, useEffect, useCallback } from 'react';
import { searchProducts } from '../../lib/products';
import { searchShops } from '../../lib/shops';
import ProductCard from '../../components/ProductCard';
import ShopCard from '../../components/ShopCard';
import { COLORS, SHADOWS } from '../../constants/theme';

const CATEGORIES = ['All', 'Grocery', 'Electronics', 'Clothing', 'Food', 'Beauty', 'Home'];

const SORT_OPTIONS = [
  { label: 'Newest',  value: 'newest' },
  { label: 'Price ↑', value: 'price_asc' },
  { label: 'Price ↓', value: 'price_desc' },
  { label: 'Popular', value: 'popular' },
];

export default function SearchScreen() {
  const router = useRouter();
  const { category: initialCategory } = useLocalSearchParams();

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('products'); // 'products' | 'shops'
  const [selectedCategory, setSelectedCategory] = useState(initialCategory || 'All');
  const [selectedSort, setSelectedSort] = useState('newest');
  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const inputRef = useRef(null);
  const debounceTimer = useRef(null);

  // ─── Fetch helpers ────────────────────────────────────────────────────────────

  const fetchProducts = useCallback(async (q, category, sort) => {
    setLoading(true);
    try {
      const params = { q, limit: 40, sort };
      if (category && category !== 'All') params.category = category;
      const res = await searchProducts(params);
      setProducts(res?.data?.products ?? []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  }, []);

  const fetchShops = useCallback(async (q) => {
    setLoading(true);
    try {
      const res = await searchShops(q, { limit: 30 });
      setShops(res?.data?.shops ?? []);
    } catch {
      setShops([]);
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  }, []);

  // ─── Debounced search trigger ─────────────────────────────────────────────────

  const scheduleSearch = useCallback(
    (q, category, sort, tab) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        if (tab === 'products') {
          fetchProducts(q, category, sort);
        } else {
          fetchShops(q);
        }
      }, 400);
    },
    [fetchProducts, fetchShops],
  );

  useEffect(() => {
    scheduleSearch(query, selectedCategory, selectedSort, activeTab);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query, selectedCategory, selectedSort, activeTab, scheduleSearch]);

  // Auto-focus on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  const handleQueryChange = (text) => {
    setQuery(text);
    setHasSearched(false);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setHasSearched(false);
  };

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
    setHasSearched(false);
  };

  const handleSortChange = (sort) => {
    setSelectedSort(sort);
    setHasSearched(false);
  };

  const handleCancel = () => {
    Keyboard.dismiss();
    router.back();
  };

  const handleClearInput = () => {
    setQuery('');
    setHasSearched(false);
    inputRef.current?.focus();
  };

  // ─── Render helpers ───────────────────────────────────────────────────────────

  const renderProductItem = ({ item, index }) => (
    <View style={[styles.productItemWrap, index % 2 === 0 ? styles.productItemLeft : styles.productItemRight]}>
      <ProductCard product={item} />
    </View>
  );

  const renderShopItem = ({ item }) => (
    <View style={styles.shopItemWrap}>
      <ShopCard shop={item} />
    </View>
  );

  const renderEmpty = () => {
    if (loading || !hasSearched) return null;
    const count = activeTab === 'products' ? products.length : shops.length;
    if (count > 0) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🔍</Text>
        <Text style={styles.emptyTitle}>
          {query.trim() ? `No results for "${query.trim()}"` : 'No results'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {activeTab === 'products'
            ? 'Try a different keyword or browse another category.'
            : 'Try a different keyword or explore nearby shops.'}
        </Text>
      </View>
    );
  };

  const currentData = activeTab === 'products' ? products : shops;

  return (
    <View style={styles.root}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <View style={styles.inputWrap}>
          <Text style={styles.searchIconText}>🔍</Text>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Search products, shops…"
            placeholderTextColor={COLORS.gray400}
            value={query}
            onChangeText={handleQueryChange}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode={Platform.OS === 'ios' ? 'while-editing' : 'never'}
          />
          {Platform.OS === 'android' && query.length > 0 && (
            <TouchableOpacity
              onPress={handleClearInput}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* ── Tab pills ───────────────────────────────────────────────────────── */}
      <View style={styles.tabRow}>
        {['products', 'shops'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabPill, activeTab === tab && styles.tabPillActive]}
            onPress={() => handleTabChange(tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
              {tab === 'products' ? 'Products' : 'Shops'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Filter + Sort chips (products only) ─────────────────────────────── */}
      {activeTab === 'products' && (
        <View style={styles.chipsSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            keyboardShouldPersistTaps="handled"
          >
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => handleCategoryChange(cat)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.chipRow, styles.sortRow]}
            keyboardShouldPersistTaps="handled"
          >
            {SORT_OPTIONS.map(({ label, value }) => {
              const active = selectedSort === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.chip, styles.sortChip, active && styles.chipActive]}
                  onPress={() => handleSortChange(value)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Results / Loading / Empty ────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          key={activeTab}
          data={currentData}
          keyExtractor={(item) => String(item.id)}
          numColumns={activeTab === 'products' ? 2 : 1}
          renderItem={activeTab === 'products' ? renderProductItem : renderShopItem}
          contentContainerStyle={[
            styles.listContent,
            currentData.length === 0 && styles.listContentEmpty,
          ]}
          columnWrapperStyle={activeTab === 'products' ? styles.columnWrapper : undefined}
          ListEmptyComponent={renderEmpty}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.gray100,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'android' ? 48 : 56,
    paddingBottom: 12,
    gap: 8,
    ...SHADOWS.card,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 20,
    color: COLORS.gray700,
    lineHeight: 24,
    marginTop: Platform.OS === 'android' ? 0 : -1,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 40,
    gap: 6,
  },
  searchIconText: {
    fontSize: 14,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.gray900,
    paddingVertical: 0,
  },
  clearBtn: {
    fontSize: 13,
    color: COLORS.gray400,
    paddingLeft: 4,
  },
  cancelBtn: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
  },
  tabPillActive: {
    backgroundColor: COLORS.primary,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray500,
  },
  tabLabelActive: {
    color: COLORS.white,
  },

  // Chips
  chipsSection: {
    backgroundColor: COLORS.white,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
  },
  sortRow: {
    paddingTop: 6,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.gray100,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray600,
  },
  chipTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '700',
  },

  // List
  listContent: {
    padding: 12,
    paddingBottom: 32,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  columnWrapper: {
    gap: 10,
    marginBottom: 10,
  },
  productItemWrap: {
    flex: 1,
  },
  productItemLeft: {},
  productItemRight: {},
  shopItemWrap: {
    width: '100%',
    marginBottom: 10,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.gray800,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 20,
  },
});
