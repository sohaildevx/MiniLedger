/**
 * Formatting helpers.
 *
 * Two deliberate choices, both to avoid timezone bugs:
 *
 *  1. Dates are parsed by splitting the 'YYYY-MM-DD' string, never through
 *     `new Date('2026-11-15')`. That constructor treats the value as UTC
 *     midnight, so it renders as the 14th for anyone west of Greenwich.
 *  2. `todayIso()` builds the date from local parts rather than calling
 *     `toISOString()`, which is UTC and would be a day behind between local
 *     midnight and the UTC offset.
 *
 * The API makes the same trade-off in SQL with to_char(due_date, 'YYYY-MM-DD').
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (value: number) => String(value).padStart(2, '0');

export function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** '2026-11-15' -> '15 Nov 2026' */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** Whole days from today. Negative means it is already past. */
export function daysUntil(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  const [todayYear, todayMonth, todayDay] = todayIso().split('-').map(Number);
  const target = Date.UTC(year, month - 1, day);
  const today = Date.UTC(todayYear, todayMonth - 1, todayDay);
  return Math.round((target - today) / 86_400_000);
}

/** 'in 3 days' / '5 days late' / 'due today' */
export function relativeDue(isoDate: string): string {
  const days = daysUntil(isoDate);
  if (days === 0) return 'due today';
  if (days > 0) return `in ${days} day${days === 1 ? '' : 's'}`;
  const late = Math.abs(days);
  return `${late} day${late === 1 ? '' : 's'} late`;
}

/**
 * Indian digit grouping (1,00,000 rather than 100,000).
 * Hand-rolled instead of Intl.NumberFormat because Hermes ships partial Intl
 * support and this behaves identically on every device.
 */
function groupIndianDigits(digits: string): string {
  if (digits.length <= 3) return digits;
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${lastThree}`;
}

/** 123456.5 -> '₹1,23,456.50' (paise shown only when non-zero) */
export function formatMoney(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const [whole, fraction] = Math.abs(safe).toFixed(2).split('.');
  const grouped = groupIndianDigits(whole);
  const sign = safe < 0 ? '-' : '';
  return fraction === '00' ? `${sign}₹${grouped}` : `${sign}₹${grouped}.${fraction}`;
}
