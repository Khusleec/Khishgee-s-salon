import crypto from 'node:crypto';

const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };
const KEYLEN = 32;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, KEYLEN, SCRYPT_OPTS);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [algo, saltHex, hashHex] = String(stored).split('$');
    if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(String(password), salt, expected.length, SCRYPT_OPTS);
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export const newToken = (): string => crypto.randomBytes(32).toString('hex');
