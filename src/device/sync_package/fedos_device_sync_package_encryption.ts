/**
 * Secure Runtime Alpha 3321–3400 — Encrypted Sync Package Builder / Reader.
 *
 * Zero new cryptography, following
 * `../../conversation/archive/fedos_conversation_archive_encryption.ts`'s
 * own "pure wiring" precedent exactly:
 *
 *   1. `FedosMasterSeedAuthority.resolveConversationKey()` (Alpha 869,
 *      already real) — but resolved against THIS ACCOUNT'S OWN public key
 *      (`selfAccountPublicKeyHex`, the caller-resolved output of
 *      `FedosNostrSigningAuthority.publicIdentityForAccount()`), not a
 *      counterparty's. A Sync Package is LOCAL and single-account,
 *      addressed to one of the account's OWN Devices — there is no second
 *      party to ECDH against. Sealing under a key resolved against your
 *      OWN public key (`ECDH(a, a·G)`) is a legitimate encrypt-to-self
 *      construction: only the holder of the account's own Master Seed
 *      (secret `a`) can ever reproduce this key, exactly mirroring the
 *      Archive's own "you can decrypt your Export iff you can already
 *      decrypt that conversation" justification, restated here as "you can
 *      open your own Sync Package iff you hold this account's own Master
 *      Seed." No new key-derivation Rust export is added — this reuses the
 *      SAME `resolveConversationKey()` the Archive already reuses.
 *   2. Build the Package Header (`./fedos_device_sync_package_header.ts`)
 *      and prepend it to the canonical session bytes
 *      (`../sync_session/fedos_device_sync_session_codec.ts`).
 *   3. Seal via the EXISTING, real `encrypt()`/`exportCiphertext()`
 *      (`../../runtime/fedos_runtime_encrypt.ts`/
 *      `fedos_runtime_export_ciphertext.ts`) — the SAME `"Conversation"`
 *      `AeadAadDomain` the Archive already reuses, for exactly the same
 *      reason: `AeadAadDomain` is a closed enum
 *      (`RootKey`/`Identity`/`Storage`/`Conversation`/`TestOnly`) mapped
 *      1:1 to `packages/fedos-core-rust/src/lib.rs`'s own discriminants —
 *      adding a `"Sync"` variant would require a Rust/WASM change, out of
 *      scope for this Arc (Architecture Frozen, no new dependency, no Rust
 *      change named anywhere in this Arc's own instructions).
 *
 * FAILURE VOCABULARY mirrors `FedosConversationArchiveExportResult`/
 * `ImportResult` exactly, plus `"expired"`/`"malformed"` (this file's own
 * two additions, kept distinct from `"failed"` for the same reason the
 * Archive keeps `"manifest-mismatch"` separate: each is discovered at a
 * DIFFERENT stage — `"malformed"` before any decrypt is even attempted,
 * `"failed"` on AEAD authentication failure, `"manifest-mismatch"` after a
 * successful decrypt, `"expired"` from the Manifest's own `expiresAt`,
 * checked independently of `../sync_session/fedos_device_sync_session.ts`'s
 * own expiry check so a caller reading a Package alone (never touching the
 * session) still gets an honest answer without decrypting first).
 *
 * HARD GUARDRAILS:
 *   - No raw key byte is ever returned by anything in this file.
 *   - `build()`/`read()` NEVER throw — any unexpected exception collapses
 *     to `{ outcome: "failed" }`.
 *   - No filesystem path, no Host wiring, no GUI, no network — mirrors the
 *     Archive Encryption Authority's own "ciphertext bytes/Manifest in,
 *     ciphertext bytes/Manifest out" scope exactly.
 */

import type { AeadAadDomain, AeadAlgorithm, AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../../runtime/fedos_wasm_loader.js";
import { encrypt as runtimeEncrypt } from "../../runtime/fedos_runtime_encrypt.js";
import { decrypt as runtimeDecrypt } from "../../runtime/fedos_runtime_decrypt.js";
import { exportCiphertext as runtimeExportCiphertext } from "../../runtime/fedos_runtime_export_ciphertext.js";
import { importCiphertext as runtimeImportCiphertext } from "../../runtime/fedos_runtime_import_ciphertext.js";
import type { FedosMasterSeedAuthority } from "../../runtime/master_seed/fedos_master_seed_authority.js";
import type { FedosDeviceSyncSessionV1 } from "../sync_session/fedos_device_sync_session.js";
import { deserializeFedosDeviceSyncSessionFromBytes, serializeFedosDeviceSyncSessionToBytes } from "../sync_session/fedos_device_sync_session_codec.js";
import {
  encodeFedosDeviceSyncPackageHeader,
  fedosDeviceSyncPackageHeaderBytesAreEqual,
  splitFedosDeviceSyncPackageHeader,
} from "./fedos_device_sync_package_header.js";
import {
  buildFedosDeviceSyncPackageManifest,
  computeFedosDeviceSyncPackageContentHash,
  fedosDeviceSyncPackageContentHashesAreEqual,
} from "./fedos_device_sync_package_manifest.js";
import { FEDOS_DEVICE_SYNC_PACKAGE_FORMAT_VERSION, isWellFormedFedosDeviceSyncPackageV1, type FedosDeviceSyncPackageV1 } from "./fedos_device_sync_package.js";

/** The ONE `AeadAadDomain` this Arc uses — the SAME domain the Archive already reuses (see this file's own header). No new domain variant is added. */
const FEDOS_DEVICE_SYNC_PACKAGE_AAD_DOMAIN: AeadAadDomain = "Conversation";

export interface FedosDeviceSyncPackageBuildRequest {
  readonly session: FedosDeviceSyncSessionV1;
  readonly suite: AeadAlgorithm;
  readonly localAccountIndex: number;
  /** ALREADY RESOLVED by the caller (`FedosNostrSigningAuthority.publicIdentityForAccount(localAccountIndex)`) — see this file's own header for why this file never resolves it internally. */
  readonly selfAccountPublicKeyHex: string;
}

export type FedosDeviceSyncPackageBuildResult =
  | { readonly outcome: "built"; readonly package: FedosDeviceSyncPackageV1 }
  | { readonly outcome: "key-unavailable" }
  | { readonly outcome: "invalid-input" }
  | { readonly outcome: "failed" };

export interface FedosDeviceSyncPackageReadRequest {
  readonly package: FedosDeviceSyncPackageV1;
  readonly suite: AeadAlgorithm;
  readonly localAccountIndex: number;
  readonly selfAccountPublicKeyHex: string;
  readonly now: number;
}

export type FedosDeviceSyncPackageReadResult =
  | { readonly outcome: "opened"; readonly session: FedosDeviceSyncSessionV1 }
  | { readonly outcome: "manifest-mismatch" }
  | { readonly outcome: "expired" }
  | { readonly outcome: "malformed" }
  | { readonly outcome: "key-unavailable" }
  | { readonly outcome: "invalid-input" }
  | { readonly outcome: "failed" };

export interface FedosDeviceSyncPackageEncryptionAuthority {
  build(request: FedosDeviceSyncPackageBuildRequest): Promise<FedosDeviceSyncPackageBuildResult>;
  read(request: FedosDeviceSyncPackageReadRequest): Promise<FedosDeviceSyncPackageReadResult>;
}

/** A narrow, structurally-typed dependency — mirrors `FedosConversationArchiveEncryptionRuntimeBoundary`'s own injectable-for-testability shape so a test can observe every branch without a real compiled WASM artifact. */
export interface FedosDeviceSyncPackageEncryptionRuntimeBoundary {
  encrypt(key: AeadKeyHandle, algorithm: AeadAlgorithm, aadDomain: AeadAadDomain, plaintext: Uint8Array): Promise<AeadCiphertextHandle | null>;
  exportCiphertext(ciphertext: AeadCiphertextHandle): Promise<AeadCiphertextWire | null>;
  importCiphertext(wire: AeadCiphertextWire): Promise<AeadCiphertextHandle | null>;
  decrypt(key: AeadKeyHandle, algorithm: AeadAlgorithm, aadDomain: AeadAadDomain, ciphertext: AeadCiphertextHandle): Promise<Uint8Array | null>;
}

/** The real, default `FedosDeviceSyncPackageEncryptionRuntimeBoundary` — thin pass-throughs to the already-real Runtime Service functions, adding no logic of its own. */
export const fedosDeviceSyncPackageEncryptionRuntimeBoundary: FedosDeviceSyncPackageEncryptionRuntimeBoundary = {
  encrypt: (key, algorithm, aadDomain, plaintext) => runtimeEncrypt(key, algorithm, aadDomain, plaintext),
  exportCiphertext: (ciphertext) => runtimeExportCiphertext(ciphertext),
  importCiphertext: (wire) => runtimeImportCiphertext(wire),
  decrypt: (key, algorithm, aadDomain, ciphertext) => runtimeDecrypt(key, algorithm, aadDomain, ciphertext),
};

function prependHeader(header: Uint8Array, sessionBytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(header.length + sessionBytes.length);
  out.set(header, 0);
  out.set(sessionBytes, header.length);
  return out;
}

/**
 * Secure Runtime Alpha 3321–3400 — the concrete, WASM-backed
 * `FedosDeviceSyncPackageEncryptionAuthority`. Constructed with a
 * `FedosMasterSeedAuthority` (the SAME instance a caller's own Master Seed
 * lifecycle already manages — never constructed internally, mirrors
 * `FedosWasmConversationArchiveEncryptionAuthority`'s own injected-
 * dependency shape) and, optionally for testability only, a
 * `FedosDeviceSyncPackageEncryptionRuntimeBoundary`.
 */
export class FedosWasmDeviceSyncPackageEncryptionAuthority implements FedosDeviceSyncPackageEncryptionAuthority {
  readonly #masterSeedAuthority: FedosMasterSeedAuthority;
  readonly #runtimeBoundary: FedosDeviceSyncPackageEncryptionRuntimeBoundary;

  constructor(
    masterSeedAuthority: FedosMasterSeedAuthority,
    runtimeBoundary: FedosDeviceSyncPackageEncryptionRuntimeBoundary = fedosDeviceSyncPackageEncryptionRuntimeBoundary,
  ) {
    this.#masterSeedAuthority = masterSeedAuthority;
    this.#runtimeBoundary = runtimeBoundary;
  }

  async build(request: FedosDeviceSyncPackageBuildRequest): Promise<FedosDeviceSyncPackageBuildResult> {
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

    const manifest = buildFedosDeviceSyncPackageManifest(request.session);
    const header = encodeFedosDeviceSyncPackageHeader({
      accountAuthority: request.session.accountAuthority,
      accountPublicIdentifier: request.session.accountPublicIdentifier,
      targetDeviceId: request.session.targetDeviceId,
      preparedAt: request.session.preparedAt,
    });
    const sealed = prependHeader(header, serializeFedosDeviceSyncSessionToBytes(request.session));

    try {
      const ciphertextHandle = await this.#runtimeBoundary.encrypt(keyHandle, request.suite, FEDOS_DEVICE_SYNC_PACKAGE_AAD_DOMAIN, sealed);
      if (ciphertextHandle === null) return { outcome: "failed" };

      const wire = await this.#runtimeBoundary.exportCiphertext(ciphertextHandle);
      if (wire === null) return { outcome: "failed" };

      return {
        outcome: "built",
        package: Object.freeze({ formatVersion: FEDOS_DEVICE_SYNC_PACKAGE_FORMAT_VERSION, manifest, ciphertext: wire }),
      };
    } catch {
      return { outcome: "failed" };
    }
  }

  async read(request: FedosDeviceSyncPackageReadRequest): Promise<FedosDeviceSyncPackageReadResult> {
    if (!Number.isInteger(request.localAccountIndex) || request.localAccountIndex < 0) {
      return { outcome: "invalid-input" };
    }
    if (typeof request.selfAccountPublicKeyHex !== "string" || request.selfAccountPublicKeyHex.length === 0) {
      return { outcome: "invalid-input" };
    }
    if (!isWellFormedFedosDeviceSyncPackageV1(request.package)) {
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

      const sealed = await this.#runtimeBoundary.decrypt(keyHandle, request.suite, FEDOS_DEVICE_SYNC_PACKAGE_AAD_DOMAIN, ciphertextHandle);
      if (sealed === null) return { outcome: "failed" };

      const split = splitFedosDeviceSyncPackageHeader(sealed);
      if (split === null) return { outcome: "failed" };

      const expectedHeader = encodeFedosDeviceSyncPackageHeader({
        accountAuthority: request.package.manifest.accountAuthority,
        accountPublicIdentifier: request.package.manifest.accountPublicIdentifier,
        targetDeviceId: request.package.manifest.targetDeviceId,
        preparedAt: request.package.manifest.preparedAt,
      });
      if (!fedosDeviceSyncPackageHeaderBytesAreEqual(split.header, expectedHeader)) return { outcome: "manifest-mismatch" };

      const session = deserializeFedosDeviceSyncSessionFromBytes(split.sessionBytes);
      if (session === null) return { outcome: "failed" };

      const recomputedHash = computeFedosDeviceSyncPackageContentHash(session);
      if (!fedosDeviceSyncPackageContentHashesAreEqual(recomputedHash, request.package.manifest.contentHash)) {
        return { outcome: "manifest-mismatch" };
      }

      return { outcome: "opened", session };
    } catch {
      return { outcome: "failed" };
    }
  }
}
