/**
 * Addresses Screen - Manage saved delivery/billing addresses
 * Features:
 * - List all saved addresses
 * - Add new address
 * - Edit existing address
 * - Delete address
 * - Set as default/billing
 * - Soft delete support with recovery
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { COLORS, SHADOWS, FONTS } from '../../constants/theme';
import { toast } from '../../components/ui/Toast';

// API functions - to be created
const API_BASE = 'http://localhost:8000/api/v1';

const addressAPI = {
  listAddresses: async (token) => {
    const response = await fetch(`${API_BASE}/addresses`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to load addresses');
    return response.json();
  },

  createAddress: async (token, data) => {
    const response = await fetch(`${API_BASE}/addresses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create address');
    return response.json();
  },

  updateAddress: async (token, id, data) => {
    const response = await fetch(`${API_BASE}/addresses/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update address');
    return response.json();
  },

  deleteAddress: async (token, id) => {
    const response = await fetch(`${API_BASE}/addresses/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to delete address');
    return response.json();
  },

  setDefault: async (token, id) => {
    const response = await fetch(`${API_BASE}/addresses/${id}/set-default`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to set default');
    return response.json();
  },

  setBilling: async (token, id) => {
    const response = await fetch(`${API_BASE}/addresses/${id}/set-billing`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to set billing');
    return response.json();
  },
};

// Address Card Component
function AddressCard({ address, isDefault, isBilling, onEdit, onDelete, onSetDefault, onSetBilling }) {
  return (
    <View style={[styles.addressCard, SHADOWS.small]}>
      {/* Address Info */}
      <View style={{ flex: 1 }}>
        <Text style={styles.addressLabel}>{address.label?.toUpperCase()}</Text>
        <Text style={styles.addressText}>{address.street}, {address.city}</Text>
        <Text style={styles.addressText}>{address.state}, {address.postal_code}</Text>
        <Text style={styles.phoneText}>{address.phone}</Text>

        {/* Tags */}
        <View style={styles.tagsContainer}>
          {isDefault && (
            <View style={[styles.tag, { backgroundColor: COLORS.success }]}>
              <Text style={styles.tagText}>Default</Text>
            </View>
          )}
          {isBilling && (
            <View style={[styles.tag, { backgroundColor: COLORS.info }]}>
              <Text style={styles.tagText}>Billing</Text>
            </View>
          )}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onEdit}
          activeOpacity={0.7}
        >
          <Icon name="pencil" size={18} color={COLORS.primary} />
        </TouchableOpacity>

        {!isDefault && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onSetDefault}
            activeOpacity={0.7}
          >
            <Icon name="star-outline" size={18} color={COLORS.warning} />
          </TouchableOpacity>
        )}

        {!isBilling && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onSetBilling}
            activeOpacity={0.7}
          >
            <Icon name="receipt" size={18} color={COLORS.info} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.actionButton}
          onPress={onDelete}
          activeOpacity={0.7}
        >
          <Icon name="delete-outline" size={18} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Address Form Modal
function AddressFormModal({ visible, address, onClose, onSave, loading }) {
  const [formData, setFormData] = useState(
    address || {
      street: '',
      city: '',
      state: '',
      postal_code: '',
      phone: '',
      label: 'home',
      lat: 0,
      lng: 0,
    }
  );

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!formData.street || !formData.city || !formData.postal_code || !formData.phone) {
      toast.show({ type: 'error', text1: 'Please fill all fields' });
      return;
    }
    onSave(formData);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelButton}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {address ? 'Edit Address' : 'Add New Address'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: 20 }}>
          {/* Label Selection */}
          <Text style={styles.inputLabel}>Address Label</Text>
          <View style={styles.labelContainer}>
            {['home', 'work', 'other'].map(label => (
              <TouchableOpacity
                key={label}
                style={[
                  styles.labelButton,
                  formData.label === label && styles.labelButtonActive,
                ]}
                onPress={() => handleChange('label', label)}
              >
                <Text
                  style={[
                    styles.labelButtonText,
                    formData.label === label && styles.labelButtonTextActive,
                  ]}
                >
                  {label.charAt(0).toUpperCase() + label.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Input Fields */}
          <Text style={styles.inputLabel}>Street Address</Text>
          <TextInput
            style={styles.input}
            placeholder="123 Main Street"
            value={formData.street}
            onChangeText={v => handleChange('street', v)}
            placeholderTextColor={COLORS.textLight}
          />

          <Text style={styles.inputLabel}>City</Text>
          <TextInput
            style={styles.input}
            placeholder="New Delhi"
            value={formData.city}
            onChangeText={v => handleChange('city', v)}
            placeholderTextColor={COLORS.textLight}
          />

          <Text style={styles.inputLabel}>State</Text>
          <TextInput
            style={styles.input}
            placeholder="Delhi"
            value={formData.state}
            onChangeText={v => handleChange('state', v)}
            placeholderTextColor={COLORS.textLight}
          />

          <Text style={styles.inputLabel}>Postal Code</Text>
          <TextInput
            style={styles.input}
            placeholder="110001"
            value={formData.postal_code}
            onChangeText={v => handleChange('postal_code', v)}
            keyboardType="numeric"
            placeholderTextColor={COLORS.textLight}
          />

          <Text style={styles.inputLabel}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="+919876543210"
            value={formData.phone}
            onChangeText={v => handleChange('phone', v)}
            keyboardType="phone-pad"
            placeholderTextColor={COLORS.textLight}
          />

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.saveButtonText}>
                {address ? 'Update Address' : 'Add Address'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// Main Addresses Screen
export default function AddressesScreen() {
  const router = useRouter();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [token, setToken] = useState(null); // Get from AuthStore

  // Load addresses on focus
  useFocusEffect(
    useCallback(() => {
      loadAddresses();
    }, [])
  );

  const loadAddresses = async () => {
    try {
      setLoading(true);
      // Get token from auth store
      const authStore = require('../../store/authStore').default;
      const state = authStore.getState();
      const userToken = state.tokens?.access_token;
      
      if (!userToken) {
        toast.show({ type: 'error', text1: 'Not authenticated' });
        router.push('/auth/login');
        return;
      }

      setToken(userToken);
      const data = await addressAPI.listAddresses(userToken);
      setAddresses(Array.isArray(data) ? data : data.addresses || []);
    } catch (err) {
      console.error('Failed to load addresses:', err);
      toast.show({ type: 'error', text1: 'Failed to load addresses' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddAddress = () => {
    setSelectedAddress(null);
    setModalVisible(true);
  };

  const handleEditAddress = (address) => {
    setSelectedAddress(address);
    setModalVisible(true);
  };

  const handleSaveAddress = async (formData) => {
    try {
      setLoading(true);
      if (selectedAddress) {
        // Update existing
        await addressAPI.updateAddress(token, selectedAddress.id, formData);
        toast.show({ type: 'success', text1: 'Address updated' });
      } else {
        // Create new
        await addressAPI.createAddress(token, formData);
        toast.show({ type: 'success', text1: 'Address added' });
      }
      setModalVisible(false);
      loadAddresses();
    } catch (err) {
      console.error('Failed to save address:', err);
      toast.show({ type: 'error', text1: 'Failed to save address' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAddress = (addressId) => {
    Alert.alert(
      'Delete Address',
      'Are you sure you want to delete this address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              setLoading(true);
              await addressAPI.deleteAddress(token, addressId);
              toast.show({ type: 'success', text1: 'Address deleted' });
              loadAddresses();
            } catch (err) {
              console.error('Failed to delete address:', err);
              toast.show({ type: 'error', text1: 'Failed to delete address' });
            } finally {
              setLoading(false);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleSetDefault = async (addressId) => {
    try {
      setLoading(true);
      await addressAPI.setDefault(token, addressId);
      toast.show({ type: 'success', text1: 'Set as default' });
      loadAddresses();
    } catch (err) {
      console.error('Failed to set default:', err);
      toast.show({ type: 'error', text1: 'Failed to set default' });
    } finally {
      setLoading(false);
    }
  };

  const handleSetBilling = async (addressId) => {
    try {
      setLoading(true);
      await addressAPI.setBilling(token, addressId);
      toast.show({ type: 'success', text1: 'Set as billing address' });
      loadAddresses();
    } catch (err) {
      console.error('Failed to set billing:', err);
      toast.show({ type: 'error', text1: 'Failed to set billing address' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Addresses</Text>
        <TouchableOpacity onPress={handleAddAddress}>
          <Icon name="plus" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Address List */}
      {loading && !addresses.length ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : addresses.length === 0 ? (
        <View style={styles.centerContent}>
          <Icon name="home-outline" size={60} color={COLORS.textLight} />
          <Text style={styles.emptyText}>No addresses saved</Text>
          <TouchableOpacity style={styles.addButton} onPress={handleAddAddress}>
            <Text style={styles.addButtonText}>Add Your First Address</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
          renderItem={({ item }) => (
            <AddressCard
              address={item}
              isDefault={item.is_default}
              isBilling={item.is_billing}
              onEdit={() => handleEditAddress(item)}
              onDelete={() => handleDeleteAddress(item.id)}
              onSetDefault={() => handleSetDefault(item.id)}
              onSetBilling={() => handleSetBilling(item.id)}
            />
          )}
          onEndReachedThreshold={0.5}
        />
      )}

      {/* Add Address Modal */}
      <AddressFormModal
        visible={modalVisible}
        address={selectedAddress}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveAddress}
        loading={loading}
      />

      {/* Floating Add Button (if list exists) */}
      {addresses.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, SHADOWS.medium]}
          onPress={handleAddAddress}
          activeOpacity={0.8}
        >
          <Icon name="plus" size={28} color="white" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    fontSize: 16,
    color: COLORS.primary,
    ...FONTS.medium,
  },
  title: {
    fontSize: 18,
    ...FONTS.bold,
    color: COLORS.text,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textLight,
    marginTop: 12,
  },
  addButton: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    ...FONTS.medium,
    fontSize: 14,
  },

  // Address Card
  addressCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addressLabel: {
    fontSize: 14,
    ...FONTS.bold,
    color: COLORS.primary,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 2,
  },
  phoneText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 10,
    color: 'white',
    ...FONTS.medium,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundLight,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    ...FONTS.bold,
    color: COLORS.text,
  },
  cancelButton: {
    fontSize: 24,
    color: COLORS.textLight,
  },
  modalContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  // Form
  inputLabel: {
    fontSize: 13,
    ...FONTS.medium,
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  labelContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  labelButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  labelButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  labelButtonText: {
    fontSize: 12,
    ...FONTS.medium,
    color: COLORS.text,
  },
  labelButtonTextActive: {
    color: 'white',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    color: 'white',
    ...FONTS.bold,
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
