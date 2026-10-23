import { config } from './config';
import { HttpError } from './errors';

/**
 * Turn the messy ways a human types a phone number into ONE canonical string,
 * so the `users.phone` UNIQUE constraint actually works:
 *
 *   "98765 43210"    -> "+919876543210"
 *   "09876543210"    -> "+919876543210"
 *   "+91 98765-43210"-> "+919876543210"
 */
export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-().]/g, '');

  // Already in E.164 (country code first).
  if (/^\+\d{10,15}$/.test(cleaned)) return cleaned;

  // Leading national trunk "0" - drop it and prepend the default country code.
  if (/^0\d{10}$/.test(cleaned)) return `${config.DEFAULT_COUNTRY_CODE}${cleaned.slice(1)}`;

  // Bare 10-digit number.
  if (/^\d{10}$/.test(cleaned)) return `${config.DEFAULT_COUNTRY_CODE}${cleaned}`;

  throw new HttpError(
    400,
    'Enter a valid phone number: 10 digits, or with a country code like +91XXXXXXXXXX',
    'INVALID_PHONE',
  );
}
