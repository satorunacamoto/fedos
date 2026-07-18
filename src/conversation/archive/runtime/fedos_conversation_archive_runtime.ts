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
import type { FedosConversationMembershipPersistence } from "../../membership/persistence/fedos_conversation_membership_persistence.js";
import type { FedosConversationCapabilityPersistence } from "../../capability/persistence/fedos_conversation_capability_persistence.js";
import type { FedosConversationMessageEnvelopePersistence } from "../../envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import type { FedosConversationPayloadStorage } from "../../payload_storage/fedos_conversation_payload_storage.js";
import type { FedosConversationParticipantReference } from "../../membership/fedos_conversation_participant_reference.js";
import { toFedosConversationMembershipId } from "../../membership/fedos_conversation_membership_id.js";
import type { FedosConversationEnvelopeEncryptionSuite } from "../../envelope/fedos_conversation_message_envelope.js";
import type { FedosBoardRuntimeClock } from "../../../board/runtime/fedos_board_runtime_clock.js";
import type { FedosConversationArchiveBundleV1 } from "../fedos_conversation_archive_bundle.js";
import { collectFedosConversationArchiveBundle } from "../fedos_conversation_archive_collector.js";
import { restoreFedosConversationArchiveBundle, type FedosConversationArchiveRestoreResult } from "../fedos_conversation_archive_restore.js";
import { detectFedosConversationArchiveDuplicates, type FedosConversationArchiveDuplicateReport } from "../fedos_conversation_archive_duplicate_detection.js";
import type { FedosConversationArchiveEncryptionAuthority } from "../fedos_conversation_archive_encryption.js";
import type { FedosConversationArchiveManifestV1 } from "../fedos_conversation_archive_manifest.js";
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
  readonly membershipPersistence: FedosConversationMembershipPersistence;
  readonly capabilityPersistence: FedosConversationCapabilityPersistence;
  readonly envelopePersistence: FedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: FedosConversationPayloadStorage;
  readonly encryptionAuthority: FedosConversationArchiveEncryptionAuthority;
  readonly fileAuthority: FedosConversationArchiveFileAuthority;
  readonly clock: FedosBoardRuntimeClock;
  /** See this file's own header, "LIFECYCLE". */
  readonly isRuntimeRunning: () => boolean;
  readonly bounds?: FedosConversationArchiveRuntimeBounds;
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

function sumRecordCounts(counts: {
  readonly membershipCount: number;
  readonly capabilityEventCount: number;
  readonly envelopeCount: number;
  readonly payloadCount: number;
}): number {
  return counts.membershipCount + counts.capabilityEventCount + counts.envelopeCount + counts.payloadCount;
}

export class FedosConversationArchiveRuntime {
  readonly #deps: FedosConversationArchiveRuntimeDependencies;
  readonly #bounds: FedosConversationArchiveRuntimeBounds;

  constructor(deps: FedosConversationArchiveRuntimeDependencies) {
    this.#deps = deps;
    this.#bounds = deps.bounds ?? DEFAULT_FEDOS_CONVERSATION_ARCHIVE_RUNTIME_BOUNDS;
  }

  async exportConversationArchive(request: FedosConversationArchiveExportRequest): Promise<FedosConversationArchiveExportResult> {
    if (!this.#deps.isRuntimeRunning()) return { outcome: "failed" };
    if (!isNonEmptyString(request.conversationId) || !isNonEmptyString(request.destinationPath)) return { outcome: "failed" };
    if (!Number.isInteger(request.localAccountIndex) || request.localAccountIndex < 0) return { outcome: "failed" };

    const conversationId = request.conversationId as FedosConversationId;
    const conversation = this.#deps.conversationPersistence.getConversation(conversationId);
    if (conversation === null) return { outcome: "conversation-not-found" };

    // Phase C item 11 -- a Conversation ID alone never authorizes export.
    const membershipId = toFedosConversationMembershipId(conversationId, request.localParticipant);
    const membership = this.#deps.membershipPersistence.getMembership(membershipId);
    if (membership === null || membership.state !== "active") return { outcome: "unauthorized" };

    const bundle = collectFedosConversationArchiveBundle(
      conversationId,
      {
        conversationPersistence: this.#deps.conversationPersistence,
        membershipPersistence: this.#deps.membershipPersistence,
        capabilityPersistence: this.#deps.capabilityPersistence,
        envelopePersistence: this.#deps.envelopePersistence,
        payloadStorage: this.#deps.payloadStorage,
      },
      this.#deps.clock(),
    );
    if (bundle === null) return { outcome: "conversation-not-found" };

    const recordCount =
      bundle.memberships.length + bundle.capabilityEvents.length + bundle.envelopes.length + bundle.payloads.length;
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

    const report = detectFedosConversationArchiveDuplicates(staged.bundle, {
      conversationPersistence: this.#deps.conversationPersistence,
      membershipPersistence: this.#deps.membershipPersistence,
      capabilityPersistence: this.#deps.capabilityPersistence,
      envelopePersistence: this.#deps.envelopePersistence,
      payloadStorage: this.#deps.payloadStorage,
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

    const details = restoreFedosConversationArchiveBundle(staged.bundle, {
      conversationPersistence: this.#deps.conversationPersistence,
      membershipPersistence: this.#deps.membershipPersistence,
      capabilityPersistence: this.#deps.capabilityPersistence,
      envelopePersistence: this.#deps.envelopePersistence,
      payloadStorage: this.#deps.payloadStorage,
    });

    if (details.conversation === "invalid" || details.conversation === "failed") {
      return { outcome: details.conversation === "invalid" ? "invalid-archive" : "persistence-failed", manifest: staged.manifest, details };
    }

    const groups = [details.memberships, details.capabilityEvents, details.envelopes, details.payloads];
    const anyFailed = groups.some((group) => group.failed > 0);
    if (anyFailed) return { outcome: "persistence-failed", manifest: staged.manifest, details };

    const anyConflict = details.conversation === "conflict" || groups.some((group) => group.conflict > 0);
    if (anyConflict) return { outcome: "conflicts-found", manifest: staged.manifest, details };

    // Alpha 1691-1760 reconciliation fix -- see FedosConversationArchiveRestoreOutcome's own
    // "partially-invalid" doc comment for why this check is required, not optional: without it, a
    // Bundle with some individually-invalid child records would fall through to "restored"/
    // "already-present" below despite those records never having been written anywhere.
    const anyInvalid = groups.some((group) => group.invalid > 0);
    if (anyInvalid) return { outcome: "partially-invalid", manifest: staged.manifest, details };

    const anyInserted = details.conversation === "inserted" || groups.some((group) => group.inserted > 0);
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
    const recordCount = bundle.memberships.length + bundle.capabilityEvents.length + bundle.envelopes.length + bundle.payloads.length;
    if (recordCount > this.#bounds.maxRecordCount) return { outcome: "too-large", manifest };

    return { outcome: "staged", manifest, bundle };
  }
}

/** Thin factory — mirrors `createFedosConversationRuntime()`'s own style (Alpha 923). Constructs no port/authority itself; only assembles the runtime over injected ones. */
export function createFedosConversationArchiveRuntime(deps: FedosConversationArchiveRuntimeDependencies): FedosConversationArchiveRuntime {
  return new FedosConversationArchiveRuntime(deps);
}
