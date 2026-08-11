/**
 * FedOS Ratchet Device Lifecycle and Authenticated Session Reset
 * Foundation Arc — the default Session Reset nonce generator. Mirrors
 * `../../device/binding_challenge/fedos_device_binding_challenge.ts`'s own
 * `FedosSecureRandomDeviceBindingChallengeNonceGenerator` exactly: 16
 * bytes (128 bits) of `@noble/hashes/utils.js`'s own reviewed CSPRNG,
 * hex-encoded — the same margin already established for this exact class
 * of replay-protection nonce elsewhere in this codebase.
 */
import { randomBytes, bytesToHex } from "@noble/hashes/utils.js";

export function generateFedosDirectRatchetSessionResetNonce(): string {
  return bytesToHex(randomBytes(16));
}
