/**
 * Secure Runtime Alpha 3481–3560 ("Encrypted Device-to-Device Local
 * Transfer") — the Transfer Invitation.
 *
 * The immutable "offer" object the initiator hands to the responder
 * out-of-band (this Arc does not implement, or assume, any specific
 * physical channel — QR code, local file, local network discovery are all
 * equally out of scope; this Arc only builds the data and its
 * verification, per its own instructions: "Still NO relay... Only local
 * encrypted exchange"). Distinct from `FedosDeviceTransferSessionV1`
 * (`./fedos_device_transfer_session.ts`), which is the Coordinator's own
 * mutable, durable, internal state record for the same `sessionId` — the
 * Invitation is what travels; the Session is what is remembered.
 */

export interface FedosDeviceTransferInvitationV1 {
  readonly schemaVersion: 1;
  readonly sessionId: string;
  readonly accountAuthority: string;
  readonly accountPublicIdentifier: string;
  readonly initiatorDeviceId: string;
  readonly responderDeviceId: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

const SESSION_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,256}$/;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,256}$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidUnixSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

/** Structural + field-shape validation only — does NOT check the LIVE Registry. Fails closed; never throws. */
export function isWellFormedFedosDeviceTransferInvitationV1(candidate: unknown): candidate is FedosDeviceTransferInvitationV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  const keys = Object.keys(value);
  if (keys.length !== 8) return false;
  if (value.schemaVersion !== 1) return false;
  if (!isNonEmptyString(value.sessionId) || !SESSION_ID_PATTERN.test(value.sessionId)) return false;
  if (!isNonEmptyString(value.accountAuthority)) return false;
  if (!isNonEmptyString(value.accountPublicIdentifier)) return false;
  if (!isNonEmptyString(value.initiatorDeviceId) || !DEVICE_ID_PATTERN.test(value.initiatorDeviceId)) return false;
  if (!isNonEmptyString(value.responderDeviceId) || !DEVICE_ID_PATTERN.test(value.responderDeviceId)) return false;
  if (value.initiatorDeviceId === value.responderDeviceId) return false;
  if (!isValidUnixSeconds(value.issuedAt)) return false;
  if (!isValidUnixSeconds(value.expiresAt) || (value.expiresAt as number) <= (value.issuedAt as number)) return false;
  return true;
}

export function isFedosDeviceTransferInvitationExpired(invitation: FedosDeviceTransferInvitationV1, now: number): boolean {
  return now > invitation.expiresAt;
}
