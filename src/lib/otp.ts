export function generateOtp(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  // Get a 6-digit number (0-999999)
  const code = array[0] % 1000000;
  // Pad with leading zeros to ensure it's exactly 6 digits
  return code.toString().padStart(6, '0');
}

/**
 * Checks if an OTP timestamp has expired based on the maxAgeMinutes.
 * @param timestampMs The time the OTP was generated (in milliseconds)
 * @param maxAgeMinutes The maximum allowed age of the OTP in minutes
 */
export function isOtpExpired(
  timestampMs: number,
  maxAgeMinutes: number
): boolean {
  const now = Date.now();
  const maxAgeMs = maxAgeMinutes * 60 * 1000;
  return now - timestampMs > maxAgeMs;
}

/**
 * Validates an input OTP against the expected OTP and checks expiration.
 * @param input The user-provided OTP
 * @param expected The expected OTP generated previously
 * @param generatedAtMs The timestamp when the OTP was generated
 * @param maxAgeMinutes The allowed validity period for the OTP
 */
export function validateOtp(
  input: string,
  expected: string,
  generatedAtMs: number,
  maxAgeMinutes: number
): boolean {
  if (isOtpExpired(generatedAtMs, maxAgeMinutes)) {
    return false;
  }
  return input === expected;
}
