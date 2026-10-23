import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing } from '@/constants/theme';
import { receiptUrl } from '@/lib/config';
import { formatDate, formatMoney, relativeDue } from '@/lib/format';
import type { Loan } from '@/lib/types';

/**
 * One row in the list.
 *
 * Status drives everything: overdue entries get a red wash, a red left edge and
 * a badge, so they are impossible to miss on the home screen. Settled entries
 * are dimmed into the brand green so they recede without disappearing.
 */
export function LoanItem({
  loan,
  busy,
  onMarkRepaid,
}: {
  loan: Loan;
  busy: boolean;
  onMarkRepaid: (id: number) => void;
}) {
  const isOverdue = loan.status === 'overdue';
  const isRepaid = loan.status === 'repaid';
  const receipt = receiptUrl(loan.receipt_path);

  return (
    <View style={[styles.card, isOverdue && styles.cardOverdue, isRepaid && styles.cardRepaid]}>
      <View style={styles.topRow}>
        <Text style={styles.name} numberOfLines={1}>
          {loan.friend_name}
        </Text>
        <Text style={[styles.amount, isRepaid && styles.amountRepaid]}>
          {formatMoney(loan.amount)}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.meta}>Due {formatDate(loan.due_date)}</Text>
        {!isRepaid && (
          <Text style={[styles.relative, isOverdue && styles.relativeOverdue]}>
            · {relativeDue(loan.due_date)}
          </Text>
        )}
        <View style={{ flex: 1 }} />
        <StatusBadge status={loan.status} />
      </View>

      {loan.note ? (
        <Text style={styles.note} numberOfLines={2}>
          {loan.note}
        </Text>
      ) : null}

      <View style={styles.footer}>
        {receipt ? (
          <Image source={{ uri: receipt }} style={styles.receipt} resizeMode="cover" />
        ) : (
          <View style={styles.receiptSpacer} />
        )}

        {isRepaid ? (
          <Text style={styles.settledText}>
            Paid {loan.repaid_at ? formatDate(loan.repaid_at.slice(0, 10)) : ''}
          </Text>
        ) : (
          <Pressable
            onPress={() => onMarkRepaid(loan.id)}
            disabled={busy}
            style={({ pressed }) => [
              styles.button,
              isOverdue && styles.buttonOverdue,
              pressed && styles.buttonPressed,
              busy && styles.buttonBusy,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Mark ${loan.friend_name} as repaid`}
          >
            {busy ? (
              <ActivityIndicator color={colors.textInverse} size="small" />
            ) : (
              <Text style={styles.buttonText}>Mark repaid</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

function StatusBadge({ status }: { status: Loan['status'] }) {
  if (status === 'open') return null;

  const overdue = status === 'overdue';
  return (
    <View style={[styles.badge, overdue ? styles.badgeOverdue : styles.badgeRepaid]}>
      <Text style={[styles.badgeText, overdue ? styles.badgeTextOverdue : styles.badgeTextRepaid]}>
        {overdue ? 'OVERDUE' : 'PAID'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
    ...shadow.card,
  },
  cardOverdue: {
    backgroundColor: colors.dangerSurface,
    borderLeftColor: colors.danger,
  },
  cardRepaid: {
    backgroundColor: colors.successSurface,
    borderLeftColor: colors.successBorder,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  name: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  amount: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
  },
  amountRepaid: {
    color: colors.success,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  relative: {
    fontSize: 13,
    color: colors.textFaint,
  },
  relativeOverdue: {
    color: colors.danger,
    fontWeight: '600',
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeOverdue: {
    backgroundColor: colors.danger,
  },
  badgeRepaid: {
    backgroundColor: colors.primaryLight,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  badgeTextOverdue: {
    color: colors.textInverse,
  },
  badgeTextRepaid: {
    color: colors.success,
  },
  note: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  receipt: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  receiptSpacer: {
    width: 46,
    height: 46,
  },
  settledText: {
    fontSize: 13,
    color: colors.success,
    fontWeight: '600',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    minWidth: 128,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonOverdue: {
    backgroundColor: colors.danger,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonBusy: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.textInverse,
    fontWeight: '700',
    fontSize: 14,
  },
});
