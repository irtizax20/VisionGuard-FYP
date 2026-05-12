import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface FAQItem { question: string; answer: string; }

const FAQS: FAQItem[] = [
  
  { 
    question: 'What data does BlinkFit store?',
    answer: 'Eye tracking runs on-device. Only aggregated health metrics are stored in Firestore. You can clear data from Settings → Profile.'
  },
  // Platform/permissions
  { 
    question: 'Why is screen time not showing on Android?',
    answer: 'Grant Usage Access: Settings → Apps → Special app access → Usage access → Enable BlinkFit. Or use the “Open Settings” button on the Screen Time card.'
  },
  // Auth & signup
  { question: 'I signed up but can’t log in.', answer: 'Verify your email first (check inbox/spam). Use “Forgot your password?” to reset if needed.' },
  { question: 'Can children create accounts?', answer: 'Under‑16 users require a parent email for verification and approval. Each parent can approve up to 2 child accounts.' },
  // Face features
  { question: 'Any tips for face capture/verification?', answer: 'Ensure good lighting, center your face, and hold steady for a moment so the camera can focus/adjust brightness.' },
  // Voice & settings
  { question: 'Where are voice alert settings?', answer: 'Go to Voice Settings to set language, speed, pitch, volume, and reminder schedules.' },
  // Offline & sync
  { question: 'Does the app work offline?', answer: 'Yes. Data is stored locally and syncs automatically when you’re back online.' },
  // Troubleshooting
  { question: 'Camera permission was denied — how do I enable it?', answer: 'Settings → Apps → BlinkFit → Permissions → Camera → Allow. Reopen the app and try again.' },
  { question: 'App stuck on splash screen or keeps returning to login.', answer: 'Check internet. From the emergency screen, tap “Go to Login”. If still stuck, force-close and reopen. As a last resort, clear app storage (this signs you out).' },
  { question: 'Background tracking stops after some time.', answer: 'Disable battery optimizations and allow background activity. Ensure Usage Access is granted and Power Saver is off.' },
  { question: 'Voice alerts are not playing.', answer: 'Enable voice alerts in Voice Settings, increase media volume, disable Do Not Disturb, and try “Test voice”.' },
  { question: 'Parent verification email not received.', answer: 'Check spam/junk, confirm the correct parent email, and retry the under‑16 signup step to resend.' },
  // General support
  { question: 'How do I report a problem or request a feature?', answer: 'Open Support → Contact Support Agent and describe the issue/feature in detail. Attach screenshots if possible.' },
];

export default function SupportScreen() {
  const { colors, fonts, spacing, borderRadius, isDark } = useTheme();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const handleContact = () => {
    const to = 'support@blinkfit.app';
    const subject = encodeURIComponent('BlinkFit Support Request');
    const body = encodeURIComponent('Describe your issue here...\n\nDevice: \nApp version: ');
    Linking.openURL(`mailto:${to}?subject=${subject}&body=${body}`);
  };

  // Use app dark grey accent for the contact button in both themes for consistency
  const contactBg = '#2B383D';
  const contactFg = '#FFFFFF';

  const styles = React.useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: spacing.lg,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      alignItems: 'center',
    },
    title: { fontSize: fonts.xxlarge, fontWeight: 'bold', color: colors.text },
    sectionTitle: {
      fontSize: fonts.large,
      fontWeight: '600',
      color: colors.text,
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      marginTop: spacing.md,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      overflow: 'hidden',
    },
    faqRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    question: { flex: 1, color: colors.text, fontSize: fonts.medium, fontWeight: '500' },
    answer: {
      color: colors.textSecondary,
      fontSize: fonts.medium,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
    },
    contactButton: {
      backgroundColor: contactBg,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: 'transparent',
      padding: spacing.md,
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    contactText: { marginLeft: spacing.md, color: contactFg, fontSize: fonts.large, fontWeight: '600' },
    infoRow: {
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
    },
    infoText: { marginLeft: spacing.sm, color: colors.textSecondary, fontSize: fonts.medium },
  }), [colors, fonts, spacing, borderRadius]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Help & Support</Text>
      </View>

      <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
      {FAQS.map((faq, index) => {
        const isOpen = openIndex === index;
        return (
          <View key={`${index}-${faq.question}`} style={styles.card}>
            <TouchableOpacity
              onPress={() => setOpenIndex(isOpen ? null : index)}
              style={styles.faqRow}
              activeOpacity={0.8}
            >
              <Text style={styles.question}>{faq.question}</Text>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.text} />
            </TouchableOpacity>
            {isOpen && <Text style={styles.answer}>{faq.answer}</Text>}
          </View>
        );
      })}

      <Text style={styles.sectionTitle}>Need More Help?</Text>
      <TouchableOpacity style={styles.contactButton} onPress={handleContact} activeOpacity={0.85}>
        <Ionicons name="mail-outline" size={22} color={contactFg} />
        <Text style={styles.contactText}>Contact Support Agent</Text>
      </TouchableOpacity>

      <View style={styles.infoRow}>
        <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
        <Text style={styles.infoText}>We usually respond within 24 hours.</Text>
      </View>
    </ScrollView>
  );
}
