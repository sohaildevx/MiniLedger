import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { HttpError } from '../errors';
import { zodToHttpError } from '../http';
import { ZodError } from 'zod';

/**
 * Terminal error middleware. Express identifies it by arity (4 arguments),
 * so the `next` parameter must stay even though it looks unused.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (res.headersSent) return;

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }

  if (err instanceof ZodError) {
    const parsed = zodToHttpError(err);
    return res.status(parsed.status).json({ error: parsed.message, code: parsed.code });
  }

  // multer has its own error class with machine-readable codes.
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ error: err.message, code: err.code });
  }

  // express.json() throws a SyntaxError with `type: 'entity.parse.failed'`.
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Request body is not valid JSON', code: 'BAD_JSON' });
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL' });
};

/**
 * NOT an error handler - it has three parameters, so Express treats it as a
 * normal middleware. It catches requests that matched no route at all.
 */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'No route matches this path', code: 'NOT_FOUND' });
};
