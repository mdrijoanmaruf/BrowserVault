import { storage } from './storage';
import { STORAGE_KEYS } from './constants';
import type { AuthState } from '@/types';

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function isBiometricsSupported(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function registerBiometrics(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supported = await isBiometricsSupported();
    if (!supported) {
      return {
        success: false,
        error: 'Biometrics are not supported on this device/browser.',
      };
    }

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    const publicKey: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'BrowserVault',
      },
      user: {
        id: userId,
        name: 'user@browservault',
        displayName: 'BrowserVault User',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
      },
      timeout: 60000,
    };

    const credential = (await navigator.credentials.create({
      publicKey,
    })) as PublicKeyCredential;

    if (!credential) {
      return { success: false, error: 'Failed to create credential.' };
    }

    const credentialIdBase64 = bufferToBase64(credential.rawId);
    await storage.setItem('vault_webauthn_credential_id', credentialIdBase64);

    // Update AuthState
    const authState = await storage.getItem<AuthState>(STORAGE_KEYS.AUTH_STATE);
    if (authState) {
      authState.hasBiometrics = true;
      await storage.setItem(STORAGE_KEYS.AUTH_STATE, authState);
    }

    return { success: true };
  } catch (error: unknown) {
    console.error('Biometric registration error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred.',
    };
  }
}

export async function verifyBiometrics(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const credentialIdBase64 = await storage.getItem<string>(
      'vault_webauthn_credential_id'
    );
    if (!credentialIdBase64) {
      return { success: false, error: 'No biometrics registered.' };
    }

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const publicKey: PublicKeyCredentialRequestOptions = {
      challenge,
      allowCredentials: [
        {
          id: base64ToBuffer(credentialIdBase64),
          type: 'public-key',
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    };

    const assertion = (await navigator.credentials.get({
      publicKey,
    })) as PublicKeyCredential;

    if (!assertion) {
      return { success: false, error: 'Biometric verification failed.' };
    }

    return { success: true };
  } catch (error: unknown) {
    console.error('Biometric verification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred.',
    };
  }
}

export async function disableBiometrics(): Promise<void> {
  await storage.removeItem('vault_webauthn_credential_id');
  const authState = await storage.getItem<AuthState>(STORAGE_KEYS.AUTH_STATE);
  if (authState) {
    authState.hasBiometrics = false;
    await storage.setItem(STORAGE_KEYS.AUTH_STATE, authState);
  }
}
