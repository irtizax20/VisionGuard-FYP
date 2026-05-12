import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useTheme } from '../../hooks/useTheme';

export default function TabLayout() {
  const { colors } = useTheme();
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
      </Tabs>
    </ProtectedRoute>
  );
}
