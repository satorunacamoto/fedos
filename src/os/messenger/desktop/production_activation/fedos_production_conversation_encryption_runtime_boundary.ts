/**
 * Secure Runtime Alpha 7161-7240 — the production-path
 * `FedosConversationEncryptionRuntimeBoundary`/`FedosConversationDecryptionRuntimeBoundary`,
 * backed by REAL WASM through the SAME opaque Master Seed authority
 * handle the production activation path already holds — NOT
 * `fedos_runtime_encrypt.ts`/`fedos_runtime_decrypt.ts`/
 * `fedos_runtime_export_ciphertext.ts`/`fedos_runtime_import_ciphertext.ts`'s
 * own dev-only `FedosWasmLoaderSkeleton` boundary (each of those four
 * Runtime Service files constructs its OWN, fresh, independent WASM
 * module instance per call — see each file's own "constructs its OWN,
 * fresh `FedosWasmLoader` instance" header line — which is doubly wrong
 * for a production caller: gated behind `NODE_ENV=development`, AND a
 * different module instantiation than the one that produced the
 * `AeadKeyHandle` `FedosWasmConversationEncryptionAuthority`'s own
 * `resolveConversationKey()` call already resolved, so even an open Dev
 * Gate would still fail on a cross-instantiation opaque-handle mismatch).
 *
 * `FedosWasmConversationEncryptionAuthority`/`DecryptionAuthority`
 * (`../../conversation/encryption/fedos_wasm_conversation_{encryption,decryption}_authority.ts`)
 * already accept an INJECTED runtime boundary for exactly this reason
 * (Alpha 870/871's own "testability" shape) — this file supplies the
 * production-safe implementation of that SAME existing seam, reaching
 * `FedosProductionMasterSeedAuthority`'s own new `encryptAead()`/
 * `decryptAead()`/`serializeAeadCiphertext()`/`deserializeAeadCiphertext()`
 * accessors (this Arc's own new, narrow wiring — see that class's own
 * header), which in turn reach the SAME already-real, already-tested
 * `encrypt_aead`/`decrypt_aead`/`serialize_aead_ciphertext`/
 * `deserialize_aead_ciphertext` Rust exports every dev-only Runtime
 * Service call ultimately reaches too. No new cryptography.
 */
import type { AeadAadDomain, AeadAlgorithm, AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../../../core/vault/wasm/fedos_wasm_loader.js";
import type { FedosConversationEncryptionRuntimeBoundary } from "../../conversations/encryption/fedos_wasm_conversation_encryption_authority.js";
import type { FedosConversationDecryptionRuntimeBoundary } from "../../conversations/encryption/fedos_wasm_conversation_decryption_authority.js";

/**
 * The narrow structural port both boundaries below need —
 * `FedosProductionMasterSeedAuthority` satisfies it via its own four new
 * methods; nothing else is required, so the coupling to the production
 * authority is by shape only — mirrors
 * `FedosProductionNostrSigningHandleSource`/`FedosProductionEphemeralGiftWrapHandleSource`'s
 * own exact discipline.
 */
export interface FedosProductionConversationAeadHandleSource {
  encryptAead(key: AeadKeyHandle, algorithm: AeadAlgorithm, aadDomain: AeadAadDomain, plaintext: Uint8Array): AeadCiphertextHandle | null;
  decryptAead(key: AeadKeyHandle, algorithm: AeadAlgorithm, aadDomain: AeadAadDomain, ciphertext: AeadCiphertextHandle): Uint8Array | null;
  serializeAeadCiphertext(ciphertext: AeadCiphertextHandle): AeadCiphertextWire | null;
  deserializeAeadCiphertext(wire: AeadCiphertextWire): AeadCiphertextHandle | null;
}

export class FedosProductionConversationEncryptionRuntimeBoundary implements FedosConversationEncryptionRuntimeBoundary {
  readonly #handleSource: FedosProductionConversationAeadHandleSource;

  constructor(handleSource: FedosProductionConversationAeadHandleSource) {
    this.#handleSource = handleSource;
  }

  async encrypt(key: AeadKeyHandle, algorithm: AeadAlgorithm, aadDomain: AeadAadDomain, plaintext: Uint8Array): Promise<AeadCiphertextHandle | null> {
    try {
      return this.#handleSource.encryptAead(key, algorithm, aadDomain, plaintext);
    } catch {
      return null;
    }
  }

  async exportCiphertext(ciphertext: AeadCiphertextHandle): Promise<AeadCiphertextWire | null> {
    try {
      return this.#handleSource.serializeAeadCiphertext(ciphertext);
    } catch {
      return null;
    }
  }
}

export class FedosProductionConversationDecryptionRuntimeBoundary implements FedosConversationDecryptionRuntimeBoundary {
  readonly #handleSource: FedosProductionConversationAeadHandleSource;

  constructor(handleSource: FedosProductionConversationAeadHandleSource) {
    this.#handleSource = handleSource;
  }

  async importCiphertext(serialized: AeadCiphertextWire): Promise<AeadCiphertextHandle | null> {
    try {
      return this.#handleSource.deserializeAeadCiphertext(serialized);
    } catch {
      return null;
    }
  }

  async decrypt(key: AeadKeyHandle, algorithm: AeadAlgorithm, aadDomain: AeadAadDomain, ciphertext: AeadCiphertextHandle): Promise<Uint8Array | null> {
    try {
      return this.#handleSource.decryptAead(key, algorithm, aadDomain, ciphertext);
    } catch {
      return null;
    }
  }
}
