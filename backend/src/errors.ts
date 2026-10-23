/**
 * A tiny error type that carries an HTTP status code.
 * Throwing this from anywhere in the request pipeline lets the error
 * middleware turn it into a JSON response - no try/catch in every route.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message: string, code?: string) => new HttpError(400, message, code);
export const unauthorized = (message = 'Authentication required', code?: string) =>
  new HttpError(401, message, code);
export const notFound = (message = 'Not found', code?: string) => new HttpError(404, message, code);
export const conflict = (message: string, code?: string) => new HttpError(409, message, code);
