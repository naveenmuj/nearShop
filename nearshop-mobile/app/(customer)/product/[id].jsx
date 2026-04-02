import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator,
  StatusBar, FlatList, TextInput, KeyboardAvoidingView, Platform,
  Modal, Dimensions, Image, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { COLORS, SHADOWS, formatPrice, formatDate } from '../../../constants/theme';
import { getProduct, getSimilarProducts } from '../../../lib/products';
import DealCountdown from '../../../components/DealCountdown';
import { addToWishlist, removeFromWishlist } from '../../../lib/wishlists';
import { trackView } from '../../../lib/engagement';
import { trackEvent } from '../../../lib/analytics';
import { startHaggle } from '../../../lib/haggle';
import { startConversation } from '../../../lib/messaging';
import { createOrder } from '../../../lib/orders';
import { toast } from '../../../components/ui/Toast';
import * as Linking from 'expo-linking';
import useAuthStore from '../../../store/authStore';
import useCartStore from '../../../store/cartStore';
import useLocationStore from '../../../store/locationStore';
import { ProductDetailSkeleton } from '../../../components/ui/ScreenSkeletons';
import { extractRankingContextFromParams, trackRankingAction } from '../../../lib/rankingTracking';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Cart button ─────────────────────────────────────────────────────────────
function CartButton({ product, isAvailable, hagglingEnabled }) {
  const addItem = useCartStore((s) => s.addItem);
  const getItemForProduct = useCartStore((s) => s.getItemForProduct);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const getItemCount = useCartStore((s) => s.getItemCount);
  const cartItem = getItemForProduct(product?.id);
  const totalItems = getItemCount();

  const rankingContext = product?.ranking_context || null;

  if (!isAvailable) {
    return (
      <Pressable style={[styles.orderBtn, styles.orderBtnDisabled, !hagglingEnabled && { flex: 1 }]} disabled>
        <Text style={styles.orderBtnText}>Out of Stock</Text>
      </Pressable>
    );
  }

  if (cartItem) {
    return (
      <View style={[styles.orderBtn, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }, !hagglingEnabled && { flex: 1 }]}>
        <Pressable onPress={() => updateQuantity(product.id, cartItem.quantity - 1)} style={{ padding: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 8 }}>
          <Text style={{ color: COLORS.white, fontSize: 18, fontWeight: '700' }}>−</Text>
        </Pressable>
        <Text style={[styles.orderBtnText, { minWidth: 24, textAlign: 'center' }]}>{cartItem.quantity}</Text>
        <Pressable onPress={() => updateQuantity(product.id, cartItem.quantity + 1)} style={{ padding: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 8 }}>
          <Text style={{ color: COLORS.white, fontSize: 18, fontWeight: '700' }}>+</Text>
        </Pressable>
        {totalItems > 0 && (
          <Pressable onPress={() => router.push('/(customer)/cart')} style={{ marginLeft: 6, padding: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 8 }}>
            <Text style={{ color: COLORS.white, fontSize: 12, fontWeight: '700' }}>Cart ({totalItems})</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <Pressable
      style={[styles.orderBtn, !hagglingEnabled && { flex: 1 }]}
      onPress={() => {
        addItem(product, {
          id: product.shop_id || product.shop?.id,
          name: product.shop_name || product.shop?.name,
        }, rankingContext);
        trackRankingAction('add_to_cart', product, rankingContext);
        toast.show({ type: 'cart', text1: `${product.name} added to cart` });
      }}
    >
      <Text style={styles.orderBtnText}>🛒 Add to Cart</Text>
    </Pressable>
  );
}

// ── Image carousel ──────────────────────────────────────────────────────────
function ImageCarousel({ images = [] }) {
  const [index, setIndex] = useState(0);
  const scrollRef = useRef(null);
  const displayImages = images.length > 0 ? images : [null];

  const onScroll = (e) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setIndex(newIndex);
  };

  return (
    <View style={carousel.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {displayImages.map((uri, i) => (
          <View key={i} style={[carousel.slide, { width: SCREEN_W }]}>
            {uri ? (
              <Image
                source={{ uri }}
                style={carousel.img}
                resizeMode="cover"
              />
            ) : (
              <View style={[carousel.img, { backgroundColor: COLORS.gray100, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ fontSize: 56 }}>📦</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
      {displayImages.length > 1 && (
        <View style={carousel.dots}>
          {displayImages.map((_, i) => (
            <View key={i} style={[carousel.dot, i === index && carousel.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const carousel = StyleSheet.create({
  container: { position: 'relative' },
  slide: { height: 280 },
  img: { width: '100%', height: 280, justifyContent: 'center', alignItems: 'center' },
  dots: {
    position: 'absolute', bottom: 12, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: COLORS.white, width: 18 },
});

// ── Haggle bottom sheet ──────────────────────────────────────────────────────
function HaggleSheet({ visible, product, onClose, onSuccess }) {
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const offerPrice = parseFloat(price);
    if (!offerPrice || offerPrice <= 0) {
      toast.warning('Please enter a valid offer price.');
      return;
    }
    if (offerPrice >= product.price) {
      toast.info('Your offer must be lower than the listed price.');
      return;
    }
    setLoading(true);
    try {
      await startHaggle({
        product_id: product.id,
        shop_id: product.shop_id,
        offered_price: offerPrice,
        message: message.trim() || undefined,
      });
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? 'Failed to send offer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <Pressable style={sheet.backdrop} onPress={onClose} />
        <View style={sheet.container}>
          <View style={sheet.handle} />
          <Text style={sheet.title}>Make an Offer</Text>
          <Text style={sheet.sub}>Listed at {formatPrice(product?.price)}</Text>

          <Text style={sheet.label}>Your offer price (₹)</Text>
          <TextInput
            style={sheet.input}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            placeholder={`Max ${formatPrice(product?.price)}`}
            placeholderTextColor={COLORS.gray400}
          />

          <Text style={sheet.label}>Message (optional)</Text>
          <TextInput
            style={[sheet.input, sheet.textarea]}
            value={message}
            onChangeText={setMessage}
            multiline
            placeholder="Why should the seller accept your offer?"
            placeholderTextColor={COLORS.gray400}
          />

          <Pressable
            style={[sheet.submitBtn, loading && sheet.submitDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={sheet.submitText}>Send Offer</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const sheet = StyleSheet.create({
  backdrop: { flex: 1 },
  container: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.gray200,
    alignSelf: 'center', marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.gray900, marginBottom: 4 },
  sub: { fontSize: 13, color: COLORS.gray500, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.gray700, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.gray50, borderWidth: 1, borderColor: COLORS.gray200,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: COLORS.gray900, marginBottom: 16,
  },
  textarea: { height: 80, textAlignVertical: 'top' },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 4,
  },
  submitDisabled: { opacity: 0.7 },
  submitText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
});

// ── Main screen ──────────────────────────────────────────────────────────────
export default function ProductDetailScreen() {
  const params = useLocalSearchParams();
  const { id } = params;
  const { user } = useAuthStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { lat, lng } = useLocationStore();
  const [product, setProduct] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inWishlist, setInWishlist] = useState(false);
  const [showHaggle, setShowHaggle] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  const rankingContext = useMemo(
    () => extractRankingContextFromParams(params),
    [params.surface, params.reason, params.query, params.source_screen, params.position],
  );

  useEffect(() => {
    const load = async () => {
      try {
        const [pRes, sRes] = await Promise.allSettled([
          getProduct(id),
          getSimilarProducts(id),
        ]);
        if (pRes.status === 'fulfilled') setProduct({ ...pRes.value.data, ranking_context: rankingContext });
        if (sRes.status === 'fulfilled') setSimilar(sRes.value.data?.items ?? sRes.value.data ?? []);
        // Track this product view for recently viewed
        trackView(id).catch(() => {});
        trackEvent({
          event_type: 'product_view',
          entity_type: 'product',
          entity_id: id,
          metadata: rankingContext.ranking_surface ? rankingContext : undefined,
          lat,
          lng,
        }).catch(() => {});
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id, lat, lng, rankingContext]);

  const toggleWishlist = async () => {
    try {
      if (inWishlist) {
        await removeFromWishlist(id);
      } else {
        await addToWishlist(id);
        if (product) trackRankingAction('wishlist_add', product, rankingContext);
      }
      setInWishlist((v) => !v);
    } catch {
      // ignore
    }
  };

  const handleShare = async () => {
    const shareUrl = `https://nearshop.in/app/product/${id}`;
    const message = `Check out ${product?.name || 'this product'} on NearShop!\n\n${shareUrl}`;
    
    try {
      // Use native Share API - shows native share sheet with all apps
      await Share.share({
        message: message,
        title: product?.name || 'Product',
        url: shareUrl, // iOS uses this
      });
    } catch (error) {
      // User cancelled or error occurred
      console.error('Share failed:', error);
      if (error?.message !== 'User did not share') {
        toast.info('Share this link: ' + shareUrl);
      }
    }
  };

  const handleMessageShop = async () => {
    if (!isAuthenticated) {
      toast.info('Please sign in to message this shop.');
      router.push('/(auth)/email');
      return;
    }
    if (!product?.shop_id || startingChat) return;

    setStartingChat(true);
    try {
      const conversation = await startConversation(product.shop_id, product.id);
      if (conversation?.id) {
        router.push(`/(customer)/chat/${conversation.id}`);
      } else {
        router.push('/(customer)/messages');
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not start chat. Please try again.');
    } finally {
      setStartingChat(false);
    }
  };

  const handleWhatsApp = () => {
    const shop = product?.shop || {};
    const phone = (shop.whatsapp || shop.phone || '').replace('+', '');
    const msg = encodeURIComponent(`Hi, I saw ${product?.name} on NearShop — is it available?`);
    Linking.openURL(`https://wa.me/${phone}?text=${msg}`).catch(() => {});
    trackEvent({ event_type: 'inquiry', entity_type: 'product', entity_id: id }).catch(() => {});
  };

  const handleOrder = async () => {
    if (!product) return;
    if (!product.shop_id) {
      toast.error('Shop information is missing. Please try again.');
      return;
    }
    setOrdering(true);
    try {
      await createOrder({
        shop_id: product.shop_id,
        items: [{ product_id: product.id, quantity: 1, price: product.price, ranking_context: rankingContext.ranking_surface ? rankingContext : null }],
      });
      toast.order('Order placed successfully. Tracking is available in Orders.');
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? 'Failed to place order');
    } finally {
      setOrdering(false);
    }
  };

  const handleHaggleSuccess = () => {
    setShowHaggle(false);
    toast.success('Offer sent. The seller will respond shortly.');
  };

  if (isLoading) {
    return <ProductDetailSkeleton />;
  }

  if (!product) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorEmoji}>🔍</Text>
        <Text style={styles.errorText}>Product Not Found</Text>
        <Text style={styles.errorSubtext}>
          This product may have been removed or is no longer available
        </Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Go Back</Text>
        </Pressable>
        <Pressable 
          style={[styles.backBtn, { backgroundColor: COLORS.primary, marginTop: 8 }]} 
          onPress={() => router.push('/(customer)/search')}
        >
          <Text style={[styles.backBtnText, { color: COLORS.white }]}>Browse Products</Text>
        </Pressable>
      </View>
    );
  }

  const isAvailable = product.is_available !== false;
  const hagglingEnabled = product.haggling_enabled;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Back + share + wishlist overlay on hero */}
      <View style={styles.floatingHeader} pointerEvents="box-none">
        <Pressable style={styles.floatBtn} onPress={() => router.back()}>
          <Text style={styles.floatBtnText}>←</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            style={styles.floatBtn}
            onPress={handleMessageShop}
            disabled={startingChat}
          >
            {startingChat ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={styles.floatBtnText}>💬</Text>}
          </Pressable>
          <Pressable style={styles.floatBtn} onPress={handleShare}>
            <Text style={styles.floatBtnText}>🔗</Text>
          </Pressable>
          <Pressable style={styles.floatBtn} onPress={toggleWishlist}>
            <Text style={styles.floatBtnText}>{inWishlist ? '❤️' : '🤍'}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <ImageCarousel images={product.images ?? []} />

        <View style={styles.body}>
          {/* Title + badges */}
          <View style={styles.titleRow}>
            <Text style={styles.productName}>{product.name}</Text>
            {!isAvailable && (
              <View style={styles.unavailableBadge}>
                <Text style={styles.unavailableText}>Out of stock</Text>
              </View>
            )}
          </View>

          <View style={styles.metaRow}>
            {product.category ? (
              <View style={styles.catBadge}>
                <Text style={styles.catBadgeText}>{product.category}</Text>
              </View>
            ) : null}
            {product.sku ? (
              <Text style={styles.sku}>SKU: {product.sku}</Text>
            ) : null}
            {(product.view_count > 0 || product.views > 0) ? (
              <View style={styles.viewBadge}>
                <Text style={styles.viewBadgeText}>👁 {product.view_count || product.views} views</Text>
              </View>
            ) : null}
          </View>

          {/* Price */}
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(product.price)}</Text>
            {product.original_price && product.original_price > product.price ? (
              <>
                <Text style={styles.originalPrice}>{formatPrice(product.original_price)}</Text>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>
                    {Math.round((1 - product.price / product.original_price) * 100)}% off
                  </Text>
                </View>
              </>
            ) : null}
          </View>

          {/* Deal Countdown */}
          {product.deal_ends_at ? (
            <View style={styles.dealCountdownWrap}>
              <DealCountdown dealEndsAt={product.deal_ends_at} compact={false} />
            </View>
          ) : null}

          {/* Shop info */}
          <Pressable
            style={styles.shopCard}
            onPress={() => router.push(`/(customer)/shop/${product.shop_id}`)}
          >
            <View style={styles.shopAvatar}>
              <Text style={{ fontSize: 18 }}>🏪</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.shopName}>{product.shop_name}</Text>
              {product.shop_address ? (
                <Text style={styles.shopAddress} numberOfLines={1}>{product.shop_address}</Text>
              ) : null}
            </View>
            <Text style={styles.shopChevron}>›</Text>
          </Pressable>

          {/* Description */}
          {product.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{product.description}</Text>
            </View>
          ) : null}

          {/* Specs / attributes */}
          {product.attributes && typeof product.attributes === 'object' && !Array.isArray(product.attributes) && Object.keys(product.attributes).length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Specifications</Text>
              {Object.entries(product.attributes).map(([k, v]) => (
                <View key={k} style={styles.specRow}>
                  <Text style={styles.specKey}>{k}</Text>
                  <Text style={styles.specVal}>{String(v)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Haggle hint */}
          {hagglingEnabled && isAvailable ? (
            <View style={styles.haggleHint}>
              <Text style={styles.haggleHintIcon}>🤝</Text>
              <Text style={styles.haggleHintText}>
                This seller accepts price negotiations. Make an offer below!
              </Text>
            </View>
          ) : null}

          {/* Similar products */}
          {similar.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Similar Products</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                {similar.map((p) => (
                  <Pressable
                    key={p.id}
                    style={styles.simCard}
                    onPress={() => router.push(`/(customer)/product/${p.id}`)}
                  >
                    <View style={styles.simImg}>
                      {p.images?.[0] ? (
                        <Image source={{ uri: p.images[0] }} style={{ width: '100%', height: '100%', borderRadius: 8 }} resizeMode="cover" />
                      ) : (
                        <Text style={{ fontSize: 28 }}>📦</Text>
                      )}
                    </View>
                    <Text style={styles.simName} numberOfLines={2}>{p.name}</Text>
                    <Text style={styles.simPrice}>{formatPrice(p.price)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* Bottom padding for sticky bar */}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Sticky action bar */}
      <SafeAreaView edges={['bottom']} style={styles.stickyBar}>
        <View style={styles.stickyInner}>
          {/* WhatsApp + Share row */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: isAvailable ? 8 : 0 }}>
            <Pressable
              style={[styles.haggleBtn, { flex: 1, backgroundColor: '#25D366' }]}
              onPress={handleWhatsApp}
            >
              <Text style={[styles.haggleBtnText, { color: '#fff' }]}>💬 WhatsApp</Text>
            </Pressable>
            <Pressable
              style={[styles.haggleBtn, { flex: 1, backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary }]}
              onPress={handleShare}
            >
              <Text style={[styles.haggleBtnText, { color: COLORS.primary }]}>🔗 Share</Text>
            </Pressable>
          </View>
          {/* Haggle and Cart row */}
          {isAvailable ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                style={[styles.haggleBtn, { flex: 1 }]}
                onPress={() => setShowHaggle(true)}
              >
                <Text style={styles.haggleBtnText}>🤝 Haggle</Text>
              </Pressable>
              <CartButton product={product} isAvailable={isAvailable} hagglingEnabled={hagglingEnabled} />
            </View>
          ) : (
            <CartButton product={product} isAvailable={isAvailable} hagglingEnabled={hagglingEnabled} />
          )}
        </View>
      </SafeAreaView>

      {/* Haggle bottom sheet */}
      {showHaggle && (
        <HaggleSheet
          visible={showHaggle}
          product={product}
          onClose={() => setShowHaggle(false)}
          onSuccess={handleHaggleSuccess}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: COLORS.bg, paddingHorizontal: 24 },
  errorEmoji: { fontSize: 64, marginBottom: 8 },
  errorText: { fontSize: 20, fontWeight: '700', color: COLORS.gray900, textAlign: 'center' },
  errorSubtext: { fontSize: 14, color: COLORS.gray600, textAlign: 'center', marginBottom: 12 },
  backBtn: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: COLORS.gray200, borderRadius: 12, minWidth: 180 },
  backBtnText: { color: COLORS.gray900, fontWeight: '600', textAlign: 'center' },
  scroll: { flex: 1 },
  floatingHeader: {
    position: 'absolute', top: 48, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16,
  },
  floatBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center', alignItems: 'center',
  },
  floatBtnText: { fontSize: 18, color: COLORS.white },
  body: { paddingHorizontal: 20, paddingTop: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  productName: { flex: 1, fontSize: 20, fontWeight: '700', color: COLORS.gray900, lineHeight: 26 },
  unavailableBadge: {
    backgroundColor: COLORS.redLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  unavailableText: { fontSize: 11, fontWeight: '700', color: COLORS.red },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  catBadge: {
    backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  catBadgeText: { fontSize: 12, fontWeight: '600', color: COLORS.primaryDark },
  sku: { fontSize: 12, color: COLORS.gray400 },
  viewBadge: { backgroundColor: COLORS.gray100, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  viewBadgeText: { fontSize: 11, color: COLORS.gray500, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  price: { fontSize: 24, fontWeight: '700', color: COLORS.green },
  originalPrice: { fontSize: 15, color: COLORS.gray400, textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: COLORS.redLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  discountText: { fontSize: 12, fontWeight: '700', color: COLORS.red },
  shopCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 20,
    ...SHADOWS.card,
  },
  shopAvatar: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  shopName: { fontSize: 14, fontWeight: '600', color: COLORS.gray900 },
  shopAddress: { fontSize: 12, color: COLORS.gray500, marginTop: 2 },
  shopChevron: { fontSize: 20, color: COLORS.gray300 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.gray900, marginBottom: 10 },
  description: { fontSize: 14, color: COLORS.gray600, lineHeight: 22 },
  specRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray100,
  },
  specKey: { fontSize: 13, color: COLORS.gray500, flex: 1 },
  specVal: { fontSize: 13, fontWeight: '600', color: COLORS.gray800, flex: 1, textAlign: 'right' },
  haggleHint: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.greenLight, borderRadius: 12, padding: 14, marginBottom: 24,
  },
  haggleHintIcon: { fontSize: 20 },
  haggleHintText: { flex: 1, fontSize: 13, color: COLORS.green, lineHeight: 18 },
  simCard: {
    width: 140, backgroundColor: COLORS.white, borderRadius: 12,
    padding: 10, marginHorizontal: 4, ...SHADOWS.card,
  },
  simImg: {
    height: 90, backgroundColor: COLORS.gray50, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  simName: { fontSize: 12, fontWeight: '600', color: COLORS.gray800, marginBottom: 4, lineHeight: 16 },
  simPrice: { fontSize: 13, fontWeight: '700', color: COLORS.green },
  dealCountdownWrap: {
    marginBottom: 16,
  },
  stickyBar: {
    backgroundColor: COLORS.white, borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.gray200,
  },
  stickyInner: { flexDirection: 'column', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  haggleBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 14,
    backgroundColor: COLORS.amberLight, alignItems: 'center',
  },
  haggleBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.amber },
  orderBtn: {
    flex: 2, paddingVertical: 16, borderRadius: 14,
    backgroundColor: COLORS.primary, alignItems: 'center',
  },
  orderBtnDisabled: { backgroundColor: COLORS.gray300 },
  orderBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
});
