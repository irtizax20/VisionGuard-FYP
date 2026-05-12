import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useNavigation, useRouter } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Dimensions, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LogoutButton from '../../components/ui/LogoutButton';
import { useScreenTime } from '../../contexts/ScreenTimeContext';
import { auth, db } from '../../firebase/firebaseConfig';
import { useTheme } from '../../hooks/useTheme';
import NativeScreenTrackingService from '../../services/NativeScreenTrackingService';
const { width } = Dimensions.get('window');
// Home Screen Component
function HomeScreen() {
  const nav = useNavigation();
  const router = useRouter();
  const { colors, fonts, spacing, borderRadius, isDark } = useTheme();
  const { screenTimeSeconds, isTracking, formattedTime, refreshScreenTime } = useScreenTime();

  // State for user data
  const [userName, setUserName] = useState('User');
  const [loading, setLoading] = useState(true);


  // Auto-sliding carousel state and refs
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const slideInterval = useRef<any>(null);

  // Carousel state
  const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0); // Start at index 0 (first real item)
  const carouselRef = useRef<ScrollView>(null);
  const isScrolling = useRef(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const carouselAutoSlideInterval = useRef<any>(null);

  // Carousel configuration - one card at a time, centered
  const CARD_WIDTH = width * 0.8; // Card takes 80% of screen
  const SIDE_PADDING = (width - CARD_WIDTH) / 2; // Padding to center card

  // Carousel data
  const carouselData = [
    {
      id: 1,
      title: "20-20-20 Rule",
      subtitle: "Every 20 min, look 20 feet away for 20 sec",
      description: "Reduce eye strain with this proven technique",
      backgroundColor: '#4A90E2',
      icon: "eye-outline",
    },
    {
      id: 2,
      title: "Blink More Often",
      subtitle: "Keep your eyes naturally moist",
      description: "Conscious blinking prevents dry eyes",
      backgroundColor: '#50C878',
      icon: "water-outline",
    },
    {
      id: 3,
      title: "Screen Brightness",
      subtitle: "Match your surroundings",
      description: "Proper lighting reduces eye fatigue",
      backgroundColor: '#FF8C42',
      icon: "sunny-outline",
    },
    {
      id: 4,
      title: "Take Breaks",
      subtitle: "Step away from screens regularly",
      description: "Give your eyes complete rest every hour",
      backgroundColor: '#9B59B6',
      icon: "pause-circle-outline",
    },
    {
      id: 5,
      title: "Eye Exercises",
      subtitle: "Strengthen your eye muscles",
      description: "Simple movements for better focus",
      backgroundColor: '#E74C3C',
      icon: "fitness-outline",
    },
    {
      id: 6,
      title: "Proper Lighting",
      subtitle: "Reduce screen contrast",
      description: "Ambient lighting protects your vision",
      backgroundColor: '#F39C12',
      icon: "bulb-outline",
    },
  ];

  // Create extended data for infinite scroll (duplicate last item at start and first item at end)
  const extendedCarouselData = React.useMemo(() => {
    if (carouselData.length === 0) return [];
    const lastItem = { ...carouselData[carouselData.length - 1], id: `${carouselData[carouselData.length - 1].id}-start` };
    const firstItem = { ...carouselData[0], id: `${carouselData[0].id}-end` };
    return [lastItem, ...carouselData, firstItem];
  }, [carouselData]);

  // Eye health tips data
  const eyeHealthTips = [
    {
      id: 1,
      title: "20-20-20 Rule",
      description: "Every 20 minutes, look at something 20 feet away for 20 seconds",
      icon: "eye-outline",
      color: colors.primary,
    },
    {
      id: 2,
      title: "Blink More Often",
      description: "Remember to blink regularly to keep your eyes moist and refreshed",
      icon: "water-outline",
      color: colors.secondary,
    },
    {
      id: 3,
      title: "Adjust Screen Brightness",
      description: "Match your screen brightness to your surroundings to reduce strain",
      icon: "sunny-outline",
      color: '#FF9500',
    },
    {
      id: 4,
      title: "Take Regular Breaks",
      description: "Step away from screens every hour to give your eyes a complete rest",
      icon: "pause-circle-outline",
      color: '#34C759',
    },
    {
      id: 5,
      title: "Proper Lighting",
      description: "Use adequate ambient lighting to reduce contrast between screen and surroundings",
      icon: "bulb-outline",
      color: '#FF6B35',
    },
  ];

  // Helper function to format display name
  const formatDisplayName = React.useCallback((fullName: string): string => {
    if (!fullName || fullName.trim() === '') return 'User';

    const words = fullName.trim().split(' ').filter(word => word.length > 0);

    if (words.length === 0) return 'User';
    if (words.length === 1) return words[0]; // Single word
    if (words.length === 2) return words[0]; // Two words - return first
    if (words.length >= 3) return words[1]; // Three or more words - return middle (second)

    return words[0]; // Fallback
  }, []);

  React.useLayoutEffect(() => {
    nav.setOptions({ headerRight: () => <LogoutButton /> });
  }, [nav]);

  // Check and request Usage Access permission with retry mechanism
  useEffect(() => {
    let permissionCheckCount = 0;
    const MAX_PERMISSION_CHECKS = 4;
    let appStateSubscription: any = null;

    const checkUsagePermission = async () => {
      if (Platform.OS !== 'android') return;

      try {
        // Safely get status with fallback
        let status;
        try {
          status = await NativeScreenTrackingService.getStatus();
        } catch (statusError) {
          console.error('❌ Failed to get native tracking status:', statusError);
          // Return early with safe defaults to prevent crash
          return;
        }
        
        if (!status) {
          console.error('❌ Native tracking status is null/undefined');
          return;
        }
        
        // Request Usage Access if not granted
        if (!status.hasUsageAccess) {
          permissionCheckCount++;
          console.log(`📊 Requesting Usage Access permission (Attempt ${permissionCheckCount}/${MAX_PERMISSION_CHECKS})...`);
          
          if (permissionCheckCount >= MAX_PERMISSION_CHECKS) {
            // Max attempts reached - logout user
            console.log('⚠️ Max permission attempts reached. Logging out user...');
            
            Alert.alert(
              'Permission Required',
              'Data Usage Access permission is required to track your screen time. You will be logged out.',
              [
                {
                  text: 'OK',
                  onPress: async () => {
                    try {
                      await AsyncStorage.removeItem('faceVerificationCompleted');
                      await signOut(auth);
                      router.replace('/(auth)/Login');
                    } catch (error) {
                      console.error('❌ Error during logout:', error);
                      router.replace('/(auth)/Login');
                    }
                  }
                }
              ]
            );
            
            // Cleanup listener
            if (appStateSubscription) {
              appStateSubscription.remove();
            }
            return;
          }
          
          await NativeScreenTrackingService.openUsageAccessSettings();
        } else {
          // Permission granted - start tracking if not already running
          console.log('✅ Usage Access permission granted');
          
          if (!status.isTracking) {
            console.log('🚀 Starting native screen time tracking...');
            await NativeScreenTrackingService.startTracking();
            console.log('✅ Screen time tracking started');
          }
          
          // Cleanup listener after permission is granted and tracking started
          if (appStateSubscription) {
            appStateSubscription.remove();
          }
        }

        // Request Battery Optimization exemption if not granted (safely)
        try {
          if (status && !status.isIgnoringBatteryOpt) {
            console.log('🔋 Requesting Battery Optimization exemption...');
            await NativeScreenTrackingService.requestIgnoreBatteryOptimizations();
          }
        } catch (batteryError) {
          console.warn('⚠️ Battery optimization request failed (non-critical):', batteryError);
          // Non-critical error, don't crash
        }
      } catch (error) {
        console.error('❌ Error checking permissions:', error);
        // Don't crash the app - log and continue
      }
    };

    // Initial check
    checkUsagePermission();

    // Listen for app state changes to re-check permission when user returns
    appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active' && permissionCheckCount < MAX_PERMISSION_CHECKS) {
        // Only re-check if permission hasn't been granted yet
        try {
          const status = await NativeScreenTrackingService.getStatus();
          if (!status?.hasUsageAccess) {
            console.log('🔄 App became active, re-checking permission...');
            checkUsagePermission();
          } else {
            // Permission already granted, cleanup listener
            if (appStateSubscription) {
              appStateSubscription.remove();
            }
          }
        } catch (error) {
          console.error('❌ Error checking status on app state change:', error);
        }
      }
    });

    return () => {
      if (appStateSubscription) {
        appStateSubscription.remove();
      }
    };
  }, []); // Run once when component mounts

  // Fetch user data from Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // First try to get the display name from auth
          if (user.displayName) {
            setUserName(formatDisplayName(user.displayName));
          } else {
            // If no display name, try to get from Firestore
            const userDoc = await getDoc(doc(db, 'user', user.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              const name = userData.name || userData.displayName || user.email?.split('@')[0] || 'User';
              setUserName(formatDisplayName(name));
            } else {
              // Fallback to email username or 'User'
              const name = user.email?.split('@')[0] || 'User';
              setUserName(formatDisplayName(name));
            }
          }
        } catch (error) {
          console.log('Error fetching user data:', error);
          const fallbackName = user.email?.split('@')[0] || 'User';
          setUserName(formatDisplayName(fallbackName));
        }
      } else {
        setUserName('User');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [formatDisplayName]);

  // Initialize infinite carousel position
  useEffect(() => {
    if (carouselRef.current && !isInitialized && extendedCarouselData.length > 0) {
      // Start at the first real item (index 1 in extended array)
      setTimeout(() => {
        carouselRef.current?.scrollTo({
          x: width, // Scroll to the first real item
          animated: false,
        });
        setIsInitialized(true);
      }, 100);
    }
  }, [extendedCarouselData.length, isInitialized]);

  // Auto-scroll carousel every 5 seconds
  useEffect(() => {
    if (!isInitialized) return;

    const startCarouselAutoScroll = () => {
      carouselAutoSlideInterval.current = setInterval(() => {
        setCurrentCarouselIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % carouselData.length;
          
          // Scroll to next card (add 1 because of duplicate item at start)
          if (carouselRef.current && !isScrolling.current) {
            carouselRef.current.scrollTo({
              x: (nextIndex + 1) * width,
              animated: true,
            });
          }
          
          return nextIndex;
        });
      }, 5000); // Auto-scroll every 5 seconds
    };

    startCarouselAutoScroll();

    return () => {
      if (carouselAutoSlideInterval.current) {
        clearInterval(carouselAutoSlideInterval.current);
      }
    };
  }, [isInitialized, carouselData.length]);

  // Handle infinite scroll for carousel
  const handleCarouselMomentumScrollEnd = useCallback((event: any) => {
    if (isScrolling.current) return;

    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);

    // Clear and restart auto-scroll timer when user manually scrolls
    if (carouselAutoSlideInterval.current) {
      clearInterval(carouselAutoSlideInterval.current);
    }

    // Handle infinite loop transitions
    if (index === 0) {
      // At duplicate last item (beginning of extended array), jump to real last item
      isScrolling.current = true;
      setTimeout(() => {
        carouselRef.current?.scrollTo({
          x: carouselData.length * width, // Position of real last item
          animated: false,
        });
        setCurrentCarouselIndex(carouselData.length - 1);
        isScrolling.current = false;
      }, 10);
    } else if (index === extendedCarouselData.length - 1) {
      // At duplicate first item (end of extended array), jump to real first item
      isScrolling.current = true;
      setTimeout(() => {
        carouselRef.current?.scrollTo({
          x: width, // Position of real first item
          animated: false,
        });
        setCurrentCarouselIndex(0);
        isScrolling.current = false;
      }, 10);
    } else {
      // Normal scroll - update the current index
      const realIndex = index - 1; // Adjust for the duplicate item at the beginning
      if (realIndex >= 0 && realIndex < carouselData.length) {
        setCurrentCarouselIndex(realIndex);
      }
    }

    // Restart auto-scroll timer after 2 seconds of user interaction
    setTimeout(() => {
      carouselAutoSlideInterval.current = setInterval(() => {
        setCurrentCarouselIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % carouselData.length;
          
          if (carouselRef.current && !isScrolling.current) {
            carouselRef.current.scrollTo({
              x: (nextIndex + 1) * width,
              animated: true,
            });
          }
          
          return nextIndex;
        });
      }, 5000);
    }, 2000);
  }, [carouselData.length, extendedCarouselData.length]);

  // Handle scroll events during scrolling (not at the end)
  const handleCarouselScroll = useCallback((event: any) => {
    if (isScrolling.current) return;

    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);

    // Only update index for normal positions (not at edges where infinite loop happens)
    if (index > 0 && index < extendedCarouselData.length - 1) {
      const realIndex = index - 1;
      if (realIndex >= 0 && realIndex < carouselData.length && realIndex !== currentCarouselIndex) {
        setCurrentCarouselIndex(realIndex);
      }
    }
  }, [carouselData.length, currentCarouselIndex, extendedCarouselData.length]);

  // Memoized scroll function to prevent recreations
  const scrollToTip = useCallback((nextIndex: number) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: nextIndex * (width * 0.8 + 16), // card width + margin
        animated: true,
      });
    }
  }, [width]);

  // Auto-sliding carousel effect
  useEffect(() => {
    const startAutoSlide = () => {
      slideInterval.current = setInterval(() => {
        setCurrentTipIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % eyeHealthTips.length;
          scrollToTip(nextIndex);
          return nextIndex;
        });
      }, 4000) as unknown as NodeJS.Timeout; // Auto-slide every 4 seconds
    };

    startAutoSlide();

    return () => {
      if (slideInterval.current) {
        clearInterval(slideInterval.current);
      }
    };
  }, [eyeHealthTips.length, scrollToTip]);

  // Handle manual scroll
  const handleScroll = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (width * 0.8 + 16));

    if (index !== currentTipIndex && index >= 0 && index < eyeHealthTips.length) {
      setCurrentTipIndex(index);

      // Clear and restart the auto-slide timer when user manually scrolls
      if (slideInterval.current) {
        clearInterval(slideInterval.current);
      }

      setTimeout(() => {
        slideInterval.current = setInterval(() => {
          setCurrentTipIndex((prevIndex) => {
            const nextIndex = (prevIndex + 1) % eyeHealthTips.length;
            scrollToTip(nextIndex);
            return nextIndex;
          });
        }, 4000) as unknown as NodeJS.Timeout;
      }, 2000) as unknown as NodeJS.Timeout; // Restart auto-slide after 2 seconds
    }
  }, [currentTipIndex, eyeHealthTips.length, scrollToTip, width]);

  // Mock data for demonstration
  const eyeStrainLevel = "Moderate";

  // Voice test handler: Native implementation handles this automatically
  const handleVoiceTest = useCallback(async () => {
    try {
      // Ask notification permission if needed
      const perm = await Notifications.getPermissionsAsync();
      if (perm.status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }

      // Fire a local notification immediately
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔊 Voice Test',
          body: 'Voice alerts are handled natively by Kotlin service.',
        },
        trigger: null,
      });

      console.log('✅ Test notification sent - Voice alerts run in native Kotlin service');
    } catch (e) {
      console.log('Voice test failed:', e);
    }
  }, []);

  // Memoize menu items to prevent recreation on every render
  const menuItems = useMemo<{ icon: string; label: string; onPress: () => void }[]>(() => [
    // TODO: Add custom screen time tracker here when ready
    // Removed: Screen Time and Daily Summary (old tracking system removed)
    // { icon: 'phone-portrait-outline', label: 'Screen Time', onPress: () => router.push('/screen-time') },
    // { icon: 'analytics', label: 'Daily Summary', onPress: () => router.push('/daily-summary') },
  ], [router]);

  // Create styles inside component to make them reactive to theme changes
  const styles = React.useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: width * 0.05,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
    },
    greeting: {
      fontWeight: 'bold',
      color: colors.text,
      fontSize: fonts.xxlarge,
    },
    welcomeMessage: {
      marginTop: spacing.xs,
      color: colors.textSecondary,
      fontSize: fonts.medium,
    },
    card: {
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.xl,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 5,
      borderWidth: 1,
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    cardTitle: {
      fontWeight: '600',
      marginBottom: spacing.md,
      color: colors.text,
      fontSize: fonts.large,
    },
    progressContainer: {
      height: 12,
      borderRadius: 6,
      overflow: 'hidden',
      backgroundColor: colors.border,
    },
    progressBar: {
      height: '100%',
      backgroundColor: colors.primary,
    },
    progressText: {
      marginTop: spacing.sm,
      textAlign: 'right',
      fontWeight: '500',
      color: colors.text,
      fontSize: fonts.medium,
    },
    infoCardsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.xl,
    },
    infoCard: {
      borderRadius: borderRadius.md,
      padding: spacing.md,
      alignItems: 'center',
      width: '48%',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 3,
      borderWidth: 1,
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    infoCardLabel: {
      marginTop: spacing.sm,
      fontWeight: '500',
      color: colors.textSecondary,
      fontSize: fonts.small,
    },
    infoCardValue: {
      fontWeight: 'bold',
      marginTop: spacing.xs,
      color: colors.text,
      fontSize: fonts.medium,
    },
    gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    gridItem: {
      width: (width * 0.9) / 2 - 10, // 2 items per row with spacing
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      alignItems: 'center',
      marginBottom: spacing.lg,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
      borderWidth: 1,
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    iconCircle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md,
      backgroundColor: colors.primary,
    },
    gridLabel: {
      fontWeight: '500',
      textAlign: 'center',
      color: colors.text,
      fontSize: fonts.medium,
    },
    quickActionsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
      marginBottom: spacing.xxl,
    },
    quickActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: 25,
      width: '100%',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    quickActionText: {
      fontWeight: '600',
      marginLeft: spacing.sm,
      fontSize: fonts.medium,
    },
    // Tab bars styles
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.xs,
      marginVertical: spacing.md,
    },
    tabButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: 'transparent',
    },
    activeTabButton: {
      backgroundColor: colors.primary,
    },
    tabText: {
      fontSize: fonts.small,
      color: colors.text,
      marginLeft: spacing.xs,
      fontWeight: '500',
    },
    activeTabText: {
      color: colors.background,
      fontWeight: '600',
    },
    suggestionContainer: {
      marginBottom: spacing.lg,
    },
    suggestionCard: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    suggestionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    suggestionTitle: {
      fontSize: fonts.medium,
      fontWeight: '600',
      color: colors.text,
      marginLeft: spacing.sm,
    },
    suggestionText: {
      fontSize: fonts.small,
      color: colors.textSecondary,
      lineHeight: 18,
    },

    // Carousel styles

    carouselContainer: {
      marginTop: spacing.lg,
      marginBottom: spacing.xl,
    },
    carouselHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
      paddingHorizontal: spacing.xs,
    },
    carouselTitle: {
      fontSize: fonts.large,
      fontWeight: '600',
      color: colors.text,
    },
    carouselScrollView: {
      marginBottom: spacing.sm,
    },
    tipCard: {
      width: width * 0.8,
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginRight: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 5,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tipCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    tipIconContainer: {
      width: 50,
      height: 50,
      borderRadius: 25,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    tipTitle: {
      fontSize: fonts.large,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    tipDescription: {
      fontSize: fonts.medium,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    paginationContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    paginationDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginHorizontal: 4,
    },
    paginationDotActive: {
      backgroundColor: colors.primary,
    },
    paginationDotInactive: {
      backgroundColor: colors.border,
    },

    // Carousel slide - full width for one card at a time
    carouselSlide: {
      width: width,
      justifyContent: 'center',
      alignItems: 'flex-start',
      paddingLeft: width * 0.05,
      paddingRight: width * 0.15,
    },
    // Carousel card
    carouselCard: {
      width: CARD_WIDTH,
      height: 200,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    carouselCardTitle: {
      fontSize: fonts.large,
      fontWeight: '700',
      color: 'white',
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    carouselCardSubtitle: {
      fontSize: fonts.small,
      color: 'rgba(255, 255, 255, 0.85)',
      marginTop: spacing.xs,
      textAlign: 'center',
    },
    carouselPagination: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.md,
    },
    carouselDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginHorizontal: 4,
    },
    carouselDotActive: {
      backgroundColor: colors.primary,
      width: 20,
    },
    carouselDotInactive: {
      backgroundColor: colors.border,
    },
  }), [colors, fonts, spacing, borderRadius, CARD_WIDTH, SIDE_PADDING]);

  return (
    <ScrollView
      style={styles.container}
      removeClippedSubviews={true}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {userName}!</Text>
        <Text style={styles.welcomeMessage}>Let&apos;s take care of your eyes today.</Text>

        {/* Horizontal Carousel */}
        <View style={styles.carouselContainer}>
          <ScrollView
            ref={carouselRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={width}
            snapToAlignment="start"
            decelerationRate="fast"
            scrollEventThrottle={16}
            bounces={false}
            pagingEnabled={true}
            disableIntervalMomentum={true}
            onScroll={handleCarouselScroll}
            onMomentumScrollEnd={handleCarouselMomentumScrollEnd}
          >
            {extendedCarouselData.map((item, index) => (
              <View key={item.id} style={styles.carouselSlide}>
                <View style={[
                  styles.carouselCard,
                  { backgroundColor: item.backgroundColor }
                ]}>
                  <Ionicons name={item.icon as any} size={28} color="white" />
                  <Text style={styles.carouselCardTitle}>{item.title}</Text>
                  <Text style={styles.carouselCardSubtitle}>{item.subtitle}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Pagination Dots */}
          <View style={styles.carouselPagination}>
            {carouselData.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.carouselDot,
                  index === currentCarouselIndex ? styles.carouselDotActive : styles.carouselDotInactive
                ]}
              />
            ))}
          </View>
        </View>
      </View>



      {/* Screen Time Tracker Card */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="phone-portrait-outline" size={24} color={colors.primary} style={{ marginRight: spacing.sm }} />
            <Text style={styles.cardTitle}>Screen Time Today</Text>
          </View>
          <TouchableOpacity
            onPress={refreshScreenTime}
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: borderRadius.md,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
          <Text style={{ fontSize: fonts.xxxlarge, fontWeight: 'bold', color: colors.text }}>
            {formattedTime}
          </Text>
          <Text style={{ fontSize: fonts.small, color: colors.textSecondary, marginTop: spacing.xs }}>
            24/7 Tracking Active
          </Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: fonts.small, color: colors.textSecondary }}>Status</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs }}>
              <View style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: isTracking ? colors.success : colors.textSecondary,
                marginRight: spacing.xs
              }} />
              <Text style={{ fontSize: fonts.medium, fontWeight: '600', color: colors.text }}>
                {isTracking ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Eye Strain Info Card */}
      <View style={styles.infoCardsContainer}>
        <View style={styles.infoCard}>
          <Ionicons name="eye-outline" size={24} color={colors.primary} />
          <Text style={styles.infoCardLabel}>Eye Strain</Text>
          <Text style={styles.infoCardValue}>{eyeStrainLevel}</Text>
        </View>
        <View style={styles.infoCard}>
          <Ionicons name="analytics-outline" size={24} color={colors.primary} />
          <Text style={styles.infoCardLabel}>Today&apos;s Focus</Text>
          <Text style={styles.infoCardValue}>Good</Text>
        </View>
      </View>

      {/* Main Menu Grid */}
      <View style={styles.gridContainer}>
        {menuItems.map((item) => (
          <TouchableOpacity key={item.label} style={styles.gridItem} onPress={item.onPress}>
            <View style={[
              styles.iconCircle,
              item.label === 'Module Tests' ? { backgroundColor: colors.error } : {}
            ]}>
              <Ionicons
                name={item.icon as any}
                size={28}
                color={item.label === 'Module Tests' ? '#FFFFFF' : colors.background}
              />
            </View>
            <Text style={[
              styles.gridLabel,
              item.label === 'Module Tests' ? { color: colors.text } : {}
            ]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsContainer}>
        <TouchableOpacity
          style={[styles.quickActionButton, { backgroundColor: colors.primary, width: '100%' }]}
          onPress={() => router.push('/eye-exercise')}
        >
          <Ionicons name="play-circle-outline" size={22} color={colors.background} />
          <Text style={[styles.quickActionText, { color: colors.background }]}>Start Eye Exercise</Text>
        </TouchableOpacity>
      </View>

      {/* Blink Detection Test */}
      <View style={styles.quickActionsContainer}>
        <TouchableOpacity
          style={[styles.quickActionButton, { backgroundColor: '#4CAF50', width: '100%' }]}
          onPress={() => router.push('/blink-test')}
        >
          <Ionicons name="eye-outline" size={22} color="#fff" />
          <Text style={[styles.quickActionText, { color: '#fff' }]}>🧪 Test Blink Detection</Text>
        </TouchableOpacity>
      </View>

      {/* Manual Eye Capture */}
      <View style={styles.quickActionsContainer}>
        <TouchableOpacity
          style={[styles.quickActionButton, { backgroundColor: '#4CAF50', width: '100%' }]}
          onPress={() => router.push('/manual-eye-capture')}
        >
          <Ionicons name="camera-outline" size={22} color="#fff" />
          <Text style={[styles.quickActionText, { color: '#fff' }]}>📸 Capture Eye Images</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

// Memoize the component to prevent unnecessary re-renders
export default React.memo(HomeScreen);
