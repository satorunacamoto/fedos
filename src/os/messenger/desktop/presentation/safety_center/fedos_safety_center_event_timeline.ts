/**
 * Secure Runtime Alpha 6201-6280 (FedOS Desktop Beta Privacy Controls and
 * Safety Center Arc) — Phase E: a bounded, safe, chronological projection
 * composed ENTIRELY from already-real, already-durable per-domain facts the
 * Controller gathers (Device Trust, Identity Transition, Deletion Request).
 * No cross-cutting audit log exists anywhere in this codebase (confirmed by
 * this Arc's own inventory) — this file is the first, and it invents no new
 * persistence of its own: every entry here is a pure re-projection of a fact
 * some OTHER domain already durably recorded.
 *
 * No message plaintext, no raw signature, no filesystem path, ever.
 */

export type FedosSafetyCenterEventCategory =
  | "device-registered"
  | "device-trusted"
  | "device-revoked"
  | "identity-replacement-observed"
  | "identity-replacement-accepted"
  | "identity-replacement-rejected"
  | "identity-replacement-conflicting"
  | "deletion-request-received"
  | "deletion-request-approved"
  | "deletion-request-rejected"
  | "deletion-request-partial";

export interface FedosSafetyCenterEventV1 {
  readonly category: FedosSafetyCenterEventCategory;
  readonly at: number;
  /** A short, closed, safe subject reference (an opaque id/ref) — never a raw path, key, or message body. */
  readonly subjectRef: string;
}

export const FEDOS_SAFETY_CENTER_EVENT_TIMELINE_MAX_ITEMS = 200;

/** Pure, total, never throws. Sorts newest-first, then truncates to the bound — mirrors `fedosIdentityTransitionSortInboxItems`/`fedosDeletionRequestSortInboxItems`'s own established discipline. */
export function fedosSafetyCenterBuildEventTimeline(events: readonly FedosSafetyCenterEventV1[], limit = FEDOS_SAFETY_CENTER_EVENT_TIMELINE_MAX_ITEMS, offset = 0): readonly FedosSafetyCenterEventV1[] {
  const sorted = [...events].sort((a, b) => b.at - a.at);
  const boundedLimit = Math.max(0, Math.min(limit, FEDOS_SAFETY_CENTER_EVENT_TIMELINE_MAX_ITEMS));
  const boundedOffset = Math.max(0, offset);
  return sorted.slice(boundedOffset, boundedOffset + boundedLimit);
}
