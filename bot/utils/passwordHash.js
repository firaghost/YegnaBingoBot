import crypto from 'crypto';

/**
 * Universal password hashing utility
 * Uses Node.js crypto (no external dependencies)
 */

/**
 * Hash a password using PBKDF2 (Password-Based Key Derivation Function 2)
 * @param {string} password - Plain text password
 * @returns {string} - Hashed password in format: salt:hash
 */
export function hashPassword(password) {
  // Generate random salt (16 bytes)
  const salt = crypto.randomBytes(16).toString('hex');
  
  // Hash password with salt using PBKDF2
  // 100,000 iterations, 64 bytes length, sha512 algorithm
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  
  // Return salt:hash format
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a stored hash
 * @param {string} password - Plain text password to verify
 * @param {string} storedHash - Stored hash in format: salt:hash
 * @returns {boolean} - True if password matches
 */
export function verifyPassword(password, storedHash) {
  // Extract salt and hash
  const [salt, originalHash] = storedHash.split(':');
  
  // Hash the provided password with the same salt
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  
  // Compare hashes (timing-safe comparison)
  return crypto.timingSafeEqual(Buffer.from(originalHash, 'hex'), Buffer.from(hash, 'hex'));
}

/**
 * Generate a secure random token
 * @param {number} length - Length in bytes (default 32)
 * @returns {string} - Random token
 */
export function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a secure session token
 * @returns {string} - Session token
 */
export function generateSessionToken() {
  return generateToken(32);
}
