/**
 * Secure Runtime Alpha 1541–1610 ("Conversation Export, Restore, Archive
 * Foundation") — Archive Integrity.
 *
 * Binds a `FedosConversationArchiveManifestV1` (which travels in the
 * CLEAR — see `fedos_conversation_archive_encryption.ts`'s own header
 * for why a Manifest is never itself AEAD-protected) to the exact
 * plaintext bundle bytes it describes: `contentHash` is a SHA-256 hex
 * digest over `serializeFedosConversationArchiveBundleToBytes(bundle)`'s
 * own canonical, deterministic output. On Import, the decrypted bundle
 * is re-hashed and compared against the Manifest's own claimed
 * `contentHash` — a mismatch means the cleartext Manifest does not
 * actually describe the plaintext AEAD decryption just recovered
 * (`fedos_conversation_archive_encryption.ts`'s own
 * `"manifest-mismatch"` outcome), independent of and in addition to
 * AEAD's own authentication tag over the sealed blob itself.
 *
 * Uses `@noble/hashes` — already one of this repository's exactly two
 * production dependencies, and already used elsewhere in this codebase
 * for SHA-256 (`src/desktop/nostr_event_id_verifier.ts`,
 * `src/nostr/noble_signature.ts`) — never a new dependency, never a
 * Rust/WASM round trip for a value that is not secret-derived and needs
 * no constant-time comparison (`contentHash` is a hash of already-
 * exported plaintext data, not key material).
 *
 * HARD GUARDRAILS:
 *   - Pure, deterministic, synchronous.
 *   - Plain string equality for `fedosConversationArchiveContentHashesAreEqual`
 *     — no timing-attack sensitivity, mirrors every other structural
 *     equality helper in this codebase (`fedosPersistedConversationRecordsAreEqual`,
 *     etc.), never key/secret comparison.
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { FedosConversationArchiveBundleV1 } from "./fedos_conversation_archive_bundle.js";
import { serializeFedosConversationArchiveBundleToBytes } from "./fedos_conversation_archive_bundle_codec.js";

/** SHA-256 hex digest over `bundle`'s own canonical byte encoding. */
export function computeFedosConversationArchiveContentHash(bundle: FedosConversationArchiveBundleV1): string {
  return bytesToHex(sha256(serializeFedosConversationArchiveBundleToBytes(bundle)));
}

export function fedosConversationArchiveContentHashesAreEqual(a: string, b: string): boolean {
  return a === b;
}
