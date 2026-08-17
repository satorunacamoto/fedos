/**
 * Disaster Recovery / Portable Backup Arc — IPC-wiring pass. The
 * production-path `FedosRecoveryBundleEncryptionRuntimeBoundary`, backed
 * by REAL WASM through the SAME opaque Master Seed authority handle the
 * production activation path already holds — NOT
 * `fedos_runtime_encrypt.ts`/`fedos_runtime_decrypt.ts`/
 * `fedos_runtime_export_ciphertext.ts`/`fedos_runtime_import_ciphertext.ts`'s
 * own dev-only `FedosWasmLoaderSkeleton` boundary
 * (`fedos_recovery_bundle_encryption.ts`'s own DEFAULT
 * `fedosRecoveryBundleEncryptionRuntimeBoundary` — each of those four
 * Runtime Service files constructs its OWN, fresh, independent WASM
 * module instance per call, a DIFFERENT module instantiation than the
 * one that produced the `AeadKeyHandle`
 * `FedosMasterSeedAuthority.resolveConversationKey()` already resolved,
 * so a real production caller hits a cross-instantiation opaque-handle
 * mismatch — `encrypt()` silently returns `null`, never throws, so this
 * surfaced only as `{ outcome: "failed" }` from `build()`).
 *
 * REAL BUG FOUND while writing this Arc's own real packaged-Electron IPC
 * acceptance test (`fedos_disaster_recovery_portable_backup_ipc_acceptance.test.ts`):
 * `profile-recovery-export` failed closed with `build-failed`/`"failed"`
 * against a REAL `FedosProductionMasterSeedAuthority` in a REAL spawned
 * Electron process, even though the identical mocked-boundary unit tests
 * (`fedos_disaster_recovery_portable_backup_export_coordinator.test.ts`)
 * passed — exactly the failure mode this file's own precedent,
 * `../production_activation/fedos_production_conversation_encryption_runtime_boundary.ts`
 * (Secure Runtime Alpha 7161-7240), already diagnosed and fixed for
 * Conversation encryption. `fedos_recovery_bundle_encryption.ts`'s own
 * header claims to mirror `fedos_device_sync_package_encryption.ts`'s
 * "pure wiring" precedent — the WRONG, OLDER precedent, which still uses
 * the dev-only boundary and is therefore suspected (not confirmed by
 * this Arc's own test) to carry the SAME latent bug in a real packaged
 * Electron process; out of this Arc's scope to fix, flagged for the
 * Coordinator.
 *
 * `FedosProductionMasterSeedAuthority`'s own `encryptAead()`/
 * `decryptAead()`/`serializeAeadCiphertext()`/`deserializeAeadCiphertext()`
 * (added by the Alpha 7161-7240 arc for exactly this reason) reach the
 * SAME already-real, already-tested Rust exports every dev-only Runtime
 * Service call ultimately reaches too — this file adds NO new
 * cryptography, only correct wiring.
 */
import type {
  AeadAadDomain,
  AeadAlgorithm,
  AeadCiphertextHandle,
  AeadCiphertextWire,
  AeadKeyHandle,
} from "../../../core/vault/wasm/fedos_wasm_loader.js";
import type { FedosRecoveryBundleEncryptionRuntimeBoundary } from "./fedos_recovery_bundle_encryption.js";

/**
 * The narrow structural port this boundary needs —
 * `FedosProductionMasterSeedAuthority` satisfies it via its own four
 * methods; nothing else is required, so the coupling to the production
 * authority is by shape only — mirrors
 * `FedosProductionConversationAeadHandleSource`'s own exact discipline.
 */
export interface FedosProductionRecoveryBundleAeadHandleSource {
  encryptAead(key: AeadKeyHandle, algorithm: AeadAlgorithm, aadDomain: AeadAadDomain, plaintext: Uint8Array): AeadCiphertextHandle | null;
  decryptAead(key: AeadKeyHandle, algorithm: AeadAlgorithm, aadDomain: AeadAadDomain, ciphertext: AeadCiphertextHandle): Uint8Array | null;
  serializeAeadCiphertext(ciphertext: AeadCiphertextHandle): AeadCiphertextWire | null;
  deserializeAeadCiphertext(wire: AeadCiphertextWire): AeadCiphertextHandle | null;
}

export class FedosProductionRecoveryBundleEncryptionRuntimeBoundary implements FedosRecoveryBundleEncryptionRuntimeBoundary {
  readonly #handleSource: FedosProductionRecoveryBundleAeadHandleSource;

  constructor(handleSource: FedosProductionRecoveryBundleAeadHandleSource) {
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
