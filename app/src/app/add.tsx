import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { z } from 'zod';
import { Field } from '@/components/Field';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, radius, spacing } from '@/constants/theme';
import { api, ApiError, errorMessage, MAX_RECEIPT_BYTES, type Receipt } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, toIsoDate } from '@/lib/format';

/**
 * Form validation. Mirrors the server's zod schema in backend/src/validation.ts
 * - same rules, same messages - so the user is told about a problem before a
 * network round-trip, while the API stays the authority that actually enforces
 * them.
 *
 * `amount` stays a string here because that is what a text field holds; it is
 * converted to a number only when the request is built.
 */
const loanSchema = z.object({
  friend_name: z
    .string()
    .trim()
    .min(2, 'Enter at least 2 characters')
    .max(80, 'Keep the name under 80 characters'),
  amount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter an amount like 1500 or 1500.50')
    .refine((value) => Number(value) > 0, 'Amount must be greater than zero'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a due date'),
  note: z.string().trim().max(280, 'Keep the note under 280 characters').optional(),
});

type LoanForm = z.infer<typeof loanSchema>;
type FieldName = keyof LoanForm;

const QUICK_DATES = [
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
] as const;

export default function AddEntryScreen() {
  const { token, signOut } = useAuth();

  /** Fixed at mount so "1 week" means the same thing for every chip. */
  const today = useMemo(() => new Date(), []);
  const isoIn = (days: number) => {
    const target = new Date(today);
    target.setDate(target.getDate() + days);
    return toIsoDate(target);
  };

  const [values, setValues] = useState<LoanForm>({
    friend_name: '',
    amount: '',
    due_date: isoIn(7),
    note: '',
  });
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(false);

  const setValue = (field: FieldName, next: string) => {
    // Clear the field's error as soon as the user starts fixing it.
    setValues((current) => ({ ...current, [field]: next }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  async function pickReceipt() {
    setFormError(null);
    try {
      // On iOS this prompts the first time; on Android it is granted at
      // install, and on web the call is a no-op that reports granted.
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setFormError('Photo permission is needed to attach a receipt.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) return;

      // Fail here rather than after a slow 20 MB upload.
      if (asset.fileSize && asset.fileSize > MAX_RECEIPT_BYTES) {
        setFormError('That photo is larger than 5 MB. Please pick a smaller one.');
        return;
      }

      setReceipt({
        uri: asset.uri,
        fileName: asset.fileName ?? 'receipt.jpg',
        mimeType: asset.mimeType ?? 'image/jpeg',
        file: asset.file,
      });
    } catch {
      setFormError('Could not open the photo picker. Please try again.');
    }
  }

  async function submit() {
    const parsed = loanSchema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<FieldName, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as FieldName;
        // Keep the first message per field rather than concatenating them.
        if (field && !next[field]) next[field] = issue.message;
      }
      setErrors(next);
      return;
    }
    if (!token) {
      setFormError('Your session expired. Please sign in again.');
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      await api.createLoan(
        token,
        {
          friend_name: parsed.data.friend_name,
          amount: Number(parsed.data.amount),
          due_date: parsed.data.due_date,
          note: parsed.data.note || undefined,
        },
        receipt ?? undefined,
      );
      // Home refetches itself via useFocusEffect when we navigate back.
      router.back();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        await signOut();
        return;
      }
      setFormError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {formError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{formError}</Text>
          </View>
        ) : null}

        <Field
          label="Who did you lend to?"
          value={values.friend_name}
          onChangeText={(next) => setValue('friend_name', next)}
          placeholder="Priya"
          error={errors.friend_name}
          autoCapitalize="words"
          autoFocus
        />

        <Field
          label="Amount"
          value={values.amount}
          onChangeText={(next) => setValue('amount', next)}
          placeholder="1500"
          keyboardType="decimal-pad"
          error={errors.amount}
          hint="Indian rupees."
        />

        <Field label="Due date" error={errors.due_date}>
          <Text style={styles.datePreview}>{formatDate(values.due_date)}</Text>

          <View style={styles.chips}>
            {QUICK_DATES.map((option) => {
              const selected = values.due_date === isoIn(option.days);
              return (
                <Pressable
                  key={option.label}
                  onPress={() => setValue('due_date', isoIn(option.days))}
                  style={[styles.chip, selected && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={values.due_date}
            onChangeText={(next) => setValue('due_date', next)}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textFaint}
            keyboardType="numbers-and-punctuation"
            style={[styles.input, errors.due_date ? styles.inputError : null]}
          />
        </Field>

        <Field
          label="Note"
          value={values.note}
          onChangeText={(next) => setValue('note', next)}
          placeholder="Movie tickets"
          error={errors.note}
          multiline
          numberOfLines={3}
          maxLength={280}
        />

        <Field label="Receipt photo" hint="Optional. PNG, JPEG or WebP up to 5 MB.">
          <View style={styles.receiptRow}>
            {receipt ? (
              <View style={styles.receiptPreview}>
                <Image source={{ uri: receipt.uri }} style={styles.receiptImage} resizeMode="cover" />
                <Pressable onPress={() => setReceipt(null)} hitSlop={spacing.sm} accessibilityRole="button">
                  <Text style={styles.removeReceipt}>Remove</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => void pickReceipt()}
                style={({ pressed }) => [styles.pickReceipt, pressed && styles.pickReceiptPressed]}
                accessibilityRole="button"
              >
                <Text style={styles.pickReceiptText}>+ Add photo</Text>
              </Pressable>
            )}
          </View>
        </Field>

        <PrimaryButton
          label="Save entry"
          onPress={() => void submit()}
          busy={busy}
          style={styles.submit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  errorBox: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
  },
  datePreview: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: colors.primary,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.danger,
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickReceipt: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pickReceiptPressed: {
    opacity: 0.7,
  },
  pickReceiptText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  receiptPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  receiptImage: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  removeReceipt: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 14,
  },
  submit: {
    marginTop: spacing.sm,
  },
});
