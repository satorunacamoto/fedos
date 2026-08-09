/**
 * Secure Runtime Alpha 7721–7800 ("FedOS Archive Multi-Device Suppression
 * Propagation Arc") — Phases E/G/H: the Suppression Observation
 * Authority.
 *
 * The ONE local source of truth for suppression observations (Phase E's
 * own "choose exactly one" requirement) — records BOTH this Device's own
 * self-authored facts (created when the local `FedosPayloadRetentionAuthority`
 * makes a new tombstone/removal decision, see
 * `fedos_archive_suppression_local_bridge.ts`) and facts imported from
 * other trusted, same-account Devices (after Phase G's own inbound
 * validation — this class never itself verifies a signature or Device
 * trust; those are the inbound handler's own separate concern, called
 * BEFORE this class ever sees the fact).
 *
 * Conflict/rollback model (Phase A reconciliation report §8's own
 * decision): flat, per-`(subjectRef, sourceDeviceId)` monotonic
 * `revision` — a candidate whose `revision` is <= the max revision
 * already recorded for that exact `(subjectRef, sourceDeviceId)` pair is
 * REJECTED, mirroring Identity Transition's own rollback rule
 * (`candidate.revision &lt;= maxRevisionSoFar`) without that domain's
 * heavier predecessor-chain/cycle-detection machinery (not justified
 * here — a suppression fact has no lineage to walk, only a flat
 * monotonic count).
 *
 * `evaluateSuppression()` is the ONE query Phase H's Archive restore
 * integration calls — deliberately narrow (never exposes raw records to
 * a restore-time caller that only needs a yes/no answer).
 *
 * HARD GUARDRAILS:
 *   - Never mutates an already-recorded observation — `#tryRecord()`'s
 *     only outcomes are `"recorded"`/`"already-present"`/`"rollback-rejected"`/
 *     `"conflict"`/`"failed"`.
 *   - Never deletes/erases anything — matches this Arc's own "no
 *     forced deletion" absolute prohibition; `evaluateSuppression()`
 *     only ever gates a RESTORE, never triggers a write to any other
 *     port.
 */

import type {
  FedosArchiveSuppressionObservationOrigin,
  FedosPersistedArchiveSuppressionObservationV1,
} from "./fedos_persisted_archive_suppression_observation_v1.js";
import type { FedosArchiveSuppressionObservationPersistence } from "./fedos_archive_suppression_observation_persistence.js";
import type { FedosArchiveSuppressionFact } from "./fedos_archive_suppression_fact.js";
import type { FedosConversationPayloadId } from "../payload_storage/fedos_conversation_payload_id.js";

export type FedosArchiveSuppressionRecordOutcome = "recorded" | "already-present" | "rollback-rejected" | "conflict" | "failed";

export type FedosArchiveSuppressionEvidenceLevel = "self-authored" | "account-only" | "device-verified" | "device-evidence-invalid";

export type FedosSuppressionEvaluation = "active" | "suppressed";

export interface FedosArchiveSuppressionObservationAuthorityDependencies {
  readonly persistence: FedosArchiveSuppressionObservationPersistence;
  readonly now?: () => number;
}

function defaultNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export class FedosArchiveSuppressionObservationAuthority {
  readonly #persistence: FedosArchiveSuppressionObservationPersistence;
  readonly #now: () => number;

  constructor(dependencies: FedosArchiveSuppressionObservationAuthorityDependencies) {
    this.#persistence = dependencies.persistence;
    this.#now = dependencies.now ?? defaultNowSeconds;
  }

  /** Records THIS Device's own newly-created fact (origin: "self") — always trusted (it is this device's own decision), never subject to Device-evidence checks. Still subject to the SAME rollback/conflict rule as an imported fact, so a caller cannot accidentally regress its own prior revision either. */
  recordSelfSuppression(fact: FedosArchiveSuppressionFact): FedosArchiveSuppressionRecordOutcome {
    return this.#tryRecord(fact, "self", "self-authored", fact.decidedAt);
  }

  /** Records a fact imported from another trusted Device, AFTER the caller (the inbound handler, Phase G) has already verified account/Device trust and computed `evidenceLevel`. This method itself performs NO authentication -- it is a pure, local, revision-ordered write. */
  recordImportedSuppression(
    fact: FedosArchiveSuppressionFact,
    evidenceLevel: Exclude<FedosArchiveSuppressionEvidenceLevel, "self-authored">,
  ): FedosArchiveSuppressionRecordOutcome {
    return this.#tryRecord(fact, "imported", evidenceLevel, this.#now());
  }

  #tryRecord(
    fact: FedosArchiveSuppressionFact,
    origin: FedosArchiveSuppressionObservationOrigin,
    evidenceLevel: FedosArchiveSuppressionEvidenceLevel,
    receivedAt: number,
  ): FedosArchiveSuppressionRecordOutcome {
    const existingForSubjectSource = this.#persistence
      .listObservationsForSubject(fact.subjectRef)
      .filter((observation) => observation.sourceDeviceId === fact.sourceDeviceId);

    const maxRevisionSoFar = existingForSubjectSource.reduce((max, observation) => Math.max(max, observation.revision), -1);
    const alreadyHaveThisExactFact = existingForSubjectSource.some((observation) => observation.id === fact.factId);

    if (!alreadyHaveThisExactFact && fact.revision <= maxRevisionSoFar) {
      return "rollback-rejected";
    }

    const record: FedosPersistedArchiveSuppressionObservationV1 = {
      schemaVersion: 1,
      id: fact.factId,
      accountAuthority: fact.accountRef.authority,
      accountPublicIdentifier: fact.accountRef.publicIdentifier,
      accountIdentityId: fact.accountRef.identityId,
      sourceDeviceId: fact.sourceDeviceId,
      subjectType: fact.subjectType,
      subjectRef: fact.subjectRef,
      suppressionMeaning: fact.suppressionMeaning,
      revision: fact.revision,
      decidedAt: fact.decidedAt,
      nonce: fact.nonce,
      origin,
      evidenceLevel,
      receivedAt,
    };

    const result = this.#persistence.putObservation(record);
    if (result === "inserted") return "recorded";
    if (result === "already-present") return "already-present";
    if (result === "conflict") return "conflict";
    return "failed";
  }

  /**
   * The ONE query Archive restore (Phase H) consults. `"suppressed"` iff
   * at least one observation exists for `payloadId` whose
   * `suppressionMeaning` covers `meaning` and whose `evidenceLevel` is
   * NOT `"device-evidence-invalid"` (an evidence-invalid record is kept
   * for audit/diagnostic purposes but never itself suppresses anything —
   * a tampered/misattributed fact must never gain restore-suppression
   * power). `origin` (self vs. imported) does not matter here — both are
   * equally authoritative once past their own respective trust gate
   * (self-authored facts are trusted by construction; imported facts
   * already passed Phase G's inbound validation before ever reaching
   * this log).
   */
  evaluateSuppression(payloadId: FedosConversationPayloadId, meaning: "restore" | "envelope-restore" | "search-reindex"): FedosSuppressionEvaluation {
    const relevantMeanings: readonly string[] =
      meaning === "restore"
        ? ["suppress-payload-restore"]
        : meaning === "envelope-restore"
          ? ["suppress-envelope-restore"]
          : ["suppress-search-reindex"];

    const observations = this.#persistence.listObservationsForSubject(payloadId as unknown as string);
    const suppressed = observations.some(
      (observation) => relevantMeanings.includes(observation.suppressionMeaning) && observation.evidenceLevel !== "device-evidence-invalid",
    );
    return suppressed ? "suppressed" : "active";
  }

  listObservationsForSubject(payloadId: FedosConversationPayloadId): readonly FedosPersistedArchiveSuppressionObservationV1[] {
    return this.#persistence.listObservationsForSubject(payloadId as unknown as string);
  }
}
