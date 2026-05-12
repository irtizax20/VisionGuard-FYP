// components/ui/DateOfBirthPicker.tsx
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React, { useMemo, useState } from 'react';
import { Dimensions, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
// Date of Birth Picker Component
const { width } = Dimensions.get('window');

interface DateOfBirthPickerProps {
  value: string;
  onDateChange: (date: string) => void;
  placeholder?: string;
}

export const DateOfBirthPicker: React.FC<DateOfBirthPickerProps> = ({
  value,
  onDateChange,
  placeholder = 'Date of Birth (YYYY-MM-DD)'
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showIOSPicker, setShowIOSPicker] = useState(false);

  const parsedDate = useMemo(() => {
    const fallback = new Date(2010, 0, 1);
    if (!value || value.length !== 10) return fallback;
    const d = new Date(value);
    return isNaN(d.getTime()) ? fallback : d;
  }, [value]);

  const formatDateOut = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const isValidDate = (dateString: string): boolean => {
    if (!dateString || dateString.length !== 10) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime()) && dateString === date.toISOString().split('T')[0];
  };

  const getBorderColor = (): string => {
    if (!isFocused && !value) return '#DADCE0';
    if (isFocused) return '#4285F4';
    if (value && isValidDate(value)) return '#4CAF50';
    if (value && !isValidDate(value)) return '#F44336';
    return '#DADCE0';
  };

  const getHelperText = (): string | null => {
    if (!value) return null;
    if (value.length === 10 && isValidDate(value)) {
      const age = calculateAge(value);
      return `Age: ${age} years`;
    }
    if (value.length > 0) return 'Please enter a valid date (YYYY-MM-DD)';
    return null;
  };

  const calculateAge = (birthDate: string): number => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const openPicker = () => {
    setIsFocused(true);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: parsedDate,
        onChange: (_event, selectedDate) => {
          setIsFocused(false);
          if (selectedDate) {
            onDateChange(formatDateOut(selectedDate));
          }
        },
        mode: 'date',
        is24Hour: true,
        maximumDate: new Date(),
      });
    } else if (Platform.OS === 'ios') {
      setShowIOSPicker(true);
    } else {
      // Web fallback: allow typing
      // Do nothing; the TextInput below will be editable on web
    }
  };

  const closeIOSPicker = () => setShowIOSPicker(false);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={openPicker}
        disabled={Platform.OS === 'web'}
      >
        <View style={[styles.inputContainer, { borderColor: getBorderColor() }]}>
          <Ionicons
            name="calendar-outline"
            size={20}
            color={getBorderColor()}
            style={styles.inputIcon}
          />
          {Platform.OS === 'web' ? (
            <TextInput
              style={styles.input}
              placeholder={placeholder}
              placeholderTextColor="#8A9BA8"
              value={value}
              onChangeText={(txt) => {
                // Remove all non-digits
                const cleaned = txt.replace(/\D/g, '');
                let formatted = cleaned;
                if (cleaned.length > 4) {
                  formatted = cleaned.slice(0, 4) + '-' + cleaned.slice(4);
                }
                if (cleaned.length > 6) {
                  formatted = formatted.slice(0, 7) + '-' + cleaned.slice(6, 8);
                }
                onDateChange(formatted);
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              keyboardType="numeric"
              maxLength={10}
            />
          ) : (
            <TextInput
              style={styles.input}
              placeholder={placeholder}
              placeholderTextColor="#8A9BA8"
              value={value}
              editable={false}
              pointerEvents="none"
            />
          )}
        </View>
      </TouchableOpacity>

      {Platform.OS === 'ios' && showIOSPicker && (
        <Modal transparent animationType="slide" visible={showIOSPicker} onRequestClose={closeIOSPicker}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalPanel}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Date of Birth</Text>
                <TouchableOpacity onPress={closeIOSPicker}>
                  <Text style={styles.modalDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={parsedDate}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={(_e, selectedDate) => {
                  if (selectedDate) {
                    onDateChange(formatDateOut(selectedDate));
                  }
                }}
              />
            </View>
          </View>
        </Modal>
      )}

      {getHelperText() && (
        <View
          style={[
            styles.helperContainer,
            { backgroundColor: isValidDate(value) ? '#E8F5E8' : '#FFF3E0' },
          ]}
        >
          <Text
            style={[
              styles.helperText,
              { color: isValidDate(value) ? '#4CAF50' : '#FF9800' },
            ]}
          >
            {getHelperText()}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: '#2B383D',
    fontWeight: '400',
  },
  helperContainer: {
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
  },
  helperText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalPanel: {
    backgroundColor: '#fff',
    paddingTop: 12,
    paddingBottom: 24,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2B383D',
  },
  modalDone: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2B383D',
  },
});
