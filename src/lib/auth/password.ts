import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

/**
 * Hashes a user password or PIN using Node's built-in `scryptSync` KDF.
 */
export function hashPasswordOrPin(secret: string, fixedSalt?: string): string {
  const salt = fixedSalt ?? randomBytes(16).toString("hex");
  const derivedKey = scryptSync(secret, salt, KEY_LENGTH).toString("hex");
  return `scrypt:${salt}:${derivedKey}`;
}

/**
 * Verifies a plaintext password or PIN against a stored `scrypt:salt:hash` string
 * in constant time using `timingSafeEqual`.
 */
export function verifyPasswordOrPin(
  plaintext: string,
  storedHash: string
): boolean {
  if (!storedHash || !storedHash.startsWith("scrypt:")) {
    return false;
  }
  const parts = storedHash.split(":");
  if (parts.length !== 3) {
    return false;
  }
  const [, salt, expectedHex] = parts;
  const derivedBuffer = scryptSync(plaintext, salt, KEY_LENGTH);
  const expectedBuffer = Buffer.from(expectedHex, "hex");
  if (derivedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(derivedBuffer, expectedBuffer);
}

