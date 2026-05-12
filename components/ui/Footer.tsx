// components/ui/Footer.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
// Footer component with navigation icons
export default function Footer() {
  const { colors } = useTheme();
  return (
    <View style={[styles.footer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable style={styles.iconContainer} onPress={() => router.replace('/(tabs)/Main')}>
        <Ionicons name="home-outline" size={24} color={colors.text} />
        <Text style={[styles.label, { color: colors.text }]}>
          Home
        </Text>
      </Pressable>

      <Pressable style={styles.iconContainer} onPress={() => router.replace('/(tabs)/Report')}>
        <Ionicons name="document-text-outline" size={24} color={colors.text} />
        <Text style={[styles.label, { color: colors.text }]}>Report</Text>
      </Pressable>

      <Pressable style={styles.iconContainer} onPress={() => router.replace('/(tabs)/Setting')}>
        <Ionicons name="settings-outline" size={24} color={colors.text} />
        <Text style={[styles.label, { color: colors.text }]}>Settings</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
 footer: {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  flexDirection: 'row',
  justifyContent: 'space-around',
  paddingVertical: 12,
  borderTopWidth: 1,
  zIndex: 100,
  height: 70,
},

  iconContainer: { alignItems: 'center' },
  label: { fontSize: 14, marginTop: 4 },
});
