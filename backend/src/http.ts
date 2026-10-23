import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z, ZodError, ZodTypeAny } from 'zod';
import { HttpError } from './errors';

/**
 * Express 4 does not await async route handlers: a rejected promise becomes an
 * unhandled rejection and the request hangs. Wrapping handlers fixes that in
 * one place instead of try/catch in every route.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** Parse + validate a request body, turning zod issues into a 400. */
export function parseBody<S extends ZodTypeAny>(schema: S, body: unknown): z.output<S> {
  const result = schema.safeParse(body);
  if (!result.success) throw zodToHttpError(result.error);
  return result.data;
}

export function zodToHttpError(error: ZodError): HttpError {
  const message = error.issues
    .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
    .join('; ');
  return new HttpError(400, message, 'VALIDATION_ERROR');
}
