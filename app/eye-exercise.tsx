import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';

const exercises = [
  { id: 1, name: 'Palming', duration: 30, description: 'Rub your hands together to generate warmth, then place them over closed eyes for 30 seconds.' },
  { id: 2, name: 'Blinking', duration: 15, description: 'Blink rapidly for a few seconds to moisten your eyes. Repeat several times.' },
  { id: 3, name: 'Focusing', duration: 30, description: 'Focus on a distant object for 15 seconds, then a near object for 15 seconds. Repeat.' },
  { id: 4, name: 'Figure Eights', duration: 20, description: 'Trace an imaginary figure eight with your eyes. Keep both head and neck still.' },
  { id: 5, name: 'Eye Rolling', duration: 20, description: 'Gently roll your eyes to improve circulation. Do this slowly in both directions.' },
  { id: 6, name: '20-20-20 Rule', duration: 20, description: 'Every 20 minutes, look at something 20 feet away for 20 seconds.' },
];

function ExerciseCard({ exercise, isActive, onToggle, theme }: { exercise: any, isActive: boolean, onToggle: () => void, theme: any }) {
  const { colors, fonts, spacing, borderRadius } = theme;
  const [timeLeft, setTimeLeft] = useState(exercise.duration);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isActive) {
      setIsRunning(false);
      setTimeLeft(exercise.duration);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isActive, exercise.duration]);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev: number) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, timeLeft]);

  const toggleTimer = () => {
    if (timeLeft === 0) setTimeLeft(exercise.duration);
    setIsRunning(!isRunning);
  };

  const progress = timeLeft / exercise.duration;

  const styles = StyleSheet.create({
    exerciseCard: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      shadowColor: 'rgba(0,0,0,0.2)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.8,
      shadowRadius: 2,
      elevation: 3,
    },
    exerciseHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    exerciseName: {
      fontSize: fonts.large,
      fontWeight: '600',
      color: colors.text,
    },
    exerciseDescription: {
      fontSize: fonts.medium,
      color: colors.textSecondary,
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    expandButton: {
      padding: spacing.sm,
    },
    timerContainer: {
      alignItems: 'center',
      marginTop: spacing.sm,
      padding: spacing.md,
      backgroundColor: colors.background,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    timerText: {
      fontSize: 32,
      fontWeight: 'bold',
      color: timeLeft === 0 ? '#34C759' : colors.primary,
      marginVertical: spacing.sm,
    },
    timerButton: {
      backgroundColor: timeLeft === 0 ? '#34C759' : (isRunning ? '#FF3B30' : colors.primary),
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xl,
      borderRadius: borderRadius.full,
      marginTop: spacing.sm,
    },
    timerButtonText: {
      color: 'white',
      fontWeight: 'bold',
      fontSize: fonts.medium,
    },
    progressBarContainer: {
      width: '100%',
      height: 8,
      backgroundColor: colors.border,
      borderRadius: 4,
      overflow: 'hidden',
      marginTop: spacing.sm,
    },
    progressBar: {
      height: '100%',
      backgroundColor: colors.primary,
    }
  });

  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <TouchableOpacity style={styles.expandButton} onPress={onToggle}>
          <Ionicons name={isActive ? "chevron-up" : "chevron-down"} size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>
      
      {isActive && (
        <View>
          <Text style={styles.exerciseDescription}>
            {exercise.description}
          </Text>
          
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>
              00:{timeLeft.toString().padStart(2, '0')}
            </Text>
            
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
            </View>
            
            <TouchableOpacity style={styles.timerButton} onPress={toggleTimer}>
              <Text style={styles.timerButtonText}>
                {timeLeft === 0 ? "Done! Reset" : (isRunning ? "Pause" : "Start Exercise")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function EyeExerciseScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { colors, fonts, spacing } = theme;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const handleToggle = useCallback((index: number) => {
    setActiveIndex(current => current === index ? null : index);
  }, []);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: spacing.xl,
      paddingBottom: spacing.lg,
    },
    backButton: {
      padding: spacing.sm,
      marginRight: spacing.md,
    },
    title: {
      fontSize: fonts.xxlarge,
      fontWeight: 'bold',
      color: colors.text,
      flex: 1,
    },
  }), [colors, fonts, spacing]);

  return (
    <ScrollView 
      style={styles.container}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={true}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Eye Exercises</Text>
      </View>

      {exercises.map((exercise, index) => (
        <ExerciseCard 
          key={exercise.id}
          exercise={exercise}
          isActive={activeIndex === index}
          onToggle={() => handleToggle(index)}
          theme={theme}
        />
      ))}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

export default React.memo(EyeExerciseScreen);
