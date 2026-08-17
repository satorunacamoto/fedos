/**
 * Disaster Recovery / Portable Backup Arc — the ONE place the Recovery
 * Bundle's Data Part inclusion/exclusion decision is compiled into code.
 * See
 * `docs/reviews/fedos_disaster_recovery_portable_backup_v1/01_recovery_bundle_format.md`
 * §2 for the full rationale behind every inclusion and every exclusion —
 * this file is deliberately just the resulting fixed table, kept
 * separate from the Encryption Authority so the *policy* ("what travels")
 * stays reviewable independently of the *mechanism* ("how it's sealed").
 *
 * EVERY leaf `planFedosLocalProfilePaths()` (`../onboarding/fedos_local_profile_paths.ts`)
 * defines is accounted for below, in ONE of two lists — `sealedMasterSeedFile`
 * is neither (it is the Identity Part, handled separately, never the Data
 * Part). A leaf added to `FedosLocalProfilePaths` in the future and not
 * added to either list here is, by construction, silently excluded from
 * the Data Part — the safer default for a field this file's author never
 * reviewed, but flagged here so it is not mistaken for an oversight.
 */

import type { FedosLocalProfilePaths } from "../onboarding/fedos_local_profile_paths.js";

/** Logical Data Part entry name -> the `FedosLocalProfilePaths` field it reads from. Order here is documentation only — the actual Data Part encoding sorts by name (`fedos_recovery_bundle_data_part_codec.ts`). */
export const FEDOS_RECOVERY_BUNDLE_INCLUDED_LOGS: ReadonlyMap<string, keyof FedosLocalProfilePaths> = new Map([
  ["profile-descriptor", "profileDescriptorFile"],
  ["board", "boardLogFile"],
  ["outbox", "outboxLogFile"],
  ["conversation", "conversationLogFile"],
  ["conversation-envelope", "conversationEnvelopeLogFile"],
  ["conversation-payload", "conversationPayloadLogFile"],
  ["conversation-membership", "conversationMembershipLogFile"],
  ["conversation-invitation-received", "conversationInvitationReceivedLogFile"],
  ["conversation-draft", "conversationDraftLogFile"],
  ["conversation-capability", "conversationCapabilityLogFile"],
  ["conversation-payload-retention", "conversationPayloadRetentionLogFile"],
  ["deletion-request-state", "deletionRequestStateLogFile"],
  ["deletion-request-decision", "deletionRequestDecisionLogFile"],
  ["deletion-request-acknowledgement", "deletionRequestAcknowledgementLogFile"],
  ["deletion-request-execution", "deletionRequestExecutionLogFile"],
  ["deletion-request-inbox-summary", "deletionRequestInboxSummaryLogFile"],
  ["deletion-request-pending-review", "deletionRequestPendingReviewLogFile"],
  ["identity-transition-observation", "identityTransitionObservationLogFile"],
  ["identity-transition-local-decision", "identityTransitionLocalDecisionLogFile"],
  ["identity-transition-conversation-continuity", "identityTransitionConversationContinuityLogFile"],
  ["archive-suppression-observation", "archiveSuppressionObservationLogFile"],
]);

/**
 * Named, NEVER included — device-bound, session-bound, Own-Device-Sync-
 * owned, or replay-protection state. Not consulted by any code path;
 * exists purely so a reader (and Agent C's red team) can see the
 * exclusion list is a deliberate, exhaustive decision rather than an
 * accidental gap. Field names only, not path lookups.
 */
export const FEDOS_RECOVERY_BUNDLE_EXCLUDED_LOGS: readonly (keyof FedosLocalProfilePaths)[] = [
  "deviceRegistryLogFile", // trust-rollback risk -- see design doc §2
  "deviceBindingReplayLogFile", // replay-protection state must never travel
  "directRatchetSessionLogFile", // device-bound live session state
  "directRatchetSealedSecretLogFile", // sealed under a device-bound key -- cryptographically inert elsewhere
  "directRatchetResetRecordLogFile", // device-bound session lifecycle audit
  "directRatchetImportRecordLogFile", // device-bound session lifecycle audit
  "peerCapabilityObservationLogFile", // device-bound live capability announcement
  "syncJournalLogFile", // Own-Device Sync's own fact/snapshot model -- hard boundary
  "syncScheduleLogFile", // Own-Device Sync's own fact/snapshot model -- hard boundary
  "syncConflictLogFile", // Own-Device Sync's own fact/snapshot model -- hard boundary
  "archiveSuppressionInboundDedupLogFile", // Own-Device-Sync-adjacent
  "archiveSuppressionFanoutObservationLogFile", // Own-Device-Sync-adjacent
  "conversationTransportObservationLogFile", // ephemeral delivery bookkeeping, re-observed naturally
  "logsDirectory", // non-secret diagnostics, never durable meaningful data
  "sessionStateDirectory", // navigation/session UI state, never durable meaningful data
  // --- Lineage Reconciliation arc: fields added to FedosLocalProfilePaths
  // since this file was originally authored, now explicitly accounted for
  // rather than left to the silent-by-omission default (see this file's
  // own header) ---
  "directRatchetRemotePublicKeyLogFile", // Direct Ratchet Live-State Durability arc -- this device's own record of each peer's remote ratchet public key; device-bound, same reasoning as the other direct-ratchet-* exclusions
  "directRatchetLiveStateSnapshotLogFile", // Direct Ratchet Live-State Durability arc -- sealed under a device-bound key, cryptographically inert on a new device, same reasoning as directRatchetSealedSecretLogFile
  "peerDeviceAnnouncementIdentityLogFile", // Peer Device Discovery Arc -- THIS device's own deviceId + public key; including it would carry the old device identity forward, directly violating the "mint a fresh device identity on every restore" requirement
  "deviceSyncJournalInboundDedupLogFile", // Own-Device Sync Protocol Final Closure arc -- Own-Device Sync's own fact/snapshot model, same hard boundary as syncJournalLogFile/syncScheduleLogFile/syncConflictLogFile
];

/** Resolves the absolute source paths to read for a Data Part build, keyed by logical name. Pure; never touches the filesystem itself. */
export function fedosRecoveryBundleSourcePaths(paths: FedosLocalProfilePaths): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const [logicalName, field] of FEDOS_RECOVERY_BUNDLE_INCLUDED_LOGS) {
    out.set(logicalName, paths[field] as string);
  }
  return out;
}

/** Resolves the absolute destination path for one logical Data Part entry name, on a (typically fresh) target profile. `null` for an unrecognized name -- restore must never write an arbitrary caller-supplied name to disk. */
export function fedosRecoveryBundleDestinationPathFor(logicalName: string, paths: FedosLocalProfilePaths): string | null {
  const field = FEDOS_RECOVERY_BUNDLE_INCLUDED_LOGS.get(logicalName);
  if (field === undefined) return null;
  return paths[field] as string;
}
