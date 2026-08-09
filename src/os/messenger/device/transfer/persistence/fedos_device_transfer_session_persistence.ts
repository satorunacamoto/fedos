/**
 * Secure Runtime Alpha 3481–3560 — Transfer Session Persistence Port.
 * Mirrors `../../persistence/fedos_device_registry_persistence.ts`'s own
 * event-store-plus-reconstruct shape exactly, applied to
 * `FedosDeviceTransferSessionV1` (`../fedos_device_transfer_session.ts`)
 * instead of a Device Binding. A DELIBERATELY SEPARATE port and file tree
 * from the Device Registry itself, from the Alpha 3161–3240 Challenge
 * Replay persistence, and from `../../../sync/` — this Arc's own Transfer
 * Session lifecycle is a distinct concern from all three.
 */

import {
  createInvitedFedosDeviceTransferSession,
  challengeFedosDeviceTransferSession,
  approveFedosDeviceTransferSession,
  sendPackageFedosDeviceTransferSession,
  verifyFedosDeviceTransferSessionState,
  completeFedosDeviceTransferSession,
  abortFedosDeviceTransferSession,
  failFedosDeviceTransferSession,
  type FedosDeviceTransferSessionV1,
} from "../fedos_device_transfer_session.js";
import {
  fedosDeviceTransferEventKey,
  fedosPersistedDeviceTransferEventsAreEqual,
  type FedosPersistedDeviceTransferEventV1,
  type FedosPersistedDeviceTransferInvitedEventV1,
} from "./fedos_persisted_device_transfer_event_v1.js";

export type FedosDeviceTransferSessionPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosDeviceTransferSessionPersistence {
  putEvent(event: FedosPersistedDeviceTransferEventV1): FedosDeviceTransferSessionPersistenceWriteResult;
  /** Resolves the CURRENT reconstructed session for one session id — `null` if no `"invited"` event exists. */
  getSession(sessionId: string): FedosDeviceTransferSessionV1 | null;
  listSessionsForAccount(accountAuthority: string, accountPublicIdentifier: string): readonly FedosDeviceTransferSessionV1[];
}

export { fedosDeviceTransferEventKey, fedosPersistedDeviceTransferEventsAreEqual };

const CANONICAL_LIFECYCLE_ORDER = ["invited", "challenged", "approved", "package-sent", "verified", "completed", "aborted", "failed"] as const;

/**
 * Reconstructs the current session for one session id from every event
 * found for it, applied in FIXED canonical lifecycle order (never the
 * log's own append order) — since each event type occurs at most once and
 * the state machine itself rejects an out-of-order transition (returning
 * `null`, silently ignored here), canonical-order application is
 * deterministic regardless of how the underlying log physically stores
 * entries. `null` if no `"invited"` event exists yet.
 */
export function reconstructFedosDeviceTransferSessionRecord(
  eventsForSessionId: readonly FedosPersistedDeviceTransferEventV1[],
): FedosDeviceTransferSessionV1 | null {
  const byType = new Map<string, FedosPersistedDeviceTransferEventV1>();
  for (const event of eventsForSessionId) {
    if (!byType.has(event.eventType)) byType.set(event.eventType, event);
  }

  const invited = byType.get("invited") as FedosPersistedDeviceTransferInvitedEventV1 | undefined;
  if (invited === undefined) return null;

  let session: FedosDeviceTransferSessionV1 = createInvitedFedosDeviceTransferSession({
    sessionId: invited.sessionId,
    accountAuthority: invited.accountAuthority,
    accountPublicIdentifier: invited.accountPublicIdentifier,
    initiatorDeviceId: invited.initiatorDeviceId,
    responderDeviceId: invited.responderDeviceId,
    createdAt: invited.createdAt,
    expiresAt: invited.expiresAt,
  });

  for (const eventType of CANONICAL_LIFECYCLE_ORDER) {
    if (eventType === "invited") continue;
    const event = byType.get(eventType);
    if (event === undefined) continue;
    // An invalid/out-of-order transition is IGNORED (never applied, never
    // throws, never nulls out an already-valid `session`) -- mirrors
    // `reconstructFedosDeviceBindingRecord`'s own "if (next !== null)
    // binding = next" discipline exactly; this can only happen from a
    // corrupt/tampered log, since every writer validates transitions
    // before ever calling `putEvent()`.
    let next: FedosDeviceTransferSessionV1 | null = null;
    switch (event.eventType) {
      case "challenged":
        next = challengeFedosDeviceTransferSession(session, event.nonce, event.challengeIssuedAt, event.challengeExpiresAt);
        break;
      case "approved":
        next = approveFedosDeviceTransferSession(session);
        break;
      case "package-sent":
        next = sendPackageFedosDeviceTransferSession(session, event.packageContentHash);
        break;
      case "verified":
        next = verifyFedosDeviceTransferSessionState(session);
        break;
      case "completed":
        next = completeFedosDeviceTransferSession(session);
        break;
      case "aborted":
        next = abortFedosDeviceTransferSession(session);
        break;
      case "failed":
        next = failFedosDeviceTransferSession(session, event.reason);
        break;
      default:
        break;
    }
    if (next !== null) session = next;
  }
  return session;
}
