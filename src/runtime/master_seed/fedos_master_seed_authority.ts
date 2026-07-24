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
import type { AeadKeyHandle } from "../fedos_wasm_loader.js";

export interface FedosMasterSeedAuthority {
  isAvailable(): Promise<boolean>;
  isCleared(): Promise<boolean>;
  generate(): Promise<boolean>;
  restoreSealed(envelope: FedosSealedMasterSeedEnvelopeV1, passphrase: Uint8Array): Promise<boolean>;
  seal(passphrase: Uint8Array): Promise<FedosSealedMasterSeedEnvelopeV1 | null>;
  clear(): Promise<void>;
  /**
   * Secure Runtime Alpha 869 — resolves the Direct-mode pairwise
   * conversation key for `accountIndex` and one counterparty's public
   * key hex (64 lowercase-or-uppercase hex characters, x-only, the SAME
   * shape a `FedosMasterSeedAuthority`'s own future `publicKeyHexForAccount`-
   * shaped method would return). Returns an opaque `AeadKeyHandle`
   * directly usable with `encrypt()`/`decrypt()`
   * (`../fedos_runtime_encrypt.js`/`../fedos_runtime_decrypt.js`) — never
   * a raw key byte. `null` on ANY failure: no Master Seed held, malformed
   * hex, or an internal derivation/ECDH failure (most likely an
   * off-curve counterparty key).
   */
  resolveConversationKey(accountIndex: number, counterpartyPublicKeyHex: string): Promise<AeadKeyHandle | null>;

  /**
   * Secure Runtime Alpha 1761–1840 ("NIP-17 Rumor Seal Gift Wrap Standard
   * Delivery Arc") Phase B — encrypts `plaintext` (a caller-supplied
   * Rumor/Seal serialization; this method performs NO Rumor/Seal
   * construction of its own) into a genuine NIP-44 v2 WIRE payload string
   * for the pairwise conversation between `accountIndex` and
   * `counterpartyPublicKeyHex`. This is NOT [`resolveConversationKey`] +
   * `encrypt()` (`../fedos_runtime_encrypt.js`) — that pipeline produces
   * this crate's own generic Envelope AEAD ciphertext, never standard
   * NIP-44 wire ciphertext a real Nostr client could decrypt. `null` on
   * ANY failure (no Master Seed held, malformed input, or an internal
   * derivation/encrypt failure) — fail closed, never a partial payload.
   *
   * OPTIONAL — mirrors `FedosMasterSeedWasmLoaderBoundary`'s own
   * `encrypt_nip44_wire`/`decrypt_nip44_wire` optionality (Secure Runtime
   * Alpha 5561–5640 integration merge): several pre-existing implementers
   * of this interface (`DevelopmentFedosMasterSeedAuthority`,
   * `FedosProductionMasterSeedAuthority`) never constructed a real NIP-44
   * wire bridge and are not required to grow one just because this method
   * exists. Callers (`fedos_nip59_seal.ts`/`fedos_nip59_gift_wrap.ts`)
   * check for its presence and fail closed, exactly like every other
   * failure mode here — never a silent downgrade.
   */
  encryptNip44Wire?(accountIndex: number, counterpartyPublicKeyHex: string, plaintext: Uint8Array): Promise<string | null>;

  /**
   * The decrypt-direction sibling of [`encryptNip44Wire`]. `null` on ANY
   * failure — no Master Seed held, malformed input, a structurally
   * malformed `payload`, OR a genuine authentication failure (wrong
   * recipient or tampered ciphertext) — never distinguishing which, never
   * a partial/best-effort plaintext. OPTIONAL — see `encryptNip44Wire`'s
   * own doc comment for why.
   */
  decryptNip44Wire?(accountIndex: number, counterpartyPublicKeyHex: string, payload: string): Promise<Uint8Array | null>;
}
