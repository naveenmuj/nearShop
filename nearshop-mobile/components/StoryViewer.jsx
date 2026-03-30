import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
  StatusBar,
  Platform,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { COLORS, SHADOWS } from '../constants/theme';
import { viewStory } from '../lib/stories';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORY_DURATION = 5000; // 5 seconds per story

/**
 * Story Viewer - Instagram-style full-screen story viewer
 */
export default function StoryViewer({
  visible,
  onClose,
  stories = [],
  initialShopIndex = 0,
  initialStoryIndex = 0,
}) {
  const [currentShopIndex, setCurrentShopIndex] = useState(initialShopIndex);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(initialStoryIndex);
  const [isPaused, setIsPaused] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const progressTimer = useRef(null);

  const currentShop = stories[currentShopIndex];
  const currentStory = currentShop?.stories?.[currentStoryIndex];

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 65,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Reset to initial indices
      setCurrentShopIndex(initialShopIndex);
      setCurrentStoryIndex(initialStoryIndex);
    }
    
    return () => {
      if (progressTimer.current) {
        clearInterval(progressTimer.current);
      }
    };
  }, [visible, initialShopIndex, initialStoryIndex]);

  // Start story timer
  useEffect(() => {
    if (!visible || !currentStory || !imageLoaded || isPaused) return;

    progressAnim.setValue(0);
    const animation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      if (finished) {
        handleNextStory();
      }
    });

    return () => animation.stop();
  }, [visible, currentShopIndex, currentStoryIndex, imageLoaded, isPaused]);

  // Record view
  useEffect(() => {
    if (visible && currentStory?.id) {
      viewStory(currentStory.id).catch(console.error);
    }
  }, [visible, currentStory?.id]);

  const handleNextStory = useCallback(() => {
    if (currentShop?.stories && currentStoryIndex < currentShop.stories.length - 1) {
      // Next story in same shop
      setCurrentStoryIndex((prev) => prev + 1);
      setImageLoaded(false);
    } else if (currentShopIndex < stories.length - 1) {
      // Next shop
      setCurrentShopIndex((prev) => prev + 1);
      setCurrentStoryIndex(0);
      setImageLoaded(false);
    } else {
      // End of all stories
      handleClose();
    }
  }, [currentShopIndex, currentStoryIndex, currentShop?.stories?.length, stories.length]);

  const handlePrevStory = useCallback(() => {
    if (currentStoryIndex > 0) {
      // Previous story in same shop
      setCurrentStoryIndex((prev) => prev - 1);
      setImageLoaded(false);
    } else if (currentShopIndex > 0) {
      // Previous shop (go to last story)
      const prevShop = stories[currentShopIndex - 1];
      setCurrentShopIndex((prev) => prev - 1);
      setCurrentStoryIndex(prevShop?.stories?.length - 1 || 0);
      setImageLoaded(false);
    }
  }, [currentShopIndex, currentStoryIndex, stories]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const handleTapLeft = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handlePrevStory();
  };

  const handleTapRight = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleNextStory();
  };

  const handleLongPressIn = () => {
    setIsPaused(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleLongPressOut = () => {
    setIsPaused(false);
  };

  const handleShopPress = () => {
    handleClose();
    if (currentShop?.shop_id) {
      router.push(`/(customer)/shop/${currentShop.shop_id}`);
    }
  };

  if (!visible || !currentShop || !currentStory) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <StatusBar barStyle="light-content" />
      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Background */}
        <View style={styles.background}>
          {currentStory.image_url && (
            <Image
              source={{ uri: currentStory.image_url }}
              style={styles.backgroundImage}
              blurRadius={20}
            />
          )}
          <View style={styles.backgroundOverlay} />
        </View>

        {/* Story Image */}
        <Image
          source={{ uri: currentStory.image_url }}
          style={styles.storyImage}
          resizeMode="contain"
          onLoad={() => setImageLoaded(true)}
        />

        {/* Progress Bars */}
        <View style={styles.progressContainer}>
          {currentShop.stories.map((_, index) => (
            <View key={index} style={styles.progressBarWrapper}>
              <View style={styles.progressBarBg} />
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    width:
                      index < currentStoryIndex
                        ? '100%'
                        : index === currentStoryIndex
                        ? progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          })
                        : '0%',
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.shopInfo} onPress={handleShopPress}>
            <View style={styles.shopAvatar}>
              {currentShop.logo_url ? (
                <Image source={{ uri: currentShop.logo_url }} style={styles.shopAvatarImage} />
              ) : (
                <View style={styles.shopAvatarPlaceholder}>
                  <Text style={styles.shopAvatarText}>
                    {currentShop.shop_name?.charAt(0) || 'S'}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.shopDetails}>
              <Text style={styles.shopName}>{currentShop.shop_name || 'Shop'}</Text>
              <Text style={styles.storyTime}>{formatStoryTime(currentStory.created_at)}</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Caption */}
        {currentStory.caption && (
          <View style={styles.captionContainer}>
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.6)']}
              style={styles.captionGradient}
            />
            <Text style={styles.caption}>{currentStory.caption}</Text>
          </View>
        )}

        {/* Touch Areas */}
        <View style={styles.touchAreas}>
          <TouchableWithoutFeedback
            onPress={handleTapLeft}
            onLongPress={handleLongPressIn}
            onPressOut={handleLongPressOut}
          >
            <View style={styles.touchAreaLeft} />
          </TouchableWithoutFeedback>
          <TouchableWithoutFeedback
            onPress={handleTapRight}
            onLongPress={handleLongPressIn}
            onPressOut={handleLongPressOut}
          >
            <View style={styles.touchAreaRight} />
          </TouchableWithoutFeedback>
        </View>

        {/* Pause Indicator */}
        {isPaused && (
          <View style={styles.pausedIndicator}>
            <Ionicons name="pause" size={60} color="rgba(255,255,255,0.7)" />
          </View>
        )}

        {/* Product Link */}
        {currentStory.product_id && (
          <TouchableOpacity
            style={styles.productLink}
            onPress={() => {
              handleClose();
              router.push(`/(customer)/product/${currentStory.product_id}`);
            }}
          >
            <Ionicons name="bag-outline" size={20} color="#fff" />
            <Text style={styles.productLinkText}>View Product</Text>
            <Ionicons name="chevron-up" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </Animated.View>
    </Modal>
  );
}

function formatStoryTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000 / 60); // minutes
  
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  const hours = Math.floor(diff / 60);
  if (hours < 24) return `${hours}h ago`;
  return 'Yesterday';
}

/**
 * Story Ring - Circular story avatar with gradient ring
 */
export function StoryRing({
  shop,
  size = 64,
  onPress,
  hasUnviewed = true,
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };

  const ringSize = size + 6;

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
    >
      <Animated.View style={[styles.ringContainer, { transform: [{ scale: scaleAnim }] }]}>
        {/* Gradient Ring */}
        {hasUnviewed ? (
          <LinearGradient
            colors={['#F58529', '#DD2A7B', '#8134AF', '#515BD4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.gradientRing, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]}
          >
            <View style={[styles.ringInner, { width: size + 2, height: size + 2, borderRadius: (size + 2) / 2 }]}>
              {shop.logo_url ? (
                <Image
                  source={{ uri: shop.logo_url }}
                  style={[styles.ringAvatar, { width: size, height: size, borderRadius: size / 2 }]}
                />
              ) : (
                <View style={[styles.ringAvatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
                  <Text style={[styles.ringAvatarText, { fontSize: size * 0.4 }]}>
                    {shop.shop_name?.charAt(0) || 'S'}
                  </Text>
                </View>
              )}
            </View>
          </LinearGradient>
        ) : (
          <View style={[styles.viewedRing, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]}>
            <View style={[styles.ringInner, { width: size + 2, height: size + 2, borderRadius: (size + 2) / 2 }]}>
              {shop.logo_url ? (
                <Image
                  source={{ uri: shop.logo_url }}
                  style={[styles.ringAvatar, { width: size, height: size, borderRadius: size / 2 }]}
                />
              ) : (
                <View style={[styles.ringAvatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
                  <Text style={[styles.ringAvatarText, { fontSize: size * 0.4 }]}>
                    {shop.shop_name?.charAt(0) || 'S'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
        
        {/* Shop Name */}
        <Text style={styles.ringShopName} numberOfLines={1}>
          {shop.shop_name || 'Shop'}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

/**
 * Stories Row - Horizontal scrollable story rings
 */
export function StoriesRow({
  stories = [],
  onStoryPress,
  style,
}) {
  if (!stories || stories.length === 0) return null;

  return (
    <View style={[styles.storiesRowContainer, style]}>
      {stories.map((shop, index) => (
        <StoryRing
          key={shop.shop_id || index}
          shop={shop}
          hasUnviewed={shop.has_unviewed !== false}
          onPress={() => onStoryPress?.(index)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Story Viewer
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  storyImage: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  progressContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
  },
  progressBarWrapper: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  shopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shopAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  shopAvatarImage: {
    width: '100%',
    height: '100%',
  },
  shopAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shopAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  shopDetails: {
    marginLeft: 10,
  },
  shopName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  storyTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captionContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
  },
  captionGradient: {
    ...StyleSheet.absoluteFillObject,
    height: 150,
    marginTop: -80,
  },
  caption: {
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#fff',
    lineHeight: 24,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  touchAreas: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  touchAreaLeft: {
    flex: 0.3,
  },
  touchAreaRight: {
    flex: 0.7,
  },
  pausedIndicator: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  productLink: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 14,
    borderRadius: 25,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  productLinkText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  // Story Ring
  ringContainer: {
    alignItems: 'center',
    marginHorizontal: 6,
  },
  gradientRing: {
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewedRing: {
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray300,
  },
  ringInner: {
    backgroundColor: '#fff',
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringAvatar: {
    backgroundColor: COLORS.gray200,
  },
  ringAvatarPlaceholder: {
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringAvatarText: {
    color: '#fff',
    fontWeight: '700',
  },
  ringShopName: {
    marginTop: 6,
    fontSize: 11,
    color: COLORS.gray700,
    maxWidth: 70,
    textAlign: 'center',
  },

  // Stories Row
  storiesRowContainer: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
});
