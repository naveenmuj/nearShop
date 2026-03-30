import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  Animated,
  Dimensions,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import useMyShop from '../../hooks/useMyShop';

// Dynamic import with fallback for LinearGradient
let LinearGradient;
try {
  LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch (e) {
  LinearGradient = ({ colors, style, children, ...props }) => (
    <View style={[style, { backgroundColor: colors?.[0] || '#7C3AED' }]} {...props}>
      {children}
    </View>
  );
}
import { createStory, getShopStories, deleteStory } from '../../lib/stories';
import { uploadImage } from '../../lib/api';
import { COLORS, SHADOWS } from '../../constants/theme';
import { alert } from '../../components/ui/PremiumAlert';
import { toast } from '../../components/ui/Toast/toastRef';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STORY_CARD_WIDTH = (SCREEN_WIDTH - 60) / 3;

export default function StoriesScreen() {
  const { shop, shopId, loading: shopLoading, refresh: refreshShop } = useMyShop();
  
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [caption, setCaption] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchStories = useCallback(async () => {
    if (!shopId) return;
    try {
      const response = await getShopStories(shopId);
      setStories(response?.data || []);
    } catch (err) {
      console.error('Failed to fetch stories:', err);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    if (shopId) {
      fetchStories();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [shopId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStories();
    setRefreshing(false);
  };

  const pickImage = async () => {
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) {
      alert.warning({
        title: 'Permission Required',
        message: 'Please allow access to your photos.',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setShowCreateModal(true);
    }
  };

  const handleCamera = async () => {
    const permResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permResult.granted) {
      alert.warning({
        title: 'Permission Required',
        message: 'Please allow access to your camera.',
      });
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setShowCreateModal(true);
    }
  };

  const handleCreateStory = async () => {
    if (!selectedImage || !shopId) return;

    setCreating(true);
    setUploading(true);

    try {
      // Upload image
      const uploadResponse = await uploadImage(selectedImage, 'stories', 'story', shopId);
      if (!uploadResponse?.url) {
        throw new Error('Failed to upload image');
      }

      setUploading(false);

      // Create story
      const storyData = {
        image_url: uploadResponse.url,
        caption: caption.trim() || null,
      };

      await createStory(storyData, shopId);
      
      toast.success('Story published! 🎉');
      setShowCreateModal(false);
      setSelectedImage(null);
      setCaption('');
      await fetchStories();
    } catch (err) {
      console.error('Failed to create story:', err);
      alert.error({
        title: 'Failed',
        message: 'Could not create story. Please try again.',
      });
    } finally {
      setCreating(false);
      setUploading(false);
    }
  };

  const handleDeleteStory = async (storyId) => {
    const confirmed = await alert.confirm({
      title: 'Delete Story',
      message: 'Are you sure you want to delete this story?',
      confirmText: 'Delete',
      variant: 'danger',
    });

    if (confirmed) {
      try {
        await deleteStory(storyId);
        toast.success('Story deleted');
        fetchStories();
      } catch (err) {
        alert.error({ title: 'Error', message: 'Failed to delete story' });
      }
    }
  };

  const formatExpiryTime = (createdAt) => {
    if (!createdAt) return '';
    const created = new Date(createdAt);
    const expires = new Date(created.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    const diff = expires - now;
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h left`;
    return `${mins}m left`;
  };

  if (shopLoading || loading) {
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
        <Text style={styles.headerTitle}>Shop Stories</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Create Story Section */}
          <View style={styles.createSection}>
            <Text style={styles.sectionTitle}>Create Story</Text>
            <Text style={styles.sectionDesc}>
              Stories disappear after 24 hours and are shown to nearby customers
            </Text>

            <View style={styles.createOptions}>
              <TouchableOpacity style={styles.createOptionCard} onPress={handleCamera}>
                <LinearGradient
                  colors={['#F97316', '#EA580C']}
                  style={styles.createOptionGradient}
                >
                  <Ionicons name="camera" size={32} color="#fff" />
                </LinearGradient>
                <Text style={styles.createOptionText}>Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.createOptionCard} onPress={pickImage}>
                <LinearGradient
                  colors={['#8B5CF6', '#7C3AED']}
                  style={styles.createOptionGradient}
                >
                  <Ionicons name="images" size={32} color="#fff" />
                </LinearGradient>
                <Text style={styles.createOptionText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Active Stories */}
          <View style={styles.activeSection}>
            <View style={styles.activeSectionHeader}>
              <Text style={styles.sectionTitle}>Active Stories</Text>
              {stories.length > 0 && (
                <View style={styles.storyCountBadge}>
                  <Text style={styles.storyCountText}>{stories.length}</Text>
                </View>
              )}
            </View>

            {stories.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="sparkles-outline" size={48} color={COLORS.gray300} />
                </View>
                <Text style={styles.emptyTitle}>No Active Stories</Text>
                <Text style={styles.emptyDesc}>
                  Create your first story to engage with nearby customers!
                </Text>
              </View>
            ) : (
              <View style={styles.storiesGrid}>
                {stories.map((story) => (
                  <View key={story.id} style={styles.storyCard}>
                    <Image
                      source={{ uri: story.image_url }}
                      style={styles.storyImage}
                      resizeMode="cover"
                    />
                    
                    {/* Gradient Overlay */}
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.7)']}
                      style={styles.storyOverlay}
                    />

                    {/* Timer Badge */}
                    <View style={styles.storyTimerBadge}>
                      <Ionicons name="time-outline" size={12} color="#fff" />
                      <Text style={styles.storyTimerText}>
                        {formatExpiryTime(story.created_at)}
                      </Text>
                    </View>

                    {/* Views */}
                    <View style={styles.storyViewsBadge}>
                      <Ionicons name="eye-outline" size={14} color="#fff" />
                      <Text style={styles.storyViewsText}>{story.view_count || 0}</Text>
                    </View>

                    {/* Delete Button */}
                    <TouchableOpacity
                      style={styles.storyDeleteBtn}
                      onPress={() => handleDeleteStory(story.id)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#fff" />
                    </TouchableOpacity>

                    {/* Caption Preview */}
                    {story.caption && (
                      <Text style={styles.storyCaption} numberOfLines={2}>
                        {story.caption}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Tips Section */}
          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>💡 Story Tips</Text>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>Post during peak hours (9-11 AM, 6-9 PM)</Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>Showcase new arrivals and limited-time offers</Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>Use vertical images (9:16) for best display</Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>Add captions to increase engagement</Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Create Story Modal */}
      {showCreateModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Story</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => {
                  setShowCreateModal(false);
                  setSelectedImage(null);
                  setCaption('');
                }}
              >
                <Ionicons name="close" size={24} color={COLORS.gray600} />
              </TouchableOpacity>
            </View>

            {/* Preview */}
            <View style={styles.previewContainer}>
              <Image
                source={{ uri: selectedImage }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            </View>

            {/* Caption Input */}
            <View style={styles.captionInputContainer}>
              <TextInput
                style={styles.captionInput}
                placeholder="Add a caption (optional)"
                placeholderTextColor={COLORS.gray400}
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={200}
              />
              <Text style={styles.captionCharCount}>{caption.length}/200</Text>
            </View>

            {/* Publish Button */}
            <TouchableOpacity
              style={[styles.publishBtn, creating && styles.publishBtnDisabled]}
              onPress={handleCreateStory}
              disabled={creating}
            >
              {creating ? (
                <View style={styles.publishBtnContent}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.publishBtnText}>
                    {uploading ? 'Uploading...' : 'Publishing...'}
                  </Text>
                </View>
              ) : (
                <View style={styles.publishBtnContent}>
                  <Ionicons name="rocket" size={20} color="#fff" />
                  <Text style={styles.publishBtnText}>Publish Story</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  createSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gray900,
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    color: COLORS.gray500,
    marginBottom: 16,
  },
  createOptions: {
    flexDirection: 'row',
    gap: 16,
  },
  createOptionCard: {
    flex: 1,
    alignItems: 'center',
  },
  createOptionGradient: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  createOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray700,
    marginTop: 10,
  },
  activeSection: {
    marginBottom: 24,
  },
  activeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  storyCountBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  storyCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: COLORS.gray50,
    borderRadius: 16,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gray700,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    color: COLORS.gray500,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  storiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  storyCard: {
    width: STORY_CARD_WIDTH,
    height: STORY_CARD_WIDTH * 1.6,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.gray100,
  },
  storyImage: {
    width: '100%',
    height: '100%',
  },
  storyOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  storyTimerBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  storyTimerText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  storyViewsBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  storyViewsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  storyDeleteBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyCaption: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    fontSize: 10,
    color: '#fff',
    lineHeight: 14,
  },
  tipsCard: {
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 16,
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

  // Modal
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  modalCloseBtn: {
    padding: 4,
  },
  previewContainer: {
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.gray100,
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  captionInputContainer: {
    marginBottom: 16,
  },
  captionInput: {
    backgroundColor: COLORS.gray50,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: COLORS.gray900,
    minHeight: 60,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  captionCharCount: {
    fontSize: 12,
    color: COLORS.gray400,
    textAlign: 'right',
    marginTop: 4,
  },
  publishBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  publishBtnDisabled: {
    opacity: 0.7,
  },
  publishBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  publishBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
