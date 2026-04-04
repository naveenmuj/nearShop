import React, { useState, useEffect } from 'react';
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
import { toast } from '../../components/ui/Toast';
import { alert } from '../../components/ui/PremiumAlert';
import { getOrderById } from '../../lib/orders';
import { createReturnRequest, getReturnReasons } from '../../lib/returns';
import { uploadFile } from '../../lib/auth';
import { COLORS } from '../../constants/theme';

const RETURN_REASONS = [
  { value: 'damaged', label: 'Damaged/Defective' },
  { value: 'wrong_item', label: 'Wrong Item Delivered' },
  { value: 'not_as_described', label: 'Not as Described' },
  { value: 'size_issue', label: 'Size/Fit Issue' },
  { value: 'other', label: 'Other' },
];

export default function ReturnRequestScreen() {
  const router = useRouter();
  const { orderId, shopId } = useLocalSearchParams();
  
  const [order, setOrder] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadOrder();
  }, []);

  const loadOrder = async () => {
    try {
      const res = await getOrderById(orderId);
      setOrder(res.data);
      // Auto-select first item if only one
      if (res.data.items?.length === 1) {
        setSelectedItem(res.data.items[0]);
      }
    } catch (error) {
      toast.show({ type: 'error', text1: 'Failed to load order' });
      router.back();
    } finally {
      setLoading(false);
    }
  };

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
    if (!selectedItem) {
      alert.warning({ title: 'Select Item', message: 'Please select an item to return' });
      return;
    }

    if (!reason) {
      alert.warning({ title: 'Select Reason', message: 'Please select a return reason' });
      return;
    }

    if (reason === 'other' && description.trim().length < 10) {
      alert.warning({ 
        title: 'Description Required', 
        message: 'Please describe the issue (at least 10 characters)' 
      });
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
            const uploaded = await uploadFile(photo.uri, 'return-photos');
            if (uploaded?.url) {
              photoUrls.push(uploaded.url);
            }
          } catch (e) {
            console.error('Photo upload failed:', e);
          }
        }
        setUploading(false);
      }

      // Submit return request
      await createReturnRequest(
        orderId,
        selectedItem.name || selectedItem.product_name,
        selectedItem.price,
        reason,
        description.trim() || null,
        photoUrls.length > 0 ? photoUrls : null,
        selectedItem.product_id || selectedItem.id,
        selectedItem.quantity || 1
      );

      toast.show({ 
        type: 'success', 
        text1: 'Return Request Submitted', 
        text2: 'We will review your request shortly' 
      });

      router.back();
    } catch (error) {
      const message = error.userMessage || error.response?.data?.detail || 'Failed to submit return request';
      alert.error({ title: 'Error', message });
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const items = order?.items || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text || '#1F2937'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Return</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* Select Item */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Item to Return *</Text>
          {items.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.itemCard,
                selectedItem === item && styles.itemCardSelected
              ]}
              onPress={() => setSelectedItem(item)}
              activeOpacity={0.7}
            >
              <View style={styles.itemCardContent}>
                <View style={styles.itemImage}>
                  {item.image_url || item.images?.[0] ? (
                    <Image source={{ uri: item.image_url || item.images[0] }} style={{ width: '100%', height: '100%', borderRadius: 8 }} />
                  ) : (
                    <Text style={{ fontSize: 20 }}>📦</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={2}>{item.name || item.product_name}</Text>
                  <Text style={styles.itemMeta}>Qty: {item.quantity || 1} • ₹{item.price}</Text>
                </View>
                {selectedItem === item && (
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Return Reason */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reason for Return *</Text>
          {RETURN_REASONS.map((r) => (
            <TouchableOpacity
              key={r.value}
              style={[
                styles.reasonCard,
                reason === r.value && styles.reasonCardSelected
              ]}
              onPress={() => setReason(r.value)}
              activeOpacity={0.7}
            >
              <View style={styles.reasonCardContent}>
                <View style={[
                  styles.radio,
                  reason === r.value && styles.radioSelected
                ]}>
                  {reason === r.value && <View style={styles.radioDot} />}
                </View>
                <Text style={[
                  styles.reasonText,
                  reason === r.value && styles.reasonTextSelected
                ]}>
                  {r.label}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Additional Details {reason === 'other' && '*'}
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="Describe the issue or reason for return..."
            placeholderTextColor={COLORS.gray400 || '#9CA3AF'}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={300}
          />
          <Text style={styles.charCount}>{description.length}/300</Text>
        </View>

        {/* Photo Upload */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Photos (Optional)</Text>
          <Text style={styles.sectionSubtitle}>Up to 3 photos showing the issue</Text>
          
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

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📝 Return Policy</Text>
          <Text style={styles.infoText}>• Returns accepted within 7 days of delivery</Text>
          <Text style={styles.infoText}>• Item must be unused and in original packaging</Text>
          <Text style={styles.infoText}>• Refund processed within 3-5 business days</Text>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.submitBtn,
            (!selectedItem || !reason || submitting || uploading) && styles.submitBtnDisabled
          ]}
          onPress={handleSubmit}
          disabled={!selectedItem || !reason || submitting || uploading}
          activeOpacity={0.8}
        >
          {submitting || uploading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.submitBtnText}>
              {uploading ? 'Uploading Photos...' : 'Submit Return Request'}
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
  centered: {
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text || '#1F2937',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.gray500 || '#9CA3AF',
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: COLORS.gray200 || '#E5E7EB',
  },
  itemCardSelected: {
    borderColor: COLORS.primary || '#7F77DD',
    backgroundColor: COLORS.primaryLight || '#F3F0FF',
  },
  itemCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemImage: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: COLORS.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray800,
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 12,
    color: COLORS.gray500,
  },
  reasonCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: COLORS.gray200 || '#E5E7EB',
  },
  reasonCardSelected: {
    borderColor: COLORS.primary || '#7F77DD',
    backgroundColor: COLORS.primaryLight || '#F3F0FF',
  },
  reasonCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.gray300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: COLORS.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  reasonText: {
    fontSize: 15,
    color: COLORS.gray700,
    fontWeight: '500',
  },
  reasonTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray300 || '#D1D5DB',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: COLORS.text || '#1F2937',
    minHeight: 100,
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
  infoCard: {
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#1E40AF',
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
