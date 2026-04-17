import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  Keyboard,
  Platform,
  BackHandler,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { searchProducts, getSearchSuggestions } from '../../lib/products';
import { searchShops, searchUnified, runConversationalSearch } from '../../lib/shops';
import { visualSearchProducts } from '../../lib/api/ai';
import { uploadFile } from '../../lib/auth';
import {
  logSearch,
  getRecentSearches,
  deleteRecentSearch,
  getSavedSearchIntents,
  saveSearchIntent,
  deleteSearchIntent,
} from '../../lib/engagement';
import ProductCard from '../../components/ProductCard';
import ShopCard from '../../components/ShopCard';
import LocationFallbackBanner from '../../components/LocationFallbackBanner';
import { useToast } from '../../components/ui/Toast';
import { SearchScreenSkeleton } from '../../components/ui/ScreenSkeletons';
import { COLORS, SHADOWS } from '../../constants/theme';
import useLocationStore from '../../store/locationStore';
import { trackRankingImpressions } from '../../lib/rankingTracking';

const CATEGORIES = ['All', 'Grocery', 'Electronics', 'Clothing', 'Food', 'Beauty', 'Home'];

const SORT_OPTIONS = [
  { label: 'Newest',  value: 'newest' },
  { label: 'Price ↑', value: 'price_asc' },
  { label: 'Price ↓', value: 'price_desc' },
  { label: 'Popular', value: 'popular' },
];

const SEARCH_MODES = [
  { key: 'smart', label: 'Smart AI' },
  { key: 'standard', label: 'Standard' },
];

const TYPE_ICONS = { product: '🛍️', shop: '🏪' };

const EMPTY_SEARCH_META = {
  aiUsed: false,
  fallbackUsed: false,
  parsedFilters: null,
  executedQuery: null,
  visualSummary: null,
};

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function applyProductUiFilters(items, category, sort) {
  let next = Array.isArray(items) ? [...items] : [];
  if (category && category !== 'All') {
    next = next.filter((item) => item?.category === category);
  }
  if (sort === 'price_asc') {
    next.sort((a, b) => Number(a?.price || 0) - Number(b?.price || 0));
  } else if (sort === 'price_desc') {
    next.sort((a, b) => Number(b?.price || 0) - Number(a?.price || 0));
  }
  return next;
}

function extractActiveAiChips(parsedFilters) {
  if (!parsedFilters) return [];
  const chips = [];
  if (normalizeText(parsedFilters.category)) chips.push(parsedFilters.category);
  if (normalizeText(parsedFilters.brand)) chips.push(parsedFilters.brand);
  if (normalizeText(parsedFilters.color)) chips.push(parsedFilters.color);
  if (normalizeText(parsedFilters.material)) chips.push(parsedFilters.material);
  if (parsedFilters.min_price != null || parsedFilters.max_price != null) {
    const min = parsedFilters.min_price != null ? `₹${parsedFilters.min_price}` : 'Any';
    const max = parsedFilters.max_price != null ? `₹${parsedFilters.max_price}` : 'Any';
    chips.push(`${min} - ${max}`);
  }
  if (parsedFilters.sort_by === 'price_low') chips.push('Price low');
  if (parsedFilters.sort_by === 'price_high') chips.push('Price high');
  return chips;
}

function toPercent(similarity) {
  const clamped = Math.max(0, Math.min(1, Number(similarity || 0)));
  return `${Math.round(clamped * 100)}% match`;
}

function confidenceLabel(band) {
  if (band === 'strong') return 'Strong';
  if (band === 'good') return 'Good';
  if (band === 'possible') return 'Possible';
  return 'Low';
}

export default function SearchScreen() {
  const router = useRouter();
  const { category: initialCategory } = useLocalSearchParams();
  const { lat, lng, preferredShopRadiusKm, error: locationError, refreshLocation } = useLocationStore();
  const { showToast } = useToast();

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('products');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory || 'All');

  // Sync category when navigated from home with a filter param
  useEffect(() => {
    if (initialCategory && initialCategory !== selectedCategory) {
      setSelectedCategory(initialCategory);
      setHasSearched(false);
    }
  }, [initialCategory]);
  const [selectedSort, setSelectedSort] = useState('newest');
  const [searchMode, setSearchMode] = useState('smart');
  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchMeta, setSearchMeta] = useState(EMPTY_SEARCH_META);
  const [searchError, setSearchError] = useState(null);
  const [visualSearchError, setVisualSearchError] = useState(null);
  const [visualSearchEnabled, setVisualSearchEnabled] = useState(true);

  // Suggestions state
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [savedIntents, setSavedIntents] = useState([]);
  const [showRecentPanel, setShowRecentPanel] = useState(false);

  const inputRef = useRef(null);
  const debounceTimer = useRef(null);
  const suggestTimer = useRef(null);

  const nearbyRadiusKm = useMemo(() => {
    const parsed = Number(preferredShopRadiusKm);
    if (!Number.isFinite(parsed)) return 5;
    return Math.max(1, Math.min(50, Math.round(parsed)));
  }, [preferredShopRadiusKm]);

  // ─── Fetch recent searches on mount ──────────────────────────────────────────

  useEffect(() => {
    getRecentSearches()
      .then((res) => setRecentSearches(res?.data?.items ?? res?.data ?? []))
      .catch(() => {});
    getSavedSearchIntents()
      .then((res) => setSavedIntents(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => handler.remove();
  }, []);

  // ─── Fetch suggestions ────────────────────────────────────────────────────────

  const fetchSuggestions = useCallback(async (q) => {
    if (!q.trim() || q.length < 2) { setSuggestions([]); return; }
    try {
      const res = await getSearchSuggestions(q.trim(), lat, lng, { radius_km: nearbyRadiusKm });
      setSuggestions(res?.data?.suggestions ?? []);
    } catch {
      setSuggestions([]);
    }
  }, [lat, lng, nearbyRadiusKm]);

  // ─── Fetch helpers ────────────────────────────────────────────────────────────

  const fetchProducts = useCallback(async (q, category, sort, mode) => {
    setLoading(true);
    try {
      if (q && q.trim()) {
        let searchData;

        if (mode === 'smart') {
          try {
            const conversational = await runConversationalSearch(q.trim(), lat, lng);
            searchData = conversational?.data ?? {};
          } catch {
            const unified = await searchUnified(q.trim(), lat, lng);
            searchData = {
              ...(unified?.data ?? {}),
              ai_used: false,
              fallback_used: true,
              parsed_filters: null,
              executed_query: q.trim(),
            };
          }
        } else {
          const unified = await searchUnified(q.trim(), lat, lng);
          searchData = {
            ...(unified?.data ?? {}),
            ai_used: false,
            fallback_used: false,
            parsed_filters: null,
            executed_query: q.trim(),
          };
        }
        const unifiedProducts = applyProductUiFilters(
          searchData?.products ?? [],
          category,
          sort,
        );
        setProducts(unifiedProducts);
        setShops(searchData?.shops ?? []);
        setSearchMeta({
          aiUsed: Boolean(searchData?.ai_used),
          fallbackUsed: Boolean(searchData?.fallback_used),
          parsedFilters: searchData?.parsed_filters ?? null,
          executedQuery: searchData?.executed_query ?? q.trim(),
        });
        setSearchError(null);
        return;
      }
      const params = { per_page: 40, radius_km: nearbyRadiusKm };
      if (sort) params.sort_by = sort;
      if (q && q.trim()) params.q = q.trim();
      if (lat != null) params.lat = lat;
      if (lng != null) params.lng = lng;
      if (category && category !== 'All') params.category = category;
      const res = await searchProducts(params);
      setProducts(res?.data?.items ?? res?.data ?? []);
      setShops([]);
      setSearchMeta(EMPTY_SEARCH_META);
      setSearchError(null);
    } catch (err) {
      setProducts([]);
      setShops([]);
      setSearchMeta(EMPTY_SEARCH_META);
      setSearchError({
        type: err?.errorType || 'unknown',
        message: err?.userMessage || 'Unable to load search results right now.',
      });
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  }, [lat, lng, nearbyRadiusKm]);

  const fetchShops = useCallback(async (q, mode) => {
    setLoading(true);
    try {
      if (q && q.trim()) {
        let searchData;

        if (mode === 'smart') {
          try {
            const conversational = await runConversationalSearch(q.trim(), lat, lng, { radius_km: nearbyRadiusKm });
            searchData = conversational?.data ?? {};
          } catch {
            const unified = await searchUnified(q.trim(), lat, lng, { radius_km: nearbyRadiusKm });
            searchData = {
              ...(unified?.data ?? {}),
              ai_used: false,
              fallback_used: true,
              parsed_filters: null,
              executed_query: q.trim(),
            };
          }
        } else {
          const unified = await searchUnified(q.trim(), lat, lng, { radius_km: nearbyRadiusKm });
          searchData = {
            ...(unified?.data ?? {}),
            ai_used: false,
            fallback_used: false,
            parsed_filters: null,
            executed_query: q.trim(),
          };
        }
        setProducts(searchData?.products ?? []);
        setShops(searchData?.shops ?? []);
        setSearchMeta({
          aiUsed: Boolean(searchData?.ai_used),
          fallbackUsed: Boolean(searchData?.fallback_used),
          parsedFilters: searchData?.parsed_filters ?? null,
          executedQuery: searchData?.executed_query ?? q.trim(),
        });
        setSearchError(null);
        return;
      }
      const params = { radius_km: nearbyRadiusKm };
      if (lat != null) params.lat = lat;
      if (lng != null) params.lng = lng;
      const res = await searchShops(q, params);
      // API returns { items: [...], total, page, per_page }
      setShops(res?.data?.items ?? []);
      setProducts([]);
      setSearchMeta(EMPTY_SEARCH_META);
      setSearchError(null);
    } catch (err) {
      setShops([]);
      setProducts([]);
      setSearchMeta(EMPTY_SEARCH_META);
      setSearchError({
        type: err?.errorType || 'unknown',
        message: err?.userMessage || 'Unable to load shops right now.',
      });
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  }, [lat, lng, nearbyRadiusKm]);

  // ─── Debounced search trigger ─────────────────────────────────────────────────

  const scheduleSearch = useCallback(
    (q, category, sort, tab, mode) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        setShowSuggestions(false);
        if (tab === 'products') fetchProducts(q, category, sort, mode);
        else fetchShops(q, mode);
        // Log search query for analytics
        if (q && q.trim().length >= 2) {
          logSearch(q.trim()).catch(() => {});
        }
      }, 450);
    },
    [fetchProducts, fetchShops],
  );

  useEffect(() => {
    scheduleSearch(query, selectedCategory, selectedSort, activeTab, searchMode);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [query, selectedCategory, selectedSort, activeTab, searchMode, scheduleSearch]);

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
    setSearchError(null);
    if (!text.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      setShowRecentPanel(inputFocused);
      setSearchMeta(EMPTY_SEARCH_META);
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
    scheduleSearch(term, selectedCategory, selectedSort, activeTab, searchMode);
  }, [selectedCategory, selectedSort, activeTab, searchMode, scheduleSearch]);

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
      scheduleSearch(item.name, selectedCategory, selectedSort, 'products', searchMode);
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

  const handleSaveIntent = async () => {
    const term = query.trim();
    if (!term) return;
    try {
      await saveSearchIntent(term, null);
      const res = await getSavedSearchIntents();
      setSavedIntents(Array.isArray(res?.data) ? res.data : []);
      Alert.alert('Saved', 'Search intent saved for quick rerun.');
    } catch {
      Alert.alert('Unable to save', 'Could not save this intent right now.');
    }
  };

  const handleDeleteIntent = async (intentId) => {
    try {
      await deleteSearchIntent(intentId);
      setSavedIntents((prev) => prev.filter((i) => String(i.id) !== String(intentId)));
    } catch {
      // ignore
    }
  };

  const handleTabChange = (tab) => { setActiveTab(tab); setHasSearched(false); };
  const handleCategoryChange = (cat) => { setSelectedCategory(cat); setHasSearched(false); };
  const handleSortChange = (sort) => { setSelectedSort(sort); setHasSearched(false); };
  const handleSearchModeChange = (mode) => { setSearchMode(mode); setHasSearched(false); };
  const handleCancel = () => { Keyboard.dismiss(); router.back(); };
  const handleClearInput = () => {
    setQuery('');
    setHasSearched(false);
    setSuggestions([]);
    setShowSuggestions(false);
    setShowRecentPanel(true);
    setSearchMeta(EMPTY_SEARCH_META);
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

  const handleVisualSearch = useCallback(async () => {
    if (!visualSearchEnabled) {
      showToast({ type: 'warning', message: 'Visual search is currently disabled on this server.' });
      return;
    }

    if (lat == null || lng == null) {
      showToast({ type: 'warning', message: 'Enable location to run nearby visual search.' });
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast({ type: 'warning', message: 'Allow photo access to run visual search.' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.82,
    });

    if (result.canceled || !result.assets?.length) return;

    setLoading(true);
    setVisualSearchError(null);
    try {
      const asset = result.assets[0];
      const uploadRes = await uploadFile(asset.uri, {
        folder: 'search',
        purpose: 'media',
        mimeType: asset.mimeType || 'image/jpeg',
        fileName: asset.fileName || `visual-search-${Date.now()}.jpg`,
      });
      const uploadData = uploadRes?.data ?? uploadRes;
      const imageUrl = uploadData?.url || uploadData?.file_url;
      if (!imageUrl) throw new Error('Image upload failed');

      const res = await visualSearchProducts({
        image_url: imageUrl,
        latitude: lat,
        longitude: lng,
        radius_km: 8,
        limit: 20,
      });

      const visualProducts = res?.data?.results ?? [];
      setProducts(visualProducts.map((item) => ({
        ...item,
        image_url: Array.isArray(item.images) ? item.images[0] : null,
        ranking_context: {
          source: 'visual_search',
          similarity: item.similarity,
          confidence_band: item.confidence_band,
        },
      })));
      setShops([]);
      setActiveTab('products');
      setHasSearched(true);
      setQuery('');
      setSearchMeta({
        aiUsed: true,
        fallbackUsed: false,
        parsedFilters: null,
        executedQuery: `Visual match (${visualProducts.length})`,
        visualSummary: res?.data?.summary || null,
      });
      if (!visualProducts.length) {
        setVisualSearchError('No close visual matches found. Try another angle or clearer image.');
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const rawDetail = typeof detail === 'string' ? detail : '';
      const featureDisabled = err?.response?.status === 403 && rawDetail.includes('FEATURE_VISUAL_SEARCH');

      if (featureDisabled) {
        setVisualSearchEnabled(false);
        setVisualSearchError('Visual search is not enabled for this environment.');
        showToast({ type: 'warning', message: 'Visual search is disabled on the backend.' });
        return;
      }

      const errorMessage =
        err?.errorType === 'network'
          ? 'NearShop backend is unreachable right now. Please try again shortly.'
          : (rawDetail || err?.userMessage || 'Could not run visual search right now.');
      setVisualSearchError(errorMessage);
      showToast({ type: 'error', message: errorMessage });
    } finally {
      setLoading(false);
      setShowSuggestions(false);
      setShowRecentPanel(false);
    }
  }, [lat, lng, showToast, visualSearchEnabled]);

  const handleSubmitEditing = () => {
    if (query.trim()) {
      executeSearch(query.trim());
    }
    setShowSuggestions(false);
    setShowRecentPanel(false);
  };

  // ─── Render helpers ───────────────────────────────────────────────────────────

  const renderProductItem = ({ item, index }) => {
    const isVisualResult = item?.ranking_context?.source === 'visual_search' || item?.source === 'visual_search';
    const similarity = item?.similarity ?? item?.ranking_context?.similarity;
    const band = item?.confidence_band ?? item?.ranking_context?.confidence_band;

    return (
      <View style={[styles.productItemWrap, index % 2 === 0 ? styles.productItemLeft : styles.productItemRight]}>
        <ProductCard
          product={item}
          tracking={query.trim() ? {
            ranking_surface: 'unified_search',
            source_screen: 'search_results',
            query: query.trim(),
            position: index + 1,
          } : null}
        />
        {isVisualResult && (
          <View style={styles.visualBadgeWrap}>
            <Text style={styles.visualBadgePrimary}>{toPercent(similarity)}</Text>
            <Text style={styles.visualBadgeSecondary}>{confidenceLabel(band)}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderShopItem = ({ item }) => (
    <View style={styles.shopItemWrap}>
      <ShopCard shop={item} />
    </View>
  );

  const renderEmpty = () => {
    if (loading || !hasSearched) return null;
    const count = activeTab === 'products' ? products.length : shops.length;
    if (count > 0) return null;

    const serviceUnavailable =
      searchError?.type === 'network' ||
      searchError?.type === 'server';

    if (serviceUnavailable) {
      return (
        <View style={styles.visualEmptyPanel}>
          <Text style={styles.visualEmptyEmoji}>📡</Text>
          <Text style={styles.visualEmptyTitle}>Search service unavailable</Text>
          <Text style={styles.visualEmptyText}>
            {searchError?.message || 'The backend is not reachable right now. Please retry in a moment.'}
          </Text>
          <TouchableOpacity
            style={styles.visualRetryBtn}
            onPress={() => scheduleSearch(query, selectedCategory, selectedSort, activeTab, searchMode)}
          >
            <Text style={styles.visualRetryBtnText}>Retry Search</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (activeTab === 'products' && searchMeta.executedQuery?.startsWith('Visual match')) {
      return (
        <View style={styles.visualEmptyPanel}>
          <Text style={styles.visualEmptyEmoji}>📷</Text>
          <Text style={styles.visualEmptyTitle}>Visual Search Result</Text>
          <Text style={styles.visualEmptyText}>{visualSearchError || 'No visual matches found for this image.'}</Text>
          <TouchableOpacity style={styles.visualRetryBtn} onPress={handleVisualSearch}>
            <Text style={styles.visualRetryBtnText}>Try Another Image</Text>
          </TouchableOpacity>
        </View>
      );
    }

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
  const activeAiChips = extractActiveAiChips(searchMeta.parsedFilters);

  useEffect(() => {
    if (!query.trim() || activeTab !== 'products' || !products.length) return;
    trackRankingImpressions(products, {
      ranking_surface: 'unified_search',
      source_screen: 'search_results',
      query: query.trim(),
    });
  }, [products, query, activeTab]);

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
          <TouchableOpacity
            onPress={handleVisualSearch}
            disabled={!visualSearchEnabled}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={[styles.visualBtn, !visualSearchEnabled && styles.visualBtnDisabled]}>📷</Text>
          </TouchableOpacity>
          {query.trim().length > 1 && (
            <TouchableOpacity onPress={handleSaveIntent} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={styles.saveIntentBtn}>★</Text>
            </TouchableOpacity>
          )}
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

      <LocationFallbackBanner
        visible={Boolean(locationError)}
        message="Search ranking and visual proximity matching may be less accurate without precise location."
        onRetry={async () => {
          await refreshLocation();
        }}
      />

      {/* ── Recent searches + trending panel (shown on focus, no query) ────── */}
      {showRecentPanel && !showSuggestions && (
        <View style={styles.suggestionsBox}>
          {savedIntents.length > 0 && (
            <>
              <View style={styles.panelSectionHeader}>
                <Text style={styles.panelSectionTitle}>Saved Intents</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedIntentRow}>
                {savedIntents.slice(0, 8).map((intent) => (
                  <View key={intent.id} style={styles.savedIntentChip}>
                    <TouchableOpacity onPress={() => executeSearch(intent.query)} style={styles.savedIntentChipMain}>
                      <Text style={styles.savedIntentText} numberOfLines={1}>{intent.label || intent.query}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteIntent(intent.id)}>
                      <Text style={styles.savedIntentDelete}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </>
          )}
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

      <View style={styles.searchModeRow}>
        {SEARCH_MODES.map((mode) => (
          <TouchableOpacity
            key={mode.key}
            style={[styles.searchModePill, searchMode === mode.key && styles.searchModePillActive]}
            onPress={() => handleSearchModeChange(mode.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.searchModeText, searchMode === mode.key && styles.searchModeTextActive]}>
              {mode.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.searchModeHint}>
        Smart AI expands your query and can fall back to normal search if needed. Standard searches exactly what you typed.
      </Text>

      {/* ── Filter + Sort chips (products only) ─────────────────────────────── */}
      {(query.trim().length > 0 || searchMeta.visualSummary) && hasSearched && !loading && (
        <View style={styles.aiMetaWrap}>
          <Text style={styles.aiMetaTitle}>
            {searchMeta.aiUsed ? 'AI search active' : 'Standard search active'}
          </Text>
          <Text style={styles.aiMetaSubtitle}>
            {searchMode === 'standard'
              ? 'Standard mode uses deterministic search without AI query expansion.'
              : searchMeta.fallbackUsed
              ? 'OpenAI was unavailable, so results came from normal search.'
              : searchMeta.aiUsed && searchMeta.executedQuery && searchMeta.executedQuery !== query.trim()
                ? `Expanded query: ${searchMeta.executedQuery}`
                : 'Showing results for your current query.'}
          </Text>
          {activeAiChips.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.aiChipRow}
              keyboardShouldPersistTaps="handled"
            >
              {activeAiChips.map((chip) => (
                <View key={chip} style={styles.aiChip}>
                  <Text style={styles.aiChipText}>{chip}</Text>
                </View>
              ))}
            </ScrollView>
          )}
          {searchMeta.visualSummary && (
            <View style={styles.visualSummaryRow}>
              {Object.entries(searchMeta.visualSummary)
                .filter(([, count]) => Number(count) > 0)
                .map(([band, count]) => (
                  <View key={band} style={styles.visualSummaryChip}>
                    <Text style={styles.visualSummaryText}>{`${band}: ${count}`}</Text>
                  </View>
                ))}
            </View>
          )}
        </View>
      )}

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
        <SearchScreenSkeleton />
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
  visualBtn: {
    fontSize: 16,
    paddingHorizontal: 2,
  },
  visualBtnDisabled: {
    opacity: 0.35,
  },
  saveIntentBtn: {
    fontSize: 16,
    color: '#c58a00',
    paddingHorizontal: 2,
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
  savedIntentRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  savedIntentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#edf6ff',
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 6,
    maxWidth: 220,
  },
  savedIntentChipMain: { maxWidth: 180 },
  savedIntentText: { fontSize: 12, color: '#164a78', fontWeight: '700' },
  savedIntentDelete: { marginLeft: 6, fontSize: 11, color: '#607a96', fontWeight: '700' },
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

  searchModeRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  searchModePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    backgroundColor: COLORS.white,
  },
  searchModePillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  searchModeText: {
    fontSize: 12,
    color: COLORS.gray600,
    fontWeight: '600',
  },
  searchModeTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  searchModeHint: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingBottom: 10,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.gray500,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },

  aiMetaWrap: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  aiMetaTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.gray800,
  },
  aiMetaSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.gray500,
    lineHeight: 18,
  },
  aiChipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
  },
  aiChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: COLORS.primaryLight,
  },
  aiChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
  visualSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  visualSummaryChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#e7f0ff',
  },
  visualSummaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e4f86',
    textTransform: 'capitalize',
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
  visualBadgeWrap: {
    position: 'absolute',
    left: 8,
    top: 8,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(6, 34, 58, 0.88)',
  },
  visualBadgePrimary: {
    fontSize: 10,
    color: COLORS.white,
    fontWeight: '700',
  },
  visualBadgeSecondary: {
    fontSize: 9,
    color: '#9ED0FF',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
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
  visualEmptyPanel: {
    marginTop: 24,
    marginHorizontal: 12,
    padding: 18,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    ...SHADOWS.card,
    alignItems: 'center',
  },
  visualEmptyEmoji: { fontSize: 34, marginBottom: 8 },
  visualEmptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.gray800 },
  visualEmptyText: { fontSize: 13, color: COLORS.gray500, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  visualRetryBtn: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  visualRetryBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 12 },
});
