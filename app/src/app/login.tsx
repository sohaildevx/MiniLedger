import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Field } from '@/components/Field';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, radius, shadow, spacing } from '@/constants/theme';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Step = 'phone' | 'code';

/** Client-side shape checks only - the server owns the real normalisation. */
const hasTenDigits = (value: string) => value.replace(/\D/g, '').length >= 10;
const SIX_DIGITS = /^\d{6}$/;
const RESEND_SECONDS = 60;

export default function LoginScreen() {
  const { signIn } = useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // Ticks once a second while the resend cooldown is running.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function sendOtp() {
    if (!hasTenDigits(phone)) {
      setError('Enter a valid phone number');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.requestOtp(phone.trim());
      setSentTo(result.phone);
      setStep('code');
      setCode('');
      setResendIn(RESEND_SECONDS);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    if (!SIX_DIGITS.test(code)) {
      setError('Enter the 6-digit code');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.verifyOtp(phone.trim(), code);
      // Persist first, then navigate - otherwise a quick Back could land on the
      // login screen with a session that already exists.
      await signIn(result.token);
      router.replace('/home');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.brand}>
          <Text style={styles.logo}>₹</Text>
          <Text style={styles.title}>MiniLedger</Text>
          <Text style={styles.subtitle}>Keep track of who owes you what.</Text>
        </View>

        <View style={styles.card}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {step === 'phone' ? (
            <>
              <Field
                label="Phone number"
                value={phone}
                onChangeText={setPhone}
                placeholder="98765 43210"
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                autoFocus
                hint="We'll text you a 6-digit code."
              />
              <PrimaryButton label="Send code" onPress={() => void sendOtp()} busy={busy} />
            </>
          ) : (
            <>
              <Text style={styles.sentTo}>
                Code sent to <Text style={styles.sentToStrong}>{sentTo}</Text>
              </Text>

              <Field
                label="6-digit code"
                value={code}
                onChangeText={(next) => setCode(next.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={6}
                autoFocus
                hint="Check the backend terminal window - the code is printed there."
              />

              <PrimaryButton
                label="Verify and sign in"
                onPress={() => void verifyOtp()}
                busy={busy}
              />

              <View style={styles.resendRow}>
                <Pressable
                  onPress={() => void sendOtp()}
                  disabled={resendIn > 0 || busy}
                  hitSlop={spacing.sm}
                >
                  <Text style={[styles.link, (resendIn > 0 || busy) && styles.linkDisabled]}>
                    {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                  </Text>
                </Pressable>

                <Pressable onPress={() => setStep('phone')} hitSlop={spacing.sm}>
                  <Text style={styles.link}>Change number</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <Text style={styles.footnote}>
          Demo build: the OTP is printed in the API terminal, not sent by SMS.
        </Text>
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
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xl,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  brand: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  logo: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.textInverse,
    backgroundColor: colors.primary,
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    textAlign: 'center',
    lineHeight: 72,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    ...shadow.floating,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadow.card,
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
  sentTo: {
    fontSize: 15,
    color: colors.textMuted,
  },
  sentToStrong: {
    color: colors.text,
    fontWeight: '700',
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  link: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  linkDisabled: {
    color: colors.textFaint,
  },
  footnote: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textFaint,
    lineHeight: 17,
  },
});
