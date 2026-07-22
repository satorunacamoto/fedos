/**
 * Secure Runtime Alpha 3481–3560 ("Encrypted Device-to-Device Local
 * Transfer") — the persisted Transfer Session event union.
 *
 * Mirrors `../../persistence/fedos_persisted_device_binding_event_v1.ts`'s
 * own "event-sourced, one immutable fact per (sessionId, eventType)"
 * discipline exactly, applied to `FedosDeviceTransferSessionV1`
 * (`../fedos_device_transfer_session.ts`) instead of a Device Binding.
 * Each event type occurs AT MOST ONCE per `sessionId` — this Arc's own
 * Transfer Session state machine only ever fires `"challenged"`/
 * `"approved"`/`"package-sent"`/`"verified"` once each, and exactly one of
 * `"completed"`/`"aborted"`/`"failed"` (the three terminal states) ever
 * fires for a given session.
 */

export interface FedosPersistedDeviceTransferInvitedEventV1 {
  readonly schemaVersion: 1;
  readonly eventType: "invited";
  readonly sessionId: string;
  readonly accountAuthority: string;
  readonly accountPublicIdentifier: string;
  readonly initiatorDeviceId: string;
  readonly responderDeviceId: string;
  readonly createdAt: number;
  readonly expiresAt: number;
}

export interface FedosPersistedDeviceTransferChallengedEventV1 {
  readonly schemaVersion: 1;
  readonly eventType: "challenged";
  readonly sessionId: string;
  readonly nonce: string;
  readonly challengeIssuedAt: number;
  readonly challengeExpiresAt: number;
  readonly at: number;
}

export interface FedosPersistedDeviceTransferApprovedEventV1 {
  readonly schemaVersion: 1;
  readonly eventType: "approved";
  readonly sessionId: string;
  readonly at: number;
}

export interface FedosPersistedDeviceTransferPackageSentEventV1 {
  readonly schemaVersion: 1;
  readonly eventType: "package-sent";
  readonly sessionId: string;
  readonly packageContentHash: string;
  readonly at: number;
}

export interface FedosPersistedDeviceTransferVerifiedEventV1 {
  readonly schemaVersion: 1;
  readonly eventType: "verified";
  readonly sessionId: string;
  readonly at: number;
}

export interface FedosPersistedDeviceTransferCompletedEventV1 {
  readonly schemaVersion: 1;
  readonly eventType: "completed";
  readonly sessionId: string;
  readonly at: number;
}

export interface FedosPersistedDeviceTransferAbortedEventV1 {
  readonly schemaVersion: 1;
  readonly eventType: "aborted";
  readonly sessionId: string;
  readonly at: number;
}

export interface FedosPersistedDeviceTransferFailedEventV1 {
  readonly schemaVersion: 1;
  readonly eventType: "failed";
  readonly sessionId: string;
  readonly reason: string;
  readonly at: number;
}

export type FedosPersistedDeviceTransferEventV1 =
  | FedosPersistedDeviceTransferInvitedEventV1
  | FedosPersistedDeviceTransferChallengedEventV1
  | FedosPersistedDeviceTransferApprovedEventV1
  | FedosPersistedDeviceTransferPackageSentEventV1
  | FedosPersistedDeviceTransferVerifiedEventV1
  | FedosPersistedDeviceTransferCompletedEventV1
  | FedosPersistedDeviceTransferAbortedEventV1
  | FedosPersistedDeviceTransferFailedEventV1;

export function fedosDeviceTransferEventKey(event: FedosPersistedDeviceTransferEventV1): string {
  return `${event.sessionId}:${event.eventType}`;
}

export function fedosPersistedDeviceTransferEventsAreEqual(a: FedosPersistedDeviceTransferEventV1, b: FedosPersistedDeviceTransferEventV1): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
