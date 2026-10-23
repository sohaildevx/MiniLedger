import { Router } from 'express';
import { asyncHandler, parseBody } from '../http';
import { createLoan, getSummary, listLoans, markRepaid } from '../loans';
import { requireAuth } from '../middleware/auth';
import { notFound } from '../errors';
import { receiptUpload } from '../uploads';
import { loanInputSchema } from '../validation';

export const loansRouter = Router();

// Every route below this line needs a valid JWT.
loansRouter.use(requireAuth);

/** GET /loans - the list shown on the home screen, newest/most urgent first. */
loansRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ loans: await listLoans(req.userId!) });
  }),
);

/** GET /loans/summary - powers the summary card. Declared before /:id routes. */
loansRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    res.json(await getSummary(req.userId!));
  }),
);

/**
 * POST /loans - create an entry.
 *
 * `receiptUpload.single('receipt')` makes this endpoint accept BOTH
 * application/json (simple case) and multipart/form-data (when the app
 * attaches a photo). Multer skips parsing for non-multipart content types.
 */
loansRouter.post(
  '/',
  receiptUpload.single('receipt'),
  asyncHandler(async (req, res) => {
    const input = parseBody(loanInputSchema, req.body);

    const loan = await createLoan({
      userId: req.userId!,
      friendName: input.friend_name,
      amount: input.amount,
      dueDate: input.due_date,
      note: input.note ?? null,
      // Stored relative on purpose: the app prepends its own API base URL,
      // which differs between an emulator, a real phone and production.
      receiptPath: req.file ? `/uploads/${req.file.filename}` : null,
    });

    res.status(201).json(loan);
  }),
);

/** POST /loans/:id/repaid - mark an entry as repaid. */
loansRouter.post(
  '/:id/repaid',
  asyncHandler(async (req, res) => {
    const loanId = Number(req.params.id);
    if (!Number.isInteger(loanId) || loanId <= 0) throw notFound('Loan not found');

    // markRepaid filters on user_id too, so another user's id is a 404,
    // not a permission leak.
    const loan = await markRepaid(req.userId!, loanId);
    if (!loan) throw notFound('Loan not found');

    res.json(loan);
  }),
);
