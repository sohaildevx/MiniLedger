import { z } from 'zod';

/** Every request body shape in the API, declared in one file. */

export const requestOtpSchema = z.object({
  phone: z.string().trim().min(1, 'phone is required').max(25, 'phone is too long'),
});

export const verifyOtpSchema = z.object({
  phone: z.string().trim().min(1, 'phone is required').max(25, 'phone is too long'),
  code: z.string().regex(/^\d{6}$/, 'code must be a 6-digit number'),
});

/**
 * `z.coerce.number()` because multipart form fields always arrive as strings -
 * without coercion "1500" from a form would fail a z.number() check.
 */
const dueDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'due_date must be formatted YYYY-MM-DD')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'due_date is not a real calendar date');

export const loanInputSchema = z.object({
  friend_name: z
    .string()
    .trim()
    .min(2, 'friend_name must be at least 2 characters')
    .max(80, 'friend_name must be 80 characters or fewer'),
  amount: z.coerce
    .number()
    .positive('amount must be greater than 0')
    .max(1_000_000_000, 'amount is too large'),
  // Past dates are allowed on purpose: you might record a loan you made last month.
  due_date: dueDateSchema,
  note: z.string().trim().max(280, 'note must be 280 characters or fewer').nullish(),
});

export type LoanInput = z.output<typeof loanInputSchema>;
