/**
 * Secure Runtime Alpha 7081-7160 — the durable, restart-safe record of
 * one INBOUND invitation this local Device has processed. Mirrors
 * `fedos_ratchet_peer_capability_observation.ts`'s own "keyed fact,
 * insert-only, no delete" discipline, narrowed to what a one-time
 * invitation actually needs — no evidence-level tier, no supersession,
 * no lifecycle-fact union (this Arc's own narrower scope).
 *
 * Exists so a duplicate delivery of the SAME invitation (a real,
 * expected Relay behavior — see Phase F/I of the immediately-prior Arc)
 * is idempotent: the second delivery is recognized by its own `nonce`
 * and produces no second Membership admission attempt, no second
 * `reactivateRestoredConversation()` call.
 */
import type { FedosConversationParticipantReference } from "../../../../conversation/membership/fedos_conversation_participant_reference.js";

export interface FedosConversationInvitationReceivedRecordV1 {
  readonly schemaVersion: 1;
  /** Which LOCAL Device recorded this — mirrors Peer Capability's own multi-device-isolation field. */
  readonly localDeviceRef: string;
  readonly conversationId: string;
  readonly inviter: FedosConversationParticipantReference;
  readonly invitee: FedosConversationParticipantReference;
  /** The advertisement's own `nonce` — this record's own uniqueness key alongside `localDeviceRef`/`conversationId`. */
  readonly nonce: string;
  readonly acceptedAt: number;
}

/** Deterministic, order-stable key — one row per (local Device, conversationId, nonce). */
export function fedosConversationInvitationReceivedRecordKey(record: FedosConversationInvitationReceivedRecordV1): string {
  return JSON.stringify([record.localDeviceRef, record.conversationId, record.nonce]);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isWellFormedParticipant(candidate: unknown): candidate is FedosConversationParticipantReference {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== 3 || !keys.includes("authority") || !keys.includes("publicIdentifier") || !keys.includes("identityId")) return false;
  const r = candidate as Record<string, unknown>;
  return isNonEmptyString(r.authority) && isNonEmptyString(r.publicIdentifier) && (r.identityId === null || isNonEmptyString(r.identityId));
}

/**
 * Structural equality over every IDENTITY field — used to decide
 * `"already-present"` (idempotent replay) vs `"conflict"` for a duplicate
 * key. Deliberately EXCLUDES `acceptedAt`: that field records "when THIS
 * local Device first accepted the fact," re-derived fresh on every
 * import attempt (including a genuinely idempotent redelivery received
 * after a real time gap, e.g. after a restart) — it is not part of the
 * invitation's own identity, which is already fully captured by
 * `(localDeviceRef, conversationId, nonce, inviter, invitee)`. Including
 * it here would misclassify a genuine duplicate redelivery, arriving at
 * a different wall-clock moment than the original, as a fabricated
 * "conflict" — a real bug this Arc's own restart-safety vertical slice
 * caught and fixed.
 */
export function fedosConversationInvitationReceivedRecordsAreEqual(
  a: FedosConversationInvitationReceivedRecordV1,
  b: FedosConversationInvitationReceivedRecordV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.localDeviceRef === b.localDeviceRef &&
    a.conversationId === b.conversationId &&
    a.inviter.authority === b.inviter.authority &&
    a.inviter.publicIdentifier === b.inviter.publicIdentifier &&
    a.inviter.identityId === b.inviter.identityId &&
    a.invitee.authority === b.invitee.authority &&
    a.invitee.publicIdentifier === b.invitee.publicIdentifier &&
    a.invitee.identityId === b.invitee.identityId &&
    a.nonce === b.nonce
  );
}

const ALL_KNOWN_FIELDS = new Set<string>(["schemaVersion", "localDeviceRef", "conversationId", "inviter", "invitee", "nonce", "acceptedAt"]);

/** Structural validation only. Fails closed; never throws. */
export function isWellFormedFedosConversationInvitationReceivedRecordV1(candidate: unknown): candidate is FedosConversationInvitationReceivedRecordV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== ALL_KNOWN_FIELDS.size || !keys.every((k) => ALL_KNOWN_FIELDS.has(k))) return false;
  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== 1) return false;
  if (!isNonEmptyString(r.localDeviceRef)) return false;
  if (!isNonEmptyString(r.conversationId)) return false;
  if (!isWellFormedParticipant(r.inviter)) return false;
  if (!isWellFormedParticipant(r.invitee)) return false;
  if (!isNonEmptyString(r.nonce)) return false;
  if (typeof r.acceptedAt !== "number" || !Number.isFinite(r.acceptedAt)) return false;
  return true;
}
