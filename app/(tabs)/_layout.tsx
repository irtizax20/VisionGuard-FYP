import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useTheme } from '../../hooks/useTheme';
import { useState, useEffect } from 'react';
import { auth, db } from '../../firebase/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

export default function TabLayout() {
  const { colors } = useTheme();
  const [isParent, setIsParent] = useState(false);

  useEffect(() => {
    const checkUserRole = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'user', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            // Show parent dashboard for adult categories
            if (data.category && (data.category === '16-40' || data.category === '40+' || data.category === 'adult' || data.category === 'old')) {
              setIsParent(true);
            }
          }
        } catch (e) {
          console.log('Error fetching role:', e);
        }
      }
    };
    checkUserRole();
  }, []);

// Configure tab navigator with themed styles and icons
  return (
    <ProtectedRoute>
      <Tabs
        screenOptions={({ route }) => ({
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTitleStyle: {
            color: colors.text,
          },
          headerTintColor: colors.text,

          tabBarStyle: {
            height: 80,
            paddingBottom: 5,
            backgroundColor: colors.card,
            borderTopColor: colors.border,
          },

          tabBarItemStyle: {
            marginTop: 10,
          },

          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
            marginTop: 4,
          },

          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: '#888888', // Medium grey for visibility on both dark/light modes

          // Add indicator for active tab
          tabBarIndicatorStyle: {
            backgroundColor: colors.primary,
            height: 3,
          },

          tabBarIcon: ({ color, size, focused }) => {
            let iconName: any;

            // Use filled icons when focused, outline when not
            if (route.name === 'Main') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Report') {
              iconName = focused ? 'document-text' : 'document-text-outline';
            } else if (route.name === 'Setting') {
              iconName = focused ? 'settings' : 'settings-outline';
            } else if (route.name === 'ParentDashboard') {
              iconName = focused ? 'shield' : 'shield-outline';
            }

            return (
              <>
                {focused && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -10,
                      left: -20,
                      right: -20,
                      bottom: -25,
                      backgroundColor: colors.primary + '15', // 15% opacity,
                      borderRadius: 12,
                    }}
                  />
                )}
                <Ionicons
                  name={iconName}
                  size={focused ? size + 2 : size}
                  color={color}
                  style={{
                    marginBottom: focused ? 2 : 0,
                    zIndex: 1,
                  }}
                />
              </>
            );
          },
        })}
      >
        <Tabs.Screen
          name="Main"
          options={{
            title: 'Home',
            headerTitle: 'Vision Guard',
          }}
        />
        <Tabs.Screen
          name="Report"
          options={{
            title: 'Reports',
            headerTitle: 'Eye Health Reports',
          }}
        />
        <Tabs.Screen
          name="Setting"
          options={{
            title: 'Settings',
            headerTitle: 'Settings',
          }}
        />
        <Tabs.Screen
          name="ParentDashboard"
          options={{
            title: 'Parent',
            headerTitle: 'Parent Dashboard',
            href: isParent ? ('/ParentDashboard' as any) : null,
          }}
        />
      </Tabs>
    </ProtectedRoute>
  );
}
