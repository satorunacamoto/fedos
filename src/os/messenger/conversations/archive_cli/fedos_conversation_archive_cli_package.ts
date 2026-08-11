/**
 * Secure Runtime Alpha 2341–2420 ("Conversation Archive CLI and User
 * Packaging") — CLI Package V1.
 *
 * The on-disk/wire shape a CLI-level caller actually handles: a
 * `FedosConversationArchiveManifestV1` (Alpha 1541–1610, unchanged —
 * already travels in the clear) paired with the `AeadCiphertextWire`
 * (`../../runtime/fedos_wasm_loader.ts`) that
 * `FedosWasmConversationArchiveEncryptionAuthority.export()` already
 * returns alongside it. This file adds NO new field to either reused
 * type — it only names the pairing as one addressable unit ("single
 * archive" packaging) and, separately, an array of that unit ("multiple
 * archive bundle" packaging).
 *
 * `formatVersion` versions THIS packaging shape only — it is
 * independent of, and never conflated with, `manifest.schemaVersion`
 * (`FedosConversationArchiveSchemaVersion`, Alpha 1541–1610's own
 * Archive wire-format version). A future CLI packaging change (e.g. a
 * new metadata field alongside the manifest) bumps `formatVersion`
 * without ever touching the frozen Archive schema itself.
 *
 * HARD GUARDRAILS:
 *   - No key material, no plaintext bundle content — a Package carries
 *     only what Export already hands a caller: a cleartext Manifest and
 *     an opaque ciphertext wire string.
 *   - This file defines types/constants ONLY — no function, no class.
 */

import type { FedosConversationArchiveManifestV1 } from "../archive/fedos_conversation_archive_manifest.js";
import type { AeadCiphertextWire } from "../../../core/vault/wasm/fedos_wasm_loader.js";

export const FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION = 1 as const;

export type FedosConversationArchiveCliPackageFormatVersion = typeof FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION;

/** One conversation's Encrypted Export, packaged for a CLI-level caller — "single archive". */
export interface FedosConversationArchiveCliPackageV1 {
  readonly formatVersion: FedosConversationArchiveCliPackageFormatVersion;
  readonly manifest: FedosConversationArchiveManifestV1;
  readonly ciphertext: AeadCiphertextWire;
}

/** Many Packages addressed as one unit — "multiple archive bundle". Never itself re-encrypted; each nested Package already carries its own ciphertext. */
export interface FedosConversationArchiveCliMultiPackageV1 {
  readonly formatVersion: FedosConversationArchiveCliPackageFormatVersion;
  readonly packages: readonly FedosConversationArchiveCliPackageV1[];
}
