import { randomUUID } from 'crypto';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { config } from './config';
import { HttpError } from './errors';

/** Local disk storage for receipt photos (the optional bonus feature). */

export const uploadDir = path.resolve(process.cwd(), config.UPLOAD_DIR);

export function ensureUploadDir(): void {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_MIME_TYPES = /^image\/(png|jpe?g|webp)$/;

export const receiptUpload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    // Timestamp + random suffix: unique even if two uploads land in the same
    // millisecond, and the extension is preserved so <Image> can detect the type.
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`);
    },
  }),
  limits: { fileSize: config.MAX_RECEIPT_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.test(file.mimetype)) return cb(null, true);
    cb(new HttpError(415, 'Receipt must be a PNG, JPEG or WebP image', 'UNSUPPORTED_FILE_TYPE'));
  },
});
