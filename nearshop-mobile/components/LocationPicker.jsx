import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import useLocationStore from '../store/locationStore';
import { COLORS } from '../constants/theme';

const POPULAR = [
  { name: 'Koramangala, Bengaluru', lat: 12.9279, lng: 77.6271 },
  { name: 'Connaught Place, New Delhi', lat: 28.6315, lng: 77.2167 },
  { name: 'Bandra West, Mumbai', lat: 19.0596, lng: 72.8295 },
  { name: 'T. Nagar, Chennai', lat: 13.0418, lng: 80.2341 },
  { name: 'Hitech City, Hyderabad', lat: 17.4477, lng: 78.3760 },
  { name: 'Salt Lake, Kolkata', lat: 22.5726, lng: 88.4158 },
];

async function searchLocations(query) {
  if (!query || query.trim().length < 2) return [];
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1&countrycodes=in`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((item) => {
    const a = item.address || {};
    const short = [
      a.neighbourhood || a.suburb || a.hamlet,
      a.city || a.town || a.village || a.county,
      a.state,
    ].filter(Boolean).slice(0, 3).join(', ');
    return {
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      name: short || item.display_name?.split(',').slice(0, 2).join(',').trim(),
      fullName: item.display_name,
    };
  });
}

export default function LocationPicker({ visible, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);
  const { setLocation } = useLocationStore();

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setError('');
    }
  }, [visible]);

  const handleSearch = useCallback((val) => {
    setQuery(val);
    setError('');
    clearTimeout(debounceRef.current);
    if (!val.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await searchLocations(val);
        setResults(found);
      } catch {
        setError('Search failed. Check your internet.');
      } finally {
        setSearching(false);
      }
    }, 400);
  }, []);

  const handleSelect = async (lat, lng, name) => {
    await setLocation(lat, lng, name);
    Keyboard.dismiss();
    onClose();
  };

  const handleGPS = async () => {
    setError('');
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied. You can search manually or pick a city below.');
        setGpsLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      let address = 'Current location';
      try {
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        address = [geo.name, geo.district || geo.subregion].filter(Boolean).join(', ') || address;
      } catch { /* use fallback name */ }
      await setLocation(loc.coords.latitude, loc.coords.longitude, address);
      onClose();
    } catch (err) {
      setError('Could not get your location. Try searching manually.');
    } finally {
      setGpsLoading(false);
    }
  };

  const renderResult = ({ item }) => (
    <TouchableOpacity
      style={styles.resultRow}
      onPress={() => handleSelect(item.lat, item.lng, item.name)}
      activeOpacity={0.7}
    >
      <View style={styles.resultIcon}>
        <Text style={styles.resultIconText}>📍</Text>
      </View>
      <View style={styles.resultText}>
        <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.resultFull} numberOfLines={1}>
          {item.fullName?.split(',').slice(0, 3).join(',')}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  const renderPopular = ({ item }) => (
    <TouchableOpacity
      style={styles.resultRow}
      onPress={() => handleSelect(item.lat, item.lng, item.name)}
      activeOpacity={0.7}
    >
      <View style={styles.resultIcon}>
        <Text style={styles.resultIconText}>🏙️</Text>
      </View>
      <Text style={[styles.resultName, { flex: 1 }]} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  const showResults = !searching && results.length > 0;
  const noResults = !searching && query.length >= 2 && results.length === 0;
  const showPopular = !query;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handleBar} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>📍</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Set your location</Text>
            <Text style={styles.headerSubtitle}>To find shops near you</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Search input */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search area, street, city..."
            placeholderTextColor={COLORS.gray400}
            value={query}
            onChangeText={handleSearch}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {searching && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 8 }} />}
        </View>

        {/* GPS button */}
        <TouchableOpacity
          style={styles.gpsBtn}
          onPress={handleGPS}
          disabled={gpsLoading}
          activeOpacity={0.8}
        >
          {gpsLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <View style={styles.gpsIcon}>
              <Text style={{ fontSize: 18 }}>🎯</Text>
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.gpsBtnLabel}>
              {gpsLoading ? 'Getting your location...' : 'Use current location'}
            </Text>
            <Text style={styles.gpsBtnSub}>Auto-detect using GPS</Text>
          </View>
        </TouchableOpacity>

        {/* Error */}
        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️  {error}</Text>
          </View>
        )}

        {/* Results / Popular */}
        <FlatList
          data={showResults ? results : showPopular ? POPULAR : []}
          keyExtractor={(_, i) => String(i)}
          renderItem={showResults ? renderResult : renderPopular}
          ListHeaderComponent={
            showResults ? <Text style={styles.sectionLabel}>SEARCH RESULTS</Text>
            : noResults ? (
              <View style={styles.noResults}>
                <Text style={{ fontSize: 28 }}>📍</Text>
                <Text style={styles.noResultsTitle}>No results found</Text>
                <Text style={styles.noResultsSub}>Try a different area or city name</Text>
              </View>
            )
            : showPopular ? <Text style={styles.sectionLabel}>POPULAR CITIES</Text>
            : null
          }
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  headerIcon: {
    width: 36,
    height: 36,
    backgroundColor: '#EDE9FE',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconText: { fontSize: 18 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  headerSubtitle: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  closeBtn: {
    width: 32,
    height: 32,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    padding: 0,
  },

  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: '#EDE9FE',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#C4B5FD',
  },
  gpsIcon: {
    width: 38,
    height: 38,
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gpsBtnLabel: { fontSize: 14, fontWeight: '700', color: '#5B21B6' },
  gpsBtnSub: { fontSize: 12, color: '#7C3AED', marginTop: 2 },

  errorBox: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { fontSize: 13, color: '#DC2626' },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 1.2,
    marginTop: 16,
    marginBottom: 6,
    marginHorizontal: 20,
  },
  list: { marginTop: 4 },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  resultIcon: {
    width: 36,
    height: 36,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultIconText: { fontSize: 16 },
  resultText: { flex: 1 },
  resultName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  resultFull: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  chevron: { fontSize: 20, color: '#D1D5DB', fontWeight: '300' },

  noResults: { alignItems: 'center', paddingVertical: 24 },
  noResultsTitle: { fontSize: 15, fontWeight: '700', color: '#374151', marginTop: 8 },
  noResultsSub: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
});
