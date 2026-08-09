/**
 * Secure Runtime Alpha 7241-7320 — the production-path
 * `FedosConversationArchiveEncryptionRuntimeBoundary`, backed by REAL WASM
 * through the SAME opaque Master Seed authority handle the production
 * activation path already holds.
 *
 * This is the SAME recurring bug class Alpha 7161-7240 already fixed for
 * the generic Envelope-AEAD encrypt/decrypt path
 * (`fedos_production_conversation_encryption_runtime_boundary.ts`, this
 * file's own immediate sibling, unmodified): `FedosWasmConversationArchiveEncryptionAuthority`'s
 * own DEFAULT `fedosConversationArchiveEncryptionRuntimeBoundary`
 * (`../../conversation/archive/fedos_conversation_archive_encryption.ts`)
 * calls `fedos_runtime_encrypt.ts`/`fedos_runtime_decrypt.ts`/
 * `fedos_runtime_export_ciphertext.ts`/`fedos_runtime_import_ciphertext.ts`
 * — each of those constructs its OWN, fresh, independent, `NODE_ENV=development`-gated
 * `FedosWasmLoaderSkeleton` instance per call, never the canonical,
 * already-activated production authority a real Coordinator/profile
 * unlock already constructed. A real vertical slice (this Arc's own
 * `test/secure_runtime_alpha_7241_7320_archive_search_retention_interaction.test.ts`)
 * proved this live: Archive export genuinely fails ("failed", never a
 * fabricated success) outside `NODE_ENV=development`, even with a real
 * compiled `pkg/` artifact present and a real, already-activated
 * production Master Seed Authority available — because Archive's own
 * encryption authority never had a production-path boundary to fall back
 * to at all, unlike the generic Envelope-AEAD path 7161-7240 already
 * fixed.
 *
 * No new cryptography: reuses the EXACT SAME already-real, already-tested
 * `FedosProductionConversationAeadHandleSource` shape (`encryptAead`/
 * `decryptAead`/`serializeAeadCiphertext`/`deserializeAeadCiphertext`)
 * `FedosProductionMasterSeedAuthority` already exposes for the generic
 * Envelope path — Archive's own `FedosConversationArchiveEncryptionRuntimeBoundary`
 * just bundles all four operations into ONE interface (its own
 * pre-existing, unmodified shape) instead of two, so this file is a thin,
 * combined adapter over the identical accessor methods, never a second,
 * divergent handle source.
 */
import type { AeadAadDomain, AeadAlgorithm, AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../../../../runtime/fedos_wasm_loader.js";
import type { FedosConversationArchiveEncryptionRuntimeBoundary } from "../../conversations/archive/fedos_conversation_archive_encryption.js";
import type { FedosProductionConversationAeadHandleSource } from "./fedos_production_conversation_encryption_runtime_boundary.js";

export type { FedosProductionConversationAeadHandleSource };

export class FedosProductionConversationArchiveEncryptionRuntimeBoundary implements FedosConversationArchiveEncryptionRuntimeBoundary {
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

  async importCiphertext(wire: AeadCiphertextWire): Promise<AeadCiphertextHandle | null> {
    try {
      return this.#handleSource.deserializeAeadCiphertext(wire);
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
