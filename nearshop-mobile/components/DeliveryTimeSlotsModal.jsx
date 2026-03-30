import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Common time options in 30-minute intervals
const TIME_OPTIONS = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30',
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
  '21:00', '21:30', '22:00', '22:30', '23:00', '23:30',
];

// Peak hour suggestions
const PEAK_HOURS_HINT = {
  title: '💡 Peak Hours Tip',
  message: 'Most businesses see high demand during:\n• Morning: 9:00 AM - 11:00 AM\n• Lunch: 12:00 PM - 2:00 PM\n• Evening: 5:00 PM - 8:00 PM',
};

// Preset templates
const PRESETS = [
  {
    id: 'full_day',
    label: 'Full Day',
    icon: '☀️',
    slots: [{ from: '09:00', to: '21:00' }],
  },
  {
    id: 'morning_evening',
    label: 'Morning & Evening',
    icon: '🌅',
    slots: [
      { from: '09:00', to: '12:00' },
      { from: '17:00', to: '21:00' },
    ],
  },
  {
    id: 'lunch_dinner',
    label: 'Lunch & Dinner',
    icon: '🍽️',
    slots: [
      { from: '11:00', to: '14:00' },
      { from: '18:00', to: '22:00' },
    ],
  },
  {
    id: 'afternoon_only',
    label: 'Afternoon Only',
    icon: '🌤️',
    slots: [{ from: '14:00', to: '19:00' }],
  },
];

const formatTime = (time24) => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
};

const TimeSlot = ({ slot, index, onUpdate, onRemove, isLast }) => {
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleRemove = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onRemove(index));
  };

  return (
    <Animated.View style={[styles.slotContainer, { transform: [{ scale: scaleAnim }] }]}>
      <View style={styles.slotHeader}>
        <Text style={styles.slotTitle}>Time Slot {index + 1}</Text>
        {!isLast && (
          <TouchableOpacity onPress={handleRemove} style={styles.removeBtn}>
            <Ionicons name="close-circle" size={22} color={COLORS.danger} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.slotRow}>
        {/* From Time */}
        <View style={styles.timePickerContainer}>
          <Text style={styles.timeLabel}>From</Text>
          <TouchableOpacity
            style={[styles.timePicker, showFromPicker && styles.timePickerActive]}
            onPress={() => {
              setShowFromPicker(!showFromPicker);
              setShowToPicker(false);
            }}
          >
            <Ionicons name="time-outline" size={18} color={COLORS.primary} />
            <Text style={styles.timeValue}>{formatTime(slot.from)}</Text>
            <Ionicons
              name={showFromPicker ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={COLORS.gray500}
            />
          </TouchableOpacity>

          {showFromPicker && (
            <View style={styles.timeDropdown}>
              <ScrollView
                style={styles.timeScrollView}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {TIME_OPTIONS.map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.timeOption,
                      slot.from === time && styles.timeOptionSelected,
                    ]}
                    onPress={() => {
                      onUpdate(index, { ...slot, from: time });
                      setShowFromPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.timeOptionText,
                        slot.from === time && styles.timeOptionTextSelected,
                      ]}
                    >
                      {formatTime(time)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Arrow */}
        <View style={styles.arrowContainer}>
          <Ionicons name="arrow-forward" size={20} color={COLORS.primary} />
        </View>

        {/* To Time */}
        <View style={styles.timePickerContainer}>
          <Text style={styles.timeLabel}>To</Text>
          <TouchableOpacity
            style={[styles.timePicker, showToPicker && styles.timePickerActive]}
            onPress={() => {
              setShowToPicker(!showToPicker);
              setShowFromPicker(false);
            }}
          >
            <Ionicons name="time-outline" size={18} color={COLORS.primary} />
            <Text style={styles.timeValue}>{formatTime(slot.to)}</Text>
            <Ionicons
              name={showToPicker ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={COLORS.gray500}
            />
          </TouchableOpacity>

          {showToPicker && (
            <View style={styles.timeDropdown}>
              <ScrollView
                style={styles.timeScrollView}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {TIME_OPTIONS.filter((t) => t > slot.from).map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.timeOption,
                      slot.to === time && styles.timeOptionSelected,
                    ]}
                    onPress={() => {
                      onUpdate(index, { ...slot, to: time });
                      setShowToPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.timeOptionText,
                        slot.to === time && styles.timeOptionTextSelected,
                      ]}
                    >
                      {formatTime(time)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </View>

      {/* Duration indicator */}
      <View style={styles.durationBadge}>
        <Ionicons name="hourglass-outline" size={12} color={COLORS.gray600} />
        <Text style={styles.durationText}>
          {calculateDuration(slot.from, slot.to)}
        </Text>
      </View>
    </Animated.View>
  );
};

const calculateDuration = (from, to) => {
  if (!from || !to) return '0h';
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  const diff = (th * 60 + tm) - (fh * 60 + fm);
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

export default function DeliveryTimeSlotsModal({
  visible,
  onClose,
  initialAvailability = 'all_day',
  initialSlots = [],
  onSave,
}) {
  const [availability, setAvailability] = useState(initialAvailability);
  const [slots, setSlots] = useState(
    initialSlots.length > 0 ? initialSlots : [{ from: '09:00', to: '18:00' }]
  );
  const [showPeakHint, setShowPeakHint] = useState(false);

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleAddSlot = () => {
    const lastSlot = slots[slots.length - 1];
    const newFrom = lastSlot?.to || '12:00';
    const fromIdx = TIME_OPTIONS.indexOf(newFrom);
    const newTo = TIME_OPTIONS[Math.min(fromIdx + 4, TIME_OPTIONS.length - 1)] || '18:00';
    setSlots([...slots, { from: newFrom, to: newTo }]);
  };

  const handleUpdateSlot = (index, updatedSlot) => {
    const newSlots = [...slots];
    newSlots[index] = updatedSlot;
    setSlots(newSlots);
  };

  const handleRemoveSlot = (index) => {
    if (slots.length > 1) {
      setSlots(slots.filter((_, i) => i !== index));
    }
  };

  const handleApplyPreset = (preset) => {
    setSlots(preset.slots);
    setAvailability('specific');
  };

  const handleSave = () => {
    // Validate slots
    const validSlots = slots.filter((s) => s.from && s.to && s.from < s.to);
    onSave(availability, validSlots);
    onClose();
  };

  const availabilityOptions = [
    {
      key: 'all_day',
      label: 'All Day',
      icon: 'sunny',
      desc: 'Available for delivery anytime',
    },
    {
      key: 'peak',
      label: 'Peak Hours',
      icon: 'flame',
      desc: 'High-demand time periods only',
    },
    {
      key: 'specific',
      label: 'Specific Hours',
      icon: 'time',
      desc: 'Custom time slots',
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Backdrop */}
        <Animated.View
          style={[styles.backdrop, { opacity: backdropAnim }]}
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Content */}
        <Animated.View
          style={[
            styles.content,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Delivery Hours</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.gray600} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Availability Type */}
            <Text style={styles.sectionTitle}>When are you available for delivery?</Text>
            <View style={styles.optionsGrid}>
              {availabilityOptions.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.optionCard,
                    availability === option.key && styles.optionCardActive,
                  ]}
                  onPress={() => {
                    setAvailability(option.key);
                    if (option.key === 'peak') {
                      setShowPeakHint(true);
                    }
                  }}
                >
                  <Ionicons
                    name={option.icon}
                    size={24}
                    color={availability === option.key ? COLORS.primary : COLORS.gray500}
                  />
                  <Text
                    style={[
                      styles.optionLabel,
                      availability === option.key && styles.optionLabelActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text style={styles.optionDesc}>{option.desc}</Text>
                  {availability === option.key && (
                    <View style={styles.checkmark}>
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Peak Hours Hint */}
            {(availability === 'peak' || showPeakHint) && (
              <View style={styles.hintBox}>
                <View style={styles.hintHeader}>
                  <Text style={styles.hintTitle}>{PEAK_HOURS_HINT.title}</Text>
                  <TouchableOpacity onPress={() => setShowPeakHint(false)}>
                    <Ionicons name="close" size={18} color={COLORS.gray500} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.hintText}>{PEAK_HOURS_HINT.message}</Text>
              </View>
            )}

            {/* Specific Hours Configuration */}
            {availability === 'specific' && (
              <>
                {/* Presets */}
                <Text style={styles.sectionTitle}>Quick Presets</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.presetsScroll}
                >
                  {PRESETS.map((preset) => (
                    <TouchableOpacity
                      key={preset.id}
                      style={styles.presetChip}
                      onPress={() => handleApplyPreset(preset)}
                    >
                      <Text style={styles.presetIcon}>{preset.icon}</Text>
                      <Text style={styles.presetLabel}>{preset.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Time Slots */}
                <Text style={styles.sectionTitle}>
                  Your Time Slots ({slots.length})
                </Text>

                {slots.map((slot, index) => (
                  <TimeSlot
                    key={index}
                    slot={slot}
                    index={index}
                    onUpdate={handleUpdateSlot}
                    onRemove={handleRemoveSlot}
                    isLast={slots.length === 1}
                  />
                ))}

                {/* Add Slot Button */}
                {slots.length < 5 && (
                  <TouchableOpacity style={styles.addSlotBtn} onPress={handleAddSlot}>
                    <Ionicons name="add-circle" size={20} color={COLORS.primary} />
                    <Text style={styles.addSlotText}>Add Another Time Slot</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* Summary */}
            <View style={styles.summarySection}>
              <Text style={styles.summaryTitle}>📋 Summary</Text>
              {availability === 'all_day' && (
                <Text style={styles.summaryText}>
                  Delivery available all day during business hours
                </Text>
              )}
              {availability === 'peak' && (
                <Text style={styles.summaryText}>
                  Delivery during peak demand hours (9-11 AM, 12-2 PM, 5-8 PM)
                </Text>
              )}
              {availability === 'specific' && (
                <View>
                  {slots.map((slot, i) => (
                    <Text key={i} style={styles.summaryText}>
                      • {formatTime(slot.from)} - {formatTime(slot.to)}
                    </Text>
                  ))}
                </View>
              )}
            </View>

            {/* Extra padding for scroll */}
            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Save Button */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save Delivery Hours</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  content: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    ...SHADOWS.large,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.gray300,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray800,
    marginTop: 20,
    marginBottom: 12,
  },
  optionsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  optionCard: {
    flex: 1,
    backgroundColor: COLORS.gray50,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight + '20',
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray700,
    marginTop: 8,
    textAlign: 'center',
  },
  optionLabelActive: {
    color: COLORS.primary,
  },
  optionDesc: {
    fontSize: 11,
    color: COLORS.gray500,
    textAlign: 'center',
    marginTop: 4,
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  hintBox: {
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  hintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hintTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray800,
  },
  hintText: {
    fontSize: 13,
    color: COLORS.gray700,
    lineHeight: 20,
  },
  presetsScroll: {
    marginBottom: 8,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray100,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    gap: 6,
  },
  presetIcon: {
    fontSize: 16,
  },
  presetLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray700,
  },
  slotContainer: {
    backgroundColor: COLORS.gray50,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  slotTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray700,
  },
  removeBtn: {
    padding: 2,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  timePickerContainer: {
    flex: 1,
    zIndex: 10,
  },
  timeLabel: {
    fontSize: 12,
    color: COLORS.gray500,
    marginBottom: 6,
  },
  timePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    gap: 8,
  },
  timePickerActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight + '10',
  },
  timeValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.gray800,
  },
  timeDropdown: {
    position: 'absolute',
    top: 68,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    ...SHADOWS.medium,
    zIndex: 100,
  },
  timeScrollView: {
    maxHeight: 200,
  },
  timeOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  timeOptionSelected: {
    backgroundColor: COLORS.primaryLight + '20',
  },
  timeOptionText: {
    fontSize: 14,
    color: COLORS.gray700,
  },
  timeOptionTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  arrowContainer: {
    paddingTop: 28,
    paddingHorizontal: 4,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.gray100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 12,
    gap: 4,
  },
  durationText: {
    fontSize: 12,
    color: COLORS.gray600,
    fontWeight: '500',
  },
  addSlotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight + '10',
    gap: 8,
    marginTop: 4,
  },
  addSlotText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  summarySection: {
    backgroundColor: COLORS.gray50,
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.gray800,
    marginBottom: 10,
  },
  summaryText: {
    fontSize: 14,
    color: COLORS.gray600,
    lineHeight: 22,
  },
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray100,
    backgroundColor: COLORS.white,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
});
