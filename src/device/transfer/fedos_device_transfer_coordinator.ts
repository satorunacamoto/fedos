/**
 * Secure Runtime Alpha 3481–3560 ("Encrypted Device-to-Device Local
 * Transfer") — the Transfer Coordinator.
 *
 * The ONE orchestrator tying the Transfer Session state machine
 * (`./fedos_device_transfer_session.ts`), the Transfer Challenge/Proof/
 * Approval crypto (`./fedos_device_transfer_challenge.ts`,
 * `./fedos_device_transfer_proof.ts`), and the durable Transfer Session
 * Persistence (`./persistence/`) together — mirroring
 * `../binding_challenge/fedos_device_binding_registration_authority.ts`'s
 * own "re-verify everything on every call, before ever mutating durable
 * state" discipline exactly, one protocol layer up.
 *
 * Reuses, unmodified: the Device Registry (`FedosDeviceRegistryPersistence`,
 * read-only here — this Arc never registers, revokes, or mutates a Device
 * Binding), the Registration Authority's own live-trust vocabulary (a
 * Device must currently be `"trusted"` to participate, exactly like Sync
 * Session Preparation already requires), and the EXISTING, unmodified
 * `FedosDeviceSyncPackageEncryptionAuthority`
 * (`../sync_package/fedos_device_sync_package_encryption.ts`, Alpha
 * 3321–3400) — this Coordinator never constructs one itself (it has no
 * opinion about sourcing a `FedosMasterSeedAuthority`, mirroring
 * `FedosDeviceSyncRuntime`'s own identical stance); a caller injects it
 * per call to `buildTransferPackage()`/`verifyTransferPackage()`.
 *
 * Security discipline: every hard cryptographic denial this Coordinator
 * discovers (`"invalid-proof"`, `"wrong-device"`, `"invalid-approval"`,
 * `"conflict"`, `"expired"`, `"initiator-not-trusted"`,
 * `"responder-key-mismatch"`) durably transitions the Transfer Session to
 * `"failed"` (unless it is already terminal) — an interrupted or attacked
 * transfer never sits in an ambiguous, silently-retryable prior state.
 * Usage/structural outcomes (`"not-found"`, `"wrong-state"`,
 * `"already-*"`, `"duplicate-package"`) never do.
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { FedosDeviceBindingAccountRef } from "../fedos_device_binding.js";
import type { FedosDeviceRegistryPersistence } from "../persistence/fedos_device_registry_persistence.js";
import type { FedosDeviceSigningKeypair } from "../crypto/fedos_device_signing_keypair.js";
import type { AeadAlgorithm } from "../../runtime/fedos_wasm_loader.js";
import type { FedosDeviceSyncSessionV1 } from "../sync_session/fedos_device_sync_session.js";
import type { FedosDeviceSyncPackageEncryptionAuthority } from "../sync_package/fedos_device_sync_package_encryption.js";
import {
  FEDOS_DEVICE_TRANSFER_DOMAIN_V1,
  FedosSecureRandomDeviceTransferChallengeNonceGenerator,
  isFedosDeviceTransferChallengeExpired,
  serializeFedosDeviceTransferChallengeV1,
  type FedosDeviceTransferChallengeNonceGenerator,
  type FedosDeviceTransferChallengeV1,
} from "./fedos_device_transfer_challenge.js";
import {
  createFedosDeviceTransferApproval,
  verifyFedosDeviceTransferApproval,
  verifyFedosDeviceTransferProof,
  type FedosDeviceTransferApprovalV1,
  type FedosDeviceTransferProofV1,
} from "./fedos_device_transfer_proof.js";
import {
  isFedosDeviceTransferInvitationExpired,
  isWellFormedFedosDeviceTransferInvitationV1,
  type FedosDeviceTransferInvitationV1,
} from "./fedos_device_transfer_invitation.js";
import { isFedosDeviceTransferSessionTerminal, type FedosDeviceTransferSessionV1 } from "./fedos_device_transfer_session.js";
import { isWellFormedFedosDeviceTransferPackageV1, type FedosDeviceTransferPackageV1 } from "./fedos_device_transfer_package.js";
import type { FedosDeviceTransferSessionPersistence } from "./persistence/fedos_device_transfer_session_persistence.js";

export interface FedosDeviceTransferCoordinatorLimits {
  readonly invitationTtlSeconds: number;
  readonly challengeTtlSeconds: number;
}

export const FEDOS_DEVICE_TRANSFER_DEFAULT_LIMITS: FedosDeviceTransferCoordinatorLimits = Object.freeze({
  invitationTtlSeconds: 300,
  challengeTtlSeconds: 300,
});

export interface FedosDeviceTransferCoordinatorDeps {
  readonly sessionPersistence: FedosDeviceTransferSessionPersistence;
  readonly registryPersistence: FedosDeviceRegistryPersistence;
  readonly now?: () => number;
  readonly nonceGenerator?: FedosDeviceTransferChallengeNonceGenerator;
  readonly limits?: FedosDeviceTransferCoordinatorLimits;
}

export interface FedosDeviceTransferInvitationCreateResult {
  readonly outcome: "invited" | "same-device" | "initiator-not-trusted" | "responder-not-trusted" | "wrong-account" | "failed";
  readonly invitation: FedosDeviceTransferInvitationV1 | null;
}

export interface FedosDeviceTransferChallengeIssueResult {
  readonly outcome: "challenged" | "already-challenged" | "invalid-invitation" | "expired-invitation" | "not-found" | "wrong-state" | "initiator-not-trusted";
  readonly challenge: FedosDeviceTransferChallengeV1 | null;
}

export type FedosDeviceTransferApprovalOutcome2 =
  | "approved"
  | "already-approved"
  | "replayed"
  | "not-found"
  | "wrong-state"
  | "expired"
  | "invalid-proof"
  | "wrong-device"
  | "initiator-not-trusted"
  | "responder-key-mismatch";

export interface FedosDeviceTransferApprovalResult {
  readonly outcome: FedosDeviceTransferApprovalOutcome2;
  readonly approval: FedosDeviceTransferApprovalV1 | null;
}

export interface FedosDeviceTransferPackageBuildDeps {
  readonly sessionId: string;
  readonly approval: FedosDeviceTransferApprovalV1;
  readonly syncSession: FedosDeviceSyncSessionV1;
  readonly encryptionAuthority: FedosDeviceSyncPackageEncryptionAuthority;
  readonly suite: AeadAlgorithm;
  readonly localAccountIndex: number;
  readonly selfAccountPublicKeyHex: string;
}

export type FedosDeviceTransferPackageBuildOutcome =
  | "package-sent"
  | "not-found"
  | "wrong-state"
  | "invalid-approval"
  | "expired"
  | "key-unavailable"
  | "invalid-input"
  | "failed";

export interface FedosDeviceTransferPackageBuildResult {
  readonly outcome: FedosDeviceTransferPackageBuildOutcome;
  readonly package: FedosDeviceTransferPackageV1 | null;
}

export interface FedosDeviceTransferVerifyDeps {
  readonly transferPackage: FedosDeviceTransferPackageV1;
  readonly encryptionAuthority: FedosDeviceSyncPackageEncryptionAuthority;
  readonly suite: AeadAlgorithm;
  readonly localAccountIndex: number;
  readonly selfAccountPublicKeyHex: string;
}

export type FedosDeviceTransferVerifyOutcome =
  | "verified"
  | "duplicate-package"
  | "conflict"
  | "not-found"
  | "wrong-state"
  | "malformed"
  | "manifest-mismatch"
  | "expired"
  | "key-unavailable"
  | "invalid-input"
  | "failed";

export interface FedosDeviceTransferVerifyResult {
  readonly outcome: FedosDeviceTransferVerifyOutcome;
  readonly session: FedosDeviceSyncSessionV1 | null;
}

export type FedosDeviceTransferCompletionOutcome = "completed" | "already-completed" | "not-found" | "wrong-state";
export type FedosDeviceTransferAbortOutcome = "aborted" | "already-terminal" | "not-found";
export type FedosDeviceTransferFailOutcome = "failed" | "already-terminal" | "not-found";

function defaultNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function contentHashOf(value: unknown): string {
  return bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(value))));
}

export class FedosDeviceTransferCoordinator {
  readonly #sessionPersistence: FedosDeviceTransferSessionPersistence;
  readonly #registryPersistence: FedosDeviceRegistryPersistence;
  readonly #now: () => number;
  readonly #nonceGenerator: FedosDeviceTransferChallengeNonceGenerator;
  readonly #limits: FedosDeviceTransferCoordinatorLimits;

  constructor(deps: FedosDeviceTransferCoordinatorDeps) {
    this.#sessionPersistence = deps.sessionPersistence;
    this.#registryPersistence = deps.registryPersistence;
    this.#now = deps.now ?? defaultNowSeconds;
    this.#nonceGenerator = deps.nonceGenerator ?? new FedosSecureRandomDeviceTransferChallengeNonceGenerator();
    this.#limits = deps.limits ?? FEDOS_DEVICE_TRANSFER_DEFAULT_LIMITS;
  }

  getSession(sessionId: string): FedosDeviceTransferSessionV1 | null {
    return this.#sessionPersistence.getSession(sessionId);
  }

  listSessionsForAccount(accountRef: FedosDeviceBindingAccountRef): readonly FedosDeviceTransferSessionV1[] {
    return this.#sessionPersistence.listSessionsForAccount(accountRef.authority, accountRef.publicIdentifier);
  }

  /** Transfer Invitation/Transfer Session creation — refuses same-device, untrusted, or cross-account pairings. */
  createInvitation(
    accountRef: FedosDeviceBindingAccountRef,
    initiatorDeviceId: string,
    responderDeviceId: string,
    now: number = this.#now(),
  ): FedosDeviceTransferInvitationCreateResult {
    if (initiatorDeviceId === responderDeviceId) return { outcome: "same-device", invitation: null };

    const initiatorBinding = this.#registryPersistence.getBinding(initiatorDeviceId);
    if (initiatorBinding === null || initiatorBinding.trustState !== "trusted") return { outcome: "initiator-not-trusted", invitation: null };
    if (initiatorBinding.accountRef.authority !== accountRef.authority || initiatorBinding.accountRef.publicIdentifier !== accountRef.publicIdentifier) {
      return { outcome: "wrong-account", invitation: null };
    }

    const responderBinding = this.#registryPersistence.getBinding(responderDeviceId);
    if (responderBinding === null || responderBinding.trustState !== "trusted") return { outcome: "responder-not-trusted", invitation: null };
    if (responderBinding.accountRef.authority !== accountRef.authority || responderBinding.accountRef.publicIdentifier !== accountRef.publicIdentifier) {
      return { outcome: "wrong-account", invitation: null };
    }

    const sessionId = this.#nonceGenerator.generateNonce();
    const invitation: FedosDeviceTransferInvitationV1 = Object.freeze({
      schemaVersion: 1,
      sessionId,
      accountAuthority: accountRef.authority,
      accountPublicIdentifier: accountRef.publicIdentifier,
      initiatorDeviceId,
      responderDeviceId,
      issuedAt: now,
      expiresAt: now + this.#limits.invitationTtlSeconds,
    });

    const write = this.#sessionPersistence.putEvent({
      schemaVersion: 1,
      eventType: "invited",
      sessionId,
      accountAuthority: accountRef.authority,
      accountPublicIdentifier: accountRef.publicIdentifier,
      initiatorDeviceId,
      responderDeviceId,
      createdAt: now,
      expiresAt: invitation.expiresAt,
    });
    if (write !== "inserted") return { outcome: "failed", invitation: null };

    return { outcome: "invited", invitation };
  }

  /** Transfer Challenge — minted by the RESPONDER upon receiving an Invitation. Idempotent if this session was already challenged. */
  issueChallenge(invitation: FedosDeviceTransferInvitationV1, now: number = this.#now()): FedosDeviceTransferChallengeIssueResult {
    if (!isWellFormedFedosDeviceTransferInvitationV1(invitation)) return { outcome: "invalid-invitation", challenge: null };
    if (isFedosDeviceTransferInvitationExpired(invitation, now)) return { outcome: "expired-invitation", challenge: null };

    const session = this.#sessionPersistence.getSession(invitation.sessionId);
    if (session === null) return { outcome: "not-found", challenge: null };
    if (
      session.initiatorDeviceId !== invitation.initiatorDeviceId ||
      session.responderDeviceId !== invitation.responderDeviceId ||
      session.accountAuthority !== invitation.accountAuthority ||
      session.accountPublicIdentifier !== invitation.accountPublicIdentifier
    ) {
      return { outcome: "invalid-invitation", challenge: null };
    }

    if (session.state !== "invited") {
      const existing = this.#reconstructChallenge(session);
      if (existing !== null) return { outcome: "already-challenged", challenge: existing };
      return { outcome: "wrong-state", challenge: null };
    }

    const initiatorBinding = this.#registryPersistence.getBinding(session.initiatorDeviceId);
    if (initiatorBinding === null || initiatorBinding.trustState !== "trusted" || initiatorBinding.devicePublicKeyRef === null) {
      this.#denyAndFail(session, "initiator-not-trusted", now);
      return { outcome: "initiator-not-trusted", challenge: null };
    }

    const issuedAt = now;
    const expiresAt = issuedAt + this.#limits.challengeTtlSeconds;
    const nonce = this.#nonceGenerator.generateNonce();
    const challenge: FedosDeviceTransferChallengeV1 = Object.freeze({
      schemaVersion: 1,
      domain: FEDOS_DEVICE_TRANSFER_DOMAIN_V1,
      sessionId: session.sessionId,
      initiatorDeviceId: session.initiatorDeviceId,
      initiatorDevicePublicKeyHex: initiatorBinding.devicePublicKeyRef,
      issuedAt,
      expiresAt,
      nonce,
    });

    this.#sessionPersistence.putEvent({ schemaVersion: 1, eventType: "challenged", sessionId: session.sessionId, nonce, challengeIssuedAt: issuedAt, challengeExpiresAt: expiresAt, at: now });
    return { outcome: "challenged", challenge };
  }

  /** Transfer Approval — verifies the initiator's Proof against the EXACT challenge this session issued (re-checked live), then the responder signs its own Approval. */
  approveTransfer(
    sessionId: string,
    proof: FedosDeviceTransferProofV1,
    responderKeypair: FedosDeviceSigningKeypair,
    now: number = this.#now(),
  ): FedosDeviceTransferApprovalResult {
    const session = this.#sessionPersistence.getSession(sessionId);
    if (session === null) return { outcome: "not-found", approval: null };
    if (session.state === "invited" || session.state === "aborted" || session.state === "failed") {
      return { outcome: "wrong-state", approval: null };
    }

    const expectedChallenge = this.#reconstructChallenge(session);
    if (expectedChallenge === null) return { outcome: "wrong-state", approval: null };

    if (serializeFedosDeviceTransferChallengeV1(proof.challenge) !== serializeFedosDeviceTransferChallengeV1(expectedChallenge)) {
      this.#denyAndFail(session, "replayed", now);
      return { outcome: "replayed", approval: null };
    }

    const responderBinding = this.#registryPersistence.getBinding(session.responderDeviceId);
    if (responderBinding === null || responderBinding.devicePublicKeyRef !== responderKeypair.publicKeyHex) {
      return { outcome: "responder-key-mismatch", approval: null };
    }

    if (session.state !== "challenged") {
      // Already approved (or later) with the SAME challenge -- idempotent: a fresh signature is safe to re-issue (Schnorr signing is randomized; a repeat isn't byte-identical, but is equally valid).
      const approval = createFedosDeviceTransferApproval(responderKeypair, expectedChallenge, session.responderDeviceId, now);
      if (approval === null) return { outcome: "invalid-proof", approval: null };
      return { outcome: "already-approved", approval };
    }

    const proofOutcome = verifyFedosDeviceTransferProof(proof, now);
    if (proofOutcome === "expired") {
      this.#denyAndFail(session, "expired", now);
      return { outcome: "expired", approval: null };
    }
    if (proofOutcome === "key-mismatch") {
      this.#denyAndFail(session, "wrong-device", now);
      return { outcome: "wrong-device", approval: null };
    }
    if (proofOutcome !== "valid") {
      this.#denyAndFail(session, "invalid-proof", now);
      return { outcome: "invalid-proof", approval: null };
    }

    const initiatorBinding = this.#registryPersistence.getBinding(session.initiatorDeviceId);
    if (initiatorBinding === null || initiatorBinding.trustState !== "trusted") {
      this.#denyAndFail(session, "initiator-not-trusted", now);
      return { outcome: "initiator-not-trusted", approval: null };
    }

    const approval = createFedosDeviceTransferApproval(responderKeypair, expectedChallenge, session.responderDeviceId, now);
    if (approval === null) {
      this.#denyAndFail(session, "invalid-proof", now);
      return { outcome: "invalid-proof", approval: null };
    }

    this.#sessionPersistence.putEvent({ schemaVersion: 1, eventType: "approved", sessionId, at: now });
    return { outcome: "approved", approval };
  }

  /** Transfer Package — built by the INITIATOR after receiving a valid Approval. Reuses the EXISTING, unmodified `FedosDeviceSyncPackageEncryptionAuthority` verbatim. */
  async buildTransferPackage(deps: FedosDeviceTransferPackageBuildDeps, now: number = this.#now()): Promise<FedosDeviceTransferPackageBuildResult> {
    const session = this.#sessionPersistence.getSession(deps.sessionId);
    if (session === null) return { outcome: "not-found", package: null };
    if (session.state !== "approved") return { outcome: "wrong-state", package: null };

    const expectedChallenge = this.#reconstructChallenge(session);
    if (expectedChallenge === null) return { outcome: "wrong-state", package: null };

    const responderBinding = this.#registryPersistence.getBinding(session.responderDeviceId);
    const expectedResponderKeyHex = responderBinding?.devicePublicKeyRef ?? "";
    if (serializeFedosDeviceTransferChallengeV1(deps.approval.challenge) !== serializeFedosDeviceTransferChallengeV1(expectedChallenge)) {
      this.#denyAndFail(session, "invalid-approval", now);
      return { outcome: "invalid-approval", package: null };
    }
    const approvalOutcome = verifyFedosDeviceTransferApproval(deps.approval, expectedResponderKeyHex, now);
    if (approvalOutcome === "expired") {
      this.#denyAndFail(session, "expired", now);
      return { outcome: "expired", package: null };
    }
    if (approvalOutcome !== "valid") {
      this.#denyAndFail(session, "invalid-approval", now);
      return { outcome: "invalid-approval", package: null };
    }

    const built = await deps.encryptionAuthority.build({ session: deps.syncSession, suite: deps.suite, localAccountIndex: deps.localAccountIndex, selfAccountPublicKeyHex: deps.selfAccountPublicKeyHex });
    if (built.outcome !== "built") {
      return { outcome: built.outcome, package: null };
    }

    const transferPackage: FedosDeviceTransferPackageV1 = Object.freeze({ formatVersion: 1, sessionId: session.sessionId, syncPackage: built.package });
    const packageContentHash = contentHashOf(transferPackage);
    this.#sessionPersistence.putEvent({ schemaVersion: 1, eventType: "package-sent", sessionId: session.sessionId, packageContentHash, at: now });
    return { outcome: "package-sent", package: transferPackage };
  }

  /** Transfer Verification — the RESPONDER's own check of an incoming Transfer Package. Detects a resubmission of the SAME package (`"duplicate-package"`, idempotent) vs. a DIFFERENT package presented against an already-progressed session (`"conflict"`) before ever attempting decrypt. */
  async verifyTransferPackage(deps: FedosDeviceTransferVerifyDeps, now: number = this.#now()): Promise<FedosDeviceTransferVerifyResult> {
    if (!isWellFormedFedosDeviceTransferPackageV1(deps.transferPackage)) return { outcome: "malformed", session: null };

    const session = this.#sessionPersistence.getSession(deps.transferPackage.sessionId);
    if (session === null) return { outcome: "not-found", session: null };

    const contentHash = contentHashOf(deps.transferPackage);

    if (session.state === "verified" || session.state === "completed") {
      if (session.packageContentHash !== contentHash) return { outcome: "conflict", session: null };
      const reread = await deps.encryptionAuthority.read({
        package: deps.transferPackage.syncPackage,
        suite: deps.suite,
        localAccountIndex: deps.localAccountIndex,
        selfAccountPublicKeyHex: deps.selfAccountPublicKeyHex,
        now,
      });
      return reread.outcome === "opened" ? { outcome: "duplicate-package", session: reread.session } : { outcome: reread.outcome, session: null };
    }

    if (session.state !== "package-sent") return { outcome: "wrong-state", session: null };
    if (session.packageContentHash !== contentHash) {
      this.#denyAndFail(session, "conflict", now);
      return { outcome: "conflict", session: null };
    }

    const read = await deps.encryptionAuthority.read({
      package: deps.transferPackage.syncPackage,
      suite: deps.suite,
      localAccountIndex: deps.localAccountIndex,
      selfAccountPublicKeyHex: deps.selfAccountPublicKeyHex,
      now,
    });
    if (read.outcome !== "opened") {
      this.#denyAndFail(session, read.outcome, now);
      return { outcome: read.outcome, session: null };
    }

    this.#sessionPersistence.putEvent({ schemaVersion: 1, eventType: "verified", sessionId: session.sessionId, at: now });
    return { outcome: "verified", session: read.session };
  }

  /** Transfer Completion — terminal success. */
  completeTransfer(sessionId: string, now: number = this.#now()): FedosDeviceTransferCompletionOutcome {
    const session = this.#sessionPersistence.getSession(sessionId);
    if (session === null) return "not-found";
    if (session.state === "completed") return "already-completed";
    if (session.state !== "verified") return "wrong-state";
    this.#sessionPersistence.putEvent({ schemaVersion: 1, eventType: "completed", sessionId, at: now });
    return "completed";
  }

  /** Transfer Abort — voluntary cancellation, allowed from any non-terminal state. */
  abortTransfer(sessionId: string, now: number = this.#now()): FedosDeviceTransferAbortOutcome {
    const session = this.#sessionPersistence.getSession(sessionId);
    if (session === null) return "not-found";
    if (isFedosDeviceTransferSessionTerminal(session)) return "already-terminal";
    this.#sessionPersistence.putEvent({ schemaVersion: 1, eventType: "aborted", sessionId, at: now });
    return "aborted";
  }

  /** Transfer Failure — explicit, caller-driven terminal failure (e.g. an out-of-band signal that the transfer cannot proceed). Every OTHER method in this class already fails a session automatically on a hard cryptographic denial; this method exists for a caller that observes a failure this Coordinator itself has no way to detect on its own. */
  failTransfer(sessionId: string, reason: string, now: number = this.#now()): FedosDeviceTransferFailOutcome {
    const session = this.#sessionPersistence.getSession(sessionId);
    if (session === null) return "not-found";
    if (isFedosDeviceTransferSessionTerminal(session)) return "already-terminal";
    this.#sessionPersistence.putEvent({ schemaVersion: 1, eventType: "failed", sessionId, reason, at: now });
    return "failed";
  }

  /** PRIVATE — durably transitions `session` to `"failed"` with `reason`, UNLESS it is already terminal (idempotent no-op in that case — an already-`"aborted"`/`"completed"`/`"failed"` session is never overwritten). Callers still return their own outcome literal immediately after calling this; it never returns a caller-shaped result itself. */
  #denyAndFail(session: FedosDeviceTransferSessionV1, reason: string, now: number): void {
    if (isFedosDeviceTransferSessionTerminal(session)) return;
    this.#sessionPersistence.putEvent({ schemaVersion: 1, eventType: "failed", sessionId: session.sessionId, reason, at: now });
  }

  /** PRIVATE — reconstructs the challenge THIS session actually issued, by combining the session's own denormalized `challengeNonce`/`challengeIssuedAt`/`challengeExpiresAt` (set by `challengeFedosDeviceTransferSession()`, Alpha `fedos_device_transfer_session.ts`) with a FRESH, LIVE Registry lookup of the initiator's current public key — never a cached/stale key. `null` if no challenge was ever issued for this session, or the initiator's live key is unavailable. */
  #reconstructChallenge(session: FedosDeviceTransferSessionV1): FedosDeviceTransferChallengeV1 | null {
    if (session.challengeNonce === null || session.challengeIssuedAt === null || session.challengeExpiresAt === null) return null;
    const initiatorBinding = this.#registryPersistence.getBinding(session.initiatorDeviceId);
    if (initiatorBinding === null || initiatorBinding.devicePublicKeyRef === null) return null;
    return Object.freeze({
      schemaVersion: 1,
      domain: FEDOS_DEVICE_TRANSFER_DOMAIN_V1,
      sessionId: session.sessionId,
      initiatorDeviceId: session.initiatorDeviceId,
      initiatorDevicePublicKeyHex: initiatorBinding.devicePublicKeyRef,
      issuedAt: session.challengeIssuedAt,
      expiresAt: session.challengeExpiresAt,
      nonce: session.challengeNonce,
    });
  }
}

export function createFedosDeviceTransferCoordinator(deps: FedosDeviceTransferCoordinatorDeps): FedosDeviceTransferCoordinator {
  return new FedosDeviceTransferCoordinator(deps);
}
