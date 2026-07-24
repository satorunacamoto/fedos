/**
 * TEST-ONLY. Secure Runtime Alpha 3161–3240 — a real-crypto
 * `FedosNostrSigningAuthority` stand-in for the production WASM-backed
 * `FedosWasmNostrSigningAuthority` (`../../src/nostr/sign/fedos_wasm_nostr_signing_authority.ts`),
 * which requires the WASM runtime this test suite does not load.
 *
 * Uses REAL BIP-340 Schnorr signatures (`@noble/curves`, the same library
 * already used in production by `../../src/nostr/noble_signature.ts` and
 * `../../src/device/crypto/fedos_device_signing_keypair.ts`) over the SAME
 * canonical id computation production verification uses
 * (`../../src/nostr/event.ts`'s own `serializeForId` + sha256) — so every
 * event this authority signs verifies successfully against the real,
 * unmodified `NobleSignatureVerifier`. This file signs; nothing in `src/`
 * is changed to accommodate it.
 *
 * One fixed, freshly-CSPRNG-generated secret key per `accountIndex`,
 * generated lazily on first use and cached for the lifetime of one test
 * authority instance — never derived from a Master Seed, never shared
 * across instances, never exported by any method.
 */

import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { serializeForId } from "../../src/nostr/event.js";
import type { FedosNostrWireEvent } from "../../src/desktop/fedos_nostr_wire_event.js";
import {
  isWellFormedFedosNostrUnsignedEventRequest,
  type FedosNostrSigningAuthority,
  type FedosNostrUnsignedEventRequest,
} from "../../src/nostr/sign/fedos_nostr_signing_authority.js";
import type { FedosNostrSigningPublicIdentity } from "../../src/nostr/sign/fedos_nostr_signing_public_identity.js";

export class RealFedosNostrSigningAuthority implements FedosNostrSigningAuthority {
  readonly #secretKeysByAccountIndex = new Map<number, Uint8Array>();

  #secretKeyFor(accountIndex: number): Uint8Array {
    let secretKey = this.#secretKeysByAccountIndex.get(accountIndex);
    if (secretKey === undefined) {
      secretKey = schnorr.utils.randomSecretKey();
      this.#secretKeysByAccountIndex.set(accountIndex, secretKey);
    }
    return secretKey;
  }

  async signEvent(request: FedosNostrUnsignedEventRequest): Promise<FedosNostrWireEvent | null> {
    if (!isWellFormedFedosNostrUnsignedEventRequest(request)) return null;
    const secretKey = this.#secretKeyFor(request.accountIndex);
    const pubkey = bytesToHex(schnorr.getPublicKey(secretKey));
    const tags = request.tags.map((tag) => [...tag]);
    const digest = sha256(
      new TextEncoder().encode(
        serializeForId({ pubkey, created_at: request.createdAt, kind: request.kind, tags, content: request.content }),
      ),
    );
    const id = bytesToHex(digest);
    const sig = bytesToHex(schnorr.sign(digest, secretKey));
    return Object.freeze({ id, pubkey, created_at: request.createdAt, kind: request.kind, tags, content: request.content, sig });
  }

  async publicIdentityForAccount(accountIndex: number): Promise<FedosNostrSigningPublicIdentity | null> {
    if (!Number.isInteger(accountIndex) || accountIndex < 0) return null;
    const secretKey = this.#secretKeyFor(accountIndex);
    return { accountIndex, publicKeyHex: bytesToHex(schnorr.getPublicKey(secretKey)) };
  }
}

/** Signs an arbitrary 32-byte-message-producing preimage under a FRESH, one-off keypair unrelated to any account index — for "wrong signer" negative tests. Returns the hex pubkey and a signer function; never exposes the secret key itself. */
export function createStandaloneSchnorrSigner(): { publicKeyHex: string; sign: (digest: Uint8Array) => string } {
  const secretKey = schnorr.utils.randomSecretKey();
  const publicKeyHex = bytesToHex(schnorr.getPublicKey(secretKey));
  return { publicKeyHex, sign: (digest: Uint8Array) => bytesToHex(schnorr.sign(digest, secretKey)) };
}

export { hexToBytes };
