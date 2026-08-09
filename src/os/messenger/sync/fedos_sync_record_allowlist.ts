/**
 * Secure Runtime Alpha 2921–3000 ("Device Trust and Multi-Device Runtime
 * Integration") — Sync Journal Record Allowlist (Phase G).
 *
 * A pure, standalone, ADDITIVE guard — zero modification to
 * `./fedos_sync_journal.ts`'s or `./fedos_sync_state.ts`'s existing,
 * frozen public shapes (`FedosSyncJournalEntryV1`/
 * `FedosSyncLocalChangeInput` are unchanged by this Arc). A caller
 * intending to feed a local change into `FedosSyncState.recordLocalChange()`
 * is expected to call `reviewFedosSyncRecordForJournal()` FIRST — this
 * Arc's own `../desktop/runtime/fedos_device_trust_runtime.ts` (Phase F)
 * is the one production caller that does so.
 *
 * This file names WHAT KIND of fact the Sync Journal's own opaque
 * `contentHash` may legitimately stand in for — never the fact's actual
 * bytes (which this file never sees; the Journal itself has never
 * carried plaintext or ciphertext, per its own Alpha 2421–2500 header).
 * `recordType` is a caller-supplied label describing the categorized
 * fact ahead of the existing `FedosSyncLocalChangeInput`; a
 * `recordType` outside `FEDOS_SYNC_ALLOWED_RECORD_TYPES` fails closed,
 * unconditionally, before the Journal is ever touched.
 *
 * HARD GUARDRAILS:
 *   - Pure function — no I/O, no mutation, never throws.
 *   - Unknown `recordType` values are REJECTED, never allowed by default.
 *   - Any metadata key/value carrying a sensitive marker
 *     (secret/seed/password/passphrase/private key/bearer/mnemonic/
 *     recovery phrase/plaintext) is REJECTED regardless of `recordType`.
 */

export type FedosSyncAllowedRecordType =
  | "conversation-identity-metadata"
  | "membership-metadata"
  | "capability-public-event"
  | "retention-tombstone-fact"
  | "archive-reference"
  | "search-canonical-id";

/** The complete, closed allowlist this Arc approves for synchronization. Every other candidate named in this Arc's own Phase G instruction (plaintext messages, raw Envelope payloads, Master Seed, account/Device private key, Sender-Key secret, bearer secret, passphrase) is EXPLICITLY excluded until separately reviewed. */
export const FEDOS_SYNC_ALLOWED_RECORD_TYPES: readonly FedosSyncAllowedRecordType[] = [
  "conversation-identity-metadata",
  "membership-metadata",
  "capability-public-event",
  "retention-tombstone-fact",
  "archive-reference",
  "search-canonical-id",
];

const SENSITIVE_MARKERS: readonly string[] = [
  "secret",
  "seed",
  "password",
  "passphrase",
  "recovery",
  "phrase",
  "mnemonic",
  "privatekey",
  "private_key",
  "bearer",
  "plaintext",
  "token",
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSensitiveMarkerMatch(value: string): boolean {
  const normalized = normalize(value);
  return SENSITIVE_MARKERS.some((marker) => normalized.includes(marker));
}

export function isFedosSyncRecordTypeAllowed(recordType: string): recordType is FedosSyncAllowedRecordType {
  return (FEDOS_SYNC_ALLOWED_RECORD_TYPES as readonly string[]).includes(recordType);
}

export interface FedosSyncRecordAllowlistDecision {
  readonly allowed: boolean;
  readonly reason: string;
}

/**
 * The one guard this Arc's Runtime accessor calls before ever recording
 * a local change into the Sync Journal. `metadata`, if supplied, is
 * reviewed for sensitive keys/values using the SAME conservative marker
 * family `../identity/device_trust.ts`/`../identity/device_registration.ts`
 * already established (Stage 127/128) — reused, not reinvented.
 */
export function reviewFedosSyncRecordForJournal(
  recordType: string,
  metadata?: Readonly<Record<string, string>>,
): FedosSyncRecordAllowlistDecision {
  if (!isFedosSyncRecordTypeAllowed(recordType)) {
    return { allowed: false, reason: `unknown sync record type "${recordType}" -- fails closed, not on the Phase G allowlist` };
  }
  if (metadata !== undefined) {
    for (const [key, value] of Object.entries(metadata)) {
      if (isSensitiveMarkerMatch(key) || (typeof value === "string" && isSensitiveMarkerMatch(value))) {
        return { allowed: false, reason: `sync record metadata key "${key}" contains a sensitive marker -- rejected` };
      }
    }
  }
  return { allowed: true, reason: `record type "${recordType}" is on the Phase G sync allowlist` };
}
