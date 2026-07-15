/**
 * Secure Runtime Alpha 438 — the TypeScript-facing Master Seed Authority
 * contract. `FedosWasmMasterSeedAuthority`
 * (`fedos_wasm_master_seed_authority.ts`) is this repository's ONE
 * implementation.
 *
 * Every method here returns only a `boolean`, `void`, or a sealed
 * (never plaintext) envelope — no implementation of this interface may
 * expose a raw Master Seed getter, a raw Nostr secret-key getter, or an
 * `nsec` export of any kind (Permanent Security Invariants 1-3). Every
 * method is `async`: constructing the underlying WASM authority itself
 * requires a gated, asynchronous Rust Boundary reach
 * (`fedos_wasm_loader.ts`), so even the read-only `isAvailable()`/
 * `isCleared()` queries must be able to report "not constructed" without
 * throwing.
 */
import type { FedosSealedMasterSeedEnvelopeV1 } from "./fedos_sealed_master_seed_envelope.js";

export interface FedosMasterSeedAuthority {
  isAvailable(): Promise<boolean>;
  isCleared(): Promise<boolean>;
  generate(): Promise<boolean>;
  restoreSealed(envelope: FedosSealedMasterSeedEnvelopeV1, passphrase: Uint8Array): Promise<boolean>;
  seal(passphrase: Uint8Array): Promise<FedosSealedMasterSeedEnvelopeV1 | null>;
  clear(): Promise<void>;
}
