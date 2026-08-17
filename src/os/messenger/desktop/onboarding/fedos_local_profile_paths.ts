/**
 * Secure Runtime Alpha 4661-4740 — Phase G: the ONE durable path-planning
 * boundary for local application state.
 *
 * Today every durable concern is a hand-built absolute `*LogPath` string on
 * `FedosDesktopRuntimeConfig` (Phase A §8). This planner derives every
 * subpath DETERMINISTICALLY from a single profile root, so the coordinator
 * (`./fedos_profile_initialization_coordinator.ts`) supplies one coherent,
 * isolated set — instead of redesigning every persistence port.
 *
 * RULES (Phase G):
 *   - ONE profile root directory; deterministic subpaths beneath it.
 *   - No source-tree paths, no `cwd`-relative implicit paths — the caller
 *     supplies an explicit absolute root (mirrors `FedosDesktopRuntimeConfig`'s
 *     own "no default path" discipline, Alpha 604).
 *   - No path traversal: every derived leaf is a fixed, hardcoded relative
 *     segment joined to the root; no caller string is ever interpolated into
 *     a subpath, so `..`/absolute-escape is structurally impossible.
 *   - Independent profiles isolated: two different roots share no subpath.
 *   - Parent-directory creation is owned by the application ASSEMBLY
 *     (`ensureDirectories()`), never by a renderer and never implicitly.
 *   - No arbitrary renderer filesystem access — this module exposes only
 *     fixed, named paths, never an "open arbitrary path" method.
 *
 * PACKAGING NOTE (Windows / Japanese / OneDrive / short-path): the root is
 * whatever absolute path the caller supplies. On Windows this is typically
 * under `%APPDATA%` (an ASCII short path even when the user profile name is
 * Japanese). Callers whose only writable root is a long OneDrive-redirected
 * `%USERPROFILE%\OneDrive - <org>\...` path (as in this very worktree) are
 * supported — Node's `fs` handles long/UTF-8 paths — but a packaged build
 * SHOULD prefer `%APPDATA%\FedOS\profiles\<id>` to stay well under
 * `MAX_PATH`; this is documented, not enforced (Phase G: "short-path
 * packaging compatibility documented").
 */

import { join, isAbsolute } from "node:path";
import { mkdirSync, existsSync, unlinkSync } from "node:fs";

/** Every named durable leaf a profile owns. Non-secret path strings only. */
export interface FedosLocalProfilePaths {
  /** The one profile root directory (the caller-supplied absolute path). */
  readonly root: string;
  /** The non-secret profile descriptor file. */
  readonly profileDescriptorFile: string;
  /** The sealed (Argon2id + AEAD) Master Seed envelope file. Sealed bytes only — never plaintext. */
  readonly sealedMasterSeedFile: string;
  /** Board append-only log. */
  readonly boardLogFile: string;
  /** Outbox append-only log. */
  readonly outboxLogFile: string;
  /** Conversation append-only log. */
  readonly conversationLogFile: string;
  /** Conversation Message Envelope append-only log. */
  readonly conversationEnvelopeLogFile: string;
  /** Conversation Payload Storage append-only log. */
  readonly conversationPayloadLogFile: string;
  /** Conversation Membership append-only log. */
  readonly conversationMembershipLogFile: string;
  /** Device Registry append-only log. */
  readonly deviceRegistryLogFile: string;
  /** Device Binding challenge-replay append-only log. */
  readonly deviceBindingReplayLogFile: string;
  /** Durable Sync Journal append-only log. */
  readonly syncJournalLogFile: string;
  /** Device Sync schedule append-only log. */
  readonly syncScheduleLogFile: string;
  /** Device Sync conflict append-only log. */
  readonly syncConflictLogFile: string;
  /** Local application log directory (non-secret diagnostics only). */
  readonly logsDirectory: string;
  /** Navigation / session state directory. */
  readonly sessionStateDirectory: string;
  // Secure Runtime Alpha 6521-6600 (FedOS Desktop Beta Production Runtime
  // Configuration Unification Arc) -- every field below this comment is
  // ADDITIVE ONLY, mirroring this file's own established one-leaf-per-line
  // pattern exactly, for the four previously test-only-reachable
  // subsystems this Arc threads into production bootstrap.
  /** Private Transport delivery-observation append-only log. */
  readonly conversationTransportObservationLogFile: string;
  /** Direct Ratchet session-state append-only log. */
  readonly directRatchetSessionLogFile: string;
  /** Direct Ratchet sealed-secret append-only log. */
  readonly directRatchetSealedSecretLogFile: string;
  /** Direct Ratchet Session Reset audit-record append-only log. */
  readonly directRatchetResetRecordLogFile: string;
  /** Direct Ratchet inbound dedup/import-record append-only log. */
  readonly directRatchetImportRecordLogFile: string;
  /** Direct Ratchet Live-State Durability arc — this Device's own record of each peer's current remote ratchet public key (non-secret, current-value, atomic rewrite-in-place). */
  readonly directRatchetRemotePublicKeyLogFile: string;
  /** Direct Ratchet Live-State Durability arc — the durable, SEALED, current-value snapshot of each session's own live cryptographic state (root/chain/private keys — always already-sealed ciphertext, atomic rewrite-in-place, never append-forever — see that persistence class's own header for why). */
  readonly directRatchetLiveStateSnapshotLogFile: string;
  /** Ratchet Peer Capability observation append-only log. */
  readonly peerCapabilityObservationLogFile: string;
  /** FedOS Peer Device Discovery Arc — this local device's own small, durable, non-secret identity file (deviceId + devicePublicKeyHex only, never a private key). */
  readonly peerDeviceAnnouncementIdentityLogFile: string;
  /** Secure Runtime Alpha 7081-7160 — Conversation Invitation received-invitation append-only log. */
  readonly conversationInvitationReceivedLogFile: string;
  /**
   * Secure Runtime Alpha 7081-7160 — real, pre-existing bug fix: this
   * Draft append-only log path existed on `FedosDesktopRuntimeConfig.conversationDraftLogPath`
   * already, but `FedosProfileInitializationCoordinator` never supplied
   * it, so Draft persistence silently defaulted to in-memory-only (lost
   * on every restart) even through the real production Coordinator path
   * — confirmed by direct testing (`conversationMembershipLogFile`
   * immediately above WAS already correctly wired; this ONE sibling
   * field was not). See the completion declaration for the full account.
   */
  readonly conversationDraftLogFile: string;
  /** Identity Transition peer-observation append-only log. */
  readonly identityTransitionObservationLogFile: string;
  /** Identity Transition durable local-decision append-only log. */
  readonly identityTransitionLocalDecisionLogFile: string;
  /**
   * Verified Secure Session UI mega-arc (Coordinator) — Identity Transition
   * per-conversation continuity append-only log
   * (`FedosIdentityTransitionConversationContinuityPersistence`). Found
   * unwired at the Desktop Runtime composition (`fedos_desktop_runtime.ts`'s
   * `conversationIdentityTransitionDeps` never supplied
   * `continuityPersistence`, despite the field being optional-with-durable-
   * fallback exactly like `identityTransitionLocalDecisionLogFile` above)
   * — every real production process was silently falling back to the
   * non-durable `InMemoryFedosIdentityTransitionConversationContinuityPersistence`
   * default, losing the per-conversation identity-continuity record on
   * every restart. Fixed as part of wiring the new conversation Security
   * State UI, which reads this record as its `IDENTITY_CONTINUITY` axis's
   * primary fact source and therefore requires it to genuinely survive a
   * restart.
   */
  readonly identityTransitionConversationContinuityLogFile: string;
  /** Signed Deletion Request state append-only log. */
  readonly deletionRequestStateLogFile: string;
  /** Signed Deletion recipient-decision append-only log. */
  readonly deletionRequestDecisionLogFile: string;
  /** Signed Deletion acknowledgement append-only log. */
  readonly deletionRequestAcknowledgementLogFile: string;
  /** Signed Deletion local execution-record append-only log. */
  readonly deletionRequestExecutionLogFile: string;
  /** Signed Deletion recipient Inbox-summary append-only log. */
  readonly deletionRequestInboxSummaryLogFile: string;
  /** Signed Deletion pending-review durable side-channel append-only log. */
  readonly deletionRequestPendingReviewLogFile: string;
  // Secure Runtime Alpha 7241-7320 -- real, narrow bug fix: these two
  // leaf files did not exist at all, so `FedosDesktopRuntimeConfig`'s
  // own already-existing `conversationCapabilityLogPath`/
  // `conversationPayloadRetentionLogPath` fields (Alpha 923/1143) had no
  // planned path to receive from the Coordinator and silently defaulted
  // to in-memory-only (lost on every restart) even through the real
  // production Coordinator path -- the SAME bug class Alpha 7081-7160
  // found and fixed for `conversationDraftLogFile` immediately above.
  /** Conversation Capability append-only log. */
  readonly conversationCapabilityLogFile: string;
  /** Payload Retention decision append-only log. */
  readonly conversationPayloadRetentionLogFile: string;
  /**
   * Secure Runtime Alpha 7881-7960 — Archive Suppression Observation
   * append-only log. UNCONDITIONAL (mirrors `conversationCapabilityLogFile`/
   * `conversationPayloadRetentionLogFile`'s own discipline immediately
   * above, not gated behind a dependency toggle) — a real profile's own
   * local suppression facts survive restart regardless of whether
   * multi-Device sync is ever enabled.
   */
  readonly archiveSuppressionObservationLogFile: string;
  /** Meaningful only when Device Sync suppression propagation is enabled. */
  readonly archiveSuppressionInboundDedupLogFile: string;
  /** Meaningful only when Device Sync suppression propagation is enabled. */
  readonly archiveSuppressionFanoutObservationLogFile: string;
  /** Own-Device Sync Protocol Final Closure arc -- meaningful only when the real Journal Transport (`deviceSyncJournalMasterSeedAuthority`) is enabled. */
  readonly deviceSyncJournalInboundDedupLogFile: string;
}

/** The set of directories `ensureDirectories()` creates (recursively). Derived from the leaf paths above; no caller string is ever a directory component beyond the root itself. */
function directoriesFor(paths: FedosLocalProfilePaths): readonly string[] {
  return [paths.root, paths.logsDirectory, paths.sessionStateDirectory];
}

/**
 * Plans every durable subpath for one profile root. `root` MUST be an
 * absolute path (rejected with `null` otherwise — never a `cwd`-relative
 * path). Pure; creates no directory; never throws.
 */
export function planFedosLocalProfilePaths(root: string): FedosLocalProfilePaths | null {
  if (typeof root !== "string" || root.length === 0) return null;
  if (!isAbsolute(root)) return null;
  return Object.freeze({
    root,
    profileDescriptorFile: join(root, "profile.json"),
    sealedMasterSeedFile: join(root, "master-seed.sealed.json"),
    boardLogFile: join(root, "board.ndjson"),
    outboxLogFile: join(root, "outbox.ndjson"),
    conversationLogFile: join(root, "conversation.ndjson"),
    conversationEnvelopeLogFile: join(root, "conversation-envelope.ndjson"),
    conversationPayloadLogFile: join(root, "conversation-payload.ndjson"),
    conversationMembershipLogFile: join(root, "conversation-membership.ndjson"),
    deviceRegistryLogFile: join(root, "device-registry.ndjson"),
    deviceBindingReplayLogFile: join(root, "device-binding-replay.ndjson"),
    syncJournalLogFile: join(root, "sync-journal.ndjson"),
    syncScheduleLogFile: join(root, "sync-schedule.ndjson"),
    syncConflictLogFile: join(root, "sync-conflict.ndjson"),
    logsDirectory: join(root, "logs"),
    sessionStateDirectory: join(root, "session"),
    conversationTransportObservationLogFile: join(root, "conversation-transport-observation.ndjson"),
    directRatchetSessionLogFile: join(root, "direct-ratchet-session.ndjson"),
    directRatchetSealedSecretLogFile: join(root, "direct-ratchet-sealed-secret.ndjson"),
    directRatchetResetRecordLogFile: join(root, "direct-ratchet-reset-record.ndjson"),
    directRatchetImportRecordLogFile: join(root, "direct-ratchet-import-record.ndjson"),
    directRatchetRemotePublicKeyLogFile: join(root, "direct-ratchet-remote-public-key.ndjson"),
    directRatchetLiveStateSnapshotLogFile: join(root, "direct-ratchet-live-state-snapshot.json"),
    peerCapabilityObservationLogFile: join(root, "peer-capability-observation.ndjson"),
    peerDeviceAnnouncementIdentityLogFile: join(root, "peer-device-announcement-identity.json"),
    conversationInvitationReceivedLogFile: join(root, "conversation-invitation-received.ndjson"),
    conversationDraftLogFile: join(root, "conversation-draft.ndjson"),
    identityTransitionObservationLogFile: join(root, "identity-transition-observation.ndjson"),
    identityTransitionLocalDecisionLogFile: join(root, "identity-transition-local-decision.ndjson"),
    identityTransitionConversationContinuityLogFile: join(root, "identity-transition-conversation-continuity.ndjson"),
    deletionRequestStateLogFile: join(root, "deletion-request-state.ndjson"),
    deletionRequestDecisionLogFile: join(root, "deletion-request-decision.ndjson"),
    deletionRequestAcknowledgementLogFile: join(root, "deletion-request-acknowledgement.ndjson"),
    deletionRequestExecutionLogFile: join(root, "deletion-request-execution.ndjson"),
    deletionRequestInboxSummaryLogFile: join(root, "deletion-request-inbox-summary.ndjson"),
    deletionRequestPendingReviewLogFile: join(root, "deletion-request-pending-review.ndjson"),
    conversationCapabilityLogFile: join(root, "conversation-capability.ndjson"),
    conversationPayloadRetentionLogFile: join(root, "conversation-payload-retention.ndjson"),
    archiveSuppressionObservationLogFile: join(root, "archive-suppression-observation.ndjson"),
    archiveSuppressionInboundDedupLogFile: join(root, "archive-suppression-inbound-dedup.ndjson"),
    archiveSuppressionFanoutObservationLogFile: join(root, "archive-suppression-fanout-observation.ndjson"),
    deviceSyncJournalInboundDedupLogFile: join(root, "device-sync-journal-inbound-dedup.ndjson"),
  });
}

/**
 * Creates the profile's directories (root + logs + session). Owned by the
 * application assembly, never a renderer. Idempotent (recursive mkdir).
 * Returns `true` on success, `false` on any filesystem failure — never
 * throws.
 */
export function ensureFedosLocalProfileDirectories(paths: FedosLocalProfilePaths): boolean {
  try {
    for (const dir of directoriesFor(paths)) {
      mkdirSync(dir, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

/** True iff two path plans are fully isolated — no shared leaf file/directory. The Phase G "independent profiles isolated" guard. */
export function fedosLocalProfilePathsIsolated(a: FedosLocalProfilePaths, b: FedosLocalProfilePaths): boolean {
  if (a.root === b.root) return false;
  const aValues = new Set(Object.values(a));
  for (const value of Object.values(b)) {
    if (aValues.has(value)) return false;
  }
  return true;
}

/**
 * Every durable leaf FILE `detectProfileState()`'s own narrow 2-file check
 * does NOT inspect (excludes `root`, the two identity files it already
 * checks, and the two bare directories `ensureDirectories()` creates for
 * every profile — an empty directory existing is not itself residual
 * data). Disaster Recovery Product Closure arc, Track 3: the authoritative
 * list backing the widened "is this location TRULY safe to create/restore
 * a new identity into" guard — added after a CONFIRMED, live-reproduced
 * identity-boundary leak (an old identity's board post remained readable
 * by a newly created identity in the same profile root after Start Over,
 * because reset deleted only the 2 files `detectProfileState()` checks).
 */
function residualProfileDataLeaves(paths: FedosLocalProfilePaths): readonly string[] {
  const { root, profileDescriptorFile, sealedMasterSeedFile, logsDirectory, sessionStateDirectory, ...rest } = paths;
  return Object.values(rest);
}

/**
 * True iff any durable leaf beyond the profile descriptor and sealed
 * Master Seed still exists on disk. `detectProfileState()` alone cannot
 * answer this — it inspects only those two files, which is exactly the
 * narrow check `createProfile()`'s overwrite guard and Recovery restore's
 * `target-not-fresh` check both trusted, and exactly the gap Start Over's
 * 2-file delete left open. Never throws; a filesystem error reading a
 * given leaf is treated as "not present" for THAT leaf only (this can only
 * weaken the guard toward a false negative on an already-degenerate
 * filesystem — it can never cause a genuine leak to be silently allowed).
 */
export function hasResidualFedosProfileData(paths: FedosLocalProfilePaths): boolean {
  for (const leaf of residualProfileDataLeaves(paths)) {
    try {
      if (existsSync(leaf)) return true;
    } catch {
      // treated as absent for this leaf; see doc comment above
    }
  }
  return false;
}

/**
 * Deletes every durable leaf `hasResidualFedosProfileData()` inspects (the
 * same list, minus `root`/the two identity files/the two bare
 * directories). Disaster Recovery Product Closure arc, Track 3 —
 * companion to `hasResidualFedosProfileData()`: the widened freshness
 * CHECK alone (refuse-only) turned out to make a legitimate Start Over
 * permanently unable to complete a real re-creation, because a normal
 * `createProfile()` call durably writes well beyond the 2 identity files
 * during its own Device/Runtime bootstrap step (e.g. the local Device
 * Registry entry) — so every post-reset retry would refuse forever with
 * no path forward. `resetCorruptReadyProfile()`/`resetInterruptedProfile()`
 * call this AFTER their own existing 2-file `delete()` calls succeed, so a
 * completed reset is now genuinely, not just nominally, a fresh root — the
 * widened freshness check in `createProfile()`/`restoreFedosRecoveryBundle()`
 * then remains as defense in depth for any OTHER path that reaches this
 * root without going through a reset at all (a bug in reset itself, a
 * manual/external filesystem restore, ...), never as the only guard.
 * Best-effort per leaf (a single stray `unlinkSync` failure never aborts
 * the rest); returns `true` iff every leaf that existed was successfully
 * removed.
 */
export function deleteResidualFedosProfileData(paths: FedosLocalProfilePaths): boolean {
  let allSucceeded = true;
  for (const leaf of residualProfileDataLeaves(paths)) {
    try {
      if (existsSync(leaf)) unlinkSync(leaf);
    } catch {
      allSucceeded = false;
    }
  }
  return allSucceeded;
}
