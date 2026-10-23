import { Router } from 'express';
import { asyncHandler, parseBody } from '../http';
import { normalizePhone } from '../phone';
import { issueOtp, verifyOtp } from '../otp';
import { signToken } from '../middleware/auth';
import { HttpError } from '../errors';
import { createUser, findUserByPhone } from '../users';
import { requestOtpSchema, verifyOtpSchema } from '../validation';

export const authRouter = Router();

/**
 * Step 1 of login. Generates a 6-digit code, prints it to the server log
 * (this is the "mock OTP" the brief asks for) and returns 202.
 *
 * Note what is NOT returned: the code itself. The phone number is echoed back
 * so the client can display "code sent to +919876543210".
 */
authRouter.post(
  '/request-otp',
  asyncHandler(async (req, res) => {
    const { phone } = parseBody(requestOtpSchema, req.body);
    const normalized = normalizePhone(phone);
    const { code, ttlSeconds } = issueOtp(normalized);

    // In production this line is replaced by an SMS provider call.
    console.log(`\n🔐  [MiniLedger] OTP for ${normalized}: ${code}  (expires in ${ttlSeconds}s)\n`);

    res.status(202).json({ phone: normalized, ttlSeconds });
  }),
);

/**
 * Step 2. On success the user row is created (first login only) and a JWT is
 * issued. The OTP is consumed here and cannot be used again.
 */
authRouter.post(
  '/verify-otp',
  asyncHandler(async (req, res) => {
    const { phone, code } = parseBody(verifyOtpSchema, req.body);
    const normalized = normalizePhone(phone);

    const result = verifyOtp(normalized, code);
    if (!result.ok) throw new HttpError(401, result.reason, 'OTP_INVALID');

    const user = (await findUserByPhone(normalized)) ?? (await createUser(normalized));

    res.json({ token: signToken(user.id), user: { id: user.id, phone: user.phone } });
  }),
);
