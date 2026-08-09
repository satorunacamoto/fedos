/**
 * Secure Runtime Alpha 1426/1427 ("Local Import Record" / "Duplicate
 * Detection") — Phase D of the Alpha 1391–1470 Nostr Private Direct and
 * Pairwise Fanout Delivery Arc.
 *
 * The SMALLEST local transport-provenance fact: which Nostr transport
 * event id was already imported, and into which local canonical
 * Envelope. Keyed by the transport event's own deterministic NIP-01 `id`
 * — receiving the identical event from two different Relays (or the same
 * Relay twice) always resolves to the SAME key, so a second delivery
 * attempt is recognized as a duplicate BEFORE any second decrypt or
 * second local Envelope write happens (Alpha 1427's own "never trust
 * Relay identity for deduplication" — the NIP-01 event id is signed,
 * intrinsic wire identity, never a Relay-supplied token).
 *
 * No plaintext of any kind lives here — `relaySource` is untrusted
 * observation only (Alpha 1421: never a canonical Conversation fact).
 */

const MAX_ID_FIELD_LENGTH = 512;

export type FedosPrivateNostrImportResult = "imported" | "duplicate";

export interface FedosPrivateNostrImportRecord {
  readonly nostrEventId: string;
  readonly conversationId: string;
  readonly envelopeId: string;
  readonly relaySource: string | null;
  readonly receivedAt: number;
  readonly importResult: FedosPrivateNostrImportResult;
}

function isSafeIdField(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_FIELD_LENGTH;
}

/** Fails closed to `null` on any invalid field — never throws. */
export function createFedosPrivateNostrImportRecord(input: {
  readonly nostrEventId: string;
  readonly conversationId: string;
  readonly envelopeId: string;
  readonly relaySource: string | null;
  readonly receivedAt: number;
  readonly importResult: FedosPrivateNostrImportResult;
}): FedosPrivateNostrImportRecord | null {
  if (!isSafeIdField(input.nostrEventId)) return null;
  if (!isSafeIdField(input.conversationId)) return null;
  if (!isSafeIdField(input.envelopeId)) return null;
  if (input.relaySource !== null && typeof input.relaySource !== "string") return null;
  if (!Number.isInteger(input.receivedAt) || input.receivedAt < 0) return null;
  if (input.importResult !== "imported" && input.importResult !== "duplicate") return null;

  return Object.freeze({
    nostrEventId: input.nostrEventId,
    conversationId: input.conversationId,
    envelopeId: input.envelopeId,
    relaySource: input.relaySource,
    receivedAt: input.receivedAt,
    importResult: input.importResult,
  });
}

export type FedosPrivateNostrImportRecordPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosPrivateNostrImportRecordPersistence {
  putImportFact(record: FedosPrivateNostrImportRecord): FedosPrivateNostrImportRecordPersistenceWriteResult;
  getImport(nostrEventId: string): FedosPrivateNostrImportRecord | null;
}

export function fedosPrivateNostrImportRecordsAreEqual(
  a: FedosPrivateNostrImportRecord,
  b: FedosPrivateNostrImportRecord,
): boolean {
  return (
    a.nostrEventId === b.nostrEventId &&
    a.conversationId === b.conversationId &&
    a.envelopeId === b.envelopeId &&
    a.relaySource === b.relaySource &&
    a.receivedAt === b.receivedAt &&
    a.importResult === b.importResult
  );
}
