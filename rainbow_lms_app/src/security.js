'use strict';

const crypto = require('node:crypto');

const PASSWORD_MIN_LENGTH = 12;

function hashPassword(password) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Passwords must contain at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

function verifyPassword(password, stored) {
  try {
    const [algorithm, n, r, p, saltText, hashText] = String(stored || '').split('$');
    if (algorithm !== 'scrypt' || !saltText || !hashText) return false;
    const salt = Buffer.from(saltText, 'base64url');
    const expected = Buffer.from(hashText, 'base64url');
    const actual = crypto.scryptSync(String(password || ''), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function validatePassword(password) {
  const value = String(password || '');
  const errors = [];
  if (value.length < PASSWORD_MIN_LENGTH) errors.push(`at least ${PASSWORD_MIN_LENGTH} characters`);
  if (!/[a-z]/.test(value)) errors.push('a lowercase letter');
  if (!/[A-Z]/.test(value)) errors.push('an uppercase letter');
  if (!/[0-9]/.test(value)) errors.push('a number');
  if (!/[^A-Za-z0-9]/.test(value)) errors.push('a symbol');
  return { valid: errors.length === 0, errors };
}

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let result = '';
  for (let i = 0; i < 18; i += 1) {
    result += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return result;
}

module.exports = {
  PASSWORD_MIN_LENGTH,
  generateTemporaryPassword,
  hashPassword,
  randomToken,
  safeEqual,
  tokenHash,
  validatePassword,
  verifyPassword,
};
