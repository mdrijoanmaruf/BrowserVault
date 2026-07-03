import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateOtp, isOtpExpired, validateOtp } from '@/lib/otp';

describe('OTP Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should generate a 6 digit numeric OTP', () => {
    const otp = generateOtp();
    expect(typeof otp).toBe('string');
    expect(otp).toHaveLength(6);
    expect(/^\d{6}$/.test(otp)).toBe(true);
  });

  it('should correctly identify expired OTPs', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const maxAgeMinutes = 10;
    
    // Just generated
    expect(isOtpExpired(now, maxAgeMinutes)).toBe(false);
    
    // 9 minutes ago (not expired)
    expect(isOtpExpired(now - (9 * 60 * 1000), maxAgeMinutes)).toBe(false);
    
    // 11 minutes ago (expired)
    expect(isOtpExpired(now - (11 * 60 * 1000), maxAgeMinutes)).toBe(true);
  });

  it('should validate correct and non-expired OTP', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const otp = '123456';
    const generatedAt = now - 60000; // 1 minute ago

    expect(validateOtp(otp, otp, generatedAt, 10)).toBe(true);
  });

  it('should reject incorrect OTP', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const otp = '123456';
    const wrongOtp = '654321';
    const generatedAt = now - 60000;

    expect(validateOtp(wrongOtp, otp, generatedAt, 10)).toBe(false);
  });

  it('should reject expired OTP even if it matches', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const otp = '123456';
    const generatedAt = now - (15 * 60 * 1000); // 15 minutes ago

    expect(validateOtp(otp, otp, generatedAt, 10)).toBe(false);
  });
});
