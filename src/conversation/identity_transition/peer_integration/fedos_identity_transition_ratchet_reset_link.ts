/**
 * Secure Runtime Alpha 5961–6040 — Phase J's own scope decision (see the
 * reconciliation report): rather than widening
 * `FedosDirectRatchetSessionResetSignableContent`'s frozen, fixed-position
 * canonical array (which would change the signed digest shape for a wire
 * message type several prior Arcs already built real, passing tests
 * against), `transitionId` is bound to the resulting Ratchet session via
 * this SEPARATE, additive, durable LOCAL correlation fact instead. The
 * wire message itself still carries the real, authentic `resetReason:
 * "identity-transition"` (see `../../ratchet/fedos_direct_ratchet_session_reset_reason.ts`);
 * this record is purely a local audit/query convenience layered on top.
 *
 * No secrets — a public correlation fact only.
 */
import type { FedosDeviceBindingAccountRef } from "../../../device/fedos_device_binding.js";
import { isWellFormedFedosIdentityTransitionId } from "../fedos_identity_transition_id.js";
import { FEDOS_IDENTITY_TRANSITION_MAX_IDENTIFIER_LENGTH } from "../fedos_identity_transition_id_limits.js";

export interface FedosIdentityTransitionRatchetResetLinkV1 {
  readonly schemaVersion: 1;
  readonly transitionId: string;
  readonly sessionId: string;
  readonly conversationId: string;
  readonly remoteAccountRef: FedosDeviceBindingAccountRef;
  readonly remoteDeviceRef: string;
  readonly recordedAt: number;
}

export function fedosIdentityTransitionRatchetResetLinkKey(link: FedosIdentityTransitionRatchetResetLinkV1): string {
  return JSON.stringify([link.transitionId, link.sessionId]);
}

function accountRefsEqual(a: FedosDeviceBindingAccountRef, b: FedosDeviceBindingAccountRef): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier && a.identityId === b.identityId;
}

export function fedosIdentityTransitionRatchetResetLinksAreEqual(
  a: FedosIdentityTransitionRatchetResetLinkV1,
  b: FedosIdentityTransitionRatchetResetLinkV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.transitionId === b.transitionId &&
    a.sessionId === b.sessionId &&
    a.conversationId === b.conversationId &&
    accountRefsEqual(a.remoteAccountRef, b.remoteAccountRef) &&
    a.remoteDeviceRef === b.remoteDeviceRef &&
    a.recordedAt === b.recordedAt
  );
}

function isNonEmptyBoundedString(value: unknown, maxLength = FEDOS_IDENTITY_TRANSITION_MAX_IDENTIFIER_LENGTH): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isWellFormedAccountRef(candidate: unknown): candidate is FedosDeviceBindingAccountRef {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== 3 || !keys.includes("authority") || !keys.includes("publicIdentifier") || !keys.includes("identityId")) return false;
  const r = candidate as Record<string, unknown>;
  return isNonEmptyBoundedString(r.authority) && isNonEmptyBoundedString(r.publicIdentifier) && (r.identityId === null || isNonEmptyBoundedString(r.identityId));
}

const ALL_KNOWN_FIELDS = new Set<string>(["schemaVersion", "transitionId", "sessionId", "conversationId", "remoteAccountRef", "remoteDeviceRef", "recordedAt"]);

export function isWellFormedFedosIdentityTransitionRatchetResetLinkV1(candidate: unknown): candidate is FedosIdentityTransitionRatchetResetLinkV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== ALL_KNOWN_FIELDS.size || !keys.every((k) => ALL_KNOWN_FIELDS.has(k))) return false;
  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== 1) return false;
  if (!isWellFormedFedosIdentityTransitionId(r.transitionId)) return false;
  if (!isNonEmptyBoundedString(r.sessionId)) return false;
  if (!isNonEmptyBoundedString(r.conversationId)) return false;
  if (!isWellFormedAccountRef(r.remoteAccountRef)) return false;
  if (!isNonEmptyBoundedString(r.remoteDeviceRef)) return false;
  if (typeof r.recordedAt !== "number" || !Number.isFinite(r.recordedAt)) return false;
  return true;
}

export function encodeFedosIdentityTransitionRatchetResetLinkV1(link: FedosIdentityTransitionRatchetResetLinkV1): string {
  return JSON.stringify(link);
}

export function decodeFedosIdentityTransitionRatchetResetLinkV1(line: string): FedosIdentityTransitionRatchetResetLinkV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  return isWellFormedFedosIdentityTransitionRatchetResetLinkV1(parsed) ? parsed : null;
}

export interface FedosIdentityTransitionRatchetResetLinkPersistence {
  putLink(link: FedosIdentityTransitionRatchetResetLinkV1): "inserted" | "already-present" | "conflict" | "failed";
  listLinksForTransition(transitionId: string): readonly FedosIdentityTransitionRatchetResetLinkV1[];
  listLinks(): readonly FedosIdentityTransitionRatchetResetLinkV1[];
}

export class InMemoryFedosIdentityTransitionRatchetResetLinkPersistence implements FedosIdentityTransitionRatchetResetLinkPersistence {
  readonly #links = new Map<string, FedosIdentityTransitionRatchetResetLinkV1>();

  putLink(link: FedosIdentityTransitionRatchetResetLinkV1): "inserted" | "already-present" | "conflict" | "failed" {
    const key = fedosIdentityTransitionRatchetResetLinkKey(link);
    const existing = this.#links.get(key);
    if (existing === undefined) {
      this.#links.set(key, link);
      return "inserted";
    }
    return fedosIdentityTransitionRatchetResetLinksAreEqual(existing, link) ? "already-present" : "conflict";
  }

  listLinksForTransition(transitionId: string): readonly FedosIdentityTransitionRatchetResetLinkV1[] {
    return [...this.#links.values()].filter((l) => l.transitionId === transitionId);
  }

  listLinks(): readonly FedosIdentityTransitionRatchetResetLinkV1[] {
    return [...this.#links.values()];
  }
}
