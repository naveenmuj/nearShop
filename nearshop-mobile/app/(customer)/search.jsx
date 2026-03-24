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
import { searchProducts, getSearchSuggestions } from '../../lib/products';
import { searchShops } from '../../lib/shops';
import {
  logSearch,
  getRecentSearches,
  deleteRecentSearch,
} from '../../lib/engagement';
import ProductCard from '../../components/ProductCard';
import ShopCard from '../../components/ShopCard';
import { COLORS, SHADOWS } from '../../constants/theme';
import useLocationStore from '../../store/locationStore';

const CATEGORIES = ['All', 'Grocery', 'Electronics', 'Clothing', 'Food', 'Beauty', 'Home'];

const SORT_OPTIONS = [
  { label: 'Newest',  value: 'newest' },
  { label: 'Price ↑', value: 'price_asc' },
  { label: 'Price ↓', value: 'price_desc' },
  { label: 'Popular', value: 'popular' },
];

const TYPE_ICONS = { product: '🛍️', shop: '🏪' };

export default function SearchScreen() {
  const router = useRouter();
  const { category: initialCategory } = useLocalSearchParams();
  const { lat, lng } = useLocationStore();

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('products');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory || 'All');
  const [selectedSort, setSelectedSort] = useState('newest');
  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Suggestions state
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [showRecentPanel, setShowRecentPanel] = useState(false);

  const inputRef = useRef(null);
  const debounceTimer = useRef(null);
  const suggestTimer = useRef(null);

  // ─── Fetch recent searches on mount ──────────────────────────────────────────

  useEffect(() => {
    getRecentSearches()
      .then((res) => setRecentSearches(res?.data?.items ?? res?.data ?? []))
      .catch(() => {});
  }, []);

  // ─── Fetch suggestions ────────────────────────────────────────────────────────

  const fetchSuggestions = useCallback(async (q) => {
    if (!q.trim() || q.length < 2) { setSuggestions([]); return; }
    try {
      const res = await getSearchSuggestions(q.trim(), lat, lng);
      setSuggestions(res?.data?.suggestions ?? []);
    } catch {
      setSuggestions([]);
    }
  }, [lat, lng]);

  // ─── Fetch helpers ────────────────────────────────────────────────────────────

  const fetchProducts = useCallback(async (q, category, sort) => {
    setLoading(true);
    try {
      const params = { per_page: 40, sort_by: sort };
      if (q) params.q = q;
      // Only send lat/lng for category browse (no text query) to avoid geo-filtering text searches
      if (!q && category && category !== 'All' && lat != null) {
        params.lat = lat;
        params.lng = lng;
      }
      if (category && category !== 'All') params.category = category;
      const res = await searchProducts(params);
      // API returns { items: [...], total, page, per_page }
      setProducts(res?.data?.items ?? []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  }, [lat, lng]);

  const fetchShops = useCallback(async (q) => {
    setLoading(true);
    try {
      const params = {};
      if (lat != null) params.lat = lat;
      if (lng != null) params.lng = lng;
      const res = await searchShops(q, params);
      // API returns { items: [...], total, page, per_page }
      setShops(res?.data?.items ?? []);
    } catch {
      setShops([]);
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  }, [lat, lng]);

  // ─── Debounced search trigger ─────────────────────────────────────────────────

  const scheduleSearch = useCallback(
    (q, category, sort, tab) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        setShowSuggestions(false);
        if (tab === 'products') fetchProducts(q, category, sort);
        else fetchShops(q);
      }, 450);
    },
    [fetchProducts, fetchShops],
  );

  useEffect(() => {
    scheduleSearch(query, selectedCategory, selectedSort, activeTab);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [query, selectedCategory, selectedSort, activeTab, scheduleSearch]);

  // Suggestions debounce (faster — 200ms)
  useEffect(() => {
    if (!inputFocused) return;
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(() => {
      if (query.length >= 2) {
        setShowSuggestions(true);
        setShowRecentPanel(false);
        fetchSuggestions(query);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
        // Show recent panel when focused but no typed query
        setShowRecentPanel(query.length === 0);
      }
    }, 200);
    return () => { if (suggestTimer.current) clearTimeout(suggestTimer.current); };
  }, [query, inputFocused, fetchSuggestions]);

  // Auto-focus on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  const handleQueryChange = (text) => {
    setQuery(text);
    setHasSearched(false);
    if (!text.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      setShowRecentPanel(inputFocused);
    }
  };

  const executeSearch = useCallback((term) => {
    if (!term.trim()) return;
    setQuery(term);
    setShowSuggestions(false);
    setShowRecentPanel(false);
    Keyboard.dismiss();
    logSearch(term).catch(() => {});
    // Refresh recent searches list
    getRecentSearches()
      .then((res) => setRecentSearches(res?.data?.items ?? res?.data ?? []))
      .catch(() => {});
    setHasSearched(false);
    scheduleSearch(term, selectedCategory, selectedSort, activeTab);
  }, [selectedCategory, selectedSort, activeTab, scheduleSearch]);

  const handleSuggestionPress = (item) => {
    setQuery(item.name);
    setShowSuggestions(false);
    setShowRecentPanel(false);
    Keyboard.dismiss();
    logSearch(item.name).catch(() => {});
    getRecentSearches()
      .then((res) => setRecentSearches(res?.data?.items ?? res?.data ?? []))
      .catch(() => {});
    if (item.type === 'shop') {
      router.push(`/(customer)/shop/${item.id}`);
    } else {
      setHasSearched(false);
      scheduleSearch(item.name, selectedCategory, selectedSort, 'products');
      setActiveTab('products');
    }
  };

  const handleRecentPress = (term) => {
    executeSearch(term);
  };

  const handleDeleteRecent = async (term) => {
    try {
      await deleteRecentSearch(term);
      setRecentSearches((prev) => prev.filter((r) => {
        const rTerm = typeof r === 'string' ? r : r.query || r.term || r;
        return rTerm !== term;
      }));
    } catch {
      // ignore
    }
  };

  const handleTabChange = (tab) => { setActiveTab(tab); setHasSearched(false); };
  const handleCategoryChange = (cat) => { setSelectedCategory(cat); setHasSearched(false); };
  const handleSortChange = (sort) => { setSelectedSort(sort); setHasSearched(false); };
  const handleCancel = () => { Keyboard.dismiss(); router.back(); };
  const handleClearInput = () => {
    setQuery('');
    setHasSearched(false);
    setSuggestions([]);
    setShowSuggestions(false);
    setShowRecentPanel(true);
    inputRef.current?.focus();
  };

  const handleInputFocus = () => {
    setInputFocused(true);
    if (!query.trim()) setShowRecentPanel(true);
  };

  const handleInputBlur = () => {
    setTimeout(() => {
      setInputFocused(false);
      setShowRecentPanel(false);
    }, 150);
  };

  const handleSubmitEditing = () => {
    if (query.trim()) {
      executeSearch(query.trim());
    }
    setShowSuggestions(false);
    setShowRecentPanel(false);
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

        <View style={[styles.inputWrap, inputFocused && styles.inputWrapFocused]}>
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
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onSubmitEditing={handleSubmitEditing}
          />
          {Platform.OS === 'android' && query.length > 0 && (
            <TouchableOpacity onPress={handleClearInput} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* ── Recent searches + trending panel (shown on focus, no query) ────── */}
      {showRecentPanel && !showSuggestions && (
        <View style={styles.suggestionsBox}>
          {recentSearches.length > 0 && (
            <>
              <View style={styles.panelSectionHeader}>
                <Text style={styles.panelSectionTitle}>Recent Searches</Text>
              </View>
              {recentSearches.slice(0, 5).map((item, idx) => {
                const term = typeof item === 'string' ? item : item.query || item.term || String(item);
                return (
                  <View
                    key={`recent-${idx}`}
                    style={[styles.suggestionRow, idx < Math.min(recentSearches.length, 5) - 1 && styles.suggestionBorder]}
                  >
                    <TouchableOpacity
                      style={styles.recentRowLeft}
                      onPress={() => handleRecentPress(term)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.suggestionTypeIcon}>🕐</Text>
                      <Text style={styles.suggestionName} numberOfLines={1}>{term}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteRecent(term)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.recentDeleteBtn}>✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </>
          )}
          {recentSearches.length === 0 && (
            <View style={styles.panelEmpty}>
              <Text style={styles.panelEmptyText}>Start typing to search…</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Amazon-style Suggestions dropdown ───────────────────────────────── */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsBox}>
          {suggestions.map((item, idx) => (
            <TouchableOpacity
              key={`${item.type}-${item.id}`}
              style={[styles.suggestionRow, idx < suggestions.length - 1 && styles.suggestionBorder]}
              onPress={() => handleSuggestionPress(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.suggestionTypeIcon}>{TYPE_ICONS[item.type]}</Text>
              <View style={styles.suggestionTextWrap}>
                <Text style={styles.suggestionName} numberOfLines={1}>{item.name}</Text>
                {item.category ? (
                  <Text style={styles.suggestionSub}>{item.type === 'shop' ? '🏪 Shop' : `in ${item.category}`}</Text>
                ) : null}
              </View>
              <Text style={styles.suggestionArrow}>↗</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

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
              {tab === 'products'
                ? `Products${products.length > 0 ? ` (${products.length})` : ''}`
                : `Shops${shops.length > 0 ? ` (${shops.length})` : ''}`}
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
          <Text style={styles.loadingText}>Searching nearby…</Text>
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
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputWrapFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  searchIconText: { fontSize: 14 },
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

  // Suggestions
  suggestionsBox: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
    ...SHADOWS.card,
    zIndex: 99,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  suggestionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray200,
  },
  suggestionTypeIcon: { fontSize: 16 },
  suggestionTextWrap: { flex: 1 },
  suggestionName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray900,
  },
  suggestionSub: {
    fontSize: 12,
    color: COLORS.gray400,
    marginTop: 1,
  },
  suggestionArrow: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Recent panel
  panelSectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  panelSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gray400,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  recentRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recentDeleteBtn: {
    fontSize: 12,
    color: COLORS.gray400,
    paddingLeft: 8,
    fontWeight: '600',
  },
  panelEmpty: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  panelEmptyText: {
    fontSize: 13,
    color: COLORS.gray400,
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
  tabPillActive: { backgroundColor: COLORS.primary },
  tabLabel: { fontSize: 13, fontWeight: '600', color: COLORS.gray500 },
  tabLabelActive: { color: COLORS.white },

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
  sortRow: { paddingTop: 6 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.gray100,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  sortChip: { paddingHorizontal: 12, paddingVertical: 5 },
  chipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: COLORS.gray600 },
  chipTextActive: { color: COLORS.primaryDark, fontWeight: '700' },

  // List
  listContent: { padding: 12, paddingBottom: 32 },
  listContentEmpty: { flexGrow: 1 },
  columnWrapper: { gap: 10, marginBottom: 10 },
  productItemWrap: { flex: 1 },
  productItemLeft: {},
  productItemRight: {},
  shopItemWrap: { width: '100%', marginBottom: 10 },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: COLORS.gray400 },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.gray800, textAlign: 'center', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: COLORS.gray500, textAlign: 'center', lineHeight: 20 },
});
