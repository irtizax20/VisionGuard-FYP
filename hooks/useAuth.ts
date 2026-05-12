import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { auth } from '../firebase/firebaseConfig';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isFaceVerified: boolean;
    isLoading: boolean;
}

/**
 * Custom hook to manage authentication state
 * Checks both Firebase authentication and face verification status
 */
export function useAuth(): AuthState {
    const [authState, setAuthState] = useState<AuthState>({
        user: null,
        isAuthenticated: false,
        isFaceVerified: false,
        isLoading: true,
    });

    useEffect(() => {
        const checkAuthAndVerification = async (user: User | null) => {
            if (!user) {
                setAuthState({
                    user: null,
                    isAuthenticated: false,
                    isFaceVerified: false,
                    isLoading: false,
                });
                return;
            }

            // User is authenticated, now check face verification
            try {
                const faceVerified = await AsyncStorage.getItem('faceVerificationCompleted');
                setAuthState({
                    user,
                    isAuthenticated: true,
                    isFaceVerified: faceVerified === 'true',
                    isLoading: false,
                });
            } catch (error) {
                console.error('Error checking face verification:', error);
                setAuthState({
                    user,
                    isAuthenticated: true,
                    isFaceVerified: false,
                    isLoading: false,
                });
            }
        };

        // Subscribe to auth state changes
        const unsubscribe = onAuthStateChanged(auth, checkAuthAndVerification);

        return () => unsubscribe();
    }, []);

    return authState;
}
