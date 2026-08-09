/**
 * Secure Runtime Alpha 4741-4820 — Phase G/H/J: the production
 * `FedosMasterSeedAuthority`, backed by REAL WASM through the
 * capability-limited facade (Phase F) — NOT the dev-only loader gate
 * and NOT the development seed double.
 *
 * Implements the SAME `FedosMasterSeedAuthority` interface the profile
 * coordinator already consumes, so it drops in with ZERO coordinator
 * change (adapter, not replacement). It owns a single opaque WASM
 * authority handle, constructed lazily at most once per instance and
 * retained so generate/seal/restore/clear observe each other's state
 * (each Rust authority owns its own lifecycle). It NEVER exposes the
 * handle or the module, NEVER logs the passphrase or the sealed
 * envelope, and NEVER auto-generates a seed on construction. Every
 * method fails closed (never throws upward).
 *
 * Phase J (lock/teardown): `clear()` zeroizes the WASM-held seed and,
 * additionally, drops this adapter's reference to the handle, so no
 * post-lock crypto command can reach a live authority through this
 * object — a subsequent method call fails closed (handle re-constructed
 * empty; a wrong-order caller can never resurrect the prior seed).
 *
 * Secure Runtime Alpha 6841-6920 — ALSO implements `FedosDirectRatchetSealingAuthority`
 * (the narrow, additive port `fedos_direct_ratchet_sealing_authority.ts`
 * already established at Alpha 5401-5480), mirroring `FedosWasmMasterSeedAuthority`'s
 * own existing dual-implementation of both interfaces exactly. This is the
 * ONE change that lets Direct Ratchet consume THIS canonical production
 * authority (the SAME object profile unlock already activates) instead of
 * a second, independent, `NODE_ENV=development`-gated authority — no new
 * WASM export, no new Rust code: `seal_direct_ratchet_secret`/
 * `restore_direct_ratchet_secret` are already real, already Store-backed
 * methods on the SAME `FedosMasterSeedAuthorityHandle` this file's own
 * `#handle` already wraps (added by the Secure Memory Store Production
 * Wiring Arc, `8a33045e`).
 */

import type { AeadAadDomain, AeadAlgorithm, AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle, FedosMasterSeedAuthorityHandle } from "../../../../runtime/fedos_wasm_loader.js";
import type { FedosMasterSeedAuthority } from "../../../../runtime/master_seed/fedos_master_seed_authority.js";
import {
  toSealedMasterSeedEnvelopeV1,
  type FedosSealedMasterSeedEnvelopeV1,
} from "../../../../runtime/master_seed/fedos_sealed_master_seed_envelope.js";
import type { FedosProductionMasterSeedFacade, FedosProductionDirectRatchetSessionModule } from "./fedos_production_wasm_master_seed_facade.js";
import type { FedosDirectRatchetSealingAuthority } from "../../conversations/ratchet/fedos_direct_ratchet_sealing_authority.js";

export class FedosProductionMasterSeedAuthority implements FedosMasterSeedAuthority, FedosDirectRatchetSealingAuthority {
  readonly #facade: FedosProductionMasterSeedFacade;
  #handle: FedosMasterSeedAuthorityHandle | null = null;
  #cleared = false;

  constructor(facade: FedosProductionMasterSeedFacade) {
    this.#facade = facade;
  }

  #ensure(): FedosMasterSeedAuthorityHandle | null {
    if (this.#cleared) return null;
    if (this.#handle) return this.#handle;
    this.#handle = this.#facade.constructMasterSeedAuthority();
    return this.#handle;
  }

  async isAvailable(): Promise<boolean> {
    const h = this.#ensure();
    if (!h) return false;
    try {
      return h.is_available();
    } catch {
      return false;
    }
  }

  async isCleared(): Promise<boolean> {
    if (this.#cleared) return true;
    const h = this.#ensure();
    if (!h) return false;
    try {
      return h.is_cleared();
    } catch {
      return false;
    }
  }

  async generate(): Promise<boolean> {
    const h = this.#ensure();
    if (!h) return false;
    try {
      return h.generate();
    } catch {
      return false;
    }
  }

  async seal(passphrase: Uint8Array): Promise<FedosSealedMasterSeedEnvelopeV1 | null> {
    const h = this.#ensure();
    if (!h) return null;
    try {
      const value = h.seal(passphrase);
      return typeof value === "string" ? toSealedMasterSeedEnvelopeV1(value) : null;
    } catch {
      return null;
    }
  }

  async restoreSealed(envelope: FedosSealedMasterSeedEnvelopeV1, passphrase: Uint8Array): Promise<boolean> {
    const h = this.#ensure();
    if (!h) return false;
    try {
      return h.restore_sealed(envelope.json, passphrase);
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    const h = this.#handle;
    this.#cleared = true;
    this.#handle = null;
    if (!h) return;
    try {
      h.clear();
    } catch {
      /* never throws to the caller */
    }
  }

  async resolveConversationKey(
    accountIndex: number,
    counterpartyPublicKeyHex: string,
  ): Promise<AeadKeyHandle | null> {
    const h = this.#ensure();
    if (!h) return null;
    try {
      const value = h.resolve_conversation_key(accountIndex, counterpartyPublicKeyHex);
      return (value ?? null) as AeadKeyHandle | null;
    } catch {
      return null;
    }
  }

  /**
   * Secure Runtime Alpha 6841-6920 — `FedosDirectRatchetSealingAuthority`.
   * Seals opaque `secretBytes` at rest under a key bound to the full
   * Direct Ratchet session-identity tuple, through the SAME `#handle`
   * every other method on this class already uses. Fails closed (`null`)
   * on no live seed, CSPRNG failure, or any internal AEAD failure —
   * identical discipline to every method above.
   */
  async sealDirectRatchetSecret(
    localDeviceRef: string,
    remoteDeviceRef: string,
    conversationId: string,
    generation: number,
    secretBytes: Uint8Array,
  ): Promise<string | null> {
    const h = this.#ensure();
    if (!h) return null;
    try {
      const value = h.seal_direct_ratchet_secret(localDeviceRef, remoteDeviceRef, conversationId, generation, secretBytes);
      return typeof value === "string" ? value : null;
    } catch {
      return null;
    }
  }

  /**
   * Secure Runtime Alpha 6841-6920 — the restoring counterpart. Requires
   * the EXACT SAME binding tuple the secret was sealed with; any
   * difference fails closed by AEAD authentication, not by a string
   * comparison. `null` on ANY failure, including a tampered or malformed
   * `sealedBlob`.
   */
  async restoreDirectRatchetSecret(
    localDeviceRef: string,
    remoteDeviceRef: string,
    conversationId: string,
    generation: number,
    sealedBlob: string,
  ): Promise<Uint8Array | null> {
    const h = this.#ensure();
    if (!h) return null;
    try {
      const value = h.restore_direct_ratchet_secret(localDeviceRef, remoteDeviceRef, conversationId, generation, sealedBlob);
      return (value ?? null) as Uint8Array | null;
    } catch {
      return null;
    }
  }

  /**
   * INTERNAL — mirrors `FedosWasmMasterSeedAuthority`'s own reviewed
   * accessor for `FedosWasmNostrSigningAuthority`, which must sign
   * against the SAME underlying WASM authority instance this object
   * manages. Not part of the public interface; returns an opaque,
   * method-bearing handle carrying no secret byte.
   */
  async accessForNostrSigningAuthorityInternalUse(): Promise<FedosMasterSeedAuthorityHandle | null> {
    return this.#ensure();
  }

  /**
   * Secure Runtime Alpha 7161-7240 — closes the ONE remaining gap named
   * in `fedos_master_seed_authority.ts`'s own `encryptNip44Wire` doc
   * comment (this class named explicitly as an implementer that "never
   * constructed a real NIP-44 wire bridge"). The underlying Rust/WASM
   * capability (`FedosMasterSeedAuthority::encrypt_nip44_wire` in
   * `lib.rs`, `#[wasm_bindgen]`-exported on the SAME struct this file's
   * own `#handle` already wraps for `sealDirectRatchetSecret`/
   * `resolveConversationKey`) is real, round-trip-tested, and already
   * reachable through this handle's own `encrypt_nip44_wire` method
   * (`FedosMasterSeedAuthorityHandle`, `fedos_wasm_loader.ts`) — this
   * method adds no cryptography of its own, only the missing thin
   * wrapper, mirroring `sealDirectRatchetSecret`'s own exact
   * try/catch/fail-closed discipline.
   */
  async encryptNip44Wire(
    accountIndex: number,
    counterpartyPublicKeyHex: string,
    plaintext: Uint8Array,
  ): Promise<string | null> {
    const h = this.#ensure();
    if (!h || typeof h.encrypt_nip44_wire !== "function") return null;
    try {
      const value = h.encrypt_nip44_wire(accountIndex, counterpartyPublicKeyHex, plaintext);
      return typeof value === "string" ? value : null;
    } catch {
      return null;
    }
  }

  /**
   * The decrypt-direction sibling of [`encryptNip44Wire`] — see that
   * method's own doc comment for the shared design rationale. Calls
   * `h.decrypt_nip44_wire`, the real, already-tested Rust bridge's own
   * decrypt direction.
   */
  async decryptNip44Wire(
    accountIndex: number,
    counterpartyPublicKeyHex: string,
    payload: string,
  ): Promise<Uint8Array | null> {
    const h = this.#ensure();
    if (!h || typeof h.decrypt_nip44_wire !== "function") return null;
    try {
      const value = h.decrypt_nip44_wire(accountIndex, counterpartyPublicKeyHex, payload);
      return (value ?? null) as Uint8Array | null;
    } catch {
      return null;
    }
  }

  /**
   * Secure Runtime Alpha 6921-7000 — INTERNAL, mirrors
   * `accessForNostrSigningAuthorityInternalUse()`'s own exact discipline
   * (not part of the public `FedosMasterSeedAuthority` interface, opaque,
   * carries no secret byte). Reaches `FedosDirectRatchetSession`'s own
   * static constructors on the SAME already-initialized, already-verified
   * production module this authority's own facade was built from — never
   * a second import, never a second WASM initialization. `null` once this
   * authority is cleared (matches every other post-`clear()` method on
   * this class: `#cleared` is checked explicitly here, the same
   * invariant `#ensure()` enforces for the Master Seed handle itself, so
   * a locked profile can never construct a fresh Direct Ratchet session
   * through this authority either).
   */
  accessDirectRatchetSessionModuleInternalUse(): FedosProductionDirectRatchetSessionModule | null {
    if (this.#cleared) return null;
    return this.#facade.constructDirectRatchetSessionModule();
  }

  /**
   * Secure Runtime Alpha 7161-7240 — mirrors
   * `accessDirectRatchetSessionModuleInternalUse()`'s own exact
   * discipline (narrow facade capability, `#cleared`-gated, no secret
   * byte). Unlike every other method on this class, this one does NOT
   * touch `#handle`/`#ensure()` at all — a NIP-59 ephemeral Gift Wrap
   * key is a fresh, single-use, CSPRNG-drawn key generated INSIDE the
   * one Rust call this facade method wraps, never derived from the
   * Master Seed (see `build_and_sign_nip17_gift_wrap`'s own doc comment
   * in `lib.rs`) — so this method is available whenever this authority
   * is constructed and not yet cleared, independent of whether a seed
   * has been generated/restored.
   */
  buildEphemeralGiftWrap(
    recipientPublicKeyHex: string,
    createdAt: number,
    kind: number,
    contentPlaintext: Uint8Array,
  ): string | null {
    if (this.#cleared) return null;
    return this.#facade.buildAndSignGiftWrap(recipientPublicKeyHex, createdAt, kind, contentPlaintext);
  }

  /**
   * Secure Runtime Alpha 7161-7240 — the generic Envelope-AEAD
   * encrypt/serialize bridge, mirroring `buildEphemeralGiftWrap()`'s own
   * exact discipline (narrow facade capability, `#cleared`-gated). Used
   * by `FedosWasmConversationEncryptionAuthority`/`DecryptionAuthority`
   * (via `FedosProductionConversationEncryptionRuntimeBoundary`/
   * `DecryptionRuntimeBoundary`, `fedos_production_conversation_encryption_runtime_boundary.ts`)
   * for message-CONTENT storage — distinct from the NIP-44 WIRE bridge
   * above, which is for transport only.
   */
  encryptAead(key: AeadKeyHandle, algorithm: AeadAlgorithm, aadDomain: AeadAadDomain, plaintext: Uint8Array): AeadCiphertextHandle | null {
    if (this.#cleared) return null;
    return this.#facade.encryptAead(key, algorithm, aadDomain, plaintext);
  }

  /** The decrypt-direction sibling of [`encryptAead`]. */
  decryptAead(key: AeadKeyHandle, algorithm: AeadAlgorithm, aadDomain: AeadAadDomain, ciphertext: AeadCiphertextHandle): Uint8Array | null {
    if (this.#cleared) return null;
    return this.#facade.decryptAead(key, algorithm, aadDomain, ciphertext);
  }

  /** Serializes an opaque `AeadCiphertextHandle` to its storable/transmittable wire string. */
  serializeAeadCiphertext(ciphertext: AeadCiphertextHandle): AeadCiphertextWire | null {
    if (this.#cleared) return null;
    return this.#facade.serializeAeadCiphertext(ciphertext);
  }

  /** The inverse of [`serializeAeadCiphertext`]. */
  deserializeAeadCiphertext(wire: AeadCiphertextWire): AeadCiphertextHandle | null {
    if (this.#cleared) return null;
    return this.#facade.deserializeAeadCiphertext(wire);
  }
}
