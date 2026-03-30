import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import useMyShop from '../../hooks/useMyShop';
import { updateShop } from '../../lib/shops';
import { uploadImage } from '../../lib/api';
import { COLORS, SHADOWS } from '../../constants/theme';
import { alert } from '../../components/ui/PremiumAlert';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_HEIGHT = 200;
const LOGO_SIZE = 100;

export default function BrandingScreen() {
  const { shop, shopId, loading: shopLoading, refresh } = useMyShop();
  
  const [logoUrl, setLogoUrl] = useState(null);
  const [bannerUrl, setBannerUrl] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (shop) {
      setLogoUrl(shop.logo_url);
      setBannerUrl(shop.cover_image);
      setGallery(shop.gallery || []);
      
      // Animate entrance
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [shop]);

  const pickImage = async (type) => {
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) {
      alert.warning({
        title: 'Permission Required',
        message: 'Please allow access to your photos to upload images.',
      });
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'logo' ? [1, 1] : type === 'banner' ? [16, 9] : [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      return result.assets[0].uri;
    }
    return null;
  };

  const handleUploadLogo = async () => {
    const uri = await pickImage('logo');
    if (!uri) return;

    setUploadingLogo(true);
    try {
      const response = await uploadImage(uri, 'shops', 'logo', shopId);
      if (response?.url) {
        setLogoUrl(response.url);
        setHasChanges(true);
      }
    } catch (err) {
      alert.error({ title: 'Upload Failed', message: 'Could not upload logo. Please try again.' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleUploadBanner = async () => {
    const uri = await pickImage('banner');
    if (!uri) return;

    setUploadingBanner(true);
    try {
      const response = await uploadImage(uri, 'shops', 'cover', shopId);
      if (response?.url) {
        setBannerUrl(response.url);
        setHasChanges(true);
      }
    } catch (err) {
      alert.error({ title: 'Upload Failed', message: 'Could not upload banner. Please try again.' });
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleAddGalleryImage = async () => {
    if (gallery.length >= 10) {
      alert.warning({ title: 'Limit Reached', message: 'You can upload up to 10 gallery images.' });
      return;
    }

    const uri = await pickImage('gallery');
    if (!uri) return;

    setUploadingGallery(true);
    try {
      const response = await uploadImage(uri, 'shops', 'image', shopId);
      if (response?.url) {
        setGallery([...gallery, response.url]);
        setHasChanges(true);
      }
    } catch (err) {
      alert.error({ title: 'Upload Failed', message: 'Could not upload image. Please try again.' });
    } finally {
      setUploadingGallery(false);
    }
  };

  const handleRemoveGalleryImage = (index) => {
    alert.confirm({
      title: 'Remove Image',
      message: 'Are you sure you want to remove this image?',
      confirmText: 'Remove',
      variant: 'danger',
    }).then((confirmed) => {
      if (confirmed) {
        const newGallery = [...gallery];
        newGallery.splice(index, 1);
        setGallery(newGallery);
        setHasChanges(true);
      }
    });
  };

  const handleSave = async () => {
    if (!shopId || !hasChanges) return;

    setSaving(true);
    try {
      await updateShop(shopId, {
        logo_url: logoUrl,
        cover_image: bannerUrl,
        gallery: gallery,
      });
      setHasChanges(false);
      await refresh();
      alert.success({ title: 'Saved!', message: 'Your shop branding has been updated.' });
    } catch (err) {
      alert.error({ title: 'Save Failed', message: 'Could not save changes. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (shopLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.gray800} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shop Branding</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.animatedContent,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Banner Section */}
          <Text style={styles.sectionTitle}>Cover Banner</Text>
          <Text style={styles.sectionDesc}>
            This appears at the top of your shop page (16:9 aspect ratio recommended)
          </Text>
          <TouchableOpacity
            style={styles.bannerContainer}
            onPress={handleUploadBanner}
            disabled={uploadingBanner}
          >
            {bannerUrl ? (
              <Image source={{ uri: bannerUrl }} style={styles.bannerImage} />
            ) : (
              <View style={styles.bannerPlaceholder}>
                <Ionicons name="image-outline" size={48} color={COLORS.gray400} />
                <Text style={styles.placeholderText}>Tap to upload banner</Text>
              </View>
            )}
            {uploadingBanner && (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator size="large" color={COLORS.white} />
              </View>
            )}
            <View style={styles.bannerEditBadge}>
              <Ionicons name="camera" size={16} color={COLORS.white} />
            </View>
          </TouchableOpacity>

          {/* Logo Section */}
          <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Shop Logo</Text>
          <Text style={styles.sectionDesc}>
            Your logo appears on shop cards and search results (1:1 ratio)
          </Text>
          <View style={styles.logoRow}>
            <TouchableOpacity
              style={styles.logoContainer}
              onPress={handleUploadLogo}
              disabled={uploadingLogo}
            >
              {logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.logoImage} />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Ionicons name="storefront-outline" size={40} color={COLORS.gray400} />
                </View>
              )}
              {uploadingLogo && (
                <View style={styles.logoUploadOverlay}>
                  <ActivityIndicator size="small" color={COLORS.white} />
                </View>
              )}
              <View style={styles.logoEditBadge}>
                <Ionicons name="camera" size={14} color={COLORS.white} />
              </View>
            </TouchableOpacity>
            <View style={styles.logoInfo}>
              <Text style={styles.logoInfoTitle}>{shop?.name || 'Your Shop'}</Text>
              <Text style={styles.logoInfoDesc}>
                {logoUrl ? 'Logo uploaded ✓' : 'Add a logo to build your brand identity'}
              </Text>
            </View>
          </View>

          {/* Gallery Section */}
          <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Shop Gallery</Text>
          <Text style={styles.sectionDesc}>
            Show off your shop, products, and ambiance ({gallery.length}/10 images)
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.galleryScroll}
            contentContainerStyle={styles.galleryContent}
          >
            {gallery.map((imgUrl, index) => (
              <View key={index} style={styles.galleryItem}>
                <Image source={{ uri: imgUrl }} style={styles.galleryImage} />
                <TouchableOpacity
                  style={styles.galleryRemoveBtn}
                  onPress={() => handleRemoveGalleryImage(index)}
                >
                  <Ionicons name="close" size={16} color={COLORS.white} />
                </TouchableOpacity>
              </View>
            ))}
            
            {gallery.length < 10 && (
              <TouchableOpacity
                style={styles.galleryAddBtn}
                onPress={handleAddGalleryImage}
                disabled={uploadingGallery}
              >
                {uploadingGallery ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <>
                    <Ionicons name="add" size={28} color={COLORS.primary} />
                    <Text style={styles.galleryAddText}>Add Photo</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Preview Section */}
          <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Preview</Text>
          <Text style={styles.sectionDesc}>
            This is how customers will see your shop
          </Text>
          <View style={styles.previewCard}>
            <View style={styles.previewBanner}>
              {bannerUrl ? (
                <Image source={{ uri: bannerUrl }} style={styles.previewBannerImage} />
              ) : (
                <View style={styles.previewBannerPlaceholder}>
                  <Text style={styles.previewPlaceholderText}>Banner</Text>
                </View>
              )}
              <View style={styles.previewLogoWrapper}>
                {logoUrl ? (
                  <Image source={{ uri: logoUrl }} style={styles.previewLogo} />
                ) : (
                  <View style={styles.previewLogoPlaceholder}>
                    <Ionicons name="storefront" size={24} color={COLORS.gray400} />
                  </View>
                )}
              </View>
            </View>
            <View style={styles.previewInfo}>
              <Text style={styles.previewShopName}>{shop?.name || 'Your Shop Name'}</Text>
              <View style={styles.previewMeta}>
                <Ionicons name="star" size={14} color="#FFB800" />
                <Text style={styles.previewRating}>{shop?.avg_rating || '4.5'}</Text>
                <Text style={styles.previewCategory}>{shop?.category || 'Category'}</Text>
              </View>
            </View>
          </View>

          {/* Tips Section */}
          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>💡 Branding Tips</Text>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>Use a high-quality logo with your shop name or icon</Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>Banner should showcase your products or shop interior</Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>Gallery images increase customer engagement by 40%</Text>
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, !hasChanges && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
                <Text style={styles.saveBtnText}>
                  {hasChanges ? 'Save Changes' : 'No Changes'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray50,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  animatedContent: {},
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.gray900,
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    color: COLORS.gray500,
    marginBottom: 12,
    lineHeight: 18,
  },
  bannerContainer: {
    width: '100%',
    height: BANNER_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.gray100,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bannerPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: COLORS.gray400,
    marginTop: 8,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerEditBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.small,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  logoContainer: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: COLORS.gray100,
    borderWidth: 3,
    borderColor: COLORS.white,
    ...SHADOWS.medium,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  logoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoUploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: LOGO_SIZE / 2,
  },
  logoEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  logoInfo: {
    flex: 1,
  },
  logoInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  logoInfoDesc: {
    fontSize: 13,
    color: COLORS.gray500,
    marginTop: 4,
  },
  galleryScroll: {
    marginHorizontal: -20,
  },
  galleryContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  galleryItem: {
    width: 110,
    height: 110,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.gray100,
  },
  galleryImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  galleryRemoveBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryAddBtn: {
    width: 110,
    height: 110,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight + '15',
  },
  galleryAddText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  previewCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: COLORS.gray100,
  },
  previewBanner: {
    height: 120,
    backgroundColor: COLORS.gray100,
  },
  previewBannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  previewBannerPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewPlaceholderText: {
    fontSize: 14,
    color: COLORS.gray400,
  },
  previewLogoWrapper: {
    position: 'absolute',
    bottom: -30,
    left: 16,
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    borderWidth: 3,
    borderColor: COLORS.white,
    ...SHADOWS.small,
  },
  previewLogo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  previewLogoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
  },
  previewInfo: {
    paddingTop: 36,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  previewShopName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  previewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  previewRating: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray700,
    marginRight: 8,
  },
  previewCategory: {
    fontSize: 13,
    color: COLORS.gray500,
  },
  tipsCard: {
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  tipsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.gray800,
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  tipBullet: {
    fontSize: 14,
    color: COLORS.gray600,
    marginRight: 8,
    marginTop: 1,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.gray700,
    lineHeight: 20,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 24,
    gap: 8,
    ...SHADOWS.medium,
  },
  saveBtnDisabled: {
    backgroundColor: COLORS.gray300,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
});
