import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

/**
 * The routing gate. Everything the user can reach depends on this one value:
 * 'loading' keeps the splash-ish view up, otherwise we bounce to the right
 * screen. `router.replace` is used later instead of push so Back never returns
 * to a screen the user has already finished with.
 */
export default function Index() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.text}>Loading…</Text>
      </View>
    );
  }

  if (status === 'signedIn') return <Redirect href="/home" />;
  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  text: {
    color: colors.textMuted,
    fontSize: 15,
  },
});
