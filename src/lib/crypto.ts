
const ITERATIONS = 100_000;
const HASH_BYTES = 32;

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}


function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}


export function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return bufferToBase64(array.buffer);
}

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


export async function hashPassword(password: string, saltBase64: string): Promise<string> {
  const salt = base64ToBuffer(saltBase64);
  const hashBuffer = await deriveKey(password, salt);
  return bufferToBase64(hashBuffer);
}


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


export function checkPasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
  if (password.length < 8) return 'weak';

  let score = 0;
  if (password.length >= 12) score += 1; // bonus for length
  if (/[A-Z]/.test(password)) score += 1; // uppercase
  if (/[a-z]/.test(password)) score += 1; // lowercase
  if (/[0-9]/.test(password)) score += 1; // numbers
  if (/[^A-Za-z0-9]/.test(password)) score += 1; // symbols

  if (score < 3) return 'weak';
  if (score === 3 || score === 4) return 'medium';
  return 'strong';
}


export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  const array = new Uint8Array(4); // 4 bytes = 8 hex chars
  for (let i = 0; i < count; i++) {
    crypto.getRandomValues(array);
    const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    codes.push(`${hex.slice(0, 4)}-${hex.slice(4, 8)}`.toUpperCase());
  }
  return codes;
}

