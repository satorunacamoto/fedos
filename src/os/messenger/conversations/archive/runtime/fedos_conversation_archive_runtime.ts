/**
 * Secure Runtime Alpha 1691–1760 ("Conversation Archive Runtime
 * Integration and Recovery Operations Arc") — `FedosConversationArchiveRuntime`.
 *
 * Turns the Alpha 1541–1610 Archive Foundation (Collector / Encryption
 * Authority / Restore / Duplicate Detection — every one reused
 * UNMODIFIED, imported below) into a caller-invokable Local Runtime
 * operation, over the ONE new local-file boundary this Arc adds
 * (`../fs/fedos_conversation_archive_file_authority.ts`) and the ONE new
 * on-disk framing this Arc adds (`../fs/fedos_conversation_archive_file_container.ts`).
 *
 * API surface, exactly four operations, per this Arc's own scope —
 * never exposes a persistence port, a raw Authority, a key handle, or
 * any Host internal:
 *   - `exportConversationArchive()`
 *   - `inspectConversationArchive()`
 *   - `preflightRestore()`
 *   - `restoreConversationArchive()`
 *
 * LIFECYCLE: `isRuntimeRunning` is an INJECTED predicate (never an
 * internal mutable flag this class owns) — the owning Local Runtime
 * (`../../../desktop/runtime/fedos_desktop_runtime.ts`) passes a
 * closure reading its own already-existing `stopped` local variable.
 * Every public method checks it FIRST, before any await — so (a) a
 * caller who already holds a reference to this object from before
 * `stop()` was called still fails closed on every NEW call afterward
 * (Phase A item 4's own "fail closed after stop" requirement), and (b)
 * an already-in-flight call (already past that first check) is left to
 * run to completion, never cancelled — the documented, deliberate
 * choice for `stop()`'s own ordering (Phase F item 33: "let in-flight
 * operations complete... reject NEW operations immediately once
 * stopping has begun").
 *
 * NAMING: called "export"/"restore" of a "local user-controlled
 * encrypted archive" throughout — never "backup" (which would imply
 * continuous/automatic) and never "sync" (Phase F item 30).
 *
 * AUTHORIZATION (export only — Phase C item 11): a Conversation ID
 * alone never authorizes an export. `exportConversationArchive()`
 * additionally requires `localParticipant`, and independently resolves
 * the CURRENT Membership record for `(conversationId, localParticipant)`
 * via the SAME id derivation Membership itself already uses
 * (`toFedosConversationMembershipId`, Alpha 767, unchanged) — `"active"`
 * state required, or the whole call fails closed `"unauthorized"`
 * BEFORE any collection/encryption/file write is attempted.
 *
 * IDENTITY COMPATIBILITY (restore — Phase D item 18, stated plainly):
 * restoring an Archive requires being able to re-derive the SAME
 * per-conversation key the Export was originally sealed under
 * (`FedosMasterSeedAuthority.resolveConversationKey(localAccountIndex,
 * counterpartyPublicKeyHex)`, unchanged). There is no separate
 * "compatible restored authority" or "explicit import key" concept —
 * restoring into an identity that cannot resolve that exact key
 * receives the Encryption Authority's own existing, correct
 * `"key-unavailable"` outcome, surfaced here as `"identity-mismatch"`.
 * No workaround is built for this — it is the intended, fail-closed
 * behavior (Alpha 869, unchanged).
 *
 * BOUNDS (Phase B item 7 / Phase F item 32): `maxArchiveFileByteLength`
 * gates the WHOLE on-disk container (checked via `fs.stat` before any
 * content byte is read — see the File Authority's own header) and the
 * assembled container before it is ever written. `maxRecordCount` gates
 * the SUM of membership+capabilityEvent+envelope+payload counts, both
 * from the cleartext Manifest (before decrypting, wherever the Manifest
 * alone is enough) and again from the decrypted Bundle itself (defense
 * in depth) — `deserializeFedosConversationArchiveBundleFromBytes` is a
 * synchronous, whole-buffer `JSON.parse` (Alpha 1541–1610, unchanged);
 * this bound is enforced BEFORE that decode is ever reached wherever
 * possible, and is not a streaming guarantee.
 */

import type { FedosConversationId } from "../../fedos_conversation_id.js";
import type { FedosConversationPersistence } from "../../persistence/fedos_conversation_persistence.js";
import type { FedosConversationDraftPersistence } from "../../construction/fedos_conversation_draft_persistence.js";
import type { FedosConversationActivationPersistence } from "../../activation/fedos_conversation_activation_persistence.js";
import { resolveFedosConversationActiveConversation } from "../../activation/fedos_conversation_active_lookup.js";
import type { FedosConversationMembershipPersistence } from "../../membership/persistence/fedos_conversation_membership_persistence.js";
import type { FedosConversationCapabilityPersistence } from "../../capability/persistence/fedos_conversation_capability_persistence.js";
import type { FedosConversationMessageEnvelopePersistence } from "../../envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import type { FedosConversationPayloadStorage } from "../../payload_storage/fedos_conversation_payload_storage.js";
import type { FedosConversationParticipantReference } from "../../membership/fedos_conversation_participant_reference.js";
import { toFedosConversationMembershipId } from "../../membership/fedos_conversation_membership_id.js";
import type { FedosConversationEnvelopeEncryptionSuite } from "../../envelope/fedos_conversation_message_envelope.js";
import type { FedosBoardRuntimeClock } from "../../../board/runtime/fedos_board_runtime_clock.js";
import type { FedosGroupGenerationPersistence } from "../../group/fedos_group_generation.js";
import type { FedosGroupDirectPathPersistence } from "../../group/fedos_group_direct_path.js";
import type { FedosGroupMessagePersistence } from "../../group/fedos_group_message.js";
import type { FedosGroupFanoutDeliveryPersistence } from "../../group/fedos_group_fanout_delivery.js";
import type { FedosConversationArchiveBundleV1 } from "../fedos_conversation_archive_bundle.js";
import { collectFedosConversationArchiveBundle } from "../fedos_conversation_archive_collector.js";
import { restoreFedosConversationArchiveBundle, type FedosConversationArchiveRestoreResult, type FedosConversationArchiveSingleRecordOutcome, type FedosConversationArchiveRestoreOutcomeCounts } from "../fedos_conversation_archive_restore.js";
import { detectFedosConversationArchiveDuplicates, type FedosConversationArchiveDuplicateReport } from "../fedos_conversation_archive_duplicate_detection.js";
import type { FedosConversationArchiveEncryptionAuthority } from "../fedos_conversation_archive_encryption.js";
import type { FedosConversationArchiveManifestV1 } from "../fedos_conversation_archive_manifest.js";
import type { FedosPayloadRetentionAuthority } from "../../retention/fedos_payload_retention_authority.js";
import type { FedosArchiveSuppressionObservationAuthority } from "../../retention/fedos_archive_suppression_observation_authority.js";
import type { FedosConversationArchiveFileAuthority } from "../fs/fedos_conversation_archive_file_authority.js";
import { encodeFedosConversationArchiveFileContainer, decodeFedosConversationArchiveFileContainer } from "../fs/fedos_conversation_archive_file_container.js";

/** Phase B item 7's own explicit choice: this Arc's own default, not a Foundation default (the Foundation itself declares no bound). */
export const DEFAULT_FEDOS_CONVERSATION_ARCHIVE_MAX_BYTE_LENGTH = 64 * 1024 * 1024; // 64 MiB
export const DEFAULT_FEDOS_CONVERSATION_ARCHIVE_MAX_RECORD_COUNT = 200_000;

export interface FedosConversationArchiveRuntimeBounds {
  /** Ceiling on the WHOLE on-disk container file. */
  readonly maxArchiveFileByteLength: number;
  /** Ceiling on membership+capabilityEvent+envelope+payload counts, summed. */
  readonly maxRecordCount: number;
}

export const DEFAULT_FEDOS_CONVERSATION_ARCHIVE_RUNTIME_BOUNDS: FedosConversationArchiveRuntimeBounds = {
  maxArchiveFileByteLength: DEFAULT_FEDOS_CONVERSATION_ARCHIVE_MAX_BYTE_LENGTH,
  maxRecordCount: DEFAULT_FEDOS_CONVERSATION_ARCHIVE_MAX_RECORD_COUNT,
};

export interface FedosConversationArchiveRuntimeDependencies {
  readonly conversationPersistence: FedosConversationPersistence;
  /**
   * Secure Runtime Alpha 7801-7880 — OPTIONAL, additive pair (both or
   * neither): closes the packaged-product gap disclosed by Alpha
   * 7321-7400 and Alpha 7481-7560 — `exportConversationArchive()`'s own
   * existence check previously ONLY consulted `conversationPersistence`
   * (Board/public-only), so a real Direct Conversation (which never has
   * a record there) always failed `"conversation-not-found"` before
   * ever reaching the Collector. Consulted ONLY when
   * `conversationPersistence.getConversation()` itself returns `null`,
   * via the SAME `resolveFedosConversationActiveConversation()` helper
   * the Coordinators already use — never a new "is this real" rule.
   * Omitted entirely, this Runtime's own behavior for every existing
   * caller (Board conversations) is BYTE-FOR-BYTE UNCHANGED, and a
   * Direct conversationId still reports `"conversation-not-found"`
   * exactly as it always has.
   */
  readonly draftPersistence?: FedosConversationDraftPersistence;
  readonly activationPersistence?: FedosConversationActivationPersistence;
  readonly membershipPersistence: FedosConversationMembershipPersistence;
  readonly capabilityPersistence: FedosConversationCapabilityPersistence;
  readonly envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: FedosConversationPayloadStorage;
  /**
   * Secure Runtime Alpha 1921–1980 — the four Group-only persistence
   * ports this Runtime needs to additionally export/preflight/restore a
   * Group Section. ALL four optional, and meaningful only TOGETHER: a
   * caller who omits any of them gets the IDENTICAL Direct-only behavior
   * this Runtime has always had — `exportConversationArchive()` never
   * populates `group`, `preflightRestore()`/`restoreConversationArchive()`
   * never touch Group persistence at all.
   */
  readonly groupGenerationPersistence?: FedosGroupGenerationPersistence;
  readonly groupDirectPathPersistence?: FedosGroupDirectPathPersistence;
  readonly groupMessagePersistence?: FedosGroupMessagePersistence;
  readonly groupFanoutDeliveryPersistence?: FedosGroupFanoutDeliveryPersistence;
  readonly encryptionAuthority: FedosConversationArchiveEncryptionAuthority;
  readonly fileAuthority: FedosConversationArchiveFileAuthority;
  readonly clock: FedosBoardRuntimeClock;
  /** See this file's own header, "LIFECYCLE". */
  readonly isRuntimeRunning: () => boolean;
  readonly bounds?: FedosConversationArchiveRuntimeBounds;
  /**
   * Secure Runtime Alpha 7241-7320 — OPTIONAL, additive: see
   * `fedos_conversation_archive_collector.ts`'s own header for the full
   * account of the retention-gating gap this closes (Archive export
   * never enforced retention, even though Search already did from Alpha
   * 2581-2620 onward). Passed straight through to
   * `collectFedosConversationArchiveBundle()` on every `exportConversationArchive()`
   * call; omitted, export behavior is byte-for-byte unchanged.
   *
   * Secure Runtime Alpha 7481-7560 — the SAME dependency is now ALSO
   * passed through to `restoreFedosConversationArchiveBundle()` on every
   * `restoreConversationArchive()` call, which is why this Pick includes
   * `evaluateRetentionDecisionOnly` too (Restore's own defense-in-depth
   * gate; see `fedos_conversation_archive_restore.ts`'s header for why
   * `evaluatePayloadAccess()` alone is unsuitable for restore-time
   * gating). The real production `FedosPayloadRetentionAuthority` always
   * has both methods, so every existing caller is unaffected.
   */
  readonly retentionAuthority?: Pick<FedosPayloadRetentionAuthority, "evaluatePayloadAccess" | "evaluateRetentionDecisionOnly">;
  /**
   * Secure Runtime Alpha 7801-7880 — OPTIONAL, additive. Closes a real,
   * disclosed wiring gap this Arc found: `e048ff63` (FedOS Archive
   * Multi-Device Suppression Propagation Arc) fully implemented and
   * tested `suppressionAuthority` as a `restoreFedosConversationArchiveBundle()`
   * dependency, but no caller anywhere in this Runtime, nor
   * `fedos_desktop_runtime.ts`'s own production construction, ever
   * passed one through — that Arc's own real vertical slice calls
   * `restoreFedosConversationArchiveBundle()` directly, bypassing this
   * Runtime entirely, so the gap was invisible to its own tests. Passed
   * straight through to `restoreConversationArchive()` below; omitted,
   * restore behavior is byte-for-byte unchanged from `e048ff63`'s own
   * (already-inert-in-production) state.
   */
  readonly suppressionAuthority?: Pick<FedosArchiveSuppressionObservationAuthority, "evaluateSuppression">;
}

export interface FedosConversationArchiveExportRequest {
  readonly conversationId: string;
  readonly destinationPath: string;
  readonly localParticipant: FedosConversationParticipantReference;
  readonly localAccountIndex: number;
  readonly counterpartyPublicKeyHex: string;
  readonly suite: FedosConversationEnvelopeEncryptionSuite;
}

/** Closed set, Phase C item 12 — never a raw `Error`. */
export type FedosConversationArchiveExportOutcome =
  | "exported"
  | "already-exists"
  | "unauthorized"
  | "conversation-not-found"
  | "crypto-unavailable"
  | "storage-unavailable"
  | "too-large"
  | "write-failed"
  | "failed";

export interface FedosConversationArchiveExportResult {
  readonly outcome: FedosConversationArchiveExportOutcome;
  /** Present only when `outcome === "exported"`. */
  readonly manifest?: FedosConversationArchiveManifestV1;
}

export type FedosConversationArchiveInspectionOutcome = "inspected" | "not-found" | "invalid" | "too-large" | "failed";

export interface FedosConversationArchiveInspectionResult {
  readonly outcome: FedosConversationArchiveInspectionOutcome;
  /** Present only when `outcome === "inspected"`. Never requires decryption to produce. */
  readonly manifest?: FedosConversationArchiveManifestV1;
}

export interface FedosConversationArchiveRestoreRequest {
  readonly sourcePath: string;
  readonly localAccountIndex: number;
  readonly counterpartyPublicKeyHex: string;
  readonly suite: FedosConversationEnvelopeEncryptionSuite;
}

export type FedosConversationArchivePreflightOutcome =
  | "previewed"
  | "not-found"
  | "invalid-archive"
  | "integrity-failed"
  | "identity-mismatch"
  | "unsupported-version"
  | "too-large"
  | "failed";

export interface FedosConversationArchivePreflightResult {
  readonly outcome: FedosConversationArchivePreflightOutcome;
  readonly manifest?: FedosConversationArchiveManifestV1;
  /** Present only when `outcome === "previewed"` — see `detectFedosConversationArchiveDuplicates()`. */
  readonly report?: FedosConversationArchiveDuplicateReport;
}

/**
 * Closed set, Phase D item 23. `"partial-recovery-required"` is
 * INTENTIONALLY never produced by this Arc's own implementation — see
 * this file's own header and Phase D item 20's own reasoning: restore
 * replays through each port's own idempotent `put*` semantics in one
 * call, so a fresh restore attempt after any interruption already
 * converges safely on its own (Phase E test 27c/27d cover this) without
 * any dedicated recovery step. The token remains in this closed
 * vocabulary because a FUTURE Arc that chunks restore across multiple
 * calls could legitimately need it; inventing the coordination record
 * to produce it TODAY, with no real chunking, would be exactly the
 * "speculative abstraction" this repository's standing rules forbid.
 */
export type FedosConversationArchiveRestoreOutcome =
  | "restored"
  | "already-present"
  | "conflicts-found"
  /**
   * Alpha 1691-1760 own reconciliation fix — the decrypted, integrity-verified
   * Bundle contained one or more CHILD records (membership/capabilityEvent/
   * envelope/payload) that failed their own domain's deep `deserializeX()`
   * validation and were skipped (`restoreFedosConversationArchiveBundle()`'s own
   * pre-existing `invalid` tally, Alpha 1541-1610, previously computed but never
   * surfaced here). Content-hash integrity binds the CIPHERTEXT bytes to the
   * Manifest, never each individual record's own structural well-formedness, so
   * this is reachable even from a genuinely, cryptographically authentic Archive.
   * Distinct from "invalid-archive" (the archive itself could not even be
   * decoded/decrypted) -- here, decode/decrypt/integrity all succeeded and every
   * VALID record was restored; only the invalid ones were skipped. Without this
   * outcome, such a restore would silently report "restored"/"already-present"
   * despite incomplete data -- see the Phase A reconciliation report's own
   * "partial restore falsely reported as complete" finding.
   */
  | "partially-invalid"
  /**
   * Secure Runtime Alpha 7481-7560 (FedOS Archive Envelope Retention
   * Parity and Metadata Deletion Semantics Arc) — one or more
   * Envelope/Payload records were structurally VALID and passed deep
   * validation, but this RESTORING device's own CURRENT Retention
   * Authority denies them (already tombstoned/removed locally) and they
   * were skipped, never written. Deliberately DISTINCT from
   * `"partially-invalid"`: a denied record is not malformed, it is
   * correctly, intentionally suppressed — "Do not collapse all deletion
   * meanings into one boolean." See the Export/Restore Parity
   * Specification.
   */
  | "partially-denied"
  | "invalid-archive"
  | "integrity-failed"
  | "identity-mismatch"
  | "unsupported-version"
  | "partial-recovery-required"
  | "persistence-failed"
  | "failed";

export interface FedosConversationArchiveRestoreResultSummary {
  readonly outcome: FedosConversationArchiveRestoreOutcome;
  readonly manifest?: FedosConversationArchiveManifestV1;
  /** Present whenever a Bundle was actually replayed (every outcome except the pre-decrypt failures). Exact per-domain tallies from `restoreFedosConversationArchiveBundle()`, unmodified. */
  readonly details?: FedosConversationArchiveRestoreResult;
}

/** Internal-only staging outcome vocabulary — exactly `Exclude<FedosConversationArchivePreflightOutcome, "previewed">`, kept as its own named type so `#stageDecryptedBundle`'s signature does not need a type-level `Exclude<>`/intersection. */
type FedosConversationArchiveStageOutcome = "not-found" | "invalid-archive" | "integrity-failed" | "identity-mismatch" | "unsupported-version" | "too-large" | "failed";

type FedosConversationArchiveStageResult =
  | { readonly outcome: "staged"; readonly manifest: FedosConversationArchiveManifestV1; readonly bundle: FedosConversationArchiveBundleV1 }
  | { readonly outcome: FedosConversationArchiveStageOutcome; readonly manifest?: FedosConversationArchiveManifestV1 };

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

/** Secure Runtime Alpha 1921–1980 — the CLEARTEXT-manifest-based bound check, extended to also account for the Group Section's own counts (present all-or-nothing on the Manifest — see `fedos_conversation_archive_manifest_codec.ts`'s own "all-or-nothing" discipline) — `groupChildRecordCount` alone already captures the fanout-multiplication concern (N generations x M paths x K messages x recipients), since it is the SUM of every child Direct Conversation's own membership+capabilityEvent+envelope+payload counts. */
function sumRecordCounts(counts: {
  readonly membershipCount: number;
  readonly capabilityEventCount: number;
  readonly envelopeCount: number;
  readonly payloadCount: number;
  readonly groupGenerationCount?: number;
  readonly groupPathCount?: number;
  readonly groupMessageCount?: number;
  readonly groupFanoutDeliveryCount?: number;
  readonly groupChildRecordCount?: number;
}): number {
  const base = counts.membershipCount + counts.capabilityEventCount + counts.envelopeCount + counts.payloadCount;
  if (counts.groupGenerationCount === undefined) return base;
  return (
    base +
    counts.groupGenerationCount +
    (counts.groupPathCount ?? 0) +
    (counts.groupMessageCount ?? 0) +
    (counts.groupFanoutDeliveryCount ?? 0) +
    (counts.groupChildRecordCount ?? 0)
  );
}

/** Secure Runtime Alpha 1921–1980 — the DECRYPTED-bundle-based bound check (defense in depth alongside `sumRecordCounts()` above), walking the Group Section's own record counts AND recursing into every child Direct Conversation bundle — the real "fanout multiplication" this Arc's own resource bounds must account for. */
function countBundleRecordsRecursive(bundle: FedosConversationArchiveBundleV1): number {
  let total = bundle.memberships.length + bundle.capabilityEvents.length + bundle.envelopes.length + bundle.payloads.length;
  if (bundle.group !== undefined) {
    total += bundle.group.generations.length + bundle.group.paths.length + bundle.group.messages.length + bundle.group.fanoutDeliveries.length;
    for (const child of bundle.group.childConversations) total += countBundleRecordsRecursive(child);
  }
  return total;
}

/** Secure Runtime Alpha 1921–1980 — flattens every conversation-level outcome (top-level + every nested child Direct Conversation) and every per-domain outcome-counts object (base five + Group Section's own four + every child's own, recursively) out of one `FedosConversationArchiveRestoreResult` tree, so `restoreConversationArchive()`'s own rollup logic can treat "any failure/conflict/invalid/insert anywhere in the whole Group graph" uniformly, without a second, duplicated traversal. */
function flattenRestoreResult(result: FedosConversationArchiveRestoreResult): {
  readonly conversationOutcomes: readonly FedosConversationArchiveSingleRecordOutcome[];
  readonly countGroups: readonly FedosConversationArchiveRestoreOutcomeCounts[];
} {
  const conversationOutcomes: FedosConversationArchiveSingleRecordOutcome[] = [result.conversation];
  const countGroups: FedosConversationArchiveRestoreOutcomeCounts[] = [result.memberships, result.capabilityEvents, result.envelopes, result.payloads];
  if (result.group !== undefined) {
    countGroups.push(result.group.generations, result.group.paths, result.group.messages, result.group.fanoutDeliveries);
    for (const child of result.group.childConversations) {
      const nested = flattenRestoreResult(child);
      conversationOutcomes.push(...nested.conversationOutcomes);
      countGroups.push(...nested.countGroups);
    }
  }
  return { conversationOutcomes, countGroups };
}

export class FedosConversationArchiveRuntime {
  readonly #deps: FedosConversationArchiveRuntimeDependencies;
  readonly #bounds: FedosConversationArchiveRuntimeBounds;

  constructor(deps: FedosConversationArchiveRuntimeDependencies) {
    this.#deps = deps;
    this.#bounds = deps.bounds ?? DEFAULT_FEDOS_CONVERSATION_ARCHIVE_RUNTIME_BOUNDS;
  }

  /** Secure Runtime Alpha 1921–1980 — the four Group-only ports as one bundle, or `undefined` when ANY of them was omitted (all-or-nothing — mirrors every Group deps object's own identical "meaningful only together" discipline throughout this Arc). */
  #groupDeps():
    | {
        readonly groupGenerationPersistence: FedosGroupGenerationPersistence;
        readonly groupDirectPathPersistence: FedosGroupDirectPathPersistence;
        readonly groupMessagePersistence: FedosGroupMessagePersistence;
        readonly groupFanoutDeliveryPersistence: FedosGroupFanoutDeliveryPersistence;
      }
    | undefined {
    const { groupGenerationPersistence, groupDirectPathPersistence, groupMessagePersistence, groupFanoutDeliveryPersistence } = this.#deps;
    if (
      groupGenerationPersistence === undefined ||
      groupDirectPathPersistence === undefined ||
      groupMessagePersistence === undefined ||
      groupFanoutDeliveryPersistence === undefined
    ) {
      return undefined;
    }
    return { groupGenerationPersistence, groupDirectPathPersistence, groupMessagePersistence, groupFanoutDeliveryPersistence };
  }

  async exportConversationArchive(request: FedosConversationArchiveExportRequest): Promise<FedosConversationArchiveExportResult> {
    if (!this.#deps.isRuntimeRunning()) return { outcome: "failed" };
    if (!isNonEmptyString(request.conversationId) || !isNonEmptyString(request.destinationPath)) return { outcome: "failed" };
    if (!Number.isInteger(request.localAccountIndex) || request.localAccountIndex < 0) return { outcome: "failed" };

    const conversationId = request.conversationId as FedosConversationId;
    const conversation = this.#deps.conversationPersistence.getConversation(conversationId);
    // Secure Runtime Alpha 7801-7880 -- a Board record is checked FIRST
    // (byte-for-byte the pre-existing lookup); only when it is absent
    // AND both Direct-support dependencies are wired is the REAL Direct
    // Conversation existence fact consulted -- see this file's own
    // dependency-doc comment above.
    if (conversation === null) {
      const directlySupported = this.#deps.draftPersistence !== undefined && this.#deps.activationPersistence !== undefined;
      const isRealDirectConversation =
        directlySupported &&
        resolveFedosConversationActiveConversation(this.#deps.draftPersistence!, this.#deps.activationPersistence!, conversationId).outcome === "active";
      if (!isRealDirectConversation) return { outcome: "conversation-not-found" };
    }

    // Phase C item 11 -- a Conversation ID alone never authorizes export.
    const membershipId = toFedosConversationMembershipId(conversationId, request.localParticipant);
    const membership = this.#deps.membershipPersistence.getMembership(membershipId);
    if (membership === null || membership.state !== "active") return { outcome: "unauthorized" };

    const bundle = collectFedosConversationArchiveBundle(
      conversationId,
      {
        conversationPersistence: this.#deps.conversationPersistence,
        draftPersistence: this.#deps.draftPersistence,
        activationPersistence: this.#deps.activationPersistence,
        membershipPersistence: this.#deps.membershipPersistence,
        capabilityPersistence: this.#deps.capabilityPersistence,
        envelopePersistence: this.#deps.envelopePersistence,
        payloadStorage: this.#deps.payloadStorage,
        group: this.#groupDeps(),
        retentionAuthority: this.#deps.retentionAuthority,
      },
      this.#deps.clock(),
    );
    if (bundle === null) return { outcome: "conversation-not-found" };

    // Secure Runtime Alpha 1921-1980 -- recurses into the Group Section (generations/paths/messages/
    // fanoutDeliveries) and every child Direct Conversation bundle's own counts, the real
    // "fanout multiplication" (N generations x M paths x K messages x recipients) this bound must
    // account for; identical to the flat sum below for a Direct-only (no `group`) bundle.
    const recordCount = countBundleRecordsRecursive(bundle);
    if (recordCount > this.#bounds.maxRecordCount) return { outcome: "too-large" };

    const exported = await this.#deps.encryptionAuthority.export({
      bundle,
      suite: request.suite,
      localAccountIndex: request.localAccountIndex,
      counterpartyPublicKeyHex: request.counterpartyPublicKeyHex,
    });
    if (exported.outcome === "key-unavailable") return { outcome: "crypto-unavailable" };
    if (exported.outcome === "invalid-input" || exported.outcome === "failed") return { outcome: "failed" };

    const container = encodeFedosConversationArchiveFileContainer(exported.manifest, exported.ciphertext);
    if (container.length > this.#bounds.maxArchiveFileByteLength) return { outcome: "too-large" };

    const writeResult = await this.#deps.fileAuthority.createArchiveExclusive(request.destinationPath, container);
    switch (writeResult.outcome) {
      case "written":
        return { outcome: "exported", manifest: exported.manifest };
      case "already-exists":
        return { outcome: "already-exists" };
      case "is-directory":
        return { outcome: "write-failed" };
      case "parent-missing":
        return { outcome: "storage-unavailable" };
      case "failed":
        return { outcome: "write-failed" };
    }
  }

  async inspectConversationArchive(sourcePath: string): Promise<FedosConversationArchiveInspectionResult> {
    if (!this.#deps.isRuntimeRunning()) return { outcome: "failed" };
    if (!isNonEmptyString(sourcePath)) return { outcome: "failed" };

    const read = await this.#deps.fileAuthority.readArchive(sourcePath, this.#bounds.maxArchiveFileByteLength);
    if (read.outcome === "not-found") return { outcome: "not-found" };
    if (read.outcome === "is-directory") return { outcome: "invalid" };
    if (read.outcome === "too-large") return { outcome: "too-large" };
    if (read.outcome === "failed") return { outcome: "failed" };

    const decoded = decodeFedosConversationArchiveFileContainer(read.bytes);
    if (decoded.outcome === "malformed") return { outcome: "invalid" };
    // Alpha 1691-1760 -- inspectConversationArchive() never attempts a full restore; an
    // unsupported schema version is still reported as "invalid" here (never decrypted, never
    // replayed) -- the caller-facing DISTINCTION between "malformed" and "wrong version" matters
    // for preflight/restore's own closed vocabulary, not for a pure inspection.
    if (decoded.outcome === "unsupported-version") return { outcome: "invalid" };

    return { outcome: "inspected", manifest: decoded.manifest };
  }

  async preflightRestore(request: FedosConversationArchiveRestoreRequest): Promise<FedosConversationArchivePreflightResult> {
    if (!this.#deps.isRuntimeRunning()) return { outcome: "failed" };

    const staged = await this.#stageDecryptedBundle(request);
    if (staged.outcome !== "staged") return { outcome: staged.outcome, manifest: staged.manifest };

    // Secure Runtime Alpha 7481-7560 -- preflightRestore() is a READ-ONLY
    // preview (duplicate detection only); it never writes anything, so
    // this Arc's own retention re-evaluation (a write-time gate) does not
    // apply here -- it applies in restoreConversationArchive() below, the
    // only place a write ever occurs.
    const report = detectFedosConversationArchiveDuplicates(staged.bundle, {
      conversationPersistence: this.#deps.conversationPersistence,
      membershipPersistence: this.#deps.membershipPersistence,
      capabilityPersistence: this.#deps.capabilityPersistence,
      envelopePersistence: this.#deps.envelopePersistence,
      payloadStorage: this.#deps.payloadStorage,
      group: this.#groupDeps(),
    });
    return { outcome: "previewed", manifest: staged.manifest, report };
  }

  async restoreConversationArchive(request: FedosConversationArchiveRestoreRequest): Promise<FedosConversationArchiveRestoreResultSummary> {
    if (!this.#deps.isRuntimeRunning()) return { outcome: "failed" };

    // Alpha 1691-1760 Phase D item 24 -- restoreConversationArchive() never trusts that a caller
    // already ran preflightRestore(); it independently repeats the full read/decode/decrypt/bounds
    // gate below, exactly as preflightRestore() itself does.
    const staged = await this.#stageDecryptedBundle(request);
    if (staged.outcome !== "staged") {
      // The staging pipeline's own vocabulary ("not-found"/"too-large") has no dedicated token in
      // FedosConversationArchiveRestoreOutcome's closed set (Phase D item 23) -- both collapse
      // honestly into "invalid-archive" (a source that cannot even be attempted is exactly that),
      // never a generic "failed", which this Arc reserves for genuinely unexpected exceptions.
      const outcome: FedosConversationArchiveRestoreOutcome =
        staged.outcome === "not-found" || staged.outcome === "too-large" ? "invalid-archive" : staged.outcome;
      return { outcome, manifest: staged.manifest };
    }

    // Secure Runtime Alpha 7481-7560 -- the SAME `retentionAuthority` this
    // Runtime already threads into export is now ALSO threaded into
    // restore, as write-time defense-in-depth (see the Export/Restore
    // Parity Specification). Omitted entirely, restore behavior is
    // byte-for-byte unchanged from before this Arc.
    const details = restoreFedosConversationArchiveBundle(staged.bundle, {
      conversationPersistence: this.#deps.conversationPersistence,
      draftPersistence: this.#deps.draftPersistence,
      membershipPersistence: this.#deps.membershipPersistence,
      capabilityPersistence: this.#deps.capabilityPersistence,
      envelopePersistence: this.#deps.envelopePersistence,
      payloadStorage: this.#deps.payloadStorage,
      group: this.#groupDeps(),
      retentionAuthority: this.#deps.retentionAuthority,
      suppressionAuthority: this.#deps.suppressionAuthority,
    });

    if (details.conversation === "invalid" || details.conversation === "failed") {
      return { outcome: details.conversation === "invalid" ? "invalid-archive" : "persistence-failed", manifest: staged.manifest, details };
    }

    // Secure Runtime Alpha 1921-1980 -- flattens the top-level conversation outcome PLUS every nested
    // child Direct Conversation's own conversation outcome (from the Group Section, if present) into
    // one list, and every per-domain counts object (base five + Group Section's own four + every
    // child's own, recursively) into another -- so a failure/conflict/invalid ANYWHERE in the whole
    // Group graph is treated exactly like a failure/conflict/invalid in the top-level five domains
    // always were. The top-level `details.conversation` was already handled above (this function
    // still never treats an "invalid"/"failed" TOP-LEVEL conversation as anything but the immediate,
    // pre-existing outcome that check produces) -- this rollup additionally catches the SAME states
    // occurring on a nested child.
    const { conversationOutcomes, countGroups } = flattenRestoreResult(details);
    const groups = countGroups;
    const anyFailed = groups.some((group) => group.failed > 0) || conversationOutcomes.some((o) => o === "failed");
    if (anyFailed) return { outcome: "persistence-failed", manifest: staged.manifest, details };

    const anyConflict = conversationOutcomes.some((o) => o === "conflict") || groups.some((group) => group.conflict > 0);
    if (anyConflict) return { outcome: "conflicts-found", manifest: staged.manifest, details };

    // Alpha 1691-1760 reconciliation fix -- see FedosConversationArchiveRestoreOutcome's own
    // "partially-invalid" doc comment for why this check is required, not optional: without it, a
    // Bundle with some individually-invalid child records would fall through to "restored"/
    // "already-present" below despite those records never having been written anywhere.
    const anyInvalid = groups.some((group) => group.invalid > 0) || conversationOutcomes.some((o) => o === "invalid");
    if (anyInvalid) return { outcome: "partially-invalid", manifest: staged.manifest, details };

    // Secure Runtime Alpha 7481-7560 -- mirrors the "partially-invalid"
    // check immediately above, for a DIFFERENT, deliberately distinct
    // reason: one or more structurally-valid records were correctly
    // suppressed by this device's own current Retention Authority (see
    // `isPayloadPermittedForRestore()`). Never conflated with
    // "partially-invalid" — a denied record is not malformed.
    const anyDenied = groups.some((group) => group.denied > 0);
    if (anyDenied) return { outcome: "partially-denied", manifest: staged.manifest, details };

    const anyInserted = conversationOutcomes.some((o) => o === "inserted") || groups.some((group) => group.inserted > 0);
    if (!anyInserted) return { outcome: "already-present", manifest: staged.manifest, details };

    return { outcome: "restored", manifest: staged.manifest, details };
  }

  /** Shared read -> decode -> schema-check -> decrypt -> bounds-check pipeline for both `preflightRestore()` and `restoreConversationArchive()` — see this file's own header, "IDENTITY COMPATIBILITY" and "BOUNDS". Never writes anything. */
  async #stageDecryptedBundle(request: FedosConversationArchiveRestoreRequest): Promise<FedosConversationArchiveStageResult> {
    if (!isNonEmptyString(request.sourcePath)) return { outcome: "failed" };
    if (!Number.isInteger(request.localAccountIndex) || request.localAccountIndex < 0) return { outcome: "failed" };

    const read = await this.#deps.fileAuthority.readArchive(request.sourcePath, this.#bounds.maxArchiveFileByteLength);
    if (read.outcome === "not-found") return { outcome: "not-found" };
    if (read.outcome === "is-directory") return { outcome: "invalid-archive" };
    if (read.outcome === "too-large") return { outcome: "too-large" };
    if (read.outcome === "failed") return { outcome: "failed" };

    const decoded = decodeFedosConversationArchiveFileContainer(read.bytes);
    if (decoded.outcome === "malformed") return { outcome: "invalid-archive" };
    if (decoded.outcome === "unsupported-version") return { outcome: "unsupported-version" };

    const manifest = decoded.manifest;
    if (sumRecordCounts(manifest) > this.#bounds.maxRecordCount) return { outcome: "too-large" };

    const imported = await this.#deps.encryptionAuthority.import({
      manifest,
      ciphertext: decoded.ciphertext,
      suite: request.suite,
      localAccountIndex: request.localAccountIndex,
      counterpartyPublicKeyHex: request.counterpartyPublicKeyHex,
    });
    if (imported.outcome === "manifest-mismatch") return { outcome: "integrity-failed", manifest };
    if (imported.outcome === "key-unavailable") return { outcome: "identity-mismatch", manifest };
    if (imported.outcome === "invalid-input" || imported.outcome === "failed") return { outcome: "failed", manifest };

    const bundle = imported.bundle;
    const recordCount = countBundleRecordsRecursive(bundle);
    if (recordCount > this.#bounds.maxRecordCount) return { outcome: "too-large", manifest };

    return { outcome: "staged", manifest, bundle };
  }
}

/** Thin factory — mirrors `createFedosConversationRuntime()`'s own style (Alpha 923). Constructs no port/authority itself; only assembles the runtime over injected ones. */
export function createFedosConversationArchiveRuntime(deps: FedosConversationArchiveRuntimeDependencies): FedosConversationArchiveRuntime {
  return new FedosConversationArchiveRuntime(deps);
}
