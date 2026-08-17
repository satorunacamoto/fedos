/**
 * Disaster Recovery / Portable Backup Arc — Recovery Bundle Encryption
 * Authority.
 *
 * Zero new cryptography, mirroring `../../device/sync_package/fedos_device_sync_package_encryption.ts`'s
 * own "pure wiring" precedent exactly, but split into three narrower
 * methods instead of one build()/read() pair, because — unlike a Sync
 * Package — a Recovery Bundle's own restore has a real ORDERING
 * dependency the caller must drive: the Identity Part must be restored
 * FIRST (it needs only a passphrase), and only THEN can the caller
 * derive `selfAccountPublicKeyHex` for the NOW-restored identity (via a
 * `FedosNostrSigningAuthority` built against the same now-unlocked
 * `FedosMasterSeedAuthority`) to attempt the Data Part. This file never
 * resolves that public key internally — same "already resolved by the
 * caller" discipline every other reuse of `resolveConversationKey`
 * already follows.
 *
 * `"Conversation"` `AeadAadDomain` — the SAME domain the Archive and
 * Sync Package already reuse. No new domain variant.
 *
 * HARD GUARDRAILS: no raw key byte, no raw Master Seed byte, is ever
 * returned by anything in this file. Every method NEVER throws — any
 * unexpected exception collapses to `{ outcome: "failed" }`. No
 * filesystem path, no Host wiring — mirrors the Archive/Sync Package
 * Encryption Authorities' own scope exactly.
 */

import type { AeadAadDomain, AeadAlgorithm, AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../../../core/vault/wasm/fedos_wasm_loader.js";
import { encrypt as runtimeEncrypt } from "../../../core/vault/wasm/fedos_runtime_encrypt.js";
import { decrypt as runtimeDecrypt } from "../../../core/vault/wasm/fedos_runtime_decrypt.js";
import { exportCiphertext as runtimeExportCiphertext } from "../../../core/vault/wasm/fedos_runtime_export_ciphertext.js";
import { importCiphertext as runtimeImportCiphertext } from "../../../core/vault/wasm/fedos_runtime_import_ciphertext.js";
import type { FedosMasterSeedAuthority } from "../../../core/vault/wasm/fedos_master_seed_authority.js";
import { isWellFormedSealedMasterSeedEnvelopeV1Json, toSealedMasterSeedEnvelopeV1 } from "../../../core/vault/wasm/fedos_sealed_master_seed_envelope.js";
import { encodeFedosRecoveryBundleDataPart, decodeFedosRecoveryBundleDataPart, type FedosRecoveryBundleDataPartEntry } from "./fedos_recovery_bundle_data_part_codec.js";
import { encodeFedosRecoveryBundleHeader, fedosRecoveryBundleHeaderBytesAreEqual, splitFedosRecoveryBundleHeader } from "./fedos_recovery_bundle_header.js";
import { buildFedosRecoveryBundleManifest, computeFedosRecoveryBundleContentHash, fedosRecoveryBundleContentHashesAreEqual } from "./fedos_recovery_bundle_manifest.js";
import { FEDOS_RECOVERY_BUNDLE_FORMAT_VERSION, FEDOS_RECOVERY_BUNDLE_KIND, type FedosRecoveryBundleV1 } from "./fedos_recovery_bundle.js";

const FEDOS_RECOVERY_BUNDLE_AAD_DOMAIN: AeadAadDomain = "Conversation";

export interface FedosRecoveryBundleDataPartBuildRequest {
  readonly suite: AeadAlgorithm;
  readonly accountIndex: number;
  /** ALREADY RESOLVED by the caller (`FedosNostrSigningAuthority.publicIdentityForAccount(accountIndex)`), same discipline as every other `resolveConversationKey` reuse. */
  readonly selfAccountPublicKeyHex: string;
  readonly entries: readonly FedosRecoveryBundleDataPartEntry[];
}

export interface FedosRecoveryBundleBuildRequest {
  /** Verbatim `master-seed.sealed.json` contents. */
  readonly sealedMasterSeedEnvelope: string;
  readonly now: number;
  /** Omit for an Identity-only bundle — requires no live Master Seed unlock at all. */
  readonly dataPart?: FedosRecoveryBundleDataPartBuildRequest;
}

export type FedosRecoveryBundleBuildResult =
  | { readonly outcome: "built"; readonly bundle: FedosRecoveryBundleV1 }
  | { readonly outcome: "key-unavailable" }
  | { readonly outcome: "invalid-input" }
  | { readonly outcome: "failed" };

export type FedosRecoveryBundleIdentityRestoreResult = "restored" | "wrong-secret" | "malformed" | "failed";

export interface FedosRecoveryBundleDataPartRestoreRequest {
  readonly suite: AeadAlgorithm;
  /** ALREADY RESOLVED by the caller, against the identity `restoreIdentity()` just restored. */
  readonly selfAccountPublicKeyHex: string;
  /**
   * The caller's OWN trusted account index (never `bundle.manifest.accountIndex`,
   * which travels in the clear and is never AEAD-protected -- see
   * `fedos_recovery_bundle_manifest.ts`'s own header). Mini red-team R1
   * (Disaster Recovery Product Closure arc) found key derivation and the
   * post-decrypt header re-check both trusted the unauthenticated manifest
   * field for a security-relevant selector; today inert (fails closed via
   * AEAD auth failure, single-account app), but a live "trust an
   * unauthenticated field" pattern that becomes exploitable the moment
   * multi-account support ships. Fixed by requiring the caller's own
   * verified value here instead.
   */
  readonly accountIndex: number;
}

export type FedosRecoveryBundleDataPartRestoreResult =
  | { readonly outcome: "restored"; readonly entries: readonly FedosRecoveryBundleDataPartEntry[] }
  | { readonly outcome: "identity-only" }
  | { readonly outcome: "manifest-mismatch" }
  | { readonly outcome: "key-unavailable" }
  | { readonly outcome: "invalid-input" }
  | { readonly outcome: "failed" };

/** A narrow, structurally-typed dependency — mirrors the Sync Package Encryption Authority's own injectable-for-testability shape so a test can observe every branch without a compiled WASM artifact. */
export interface FedosRecoveryBundleEncryptionRuntimeBoundary {
  encrypt(key: AeadKeyHandle, algorithm: AeadAlgorithm, aadDomain: AeadAadDomain, plaintext: Uint8Array): Promise<AeadCiphertextHandle | null>;
  exportCiphertext(ciphertext: AeadCiphertextHandle): Promise<AeadCiphertextWire | null>;
  importCiphertext(wire: AeadCiphertextWire): Promise<AeadCiphertextHandle | null>;
  decrypt(key: AeadKeyHandle, algorithm: AeadAlgorithm, aadDomain: AeadAadDomain, ciphertext: AeadCiphertextHandle): Promise<Uint8Array | null>;
}

export const fedosRecoveryBundleEncryptionRuntimeBoundary: FedosRecoveryBundleEncryptionRuntimeBoundary = {
  encrypt: (key, algorithm, aadDomain, plaintext) => runtimeEncrypt(key, algorithm, aadDomain, plaintext),
  exportCiphertext: (ciphertext) => runtimeExportCiphertext(ciphertext),
  importCiphertext: (wire) => runtimeImportCiphertext(wire),
  decrypt: (key, algorithm, aadDomain, ciphertext) => runtimeDecrypt(key, algorithm, aadDomain, ciphertext),
};

function isValidAccountIndex(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 4_294_967_295;
}

export class FedosRecoveryBundleEncryptionAuthority {
  readonly #masterSeedAuthority: FedosMasterSeedAuthority;
  readonly #runtimeBoundary: FedosRecoveryBundleEncryptionRuntimeBoundary;

  constructor(
    masterSeedAuthority: FedosMasterSeedAuthority,
    runtimeBoundary: FedosRecoveryBundleEncryptionRuntimeBoundary = fedosRecoveryBundleEncryptionRuntimeBoundary,
  ) {
    this.#masterSeedAuthority = masterSeedAuthority;
    this.#runtimeBoundary = runtimeBoundary;
  }

  /**
   * Builds a Recovery Bundle. With no `dataPart`, this needs no live
   * Master Seed unlock at all — the Identity Part is a verbatim copy of
   * an already-sealed file. With `dataPart`, the caller's own
   * `masterSeedAuthority` (constructor-injected) MUST already be
   * unlocked — `resolveConversationKey` fails closed (`"key-unavailable"`)
   * otherwise.
   */
  async build(request: FedosRecoveryBundleBuildRequest): Promise<FedosRecoveryBundleBuildResult> {
    if (!isWellFormedSealedMasterSeedEnvelopeV1Json(request.sealedMasterSeedEnvelope)) {
      return { outcome: "invalid-input" };
    }

    if (!request.dataPart) {
      return {
        outcome: "built",
        bundle: Object.freeze({
          v: FEDOS_RECOVERY_BUNDLE_FORMAT_VERSION,
          kind: FEDOS_RECOVERY_BUNDLE_KIND,
          createdAt: request.now,
          sealedMasterSeedEnvelope: request.sealedMasterSeedEnvelope,
          dataCiphertext: null,
          manifest: null,
        }),
      };
    }

    const { suite, accountIndex, selfAccountPublicKeyHex, entries } = request.dataPart;
    if (!isValidAccountIndex(accountIndex)) return { outcome: "invalid-input" };
    if (typeof selfAccountPublicKeyHex !== "string" || selfAccountPublicKeyHex.length === 0) return { outcome: "invalid-input" };

    let keyHandle: AeadKeyHandle | null;
    try {
      keyHandle = await this.#masterSeedAuthority.resolveConversationKey(accountIndex, selfAccountPublicKeyHex);
    } catch {
      return { outcome: "key-unavailable" };
    }
    if (keyHandle === null) return { outcome: "key-unavailable" };

    try {
      const dataPartBytes = encodeFedosRecoveryBundleDataPart(entries);
      const header = encodeFedosRecoveryBundleHeader({ accountIndex, createdAt: request.now });
      const sealed = new Uint8Array(header.length + dataPartBytes.length);
      sealed.set(header, 0);
      sealed.set(dataPartBytes, header.length);

      const ciphertextHandle = await this.#runtimeBoundary.encrypt(keyHandle, suite, FEDOS_RECOVERY_BUNDLE_AAD_DOMAIN, sealed);
      if (ciphertextHandle === null) return { outcome: "failed" };

      const wire = await this.#runtimeBoundary.exportCiphertext(ciphertextHandle);
      if (wire === null) return { outcome: "failed" };

      const manifest = buildFedosRecoveryBundleManifest({
        createdAt: request.now,
        accountIndex,
        includedLogs: entries.map((entry) => entry.name),
        dataPartBytes,
      });

      return {
        outcome: "built",
        bundle: Object.freeze({
          v: FEDOS_RECOVERY_BUNDLE_FORMAT_VERSION,
          kind: FEDOS_RECOVERY_BUNDLE_KIND,
          createdAt: request.now,
          sealedMasterSeedEnvelope: request.sealedMasterSeedEnvelope,
          dataCiphertext: wire,
          manifest,
        }),
      };
    } catch {
      return { outcome: "failed" };
    }
  }

  /**
   * Stage 1 of restore — mandatory, and the ONLY stage that needs the
   * passphrase. `masterSeedAuthority` (constructor-injected) MUST be a
   * freshly-constructed, empty authority targeting a fresh, empty
   * profile root — this method never checks that itself (Host-wiring
   * concern, not this Authority's), it only drives `restoreSealed()`.
   * Wrong passphrase fails closed here (`"wrong-secret"`); nothing else
   * in the bundle is even attempted by a caller that stops on that
   * outcome.
   */
  async restoreIdentity(bundle: FedosRecoveryBundleV1, passphrase: Uint8Array): Promise<FedosRecoveryBundleIdentityRestoreResult> {
    const envelope = toSealedMasterSeedEnvelopeV1(bundle.sealedMasterSeedEnvelope);
    if (envelope === null) return "malformed";
    try {
      const restored = await this.#masterSeedAuthority.restoreSealed(envelope, passphrase);
      return restored ? "restored" : "wrong-secret";
    } catch {
      return "failed";
    }
  }

  /**
   * Stage 2 of restore — optional, best-effort, requires `restoreIdentity()`
   * to have already succeeded on this SAME authority instance (this
   * method does not re-check that; it will simply fail closed with
   * `"key-unavailable"` if no identity is held). `"identity-only"` when
   * the bundle carries no Data Part at all — not a failure.
   */
  async restoreDataPart(bundle: FedosRecoveryBundleV1, request: FedosRecoveryBundleDataPartRestoreRequest): Promise<FedosRecoveryBundleDataPartRestoreResult> {
    if (bundle.dataCiphertext === null || bundle.manifest === null) return { outcome: "identity-only" };
    if (typeof request.selfAccountPublicKeyHex !== "string" || request.selfAccountPublicKeyHex.length === 0) {
      return { outcome: "invalid-input" };
    }

    let keyHandle: AeadKeyHandle | null;
    try {
      keyHandle = await this.#masterSeedAuthority.resolveConversationKey(request.accountIndex, request.selfAccountPublicKeyHex);
    } catch {
      return { outcome: "key-unavailable" };
    }
    if (keyHandle === null) return { outcome: "key-unavailable" };

    try {
      const ciphertextHandle = await this.#runtimeBoundary.importCiphertext(bundle.dataCiphertext);
      if (ciphertextHandle === null) return { outcome: "failed" };

      const sealed = await this.#runtimeBoundary.decrypt(keyHandle, request.suite, FEDOS_RECOVERY_BUNDLE_AAD_DOMAIN, ciphertextHandle);
      if (sealed === null) return { outcome: "failed" };

      const split = splitFedosRecoveryBundleHeader(sealed);
      if (split === null) return { outcome: "failed" };

      // The manifest's own claimed accountIndex must ALSO match the
      // caller's trusted value -- catches a tampered manifest even in the
      // (currently impossible, single-account) case where it happened to
      // still decrypt under the caller's real key.
      if (bundle.manifest.accountIndex !== request.accountIndex) return { outcome: "manifest-mismatch" };

      const expectedHeader = encodeFedosRecoveryBundleHeader({ accountIndex: request.accountIndex, createdAt: bundle.manifest.createdAt });
      if (!fedosRecoveryBundleHeaderBytesAreEqual(split.header, expectedHeader)) return { outcome: "manifest-mismatch" };

      const recomputedHash = computeFedosRecoveryBundleContentHash(split.dataPartBytes);
      if (!fedosRecoveryBundleContentHashesAreEqual(recomputedHash, bundle.manifest.contentHash)) return { outcome: "manifest-mismatch" };

      const entries = decodeFedosRecoveryBundleDataPart(split.dataPartBytes);
      if (entries === null) return { outcome: "failed" };

      return { outcome: "restored", entries };
    } catch {
      return { outcome: "failed" };
    }
  }
}
