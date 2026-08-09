/**
 * Secure Runtime Alpha 4661-4740 — Phase D FALLBACK: a DEVELOPMENT-ONLY,
 * NON-CRYPTOGRAPHIC `FedosMasterSeedAuthority` lifecycle double.
 *
 * ============================ READ THIS ============================
 * THIS IS NOT CRYPTOGRAPHY. THIS IS NOT A SECOND MASTER SEED AUTHORITY.
 * It exists ONLY so the profile initialization/unlock COORDINATION LOGIC
 * (state machine, descriptor persistence, durable paths, device bootstrap,
 * lock/relaunch) can be exercised end to end in the development runtime,
 * because the ONE real implementation — `FedosWasmMasterSeedAuthority`
 * (`../../runtime/master_seed/fedos_wasm_master_seed_authority.ts`) — is
 * unreachable in this worktree: no compiled WASM `pkg/` exists AND the
 * dev-only crypto gate is closed by design (Phase A §2).
 * ==================================================================
 *
 * What it faithfully models (lifecycle only): `generate()` produces an
 * in-memory placeholder seed marker (random bytes, NEVER exported and NEVER
 * written to disk); `seal()` returns a STRUCTURALLY-VALID
 * `FedosSealedMasterSeedEnvelopeV1` that contains a passphrase VERIFIER
 * (sha256 of salt||passphrase) and NO seed byte; `restoreSealed()` recomputes
 * the verifier and returns `true` only for the correct passphrase — a wrong
 * passphrase is an indistinguishable coarse `false` (Phase F). `clear()`
 * zeroes and drops the in-memory marker.
 *
 * What it deliberately does NOT do: it derives no real key, decrypts
 * nothing, signs no Nostr event, and `resolveConversationKey()` always
 * returns `null`. Real conversation crypto stays fail-closed exactly as on
 * the base. It NEVER stores a plaintext seed or a plaintext passphrase
 * anywhere. Production assembly MUST NOT construct this class — the only
 * callers are this Arc's own tests and an explicitly dev-gated onboarding
 * path.
 *
 * HARD GUARDRAILS:
 *   - No plaintext seed byte and no plaintext passphrase byte is ever
 *     persisted, logged, or returned.
 *   - The sealed envelope contains only a random salt + a one-way verifier,
 *     both non-secret; asserted by a real test scanning the bytes.
 *   - No raw seed getter of any kind.
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, randomBytes } from "@noble/hashes/utils.js";
import type { FedosMasterSeedAuthority } from "../../../../runtime/master_seed/fedos_master_seed_authority.js";
import {
  toSealedMasterSeedEnvelopeV1,
  isWellFormedSealedMasterSeedEnvelopeV1Json,
  type FedosSealedMasterSeedEnvelopeV1,
} from "../../../../runtime/master_seed/fedos_sealed_master_seed_envelope.js";
import type { AeadKeyHandle } from "../../../../runtime/fedos_wasm_loader.js";

function computeVerifier(saltHex: string, passphrase: Uint8Array): string {
  // One-way: sha256(saltBytes || passphraseBytes). Non-secret output; never reversible to the passphrase.
  const saltBytes = new TextEncoder().encode(saltHex);
  const combined = new Uint8Array(saltBytes.length + passphrase.length);
  combined.set(saltBytes, 0);
  combined.set(passphrase, saltBytes.length);
  const digest = bytesToHex(sha256(combined));
  combined.fill(0);
  return digest;
}

/** Builds the dev sealed envelope JSON. Structurally valid per `isWellFormedSealedMasterSeedEnvelopeV1Json` (fixed prefix), but explicitly marked `"dev":true` so nothing mistakes it for a real Argon2id sealing. Carries NO seed byte. */
function buildDevSealedJson(saltHex: string, verifierHex: string): string {
  // Fixed key order beginning with the required structural prefix.
  return `{"v":1,"kdf":"argon2id","dev":true,"salt":"${saltHex}","verifier":"${verifierHex}"}`;
}

function parseDevSealedJson(json: string): { saltHex: string; verifierHex: string } | null {
  if (!isWellFormedSealedMasterSeedEnvelopeV1Json(json)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  if (record.dev !== true) return null;
  if (typeof record.salt !== "string" || typeof record.verifier !== "string") return null;
  return { saltHex: record.salt, verifierHex: record.verifier };
}

export class DevelopmentFedosMasterSeedAuthority implements FedosMasterSeedAuthority {
  /** In-memory placeholder marker only. NEVER exported, NEVER persisted. `null` when cleared/empty. */
  #seedMarker: Uint8Array | null = null;
  /** The verifier the most recent `restoreSealed`/`seal` observed, so `isAvailable()` is honest after a correct restore. */
  #restoredFromVerifier: string | null = null;

  async isAvailable(): Promise<boolean> {
    return this.#seedMarker !== null || this.#restoredFromVerifier !== null;
  }

  async isCleared(): Promise<boolean> {
    return this.#seedMarker === null && this.#restoredFromVerifier === null;
  }

  async generate(): Promise<boolean> {
    // A fresh in-memory placeholder marker — real randomness, never exported.
    this.#seedMarker = randomBytes(32);
    this.#restoredFromVerifier = null;
    return true;
  }

  async seal(passphrase: Uint8Array): Promise<FedosSealedMasterSeedEnvelopeV1 | null> {
    if (this.#seedMarker === null && this.#restoredFromVerifier === null) return null;
    const saltHex = bytesToHex(randomBytes(16));
    const verifierHex = computeVerifier(saltHex, passphrase);
    const json = buildDevSealedJson(saltHex, verifierHex);
    return toSealedMasterSeedEnvelopeV1(json);
  }

  async restoreSealed(envelope: FedosSealedMasterSeedEnvelopeV1, passphrase: Uint8Array): Promise<boolean> {
    const parsed = parseDevSealedJson(envelope.json);
    if (parsed === null) return false;
    const candidate = computeVerifier(parsed.saltHex, passphrase);
    // Constant-ish comparison; the dev double never leaks partial-byte correctness (Phase F).
    if (candidate.length !== parsed.verifierHex.length) return false;
    let mismatch = 0;
    for (let i = 0; i < candidate.length; i += 1) {
      mismatch |= candidate.charCodeAt(i) ^ parsed.verifierHex.charCodeAt(i);
    }
    if (mismatch !== 0) return false;
    this.#restoredFromVerifier = parsed.verifierHex;
    return true;
  }

  async clear(): Promise<void> {
    if (this.#seedMarker !== null) {
      this.#seedMarker.fill(0);
      this.#seedMarker = null;
    }
    this.#restoredFromVerifier = null;
  }

  async resolveConversationKey(): Promise<AeadKeyHandle | null> {
    // The dev double owns no real key material — conversation crypto stays fail-closed.
    return null;
  }
}

/** Builds a development-only Master Seed authority. Never call this from production assembly. */
export function createDevelopmentFedosMasterSeedAuthority(): FedosMasterSeedAuthority {
  return new DevelopmentFedosMasterSeedAuthority();
}
