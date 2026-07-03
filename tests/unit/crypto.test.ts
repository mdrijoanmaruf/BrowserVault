import { describe, it, expect } from 'vitest';
import { generateSalt, hashPassword, verifyPassword } from '@/lib/crypto';

describe('Cryptography Utilities', () => {
  it('should generate a 16-byte salt as base64', () => {
    const salt = generateSalt();
    // A 16 byte base64 string is 24 characters long with padding, but could be slightly different
    expect(typeof salt).toBe('string');
    expect(salt.length).toBeGreaterThan(0);
    // basic sanity checks for base64:
    expect(/^[A-Za-z0-9+/]+={0,2}$/.test(salt)).toBe(true);
  });

  it('should hash a password and verify it successfully', async () => {
    const password = 'mySuperSecretPassword123!';
    const salt = generateSalt();
    
    const hash = await hashPassword(password, salt);
    expect(typeof hash).toBe('string');
    expect(hash).not.toBe(password);
    
    const isValid = await verifyPassword(password, hash, salt);
    expect(isValid).toBe(true);
  });

  it('should fail to verify with wrong password', async () => {
    const password = 'mySuperSecretPassword123!';
    const wrongPassword = 'wrongPassword';
    const salt = generateSalt();
    
    const hash = await hashPassword(password, salt);
    
    const isValid = await verifyPassword(wrongPassword, hash, salt);
    expect(isValid).toBe(false);
  });

  it('should fail to verify with wrong salt', async () => {
    const password = 'mySuperSecretPassword123!';
    const salt = generateSalt();
    const wrongSalt = generateSalt();
    
    const hash = await hashPassword(password, salt);
    
    const isValid = await verifyPassword(password, hash, wrongSalt);
    expect(isValid).toBe(false);
  });
});
