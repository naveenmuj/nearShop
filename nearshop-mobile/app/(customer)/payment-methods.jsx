/**
 * Payment Methods Screen - Manage saved cards, UPI, wallets
 * Features:
 * - List all payment methods
 * - Add card (with Razorpay tokenization)
 * - Add UPI
 * - Add wallet
 * - Set as default
 * - Delete method
 * - Display card brand logos
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
import RazorpayCheckout from 'react-native-razorpay';
import { COLORS, SHADOWS, FONTS } from '../../constants/theme';
import { toast } from '../../components/ui/Toast';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// API functions
const API_BASE = 'http://localhost:8000/api/v1';

const paymentAPI = {
  listMethods: async (token) => {
    const response = await fetch(`${API_BASE}/payments/methods`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to load payment methods');
    return response.json();
  },

  createMethod: async (token, data) => {
    const response = await fetch(`${API_BASE}/payments/methods`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create payment method');
    return response.json();
  },

  deleteMethod: async (token, id) => {
    const response = await fetch(`${API_BASE}/payments/methods/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to delete payment method');
    return response.json();
  },

  setDefault: async (token, id) => {
    const response = await fetch(`${API_BASE}/payments/methods/${id}/set-default`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to set default');
    return response.json();
  },

  validateMethod: async (token, id) => {
    const response = await fetch(`${API_BASE}/payments/methods/${id}/validate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Payment method invalid');
    return response.json();
  },
};

// Helper to get card brand icon
function getCardIcon(brand) {
  switch (brand?.toLowerCase()) {
    case 'visa':
      return 'card-outline';
    case 'mastercard':
      return 'cards';
    case 'amex':
      return 'card-bulleted';
    default:
      return 'credit-card';
  }
}

// Payment Method Card Component
function PaymentMethodCard({ method, isDefault, onDelete, onSetDefault }) {
  const isCard = method.type === 'card';
  const isUPI = method.type === 'upi';
  const isWallet = method.type === 'wallet';

  return (
    <View style={[styles.methodCard, SHADOWS.small]}>
      {/* Icon and Info */}
      <View style={styles.methodContent}>
        <View style={styles.iconContainer}>
          <Icon
            name={
              isCard
                ? getCardIcon(method.card_brand)
                : isUPI
                ? 'bank-transfer'
                : 'wallet'
            }
            size={28}
            color={COLORS.primary}
          />
        </View>

        <View style={styles.methodInfo}>
          {isCard && (
            <>
              <Text style={styles.methodType}>
                {method.card_brand?.toUpperCase()} • ••• {method.card_last4}
              </Text>
              <Text style={styles.methodDetails}>
                Expires {method.card_expiry_month}/{method.card_expiry_year}
              </Text>
            </>
          )}

          {isUPI && (
            <>
              <Text style={styles.methodType}>UPI</Text>
              <Text style={styles.methodDetails}>{method.upi_id}</Text>
            </>
          )}

          {isWallet && (
            <>
              <Text style={styles.methodType}>Wallet</Text>
              <Text style={styles.methodDetails}>ID: {method.wallet_id}</Text>
            </>
          )}

          {isDefault && (
            <View style={styles.defaultTag}>
              <Icon name="check-circle" size={12} color={COLORS.success} />
              <Text style={styles.defaultTagText}>Default</Text>
            </View>
          )}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        {!isDefault && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onSetDefault}
            activeOpacity={0.7}
          >
            <Icon name="star-outline" size={18} color={COLORS.warning} />
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

// Add Payment Modal
function AddPaymentModal({ visible, paymentType, onClose, onSave, loading }) {
  const [formData, setFormData] = useState({
    type: paymentType,
    card_token: '',
    card_last4: '',
    card_brand: '',
    card_expiry_month: '',
    card_expiry_year: '',
    upi_id: '',
    wallet_id: '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddCard = async () => {
    if (!formData.card_token || !formData.card_last4 || !formData.card_brand) {
      toast.show({ type: 'error', text1: 'Please complete card details' });
      return;
    }
    onSave(formData);
  };

  const handleAddUPI = () => {
    if (!formData.upi_id) {
      toast.show({ type: 'error', text1: 'Please enter UPI ID' });
      return;
    }
    onSave(formData);
  };

  const handleAddWallet = () => {
    if (!formData.wallet_id) {
      toast.show({ type: 'error', text1: 'Please enter Wallet ID' });
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
          <Text style={styles.modalTitle}>Add Payment Method</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.modalContent}>
          {paymentType === 'card' ? (
            <>
              <Text style={styles.sectionTitle}>Card Details</Text>
              <Text style={styles.helpText}>
                Use Razorpay to securely save your card. Tap "Link Card" below.
              </Text>

              <TouchableOpacity
                style={styles.razorpayButton}
                onPress={async () => {
                  // Razorpay card tokenization would happen here
                  // This would open Razorpay's card saving interface
                  // For now, simulate with demo data
                  setFormData(prev => ({
                    ...prev,
                    card_token: 'tok_' + Math.random().toString(36).substr(2, 9),
                    card_last4: '4111',
                    card_brand: 'Visa',
                  }));
                }}
              >
                <Icon name="link-variant" size={20} color="white" />
                <Text style={styles.razorpayButtonText}>Link Card with Razorpay</Text>
              </TouchableOpacity>

              {formData.card_token && (
                <View style={styles.cardPreview}>
                  <Icon name="check-circle" size={20} color={COLORS.success} />
                  <Text style={styles.cardPreviewText}>
                    {formData.card_brand} ••• {formData.card_last4}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.saveButton, loading && styles.buttonDisabled]}
                onPress={handleAddCard}
                disabled={loading || !formData.card_token}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.saveButtonText}>Add Card</Text>
                )}
              </TouchableOpacity>
            </>
          ) : paymentType === 'upi' ? (
            <>
              <Text style={styles.sectionTitle}>UPI ID</Text>
              <Text style={styles.helpText}>
                Enter your UPI ID (e.g., user@okhdfcbank)
              </Text>

              <TextInput
                style={styles.input}
                placeholder="user@okhdfcbank"
                value={formData.upi_id}
                onChangeText={v => handleChange('upi_id', v)}
                placeholderTextColor={COLORS.textLight}
                editable={!loading}
              />

              <TouchableOpacity
                style={[styles.saveButton, loading && styles.buttonDisabled]}
                onPress={handleAddUPI}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.saveButtonText}>Add UPI</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Wallet ID</Text>
              <Text style={styles.helpText}>
                Enter your wallet ID or account number
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Wallet ID"
                value={formData.wallet_id}
                onChangeText={v => handleChange('wallet_id', v)}
                placeholderTextColor={COLORS.textLight}
                editable={!loading}
              />

              <TouchableOpacity
                style={[styles.saveButton, loading && styles.buttonDisabled]}
                onPress={handleAddWallet}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.saveButtonText}>Add Wallet</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// Main Payment Methods Screen
export default function PaymentMethodsScreen() {
  const router = useRouter();
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState('card');
  const [token, setToken] = useState(null);

  // Load payment methods on focus
  useFocusEffect(
    useCallback(() => {
      loadMethods();
    }, [])
  );

  const loadMethods = async () => {
    try {
      setLoading(true);
      const authStore = require('../../store/authStore').default;
      const state = authStore.getState();
      const userToken = state.tokens?.access_token;

      if (!userToken) {
        toast.show({ type: 'error', text1: 'Not authenticated' });
        router.push('/auth/login');
        return;
      }

      setToken(userToken);
      const data = await paymentAPI.listMethods(userToken);
      setMethods(Array.isArray(data.methods) ? data.methods : []);
    } catch (err) {
      console.error('Failed to load payment methods:', err);
      toast.show({ type: 'error', text1: 'Failed to load payment methods' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = (type) => {
    setSelectedType(type);
    setModalVisible(true);
  };

  const handleSavePayment = async (formData) => {
    try {
      setLoading(true);
      await paymentAPI.createMethod(token, formData);
      toast.show({ type: 'success', text1: 'Payment method added' });
      setModalVisible(false);
      loadMethods();
    } catch (err) {
      console.error('Failed to save payment method:', err);
      toast.show({ type: 'error', text1: 'Failed to save payment method' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMethod = (methodId) => {
    Alert.alert(
      'Delete Payment Method',
      'Are you sure you want to remove this payment method?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              setLoading(true);
              await paymentAPI.deleteMethod(token, methodId);
              toast.show({ type: 'success', text1: 'Payment method removed' });
              loadMethods();
            } catch (err) {
              console.error('Failed to delete method:', err);
              toast.show({ type: 'error', text1: 'Failed to remove payment method' });
            } finally {
              setLoading(false);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleSetDefault = async (methodId) => {
    try {
      setLoading(true);
      await paymentAPI.setDefault(token, methodId);
      toast.show({ type: 'success', text1: 'Set as default' });
      loadMethods();
    } catch (err) {
      console.error('Failed to set default:', err);
      toast.show({ type: 'error', text1: 'Failed to set default' });
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
        <Text style={styles.title}>Payment Methods</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      {loading && !methods.length ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : methods.length === 0 ? (
        <View style={styles.centerContent}>
          <Icon name="credit-card" size={60} color={COLORS.textLight} />
          <Text style={styles.emptyText}>No payment methods saved</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => handleAddPayment('card')}
          >
            <Text style={styles.addButtonText}>Add Payment Method</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={methods}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
          renderItem={({ item }) => (
            <PaymentMethodCard
              method={item}
              isDefault={item.is_default}
              onDelete={() => handleDeleteMethod(item.id)}
              onSetDefault={() => handleSetDefault(item.id)}
            />
          )}
        />
      )}

      {/* Add Payment Type Selector */}
      {methods.length > 0 && (
        <View style={styles.addButtonsContainer}>
          <TouchableOpacity
            style={[styles.typeButton, SHADOWS.small]}
            onPress={() => handleAddPayment('card')}
            activeOpacity={0.7}
          >
            <Icon name="credit-card" size={20} color={COLORS.primary} />
            <Text style={styles.typeButtonText}>Card</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeButton, SHADOWS.small]}
            onPress={() => handleAddPayment('upi')}
            activeOpacity={0.7}
          >
            <Icon name="bank-transfer" size={20} color={COLORS.primary} />
            <Text style={styles.typeButtonText}>UPI</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeButton, SHADOWS.small]}
            onPress={() => handleAddPayment('wallet')}
            activeOpacity={0.7}
          >
            <Icon name="wallet" size={20} color={COLORS.primary} />
            <Text style={styles.typeButtonText}>Wallet</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Add Payment Modal */}
      <AddPaymentModal
        visible={modalVisible}
        paymentType={selectedType}
        onClose={() => setModalVisible(false)}
        onSave={handleSavePayment}
        loading={loading}
      />
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

  // Payment Method Card
  methodCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  methodContent: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: COLORS.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  methodInfo: {
    flex: 1,
  },
  methodType: {
    fontSize: 14,
    ...FONTS.bold,
    color: COLORS.text,
    marginBottom: 2,
  },
  methodDetails: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  defaultTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  defaultTagText: {
    fontSize: 10,
    color: COLORS.success,
    ...FONTS.medium,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
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
  sectionTitle: {
    fontSize: 16,
    ...FONTS.bold,
    color: COLORS.text,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 16,
  },
  razorpayButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  razorpayButtonText: {
    color: 'white',
    ...FONTS.medium,
    fontSize: 14,
  },
  cardPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  cardPreviewText: {
    fontSize: 14,
    ...FONTS.medium,
    color: COLORS.text,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 16,
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

  // Add Buttons
  addButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  typeButton: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typeButtonText: {
    fontSize: 12,
    ...FONTS.medium,
    color: COLORS.text,
    marginTop: 6,
  },
});
