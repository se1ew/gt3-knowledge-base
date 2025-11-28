import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
export const PORT = Number(process.env.PORT) || 4000;
export const STATIC_ROOT = process.env.STATIC_ROOT
    ? path.resolve(process.env.STATIC_ROOT)
    : path.resolve(__dirname, '..');
