import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LoanItem } from '@/components/LoanItem';
import { SummaryCard } from '@/components/SummaryCard';
import { colors, radius, shadow, spacing } from '@/constants/theme';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Loan, LoanSummary } from '@/lib/types';

/** A 401 means the stored token is dead - bounce to login instead of showing a screen that can never load. */
const isExpiredSession = (error: unknown) => error instanceof ApiError && error.status === 401;

export default function HomeScreen() {
  const { token, signOut } = useAuth();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<LoanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repayingId, setRepayingId] = useState<number | null>(null);

  /**
   * useFocusEffect refires every time this screen gains focus, so returning
   * from the "new entry" modal refreshes the list with no extra wiring.
   */
  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [list, totals] = await Promise.all([api.listLoans(token), api.summary(token)]);
      setLoans(list.loans);
      setSummary(totals);
      setError(null);
    } catch (caught) {
      if (isExpiredSession(caught)) {
        await signOut();
        return;
      }
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, signOut]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const markRepaid = useCallback(
    async (loanId: number) => {
      if (!token) return;
      setRepayingId(loanId);
      try {
        // Settle on the server first, then refetch - the summary and the list
        // both change, so one round-trip keeps them consistent.
        await api.markRepaid(token, loanId);
        await load();
      } catch (caught) {
        if (isExpiredSession(caught)) {
          await signOut();
          return;
        }
        setError(errorMessage(caught));
      } finally {
        setRepayingId(null);
      }
    },
    [token, load, signOut],
  );

  return (
    <View style={styles.screen}>
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={loans}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={<SummaryCard summary={summary} />}
        renderItem={({ item }) => (
          <LoanItem
            loan={item}
            busy={repayingId === item.id}
            onMarkRepaid={(id) => void markRepaid(id)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        contentContainerStyle={[
          styles.listContent,
          loans.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          // Must be a component or undefined - `null` is rejected by the type.
          loading ? undefined : (
            <View style={styles.empty}>
              <Text style={styles.emptyGlyph}>₹</Text>
              <Text style={styles.emptyTitle}>Nothing lent yet</Text>
              <Text style={styles.emptyBody}>
                Tap the + button to record the first money you lent out.
              </Text>
            </View>
          )
        }
      />

      <Pressable
        onPress={() => router.push('/add')}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        accessibilityRole="button"
        accessibilityLabel="Add a new entry"
      >
        <Text style={styles.fabGlyph}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing.lg,
    // Room for the floating button so the last card stays tappable.
    paddingBottom: 96,
    gap: spacing.md,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  errorBanner: {
    backgroundColor: colors.dangerSurface,
    borderBottomWidth: 1,
    borderBottomColor: colors.dangerBorder,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  emptyGlyph: {
    fontSize: 44,
    fontWeight: '800',
    color: colors.textFaint,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  emptyBody: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 62,
    height: 62,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.floating,
  },
  fabPressed: {
    backgroundColor: colors.primaryDark,
  },
  fabGlyph: {
    color: colors.textInverse,
    fontSize: 30,
    fontWeight: '600',
    lineHeight: 34,
  },
});
