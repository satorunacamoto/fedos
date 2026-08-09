/**
 * Secure Runtime Alpha 1541–1610 ("Conversation Export, Restore, Archive
 * Foundation") — Archive Encryption Authority (Encrypted Export /
 * Encrypted Import).
 *
 * Zero new cryptography, mirroring `FedosWasmConversationEncryptionAuthority`/
 * `FedosWasmConversationDecryptionAuthority`'s own "pure wiring" Alpha
 * 870/871 accounting exactly:
 *
 *   1. `FedosMasterSeedAuthority.resolveConversationKey()` (Alpha 869,
 *      already real) — the SAME per-conversation `AeadKeyHandle` this
 *      conversation's own Envelopes are already encrypted under. An
 *      Archive of a conversation is therefore encrypted under EXACTLY
 *      the key a caller must already be able to derive to read that
 *      conversation at all — "you can decrypt your Export iff you can
 *      already decrypt that conversation," never a separate passphrase
 *      or a new key-derivation domain.
 *   2. Build the Archive Header (`./fedos_conversation_archive_header.ts`,
 *      this Arc's own new file, but reusing Alpha 856's own
 *      prefix-then-encrypt TECHNIQUE verbatim) and prepend it to the
 *      canonical bundle bytes
 *      (`./fedos_conversation_archive_bundle_codec.ts`).
 *   3. Seal via the EXISTING, real `encrypt()`/`exportCiphertext()`
 *      (`../../runtime/fedos_runtime_encrypt.ts`/
 *      `fedos_runtime_export_ciphertext.ts`) — the SAME `"Conversation"`
 *      `AeadAadDomain` this conversation's Envelopes already use (no new
 *      Rust-side AAD domain variant is added by this Arc — Architecture
 *      Frozen).
 *
 * `FedosConversationArchiveManifestV1` (`./fedos_conversation_archive_manifest.ts`)
 * travels ALONGSIDE the ciphertext, in the clear, exactly like the
 * Sealed Master Seed Envelope's own cost params (Alpha 435) — it is
 * NEVER itself AEAD-protected. Import independently re-verifies it
 * twice after a successful decrypt: once via the Archive Header
 * (identity: same conversation/export), once via the Integrity content
 * hash (content: same bytes) — see `"manifest-mismatch"` below.
 *
 * FAILURE VOCABULARY — mirrors `FedosConversationEncryptionResult`'s own
 * coarse, stable shape (Alpha 863) as closely as this Arc's own extra
 * Manifest-binding check allows; `"manifest-mismatch"` is the ONE
 * addition, kept DISTINCT from `"failed"` deliberately: unlike an AEAD
 * authentication failure (wrong key / corrupted ciphertext, genuinely
 * undifferentiated per RFC 8439/NIST AEAD guidance — collapsed into
 * `"failed"` here exactly as Alpha 865 already established), a
 * Manifest/Header or Manifest/content-hash mismatch is discovered ONLY
 * AFTER decryption already succeeded and authenticated the sealed blob
 * — it distinguishes "this ciphertext opened, but does not match the
 * Manifest you handed me alongside it" from every other failure mode,
 * without creating any oracle over the KEY (both class of failures
 * require the caller to already possess a validly-encrypted ciphertext
 * to reach the comparison at all).
 *
 * HARD GUARDRAILS:
 *   - No raw key byte is ever returned by anything in this file.
 *   - `export()`/`import()` NEVER throw — any unexpected exception from
 *     the injected boundary collapses to `{ outcome: "failed" }`.
 *   - No filesystem path, no Host wiring, no GUI — mirrors
 *     `FedosMasterSeedAuthority`'s own Alpha 439 "Option E" deferral:
 *     this Authority only ever hands a caller ciphertext bytes/a
 *     Manifest, or accepts them back; WHERE they are written is a
 *     separate, later Host-wiring concern this Arc does not build (No
 *     Cloud, No Sync, No GUI).
 */

import type { AeadAadDomain, AeadAlgorithm, AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../../../../runtime/fedos_wasm_loader.js";
import { encrypt as runtimeEncrypt } from "../../../../runtime/fedos_runtime_encrypt.js";
import { decrypt as runtimeDecrypt } from "../../../../runtime/fedos_runtime_decrypt.js";
import { exportCiphertext as runtimeExportCiphertext } from "../../../../runtime/fedos_runtime_export_ciphertext.js";
import { importCiphertext as runtimeImportCiphertext } from "../../../../runtime/fedos_runtime_import_ciphertext.js";
import type { FedosMasterSeedAuthority } from "../../../core/vault/wasm/fedos_master_seed_authority.js";
import type { FedosConversationEnvelopeEncryptionSuite } from "../envelope/fedos_conversation_message_envelope.js";
import type { FedosConversationArchiveBundleV1 } from "./fedos_conversation_archive_bundle.js";
import { deserializeFedosConversationArchiveBundleFromBytes, serializeFedosConversationArchiveBundleToBytes } from "./fedos_conversation_archive_bundle_codec.js";
import { encodeFedosConversationArchiveHeader, fedosConversationArchiveHeaderBytesAreEqual, splitFedosConversationArchiveHeader } from "./fedos_conversation_archive_header.js";
import { fedosConversationArchiveContentHashesAreEqual, computeFedosConversationArchiveContentHash } from "./fedos_conversation_archive_integrity.js";
import { buildFedosConversationArchiveManifest } from "./fedos_conversation_archive_manifest_codec.js";
import type { FedosConversationArchiveManifestV1 } from "./fedos_conversation_archive_manifest.js";

/** The ONE `AeadAadDomain` this Arc uses — the SAME domain this conversation's own Envelopes already seal under (Alpha 870). No new domain variant is added. */
const FEDOS_CONVERSATION_ARCHIVE_AAD_DOMAIN: AeadAadDomain = "Conversation";

export interface FedosConversationArchiveExportRequest {
  readonly bundle: FedosConversationArchiveBundleV1;
  readonly suite: FedosConversationEnvelopeEncryptionSuite;
  /** ALREADY RESOLVED by the caller — see `fedos_conversation_encryption_authority.ts`'s own header for why this codebase never resolves these two fields internally. */
  readonly localAccountIndex: number;
  readonly counterpartyPublicKeyHex: string;
}

export type FedosConversationArchiveExportResult =
  | { readonly outcome: "exported"; readonly manifest: FedosConversationArchiveManifestV1; readonly ciphertext: AeadCiphertextWire }
  | { readonly outcome: "key-unavailable" }
  | { readonly outcome: "invalid-input" }
  | { readonly outcome: "failed" };

export interface FedosConversationArchiveImportRequest {
  readonly manifest: FedosConversationArchiveManifestV1;
  readonly ciphertext: AeadCiphertextWire;
  readonly suite: FedosConversationEnvelopeEncryptionSuite;
  readonly localAccountIndex: number;
  readonly counterpartyPublicKeyHex: string;
}

export type FedosConversationArchiveImportResult =
  | { readonly outcome: "decrypted"; readonly bundle: FedosConversationArchiveBundleV1 }
  | { readonly outcome: "manifest-mismatch" }
  | { readonly outcome: "key-unavailable" }
  | { readonly outcome: "invalid-input" }
  | { readonly outcome: "failed" };

export interface FedosConversationArchiveEncryptionAuthority {
  export(request: FedosConversationArchiveExportRequest): Promise<FedosConversationArchiveExportResult>;
  import(request: FedosConversationArchiveImportRequest): Promise<FedosConversationArchiveImportResult>;
}

/** A narrow, structurally-typed dependency — mirrors `FedosConversationEncryptionRuntimeBoundary`'s own injectable-for-testability shape (Alpha 870) so a test can observe every branch without a real compiled WASM artifact. */
export interface FedosConversationArchiveEncryptionRuntimeBoundary {
  encrypt(key: AeadKeyHandle, algorithm: AeadAlgorithm, aadDomain: AeadAadDomain, plaintext: Uint8Array): Promise<AeadCiphertextHandle | null>;
  exportCiphertext(ciphertext: AeadCiphertextHandle): Promise<AeadCiphertextWire | null>;
  importCiphertext(wire: AeadCiphertextWire): Promise<AeadCiphertextHandle | null>;
  decrypt(key: AeadKeyHandle, algorithm: AeadAlgorithm, aadDomain: AeadAadDomain, ciphertext: AeadCiphertextHandle): Promise<Uint8Array | null>;
}

/** The real, default `FedosConversationArchiveEncryptionRuntimeBoundary` — thin pass-throughs to the already-real Runtime Service functions, adding no logic of its own. */
export const fedosConversationArchiveEncryptionRuntimeBoundary: FedosConversationArchiveEncryptionRuntimeBoundary = {
  encrypt: (key, algorithm, aadDomain, plaintext) => runtimeEncrypt(key, algorithm, aadDomain, plaintext),
  exportCiphertext: (ciphertext) => runtimeExportCiphertext(ciphertext),
  importCiphertext: (wire) => runtimeImportCiphertext(wire),
  decrypt: (key, algorithm, aadDomain, ciphertext) => runtimeDecrypt(key, algorithm, aadDomain, ciphertext),
};

function prependHeader(header: Uint8Array, bundleBytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(header.length + bundleBytes.length);
  out.set(header, 0);
  out.set(bundleBytes, header.length);
  return out;
}

/**
 * Secure Runtime Alpha 1541–1610 — the concrete, WASM-backed
 * `FedosConversationArchiveEncryptionAuthority`. Constructed with a
 * `FedosMasterSeedAuthority` (the SAME instance a caller's own Master
 * Seed lifecycle already manages — never constructed internally,
 * mirrors `FedosWasmConversationEncryptionAuthority`'s own injected-
 * dependency shape) and, optionally for testability only, a
 * `FedosConversationArchiveEncryptionRuntimeBoundary`.
 */
export class FedosWasmConversationArchiveEncryptionAuthority implements FedosConversationArchiveEncryptionAuthority {
  readonly #masterSeedAuthority: FedosMasterSeedAuthority;
  readonly #runtimeBoundary: FedosConversationArchiveEncryptionRuntimeBoundary;

  constructor(
    masterSeedAuthority: FedosMasterSeedAuthority,
    runtimeBoundary: FedosConversationArchiveEncryptionRuntimeBoundary = fedosConversationArchiveEncryptionRuntimeBoundary,
  ) {
    this.#masterSeedAuthority = masterSeedAuthority;
    this.#runtimeBoundary = runtimeBoundary;
  }

  async export(request: FedosConversationArchiveExportRequest): Promise<FedosConversationArchiveExportResult> {
    if (!Number.isInteger(request.localAccountIndex) || request.localAccountIndex < 0) {
      return { outcome: "invalid-input" };
    }

    let keyHandle: AeadKeyHandle | null;
    try {
      keyHandle = await this.#masterSeedAuthority.resolveConversationKey(request.localAccountIndex, request.counterpartyPublicKeyHex);
    } catch {
      return { outcome: "key-unavailable" };
    }
    if (keyHandle === null) return { outcome: "key-unavailable" };

    const manifest = buildFedosConversationArchiveManifest(request.bundle);
    const header = encodeFedosConversationArchiveHeader({ conversationId: request.bundle.conversationId, exportedAt: request.bundle.exportedAt });
    const sealed = prependHeader(header, serializeFedosConversationArchiveBundleToBytes(request.bundle));

    try {
      const ciphertextHandle = await this.#runtimeBoundary.encrypt(keyHandle, request.suite, FEDOS_CONVERSATION_ARCHIVE_AAD_DOMAIN, sealed);
      if (ciphertextHandle === null) return { outcome: "failed" };

      const wire = await this.#runtimeBoundary.exportCiphertext(ciphertextHandle);
      if (wire === null) return { outcome: "failed" };

      return { outcome: "exported", manifest, ciphertext: wire };
    } catch {
      return { outcome: "failed" };
    }
  }

  async import(request: FedosConversationArchiveImportRequest): Promise<FedosConversationArchiveImportResult> {
    if (!Number.isInteger(request.localAccountIndex) || request.localAccountIndex < 0) {
      return { outcome: "invalid-input" };
    }

    let keyHandle: AeadKeyHandle | null;
    try {
      keyHandle = await this.#masterSeedAuthority.resolveConversationKey(request.localAccountIndex, request.counterpartyPublicKeyHex);
    } catch {
      return { outcome: "key-unavailable" };
    }
    if (keyHandle === null) return { outcome: "key-unavailable" };

    try {
      const ciphertextHandle = await this.#runtimeBoundary.importCiphertext(request.ciphertext);
      if (ciphertextHandle === null) return { outcome: "failed" };

      const sealed = await this.#runtimeBoundary.decrypt(keyHandle, request.suite, FEDOS_CONVERSATION_ARCHIVE_AAD_DOMAIN, ciphertextHandle);
      if (sealed === null) return { outcome: "failed" };

      const split = splitFedosConversationArchiveHeader(sealed);
      if (split === null) return { outcome: "failed" };

      const expectedHeader = encodeFedosConversationArchiveHeader({ conversationId: request.manifest.conversationId, exportedAt: request.manifest.exportedAt });
      if (!fedosConversationArchiveHeaderBytesAreEqual(split.header, expectedHeader)) return { outcome: "manifest-mismatch" };

      const bundle = deserializeFedosConversationArchiveBundleFromBytes(split.bundleBytes);
      if (bundle === null) return { outcome: "failed" };

      const recomputedHash = computeFedosConversationArchiveContentHash(bundle);
      if (!fedosConversationArchiveContentHashesAreEqual(recomputedHash, request.manifest.contentHash)) return { outcome: "manifest-mismatch" };

      return { outcome: "decrypted", bundle };
    } catch {
      return { outcome: "failed" };
    }
  }
}
