/**
 * Secure Runtime Alpha 2341–2420 ("Conversation Archive CLI and User
 * Packaging") — CLI Package Codec.
 *
 * Converts a `FedosConversationArchiveCliPackageV1`/
 * `FedosConversationArchiveCliMultiPackageV1` (`./fedos_conversation_archive_cli_package.ts`)
 * to/from the canonical byte form this Arc's file-system layer
 * (`./fedos_conversation_archive_cli_file_system.ts`) reads and writes.
 * Mirrors `fedos_conversation_archive_bundle_codec.ts`'s own
 * "coarse, structural validation only, fail closed to `null`, never
 * throws" discipline (Alpha 1541–1610) exactly — deep validation of the
 * nested Manifest is delegated ENTIRELY to the Manifest's own EXISTING
 * `deserializeFedosConversationArchiveManifest`, never re-implemented
 * here.
 *
 * HARD GUARDRAILS:
 *   - Every decode fails closed: `null` for anything malformed, never
 *     throws.
 *   - `formatVersion` checked EXACTLY against
 *     `FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION` — no
 *     silent migration.
 *   - Unknown top-level fields are REJECTED, at both the single-Package
 *     and the multi-Package level.
 *   - Pure, deterministic, synchronous.
 */

import { deserializeFedosConversationArchiveManifest } from "../archive/fedos_conversation_archive_manifest_codec.js";
import type {
  FedosConversationArchiveCliMultiPackageV1,
  FedosConversationArchiveCliPackageV1,
} from "./fedos_conversation_archive_cli_package.js";
import { FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION } from "./fedos_conversation_archive_cli_package.js";
import type { AeadCiphertextWire } from "../../../core/vault/wasm/fedos_wasm_loader.js";

const PACKAGE_TOP_LEVEL_KEYS: ReadonlySet<string> = new Set(["formatVersion", "manifest", "ciphertext"]);
const MULTI_PACKAGE_TOP_LEVEL_KEYS: ReadonlySet<string> = new Set(["formatVersion", "packages"]);

function decodePackageObject(record: unknown): FedosConversationArchiveCliPackageV1 | null {
  if (record === null || typeof record !== "object") return null;
  const keys = Object.keys(record);
  if (!keys.every((key) => PACKAGE_TOP_LEVEL_KEYS.has(key)) || keys.length !== PACKAGE_TOP_LEVEL_KEYS.size) return null;

  const { formatVersion, manifest, ciphertext } = record as { formatVersion: unknown; manifest: unknown; ciphertext: unknown };
  if (formatVersion !== FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION) return null;
  if (typeof ciphertext !== "string" || ciphertext.length === 0) return null;

  const decodedManifest = deserializeFedosConversationArchiveManifest(manifest);
  if (decodedManifest === null) return null;

  return { formatVersion: FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION, manifest: decodedManifest, ciphertext: ciphertext as AeadCiphertextWire };
}

function packageToCanonicalObject(pkg: FedosConversationArchiveCliPackageV1): Record<string, unknown> {
  return { formatVersion: pkg.formatVersion, manifest: pkg.manifest, ciphertext: pkg.ciphertext };
}

/** Canonical byte encoding of one Package — "single archive" packaging. */
export function serializeFedosConversationArchiveCliPackageToBytes(pkg: FedosConversationArchiveCliPackageV1): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(packageToCanonicalObject(pkg)));
}

/** Fails closed to `null` for anything malformed, unrecognized-format, or corrupt. Never throws. */
export function deserializeFedosConversationArchiveCliPackageFromBytes(bytes: Uint8Array): FedosConversationArchiveCliPackageV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  return decodePackageObject(parsed);
}

/** Canonical byte encoding of many Packages as one unit — "multiple archive bundle" packaging. */
export function serializeFedosConversationArchiveCliMultiPackageToBytes(multi: FedosConversationArchiveCliMultiPackageV1): Uint8Array {
  const canonical = { formatVersion: multi.formatVersion, packages: multi.packages.map(packageToCanonicalObject) };
  return new TextEncoder().encode(JSON.stringify(canonical));
}

/** Fails closed to `null` if the top-level shape is malformed OR if ANY nested Package fails to decode — a "multiple archive bundle" is all-or-nothing, never partially decoded. Never throws. */
export function deserializeFedosConversationArchiveCliMultiPackageFromBytes(bytes: Uint8Array): FedosConversationArchiveCliMultiPackageV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object") return null;
  const keys = Object.keys(parsed);
  if (!keys.every((key) => MULTI_PACKAGE_TOP_LEVEL_KEYS.has(key)) || keys.length !== MULTI_PACKAGE_TOP_LEVEL_KEYS.size) return null;

  const { formatVersion, packages } = parsed as { formatVersion: unknown; packages: unknown };
  if (formatVersion !== FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION) return null;
  if (!Array.isArray(packages)) return null;

  const decoded: FedosConversationArchiveCliPackageV1[] = [];
  for (const raw of packages) {
    const one = decodePackageObject(raw);
    if (one === null) return null;
    decoded.push(one);
  }

  return { formatVersion: FEDOS_CONVERSATION_ARCHIVE_CLI_PACKAGE_FORMAT_VERSION, packages: decoded };
}
