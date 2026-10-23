import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '@/constants/theme';

/** The one button style in the app. Shows a spinner and locks while busy. */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  busy,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || busy;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      style={({ pressed }) => [styles.button, pressed && !inactive && styles.pressed, inactive && styles.inactive, style]}
    >
      {busy ? (
        <ActivityIndicator color={colors.textInverse} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    ...shadow.floating,
  },
  pressed: {
    backgroundColor: colors.primaryDark,
  },
  inactive: {
    opacity: 0.55,
  },
  label: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '700',
  },
});
