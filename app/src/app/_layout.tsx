import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, spacing } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';

// Keep the native splash up until React has actually mounted.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontWeight: '700', color: colors.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="home" options={{ title: 'MiniLedger', headerRight: HeaderSignOut }} />
        <Stack.Screen
          name="add"
          options={{ presentation: 'modal', title: 'New entry', headerLeft: HeaderClose }}
        />
      </Stack>
    </AuthProvider>
  );
}

/** Rendered by the navigator, which lives inside <AuthProvider>. */
function HeaderSignOut() {
  const { signOut } = useAuth();
  return (
    <Pressable onPress={() => void signOut()} hitSlop={spacing.sm} accessibilityRole="button">
      <Text style={styles.headerAction}>Sign out</Text>
    </Pressable>
  );
}

/** Closes the "new entry" modal without touching the session. */
function HeaderClose() {
  return (
    <Pressable onPress={() => router.back()} hitSlop={spacing.sm} accessibilityRole="button">
      <Text style={styles.headerAction}>Cancel</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerAction: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: spacing.xs,
  },
});
