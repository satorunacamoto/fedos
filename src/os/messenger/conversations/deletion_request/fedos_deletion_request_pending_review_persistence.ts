/**
 * Secure Runtime Alpha 6201-6280 (FedOS Desktop Beta Privacy Controls and
 * Safety Center Arc) — Phase D: the one remaining bounded gap named in the
 * prior audit of `6041-6120`/`50f80e8` (see this Arc's own
 * `docs/secure_runtime_alpha_6201_6280_pending_review_durability.md`).
 *
 * `FedosDeletionRequestInboundCoordinator`'s own `#pendingReviewCache`
 * (`fedos_deletion_request_inbound_coordinator.ts`) holds a `"policy-pending"`
 * request's real signed body IN MEMORY ONLY — a restart before the human
 * approves/rejects an `"always-review"` item makes it `"unknown-request"`
 * until the sender's own safe, idempotent redelivery. This file is a NEW,
 * OPTIONAL, ADDITIVE durable side-channel for that exact cache — it does
 * not touch `5641-5720`'s frozen decision-state persistence, does not
 * change the request/policy/execution protocol in any way, and does not
 * widen what any policy grants. It stores nothing beyond what the Inbound
 * Coordinator already held in memory: the already-verified
 * `FedosSignedDeletionRequestV1` (structured request metadata + its own
 * Nostr signature envelope) — never the target message's own plaintext,
 * never a private key, never an arbitrary filesystem path (the log file
 * path is a fixed constructor argument, mirroring every other append-only
 * store in this codebase).
 *
 * Tombstone-based logical delete (never a byte-level rewrite) — mirrors
 * this domain's own established "insert-only NDJSON, replay on read"
 * discipline exactly, extended with the one additional log-entry kind a
 * consumable (as opposed to purely additive) fact needs.
 */
import { isWellFormedFedosDeletionRequestRecordV1 } from "../../../../conversation/deletion_request/fedos_deletion_request_record.js";
import type { FedosNostrWireEvent } from "../../../../desktop/fedos_nostr_wire_event.js";
import type { FedosSignedDeletionRequestV1 } from "../../../../conversation/deletion_request/fedos_deletion_request_signing.js";
import { isFedosDeletionRequestId } from "../../../../conversation/deletion_request/fedos_deletion_request_id.js";

/** A concrete resource limit — this is a SMALL, transient review queue (a human's own pending inbox), never an unbounded audit log. */
export const FEDOS_DELETION_REQUEST_PENDING_REVIEW_MAX_LIVE_ENTRIES = 500;

export type FedosDeletionRequestPendingReviewLogEntryV1 =
  | { readonly schemaVersion: 1; readonly requestId: string; readonly action: "put"; readonly signed: FedosSignedDeletionRequestV1; readonly recordedAt: number }
  | { readonly schemaVersion: 1; readonly requestId: string; readonly action: "tombstone"; readonly recordedAt: number };

const PUT_FIELDS = new Set(["schemaVersion", "requestId", "action", "signed", "recordedAt"]);
const TOMBSTONE_FIELDS = new Set(["schemaVersion", "requestId", "action", "recordedAt"]);
const SIGNED_FIELDS = new Set(["record", "wireEvent"]);

/** Structural-only shape check (never cryptographic — verification already ran before this ever reached the pending-review cache) — duplicates `fedos_deletion_request_control_payload.ts`'s own private NIP-01 shape checker exactly, matching this codebase's own established "duplicate this tiny, closed, stable shape check across independent boundaries" convention. */
function isWellFormedFedosNostrWireEventShape(candidate: unknown): candidate is FedosNostrWireEvent {
  if (typeof candidate !== "object" || candidate === null) return false;
  const e = candidate as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.pubkey === "string" &&
    typeof e.created_at === "number" &&
    typeof e.kind === "number" &&
    Array.isArray(e.tags) &&
    e.tags.every((tag) => Array.isArray(tag) && tag.every((t) => typeof t === "string")) &&
    typeof e.content === "string" &&
    typeof e.sig === "string"
  );
}

function isWellFormedSignedRequestShape(candidate: unknown): candidate is FedosSignedDeletionRequestV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const r = candidate as Record<string, unknown>;
  const keys = Object.keys(r);
  if (keys.length !== SIGNED_FIELDS.size || !keys.every((k) => SIGNED_FIELDS.has(k))) return false;
  return isWellFormedFedosDeletionRequestRecordV1(r.record) && isWellFormedFedosNostrWireEventShape(r.wireEvent);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** Total, never-throwing structural classifier — an unrecognized `action`, unknown/extra field, or malformed nested shape fails closed to `false`. */
export function isWellFormedFedosDeletionRequestPendingReviewLogEntryV1(candidate: unknown): candidate is FedosDeletionRequestPendingReviewLogEntryV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== 1) return false;
  if (!isFedosDeletionRequestId(r.requestId)) return false;
  if (!isNonNegativeInteger(r.recordedAt)) return false;
  if (r.action === "put") {
    const keys = Object.keys(r);
    if (keys.length !== PUT_FIELDS.size || !keys.every((k) => PUT_FIELDS.has(k))) return false;
    return isWellFormedSignedRequestShape(r.signed);
  }
  if (r.action === "tombstone") {
    const keys = Object.keys(r);
    return keys.length === TOMBSTONE_FIELDS.size && keys.every((k) => TOMBSTONE_FIELDS.has(k));
  }
  return false;
}

export type FedosDeletionRequestPendingReviewWriteResult = "inserted" | "already-present" | "conflict" | "failed" | "resource-limit-exceeded";

export interface FedosDeletionRequestPendingReviewPersistence {
  /** `already-present` for a byte-identical re-`put` of a still-live entry (safe redelivery); `conflict` for a different body under the same `requestId`, or a `put` for a `requestId` this store already tombstoned (a stale/late redelivery after the human already decided — never resurrected). */
  putPendingReview(requestId: string, signed: FedosSignedDeletionRequestV1, recordedAt: number): FedosDeletionRequestPendingReviewWriteResult;
  getPendingReview(requestId: string): FedosSignedDeletionRequestV1 | null;
  /** Idempotent — tombstoning an already-tombstoned or never-seen `requestId` is a safe no-op. */
  tombstonePendingReview(requestId: string, recordedAt: number): void;
}

function signedEqual(a: FedosSignedDeletionRequestV1, b: FedosSignedDeletionRequestV1): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface ReplayedState {
  readonly live: ReadonlyMap<string, FedosSignedDeletionRequestV1>;
  readonly everSeen: ReadonlySet<string>;
}

function replayEntries(entries: readonly FedosDeletionRequestPendingReviewLogEntryV1[]): ReplayedState {
  const live = new Map<string, FedosSignedDeletionRequestV1>();
  const everSeen = new Set<string>();
  for (const entry of entries) {
    everSeen.add(entry.requestId);
    if (entry.action === "put") live.set(entry.requestId, entry.signed);
    else live.delete(entry.requestId);
  }
  return { live, everSeen };
}

function evaluatePendingReviewPut(
  state: ReplayedState,
  requestId: string,
  signed: FedosSignedDeletionRequestV1,
): FedosDeletionRequestPendingReviewWriteResult {
  const existingLive = state.live.get(requestId);
  if (existingLive !== undefined) return signedEqual(existingLive, signed) ? "already-present" : "conflict";
  if (state.everSeen.has(requestId)) return "conflict"; // already tombstoned once — never resurrected.
  if (state.live.size >= FEDOS_DELETION_REQUEST_PENDING_REVIEW_MAX_LIVE_ENTRIES) return "resource-limit-exceeded";
  return "inserted";
}

/** In-memory backend — tests and any caller that does not need cross-restart durability. */
export class InMemoryFedosDeletionRequestPendingReviewPersistence implements FedosDeletionRequestPendingReviewPersistence {
  #entries: FedosDeletionRequestPendingReviewLogEntryV1[] = [];

  putPendingReview(requestId: string, signed: FedosSignedDeletionRequestV1, recordedAt: number): FedosDeletionRequestPendingReviewWriteResult {
    const state = replayEntries(this.#entries);
    const outcome = evaluatePendingReviewPut(state, requestId, signed);
    if (outcome === "inserted") this.#entries.push({ schemaVersion: 1, requestId, action: "put", signed, recordedAt });
    return outcome;
  }
  getPendingReview(requestId: string): FedosSignedDeletionRequestV1 | null {
    return replayEntries(this.#entries).live.get(requestId) ?? null;
  }
  tombstonePendingReview(requestId: string, recordedAt: number): void {
    this.#entries.push({ schemaVersion: 1, requestId, action: "tombstone", recordedAt });
  }
}

export function evaluateFedosDeletionRequestPendingReviewPut(
  entries: readonly FedosDeletionRequestPendingReviewLogEntryV1[],
  requestId: string,
  signed: FedosSignedDeletionRequestV1,
): FedosDeletionRequestPendingReviewWriteResult {
  return evaluatePendingReviewPut(replayEntries(entries), requestId, signed);
}

export function replayFedosDeletionRequestPendingReviewLog(entries: readonly FedosDeletionRequestPendingReviewLogEntryV1[]): ReadonlyMap<string, FedosSignedDeletionRequestV1> {
  return replayEntries(entries).live;
}
