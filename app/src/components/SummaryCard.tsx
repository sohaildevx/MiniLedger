import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { colors, heroGradient, radius, shadow, spacing } from '@/constants/theme';
import { formatMoney } from '@/lib/format';
import type { LoanSummary } from '@/lib/types';

/**
 * The summary hero at the top of the list.
 *
 * `total_lent` counts everything ever lent, including what has been paid back,
 * so the headline number is "still owed" = lent - repaid. The three figures the
 * brief asks for sit underneath it.
 */
export function SummaryCard({ summary }: { summary: LoanSummary | null }) {
  const lent = summary?.total_lent ?? 0;
  const repaid = summary?.total_repaid ?? 0;
  const overdue = summary?.overdue_amount ?? 0;
  const entryCount = summary?.entry_count ?? 0;
  const overdueCount = summary?.overdue_count ?? 0;

  const outstanding = lent - repaid;

  return (
    <LinearGradient
      colors={heroGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <Text style={styles.headlineLabel}>Still owed to you</Text>
      <Text style={styles.headlineValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
        {formatMoney(outstanding)}
      </Text>

      <View style={styles.statsStrip}>
        <Stat label="Lent" value={formatMoney(lent)} />
        <View style={styles.stripDivider} />
        <Stat label="Repaid" value={formatMoney(repaid)} />
        <View style={styles.stripDivider} />
        <Stat
          label="Overdue"
          value={formatMoney(overdue)}
          alert={overdue > 0}
        />
      </View>

      <Text style={styles.footer}>
        {entryCount === 0
          ? 'No entries yet'
          : `${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`}
        {overdueCount > 0 ? `  ·  ${overdueCount} overdue` : ''}
      </Text>
    </LinearGradient>
  );
}

function Stat({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text
        style={[styles.statValue, alert && styles.statValueAlert]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.xs,
    // Without this the hero sits flat on the background and reads as a
    // painted band rather than a card.
    ...shadow.card,
  },
  headlineLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  headlineValue: {
    color: colors.textInverse,
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: spacing.lg,
  },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  stripDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginVertical: 2,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '600',
  },
  statValue: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '700',
  },
  statValueAlert: {
    color: '#FFD9D2',
  },
  footer: {
    marginTop: spacing.lg,
    textAlign: 'center',
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
  },
});
