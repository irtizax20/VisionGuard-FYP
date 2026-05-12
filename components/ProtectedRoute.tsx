import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

interface ProtectedRouteProps {
    children: React.ReactNode;
}


export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { user, isAuthenticated, isFaceVerified, isLoading } = useAuth();
    const { colors } = useTheme();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return; // Wait for auth check to complete

        if (!isAuthenticated || !user) {
            console.log('🔒 Not authenticated, redirecting to login');
            try {
                router.replace('/(auth)/Login');
            } catch (error) {
                console.error('Navigation error:', error);
            }
            return;
        }

        if (!isFaceVerified) {
            console.log('🔒 Face verification required, redirecting');
            try {
                router.replace('/(auth)/face-verification');
            } catch (error) {
                console.error('Navigation error:', error);
            }
            return;
        }

        console.log('✅ User authenticated and verified');
    }, [isAuthenticated, isFaceVerified, isLoading, user, router]);

    // Show loading state while checking auth
    if (isLoading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.text, { color: colors.text }]}>
                    Verifying authentication...
                </Text>
            </View>
        );
    }

    // Show loading while redirecting
    if (!isAuthenticated || !isFaceVerified) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.text, { color: colors.text }]}>
                    Redirecting...
                </Text>
            </View>
        );
    }

    // User is authenticated and verified, render protected content
    return <>{children}</>;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        marginTop: 16,
        fontSize: 16,
    },
});
