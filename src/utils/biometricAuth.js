// src/utils/biometricAuth.js
//
// "Fingerprint Login" for MedIndex — implemented as a device-level unlock
// gate using the standard Web Authentication API (WebAuthn), not as a
// server-verified login credential.
//
// Why a gate rather than a full WebAuthn sign-in: Firebase Auth already
// keeps the user signed in on this device (browserLocalPersistence, the
// default), so the real authentication happened once, at password
// sign-in. Making fingerprint data itself the login credential against
// Firebase would need a custom backend to store public keys and mint
// Firebase custom tokens — real infrastructure, for a benefit a device
// lock already delivers day-to-day: every time the app is opened, the
// phone's own platform authenticator (fingerprint/Face ID) must succeed
// before the already-valid session is shown. The private key/biometric
// data never leaves the phone's secure hardware; MedIndex only ever
// stores the public credential ID needed to request a fresh check.
//
// Requires HTTPS (or localhost) and a platform authenticator — this is
// checked via isBiometricAvailable() before any UI offers the option.

const STORAGE_PREFIX = 'medindex_biometric_';

function keyFor(email) {
  return STORAGE_PREFIX + String(email || '').toLowerCase().trim();
}

function b64urlEncode(buf) {
  let str = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const normal = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(normal);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

// Whether this browser/device can actually do a platform biometric check
// (Touch ID, Face ID, Android fingerprint/face unlock, Windows Hello…).
export async function isBiometricAvailable() {
  if (typeof window === 'undefined') return false;
  if (!window.isSecureContext) return false;
  if (!window.PublicKeyCredential || !window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function isBiometricEnrolled(email) {
  try {
    return !!localStorage.getItem(keyFor(email));
  } catch {
    return false;
  }
}

// Registers a new platform credential for this user on this device. Throws
// if the person cancels the OS fingerprint prompt or it's unsupported.
export async function enrollBiometric({ email, displayName }) {
  if (!email) throw new Error('Missing account email.');

  const challenge = window.crypto.getRandomValues(new Uint8Array(32));
  const userHandle = window.crypto.getRandomValues(new Uint8Array(16)); // WebAuthn user handle — unrelated to the Firebase uid

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'MedIndex' },
      user: { id: userHandle, name: email, displayName: displayName || email },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
      timeout: 60000,
      attestation: 'none',
    },
  });

  if (!credential) throw new Error('Fingerprint setup did not complete.');

  localStorage.setItem(keyFor(email), b64urlEncode(credential.rawId));
  return true;
}

// Asks the phone to verify the fingerprint/Face ID against the credential
// stored for this account. Resolves true on success, throws on failure or
// cancellation.
export async function verifyBiometric(email) {
  const stored = localStorage.getItem(keyFor(email));
  if (!stored) throw new Error('Fingerprint unlock is not set up on this device.');

  const challenge = window.crypto.getRandomValues(new Uint8Array(32));
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ id: b64urlDecode(stored), type: 'public-key' }],
      userVerification: 'required',
      timeout: 60000,
    },
  });

  if (!assertion) throw new Error('Fingerprint was not verified.');
  return true;
}

export function disableBiometric(email) {
  try {
    localStorage.removeItem(keyFor(email));
  } catch {
    // ignore
  }
}
