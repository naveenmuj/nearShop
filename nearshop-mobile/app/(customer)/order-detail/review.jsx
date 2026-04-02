import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { toast } from '../../../../components/ui/Toast';
import { alert } from '../../../../components/ui/PremiumAlert';
import { submitReview } from '../../../../lib/reviews';
import { uploadFile } from '../../../../lib/auth';
import { COLORS } from '../../../../constants/theme';

export default function SubmitReview() {
  const router = useRouter();
  const { orderId, productId, shopId, productName } = useLocalSearchParams();
  
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert.warning({ 
          title: 'Permission Required', 
          message: 'Please allow photo access to add images' 
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        if (photos.length < 3) {
          setPhotos([...photos, result.assets[0]]);
        } else {
          toast.show({ type: 'warning', text1: 'Maximum 3 photos allowed' });
        }
      }
    } catch (error) {
      toast.show({ type: 'error', text1: 'Failed to pick image' });
    }
  };

  const removePhoto = (index) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      alert.warning({ title: 'Rating Required', message: 'Please select a star rating' });
      return;
    }

    if (reviewText.trim().length < 10) {
      alert.warning({ title: 'Review Too Short', message: 'Please write at least 10 characters' });
      return;
    }

    setSubmitting(true);
    
    try {
      // Upload photos if any
      let photoUrls = [];
      if (photos.length > 0) {
        setUploading(true);
        for (const photo of photos) {
          try {
            const uploaded = await uploadFile(photo.uri, 'review-photos');
            if (uploaded?.url) {
              photoUrls.push(uploaded.url);
            }
          } catch (e) {
            console.error('Photo upload failed:', e);
          }
        }
        setUploading(false);
      }

      // Submit review
      await submitReview({
        order_id: orderId,
        product_id: productId,
        shop_id: shopId,
        rating: rating,
        review_text: reviewText.trim(),
        photos: photoUrls.length > 0 ? photoUrls : undefined,
      });

      toast.show({ 
        type: 'success', 
        text1: 'Review Submitted!', 
        text2: 'Thank you for your feedback' 
      });

      router.back();
    } catch (error) {
      const message = error.userMessage || error.response?.data?.detail || 'Failed to submit review';
      alert.error({ title: 'Error', message });
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text || '#1F2937'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Write a Review</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* Product Info */}
        {productName && (
          <View style={styles.productCard}>
            <Text style={styles.productLabel}>Reviewing:</Text>
            <Text style={styles.productName}>{decodeURIComponent(productName)}</Text>
          </View>
        )}

        {/* Star Rating */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Rating *</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setRating(star)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
              >
                <Ionicons
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={40}
                  color={star <= rating ? '#FFB800' : COLORS.gray300 || '#D1D5DB'}
                  style={styles.star}
                />
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 && (
            <Text style={styles.ratingLabel}>
              {rating === 5 ? 'Excellent! ⭐' : rating === 4 ? 'Good! 👍' : rating === 3 ? 'Average 😐' : rating === 2 ? 'Below Average 👎' : 'Poor 😞'}
            </Text>
          )}
        </View>

        {/* Review Text */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Review *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Share your experience with this product..."
            placeholderTextColor={COLORS.gray400 || '#9CA3AF'}
            value={reviewText}
            onChangeText={setReviewText}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>{reviewText.length}/500</Text>
        </View>

        {/* Photo Upload */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Photos (Optional)</Text>
          <Text style={styles.sectionSubtitle}>Up to 3 photos</Text>
          
          <View style={styles.photosGrid}>
            {photos.map((photo, index) => (
              <View key={index} style={styles.photoCard}>
                <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                <TouchableOpacity
                  style={styles.removePhotoBtn}
                  onPress={() => removePhoto(index)}
                >
                  <Ionicons name="close-circle" size={24} color={COLORS.red || '#E24B4A'} />
                </TouchableOpacity>
              </View>
            ))}
            
            {photos.length < 3 && (
              <TouchableOpacity
                style={styles.addPhotoBtn}
                onPress={handlePickImage}
                activeOpacity={0.7}
              >
                <Ionicons name="camera-outline" size={32} color={COLORS.primary || '#7F77DD'} />
                <Text style={styles.addPhotoText}>Add Photo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>💡 Review Tips</Text>
          <Text style={styles.tipText}>• Be specific about what you liked or didn't like</Text>
          <Text style={styles.tipText}>• Mention product quality, packaging, and delivery</Text>
          <Text style={styles.tipText}>• Add photos to help other customers</Text>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.submitBtn,
            (rating === 0 || reviewText.trim().length < 10 || submitting || uploading) && styles.submitBtnDisabled
          ]}
          onPress={handleSubmit}
          disabled={rating === 0 || reviewText.trim().length < 10 || submitting || uploading}
          activeOpacity={0.8}
        >
          {submitting || uploading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.submitBtnText}>
              {uploading ? 'Uploading Photos...' : 'Submit Review'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg || '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200 || '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text || '#1F2937',
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  productCard: {
    backgroundColor: COLORS.primaryLight || '#F3F0FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  productLabel: {
    fontSize: 12,
    color: COLORS.gray600 || '#6B7280',
    marginBottom: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary || '#7F77DD',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text || '#1F2937',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.gray500 || '#9CA3AF',
    marginBottom: 12,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  star: {
    marginHorizontal: 2,
  },
  ratingLabel: {
    fontSize: 14,
    color: COLORS.primary || '#7F77DD',
    fontWeight: '600',
    marginTop: 4,
  },
  textInput: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray300 || '#D1D5DB',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: COLORS.text || '#1F2937',
    minHeight: 120,
  },
  charCount: {
    fontSize: 12,
    color: COLORS.gray500 || '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoCard: {
    width: 100,
    height: 100,
    borderRadius: 12,
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: COLORS.white,
    borderRadius: 12,
  },
  addPhotoBtn: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.gray300 || '#D1D5DB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: {
    fontSize: 12,
    color: COLORS.primary || '#7F77DD',
    marginTop: 4,
  },
  tipsCard: {
    backgroundColor: '#FFFBEB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    color: '#92400E',
    marginBottom: 4,
    lineHeight: 18,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200 || '#E5E7EB',
  },
  submitBtn: {
    backgroundColor: COLORS.primary || '#7F77DD',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: COLORS.gray300 || '#D1D5DB',
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
