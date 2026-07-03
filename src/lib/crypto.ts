/**
 * Cryptography utilities using the Web Crypto API
 */

// We use an iterations count that is standard for PBKDF2 with SHA-256
const ITERATIONS = 100_000;
const HASH_BYTES = 32;

/**
 * Helper to convert an ArrayBuffer to a Base64 string
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Helper to convert a Base64 string to an ArrayBuffer
 */
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generates a cryptographically secure random salt (16 bytes), returned as a Base64 string.
 */
export function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return bufferToBase64(array.buffer);
}

/**
 * Derives a key from a password and salt using PBKDF2 with SHA-256.
 */
async function deriveKey(password: string, salt: ArrayBuffer): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  return await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    HASH_BYTES * 8
  );
}

/**
 * Hashes a password using PBKDF2 + SHA-256.
 * Returns the hash as a Base64 string.
 */
export async function hashPassword(password: string, saltBase64: string): Promise<string> {
  const salt = base64ToBuffer(saltBase64);
  const hashBuffer = await deriveKey(password, salt);
  return bufferToBase64(hashBuffer);
}

/**
 * Verifies an input password against a stored hash and salt.
 * Uses a constant-time comparison to mitigate timing attacks.
 */
export async function verifyPassword(
  input: string,
  storedHashBase64: string,
  saltBase64: string
): Promise<boolean> {
  const inputHashBuffer = await deriveKey(input, base64ToBuffer(saltBase64));
  const storedHashBuffer = base64ToBuffer(storedHashBase64);

  // Constant time comparison (if lengths match)
  if (inputHashBuffer.byteLength !== storedHashBuffer.byteLength) {
    return false;
  }

  const inputBytes = new Uint8Array(inputHashBuffer);
  const storedBytes = new Uint8Array(storedHashBuffer);

  let isMatch = 0;
  for (let i = 0; i < inputBytes.length; i++) {
    isMatch |= inputBytes[i] ^ storedBytes[i];
  }

  return isMatch === 0;
}
