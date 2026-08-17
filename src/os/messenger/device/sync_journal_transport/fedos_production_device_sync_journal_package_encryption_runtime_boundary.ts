/**
 * Disaster Recovery Product Closure arc — Track 2 (Sync Package crypto
 * audit, CONFIRMED). The production-path
 * `FedosDeviceSyncJournalPackageEncryptionRuntimeBoundary`, backed by
 * REAL WASM through the SAME opaque Master Seed authority handle the
 * production activation path already holds — NOT
 * `fedos_runtime_encrypt.ts`/`fedos_runtime_decrypt.ts`/
 * `fedos_runtime_export_ciphertext.ts`/`fedos_runtime_import_ciphertext.ts`'s
 * own dev-only `FedosWasmLoaderSkeleton` boundary (this file's own
 * default `fedosDeviceSyncJournalPackageEncryptionRuntimeBoundary` — each
 * of those four Runtime Service files constructs its OWN, fresh,
 * independent WASM module instance per call, a DIFFERENT module
 * instantiation than the one that produced the `AeadKeyHandle`
 * `FedosMasterSeedAuthority.resolveConversationKey()` already resolved,
 * so a real production caller hits a cross-instantiation opaque-handle
 * mismatch — `encrypt()` silently returns `null`, never throws, so this
 * would surface only as a build failure, invisible to every existing
 * mocked-boundary unit test).
 *
 * CONFIRMED (not merely suspected) by a live, throwaway real-WASM
 * reproduction during this arc's own Phase A investigation — see
 * `docs/reviews/fedos_disaster_recovery_portable_backup_v1/13_PRODUCT_CLOSURE_DECISION.md`
 * for the full writeup, including the important methodological finding
 * that a Node-only real-WASM test CANNOT reliably catch this bug class
 * (Node's own module/WASM-instance caching appears to alias separate
 * loader instances within one process) — every real occurrence of this
 * defect this session (Conversation encryption, Recovery Bundle
 * encryption, now this one) was only ever caught by a real spawned-
 * Electron-process proof.
 *
 * This is the THIRD time this exact failure mode has been found and
 * fixed this session. `../../production_activation/fedos_production_conversation_encryption_runtime_boundary.ts`
 * (first fix) and
 * `../../desktop/recovery/fedos_production_recovery_bundle_encryption_runtime_boundary.ts`
 * (second fix) are this file's own direct precedents — same shape,
 * same reasoning, no new cryptography, only correct wiring.
 * `FedosProductionMasterSeedAuthority`'s own `encryptAead()`/
 * `decryptAead()`/`serializeAeadCiphertext()`/`deserializeAeadCiphertext()`
 * reach the SAME already-real, already-tested Rust exports every
 * dev-only Runtime Service call ultimately reaches too.
 *
 * FLAGGED, NOT FIXED this pass: the sibling, currently-dead-code
 * `../sync_package/fedos_device_sync_package_encryption.ts` carries the
 * identical defect but has zero production construction sites today —
 * it needs this SAME fix before it is ever wired up (e.g. a future
 * Device Transfer activation), but fixing genuinely-unreachable code
 * is out of this pass's own scope.
 */
import type {
  AeadAadDomain,
  AeadAlgorithm,
  AeadCiphertextHandle,
  AeadCiphertextWire,
  AeadKeyHandle,
} from "../../../core/vault/wasm/fedos_wasm_loader.js";
import type { FedosDeviceSyncJournalPackageEncryptionRuntimeBoundary } from "./fedos_device_sync_journal_package_encryption.js";

/**
 * The narrow structural port this boundary needs —
 * `FedosProductionMasterSeedAuthority` satisfies it via its own four
 * methods; nothing else is required, so the coupling to the production
 * authority is by shape only — mirrors
 * `FedosProductionRecoveryBundleAeadHandleSource`'s own exact
 * discipline.
 */
export interface FedosProductionDeviceSyncJournalPackageAeadHandleSource {
  encryptAead(key: AeadKeyHandle, algorithm: AeadAlgorithm, aadDomain: AeadAadDomain, plaintext: Uint8Array): AeadCiphertextHandle | null;
  decryptAead(key: AeadKeyHandle, algorithm: AeadAlgorithm, aadDomain: AeadAadDomain, ciphertext: AeadCiphertextHandle): Uint8Array | null;
  serializeAeadCiphertext(ciphertext: AeadCiphertextHandle): AeadCiphertextWire | null;
  deserializeAeadCiphertext(wire: AeadCiphertextWire): AeadCiphertextHandle | null;
}

export class FedosProductionDeviceSyncJournalPackageEncryptionRuntimeBoundary implements FedosDeviceSyncJournalPackageEncryptionRuntimeBoundary {
  readonly #handleSource: FedosProductionDeviceSyncJournalPackageAeadHandleSource;

  constructor(handleSource: FedosProductionDeviceSyncJournalPackageAeadHandleSource) {
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
