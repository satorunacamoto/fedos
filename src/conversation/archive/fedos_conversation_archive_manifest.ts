/**
 * Secure Runtime Alpha 1541–1610 ("Conversation Export, Restore, Archive
 * Foundation") — Archive Manifest V1.
 *
 * The CLEARTEXT companion to an Encrypted Export's sealed ciphertext —
 * mirrors the Sealed Master Seed Envelope's own "cost params travel
 * WITH the envelope so restore always re-derives correctly" precedent
 * (Alpha 435): a caller can inspect record counts and decide whether an
 * Archive is worth importing WITHOUT decrypting it first, and Duplicate
 * Detection (`fedos_conversation_archive_duplicate_detection.ts`) can
 * run its own preflight report before ever touching key material.
 *
 * Every field a plain `string`/`number` — no nested object, matching
 * `FedosPersistedConversationMembershipV1`'s own flattening discipline
 * (Alpha 825) and every other persisted wire shape in this codebase.
 *
 * `contentHash` binds this cleartext Manifest to the exact encrypted
 * plaintext it describes — see `fedos_conversation_archive_integrity.ts`.
 *
 * HARD GUARDRAILS:
 *   - `schemaVersion` is the literal numeric type `1`
 *     (`FedosConversationArchiveSchemaVersion`).
 *   - No key material, no ciphertext, no bearer secret, no plaintext
 *     message content of any kind — record COUNTS only.
 *   - This file defines a TYPE ONLY — no function, no class.
 */

import type { FedosConversationArchiveSchemaVersion } from "./fedos_conversation_archive_schema_version.js";

export interface FedosConversationArchiveManifestV1 {
  readonly schemaVersion: FedosConversationArchiveSchemaVersion;
  readonly conversationId: string;
  readonly exportedAt: number;
  readonly membershipCount: number;
  readonly capabilityEventCount: number;
  readonly envelopeCount: number;
  readonly payloadCount: number;
  readonly contentHash: string;
}
