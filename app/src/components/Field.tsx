import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';

/**
 * Label + input + inline error, so the two forms stay consistent and the error
 * text sits directly under the field that caused it.
 */
export function Field({
  label,
  error,
  hint,
  children,
  ...inputProps
}: TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>

      {children ?? (
        <TextInput
          placeholderTextColor={colors.textFaint}
          style={[styles.input, error ? styles.inputError : null]}
          {...inputProps}
        />
      )}

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16, // >=16 stops iOS zooming the field on focus
    color: colors.text,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
  hint: {
    fontSize: 13,
    color: colors.textFaint,
  },
});
