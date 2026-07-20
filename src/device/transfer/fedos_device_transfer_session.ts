/**
 * Secure Runtime Alpha 3481–3560 ("Encrypted Device-to-Device Local
 * Transfer") — the Transfer Session state machine.
 *
 * Pure, synchronous, side-effect-free state-transition functions, mirroring
 * `../fedos_device_binding.ts`'s own "closed transition table, no I/O, no
 * key material" discipline exactly — the ONLY difference is a larger
 * number of states, since a Transfer has more steps than a single Device
 * Binding. `../transfer/persistence/fedos_device_transfer_session_persistence.ts`
 * is the sole durable caller of these functions; nothing here reads or
 * writes any persistence itself.
 *
 * Closed transition table:
 *
 *   invited      -> { challenged, aborted, failed }
 *   challenged   -> { approved, aborted, failed }
 *   approved     -> { package-sent, aborted, failed }
 *   package-sent -> { verified, aborted, failed }
 *   verified     -> { completed, failed }
 *   completed    -> {}  (terminal)
 *   aborted      -> {}  (terminal)
 *   failed       -> {}  (terminal)
 */

export type FedosDeviceTransferState =
  | "invited"
  | "challenged"
  | "approved"
  | "package-sent"
  | "verified"
  | "completed"
  | "aborted"
  | "failed";

export const FEDOS_DEVICE_TRANSFER_STATES: readonly FedosDeviceTransferState[] = [
  "invited",
  "challenged",
  "approved",
  "package-sent",
  "verified",
  "completed",
  "aborted",
  "failed",
];

export interface FedosDeviceTransferSessionV1 {
  readonly schemaVersion: 1;
  readonly sessionId: string;
  readonly accountAuthority: string;
  readonly accountPublicIdentifier: string;
  readonly initiatorDeviceId: string;
  readonly responderDeviceId: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly state: FedosDeviceTransferState;
  readonly failureReason: string | null;
  /** Set once a Transfer Package has been recorded (`"package-sent"`/`"verified"`/`"completed"`) — a sha256 hex binding, used to detect a duplicate vs. a conflicting resubmission. `null` before that point. */
  readonly packageContentHash: string | null;
  /** Set once a Transfer Challenge has been issued (`"challenged"` or later) — denormalized here (rather than requiring a second persistence read) so the Coordinator can deterministically reconstruct the EXACT `FedosDeviceTransferChallengeV1` this session issued, by combining these three fields with `initiatorDeviceId` and a fresh, live Registry key lookup. `null` before a challenge is issued. */
  readonly challengeNonce: string | null;
  readonly challengeIssuedAt: number | null;
  readonly challengeExpiresAt: number | null;
}

const TRANSITION_TABLE: Readonly<Record<FedosDeviceTransferState, readonly FedosDeviceTransferState[]>> = Object.freeze({
  invited: ["challenged", "aborted", "failed"],
  challenged: ["approved", "aborted", "failed"],
  approved: ["package-sent", "aborted", "failed"],
  "package-sent": ["verified", "aborted", "failed"],
  verified: ["completed", "failed"],
  completed: [],
  aborted: [],
  failed: [],
});

export function isFedosDeviceTransferTransitionAllowed(from: FedosDeviceTransferState, to: FedosDeviceTransferState): boolean {
  return TRANSITION_TABLE[from].includes(to);
}

export function isFedosDeviceTransferSessionTerminal(session: FedosDeviceTransferSessionV1): boolean {
  return TRANSITION_TABLE[session.state].length === 0;
}

export interface FedosDeviceTransferSessionCreateInput {
  readonly sessionId: string;
  readonly accountAuthority: string;
  readonly accountPublicIdentifier: string;
  readonly initiatorDeviceId: string;
  readonly responderDeviceId: string;
  readonly createdAt: number;
  readonly expiresAt: number;
}

export function createInvitedFedosDeviceTransferSession(input: FedosDeviceTransferSessionCreateInput): FedosDeviceTransferSessionV1 {
  return Object.freeze({
    schemaVersion: 1,
    sessionId: input.sessionId,
    accountAuthority: input.accountAuthority,
    accountPublicIdentifier: input.accountPublicIdentifier,
    initiatorDeviceId: input.initiatorDeviceId,
    responderDeviceId: input.responderDeviceId,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    state: "invited",
    failureReason: null,
    packageContentHash: null,
    challengeNonce: null,
    challengeIssuedAt: null,
    challengeExpiresAt: null,
  });
}

function transition(
  session: FedosDeviceTransferSessionV1,
  to: FedosDeviceTransferState,
  patch: Partial<Pick<FedosDeviceTransferSessionV1, "failureReason" | "packageContentHash" | "challengeNonce" | "challengeIssuedAt" | "challengeExpiresAt">> = {},
): FedosDeviceTransferSessionV1 | null {
  if (!isFedosDeviceTransferTransitionAllowed(session.state, to)) return null;
  return Object.freeze({ ...session, state: to, ...patch });
}

export function challengeFedosDeviceTransferSession(
  session: FedosDeviceTransferSessionV1,
  challengeNonce: string,
  challengeIssuedAt: number,
  challengeExpiresAt: number,
): FedosDeviceTransferSessionV1 | null {
  return transition(session, "challenged", { challengeNonce, challengeIssuedAt, challengeExpiresAt });
}

export function approveFedosDeviceTransferSession(session: FedosDeviceTransferSessionV1): FedosDeviceTransferSessionV1 | null {
  return transition(session, "approved");
}

export function sendPackageFedosDeviceTransferSession(
  session: FedosDeviceTransferSessionV1,
  packageContentHash: string,
): FedosDeviceTransferSessionV1 | null {
  return transition(session, "package-sent", { packageContentHash });
}

export function verifyFedosDeviceTransferSessionState(session: FedosDeviceTransferSessionV1): FedosDeviceTransferSessionV1 | null {
  return transition(session, "verified");
}

export function completeFedosDeviceTransferSession(session: FedosDeviceTransferSessionV1): FedosDeviceTransferSessionV1 | null {
  return transition(session, "completed");
}

export function abortFedosDeviceTransferSession(session: FedosDeviceTransferSessionV1): FedosDeviceTransferSessionV1 | null {
  return transition(session, "aborted");
}

export function failFedosDeviceTransferSession(session: FedosDeviceTransferSessionV1, reason: string): FedosDeviceTransferSessionV1 | null {
  return transition(session, "failed", { failureReason: reason });
}

export function isFedosDeviceTransferSessionExpired(session: FedosDeviceTransferSessionV1, now: number): boolean {
  return now > session.expiresAt;
}
