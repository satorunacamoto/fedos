/**
 * Secure Runtime Alpha 1691–1760 ("Conversation Archive Runtime
 * Integration and Recovery Operations Arc") — Archive File Container.
 *
 * The ONE piece of on-disk framing this Arc actually adds. The Alpha
 * 1541–1610 Archive Foundation only ever produces an in-memory
 * `FedosConversationArchiveManifestV1` (cleartext) plus an
 * `AeadCiphertextWire` (a branded, opaque `string`) — it never writes a
 * file. This module decides, and documents, the minimal honest
 * single-file layout that carries both to and from local disk:
 *
 *   [1 byte  containerSchemaVersion = 1]
 *   [4 bytes u32 BE  manifestJsonByteLength]
 *   [manifestJsonByteLength bytes  UTF-8 JSON of the cleartext Manifest]
 *   [4 bytes u32 BE  ciphertextByteLength]
 *   [ciphertextByteLength bytes  UTF-8 of the `AeadCiphertextWire` string]
 *
 * DECISION: one file, not two sibling files. A caller already chose ONE
 * destination path (`FedosConversationArchiveRuntime.exportConversationArchive()`'s
 * own request shape) — splitting into a `.manifest.json` + `.bin` pair
 * would double the exclusive-create/no-overwrite surface this Arc's own
 * File Authority (`./fedos_conversation_archive_file_authority.ts`) has
 * to guarantee atomically, for no benefit `inspectConversationArchive()`
 * needs (it already reads the WHOLE bounded file — see this module's
 * own `peekManifestSchemaVersion` for why a full read, not a partial
 * one, is still the honest choice here).
 *
 * The Manifest travels as length-prefixed JSON, NOT wrapped in the same
 * canonical byte codec the Bundle itself uses
 * (`fedos_conversation_archive_bundle_codec.ts`) — the Manifest was
 * always "cleartext, alongside the ciphertext" per the Foundation's own
 * design (`fedos_conversation_archive_encryption.ts`'s header); JSON is
 * this codebase's own existing choice for every other cleartext
 * configuration/manifest-shaped value it persists.
 *
 * `decodeFedosConversationArchiveFileContainer` performs a TWO-STAGE
 * Manifest check, deliberately: it first inspects the parsed JSON's own
 * `schemaVersion` field BEFORE handing it to
 * `deserializeFedosConversationArchiveManifest()` (Alpha 1541–1610,
 * reused unchanged) — that function fails closed to `null` for EITHER a
 * malformed manifest OR a well-formed manifest at an unsupported schema
 * version, collapsing two genuinely different outcomes
 * (`"invalid-archive"` vs `"unsupported-version"`) that
 * `FedosConversationArchiveRuntime`'s own closed result vocabulary
 * (Phase D) needs to keep apart. This module resolves that ambiguity
 * ONCE, here, rather than duplicating the peek logic in the Runtime.
 *
 * HARD GUARDRAILS:
 *   - Pure, synchronous, deterministic.
 *   - Fails closed to `null` for any malformed/truncated container --
 *     never throws.
 *   - No plaintext bundle content ever appears here -- the ciphertext
 *     bytes this module frames are already sealed by the caller.
 */

import { FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION } from "../fedos_conversation_archive_schema_version.js";
import { deserializeFedosConversationArchiveManifest } from "../fedos_conversation_archive_manifest_codec.js";
import type { FedosConversationArchiveManifestV1 } from "../fedos_conversation_archive_manifest.js";
import type { AeadCiphertextWire } from "../../../../core/vault/wasm/fedos_wasm_loader.js";

const CONTAINER_SCHEMA_VERSION_BYTE = 1;

function encodeUint32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, false);
  return out;
}

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Deterministic on-disk encoding of one Manifest + one sealed ciphertext -- see this file's own header for the exact wire layout. */
export function encodeFedosConversationArchiveFileContainer(
  manifest: FedosConversationArchiveManifestV1,
  ciphertext: AeadCiphertextWire,
): Uint8Array {
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  const ciphertextBytes = new TextEncoder().encode(ciphertext);
  return concatBytes([
    new Uint8Array([CONTAINER_SCHEMA_VERSION_BYTE]),
    encodeUint32(manifestBytes.length),
    manifestBytes,
    encodeUint32(ciphertextBytes.length),
    ciphertextBytes,
  ]);
}

export type FedosConversationArchiveFileContainerDecodeResult =
  | { readonly outcome: "decoded"; readonly manifest: FedosConversationArchiveManifestV1; readonly ciphertext: AeadCiphertextWire }
  | { readonly outcome: "malformed" }
  | { readonly outcome: "unsupported-version" };

/**
 * Splits+validates a container's bytes back into a Manifest and
 * ciphertext. Never throws. Returns `"unsupported-version"` specifically
 * when the embedded Manifest JSON parses and structurally has a
 * `schemaVersion` field, but that value is not the one this build
 * supports -- every OTHER failure (truncated container, non-JSON
 * manifest bytes, a Manifest missing/misshaping any other field) is
 * `"malformed"`.
 */
export function decodeFedosConversationArchiveFileContainer(bytes: Uint8Array): FedosConversationArchiveFileContainerDecodeResult {
  if (bytes.length < 1) return { outcome: "malformed" };
  if (bytes[0] !== CONTAINER_SCHEMA_VERSION_BYTE) return { outcome: "malformed" };
  if (bytes.length < 5) return { outcome: "malformed" };

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const manifestByteLength = view.getUint32(1, false);
  const manifestStart = 5;
  const manifestEnd = manifestStart + manifestByteLength;
  if (manifestByteLength < 0 || bytes.length < manifestEnd + 4) return { outcome: "malformed" };

  let manifestRaw: unknown;
  try {
    manifestRaw = JSON.parse(new TextDecoder().decode(bytes.slice(manifestStart, manifestEnd)));
  } catch {
    return { outcome: "malformed" };
  }

  if (manifestRaw !== null && typeof manifestRaw === "object" && "schemaVersion" in manifestRaw) {
    const rawSchemaVersion = (manifestRaw as { schemaVersion: unknown }).schemaVersion;
    if (typeof rawSchemaVersion === "number" && rawSchemaVersion !== FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION) {
      return { outcome: "unsupported-version" };
    }
  }

  const manifest = deserializeFedosConversationArchiveManifest(manifestRaw);
  if (manifest === null) return { outcome: "malformed" };

  const ciphertextLengthOffset = manifestEnd;
  const ciphertextByteLength = view.getUint32(ciphertextLengthOffset, false);
  const ciphertextStart = ciphertextLengthOffset + 4;
  const ciphertextEnd = ciphertextStart + ciphertextByteLength;
  if (ciphertextByteLength < 0 || bytes.length < ciphertextEnd) return { outcome: "malformed" };

  const ciphertext = new TextDecoder().decode(bytes.slice(ciphertextStart, ciphertextEnd)) as AeadCiphertextWire;
  return { outcome: "decoded", manifest, ciphertext };
}
