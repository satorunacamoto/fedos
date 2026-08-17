/**
 * Own-Device Sync Protocol Final Closure arc — Encrypted Journal Package
 * Builder/Reader. Mirrors
 * `../sync_package/fedos_device_sync_package_encryption.ts` EXACTLY — same
 * encrypt-to-self construction (`FedosMasterSeedAuthority.resolveConversationKey()`
 * resolved against THIS account's OWN public key), same `"Conversation"`
 * `AeadAadDomain` (no new domain variant, no Rust/WASM change), same
 * prefix-then-encrypt header technique. The ONLY difference from that file
 * is the inner payload type (`FedosDeviceSyncJournalBatchV1` instead of
 * `FedosDeviceSyncSessionV1`) — reuses
 * `encodeFedosDeviceSyncPackageHeader()`/`splitFedosDeviceSyncPackageHeader()`
 * from `../sync_package/fedos_device_sync_package_header.ts` AS-IS
 * (unmodified — that file's own header fields, account/target-device
 * identity + `preparedAt`, are already generic, carrying no
 * session-specific content).
 *
 * A NEW, small, additive sibling class -- never a modification of the
 * existing, proven, tested `FedosWasmDeviceSyncPackageEncryptionAuthority`
 * -- matching this codebase's own established "new parallel implementation
 * per payload type, never widen an existing frozen class" discipline
 * (Alpha 2921-3000/3641-3720's own device-sync-domain precedent).
 */

import type { AeadAadDomain, AeadAlgorithm, AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../../../core/vault/wasm/fedos_wasm_loader.js";
import { encrypt as runtimeEncrypt } from "../../../core/vault/wasm/fedos_runtime_encrypt.js";
import { decrypt as runtimeDecrypt } from "../../../core/vault/wasm/fedos_runtime_decrypt.js";
import { exportCiphertext as runtimeExportCiphertext } from "../../../core/vault/wasm/fedos_runtime_export_ciphertext.js";
import { importCiphertext as runtimeImportCiphertext } from "../../../core/vault/wasm/fedos_runtime_import_ciphertext.js";
import type { FedosMasterSeedAuthority } from "../../../core/vault/wasm/fedos_master_seed_authority.js";
import type { FedosDeviceSyncJournalBatchV1 } from "./fedos_device_sync_journal_batch.js";
import { deserializeFedosDeviceSyncJournalBatchFromBytes, serializeFedosDeviceSyncJournalBatchToBytes } from "./fedos_device_sync_journal_batch_codec.js";
import {
  encodeFedosDeviceSyncPackageHeader,
  fedosDeviceSyncPackageHeaderBytesAreEqual,
  splitFedosDeviceSyncPackageHeader,
} from "../sync_package/fedos_device_sync_package_header.js";
import {
  buildFedosDeviceSyncJournalPackageManifest,
  computeFedosDeviceSyncJournalPackageContentHash,
  fedosDeviceSyncJournalPackageContentHashesAreEqual,
} from "./fedos_device_sync_journal_package_manifest.js";
import { FEDOS_DEVICE_SYNC_JOURNAL_PACKAGE_FORMAT_VERSION, isWellFormedFedosDeviceSyncJournalPackageV1, type FedosDeviceSyncJournalPackageV1 } from "./fedos_device_sync_journal_package.js";

const FEDOS_DEVICE_SYNC_JOURNAL_PACKAGE_AAD_DOMAIN: AeadAadDomain = "Conversation";

export interface FedosDeviceSyncJournalPackageBuildRequest {
  readonly batch: FedosDeviceSyncJournalBatchV1;
  readonly suite: AeadAlgorithm;
  readonly localAccountIndex: number;
  readonly selfAccountPublicKeyHex: string;
}

export type FedosDeviceSyncJournalPackageBuildResult =
  | { readonly outcome: "built"; readonly package: FedosDeviceSyncJournalPackageV1 }
  | { readonly outcome: "key-unavailable" }
  | { readonly outcome: "invalid-input" }
  | { readonly outcome: "failed" };

export interface FedosDeviceSyncJournalPackageReadRequest {
  readonly package: FedosDeviceSyncJournalPackageV1;
  readonly suite: AeadAlgorithm;
  readonly localAccountIndex: number;
  readonly selfAccountPublicKeyHex: string;
  readonly now: number;
}

export type FedosDeviceSyncJournalPackageReadResult =
  | { readonly outcome: "opened"; readonly batch: FedosDeviceSyncJournalBatchV1 }
  | { readonly outcome: "manifest-mismatch" }
  | { readonly outcome: "expired" }
  | { readonly outcome: "malformed" }
  | { readonly outcome: "key-unavailable" }
  | { readonly outcome: "invalid-input" }
  | { readonly outcome: "failed" };

export interface FedosDeviceSyncJournalPackageEncryptionAuthority {
  build(request: FedosDeviceSyncJournalPackageBuildRequest): Promise<FedosDeviceSyncJournalPackageBuildResult>;
  read(request: FedosDeviceSyncJournalPackageReadRequest): Promise<FedosDeviceSyncJournalPackageReadResult>;
}

export interface FedosDeviceSyncJournalPackageEncryptionRuntimeBoundary {
  encrypt(key: AeadKeyHandle, algorithm: AeadAlgorithm, aadDomain: AeadAadDomain, plaintext: Uint8Array): Promise<AeadCiphertextHandle | null>;
  exportCiphertext(ciphertext: AeadCiphertextHandle): Promise<AeadCiphertextWire | null>;
  importCiphertext(wire: AeadCiphertextWire): Promise<AeadCiphertextHandle | null>;
  decrypt(key: AeadKeyHandle, algorithm: AeadAlgorithm, aadDomain: AeadAadDomain, ciphertext: AeadCiphertextHandle): Promise<Uint8Array | null>;
}

export const fedosDeviceSyncJournalPackageEncryptionRuntimeBoundary: FedosDeviceSyncJournalPackageEncryptionRuntimeBoundary = {
  encrypt: (key, algorithm, aadDomain, plaintext) => runtimeEncrypt(key, algorithm, aadDomain, plaintext),
  exportCiphertext: (ciphertext) => runtimeExportCiphertext(ciphertext),
  importCiphertext: (wire) => runtimeImportCiphertext(wire),
  decrypt: (key, algorithm, aadDomain, ciphertext) => runtimeDecrypt(key, algorithm, aadDomain, ciphertext),
};

function prependHeader(header: Uint8Array, batchBytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(header.length + batchBytes.length);
  out.set(header, 0);
  out.set(batchBytes, header.length);
  return out;
}

export class FedosWasmDeviceSyncJournalPackageEncryptionAuthority implements FedosDeviceSyncJournalPackageEncryptionAuthority {
  readonly #masterSeedAuthority: FedosMasterSeedAuthority;
  readonly #runtimeBoundary: FedosDeviceSyncJournalPackageEncryptionRuntimeBoundary;

  constructor(
    masterSeedAuthority: FedosMasterSeedAuthority,
    runtimeBoundary: FedosDeviceSyncJournalPackageEncryptionRuntimeBoundary = fedosDeviceSyncJournalPackageEncryptionRuntimeBoundary,
  ) {
    this.#masterSeedAuthority = masterSeedAuthority;
    this.#runtimeBoundary = runtimeBoundary;
  }

  async build(request: FedosDeviceSyncJournalPackageBuildRequest): Promise<FedosDeviceSyncJournalPackageBuildResult> {
    if (!Number.isInteger(request.localAccountIndex) || request.localAccountIndex < 0) {
      return { outcome: "invalid-input" };
    }
    if (typeof request.selfAccountPublicKeyHex !== "string" || request.selfAccountPublicKeyHex.length === 0) {
      return { outcome: "invalid-input" };
    }

    let keyHandle: AeadKeyHandle | null;
    try {
      keyHandle = await this.#masterSeedAuthority.resolveConversationKey(request.localAccountIndex, request.selfAccountPublicKeyHex);
    } catch {
      return { outcome: "key-unavailable" };
    }
    if (keyHandle === null) return { outcome: "key-unavailable" };

    const manifest = buildFedosDeviceSyncJournalPackageManifest(request.batch);
    const header = encodeFedosDeviceSyncPackageHeader({
      accountAuthority: request.batch.accountAuthority,
      accountPublicIdentifier: request.batch.accountPublicIdentifier,
      targetDeviceId: request.batch.targetDeviceId,
      preparedAt: request.batch.preparedAt,
    });
    const sealed = prependHeader(header, serializeFedosDeviceSyncJournalBatchToBytes(request.batch));

    try {
      const ciphertextHandle = await this.#runtimeBoundary.encrypt(keyHandle, request.suite, FEDOS_DEVICE_SYNC_JOURNAL_PACKAGE_AAD_DOMAIN, sealed);
      if (ciphertextHandle === null) return { outcome: "failed" };

      const wire = await this.#runtimeBoundary.exportCiphertext(ciphertextHandle);
      if (wire === null) return { outcome: "failed" };

      return {
        outcome: "built",
        package: Object.freeze({ formatVersion: FEDOS_DEVICE_SYNC_JOURNAL_PACKAGE_FORMAT_VERSION, manifest, ciphertext: wire }),
      };
    } catch {
      return { outcome: "failed" };
    }
  }

  async read(request: FedosDeviceSyncJournalPackageReadRequest): Promise<FedosDeviceSyncJournalPackageReadResult> {
    if (!Number.isInteger(request.localAccountIndex) || request.localAccountIndex < 0) {
      return { outcome: "invalid-input" };
    }
    if (typeof request.selfAccountPublicKeyHex !== "string" || request.selfAccountPublicKeyHex.length === 0) {
      return { outcome: "invalid-input" };
    }
    if (!isWellFormedFedosDeviceSyncJournalPackageV1(request.package)) {
      return { outcome: "malformed" };
    }
    if (request.now > request.package.manifest.expiresAt) {
      return { outcome: "expired" };
    }

    let keyHandle: AeadKeyHandle | null;
    try {
      keyHandle = await this.#masterSeedAuthority.resolveConversationKey(request.localAccountIndex, request.selfAccountPublicKeyHex);
    } catch {
      return { outcome: "key-unavailable" };
    }
    if (keyHandle === null) return { outcome: "key-unavailable" };

    try {
      const ciphertextHandle = await this.#runtimeBoundary.importCiphertext(request.package.ciphertext);
      if (ciphertextHandle === null) return { outcome: "failed" };

      const sealed = await this.#runtimeBoundary.decrypt(keyHandle, request.suite, FEDOS_DEVICE_SYNC_JOURNAL_PACKAGE_AAD_DOMAIN, ciphertextHandle);
      if (sealed === null) return { outcome: "failed" };

      const split = splitFedosDeviceSyncPackageHeader(sealed);
      if (split === null) return { outcome: "malformed" };

      const expectedHeader = encodeFedosDeviceSyncPackageHeader({
        accountAuthority: request.package.manifest.accountAuthority,
        accountPublicIdentifier: request.package.manifest.accountPublicIdentifier,
        targetDeviceId: request.package.manifest.targetDeviceId,
        preparedAt: request.package.manifest.preparedAt,
      });
      if (!fedosDeviceSyncPackageHeaderBytesAreEqual(split.header, expectedHeader)) {
        return { outcome: "manifest-mismatch" };
      }

      const batch = deserializeFedosDeviceSyncJournalBatchFromBytes(split.sessionBytes);
      if (batch === null) return { outcome: "malformed" };

      if (!fedosDeviceSyncJournalPackageContentHashesAreEqual(computeFedosDeviceSyncJournalPackageContentHash(batch), request.package.manifest.contentHash)) {
        return { outcome: "manifest-mismatch" };
      }

      return { outcome: "opened", batch };
    } catch {
      return { outcome: "failed" };
    }
  }
}
