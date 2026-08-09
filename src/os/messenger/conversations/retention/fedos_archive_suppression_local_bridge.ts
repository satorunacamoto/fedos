/**
 * Secure Runtime Alpha 7721–7800 ("FedOS Archive Multi-Device Suppression
 * Propagation Arc") — Phase F step 1-2: the bridge from a local
 * Retention/Deletion decision to a self-authored suppression fact.
 *
 * Deliberately a STANDALONE function, never a modification to
 * `fedos_deletion_execution_coordinator.ts` or
 * `fedos_payload_retention_authority.ts` themselves — both are Local
 * Deletion's/Retention's own closed, already-reviewed mutation
 * boundaries ("Do not reopen those semantics," this Arc's own mission
 * instruction; the Execution Coordinator's own header additionally
 * states it is "the ONLY mutating layer... no new mutation path of its
 * own"). A caller invokes this function AFTER a local retention
 * transition has already succeeded (e.g. right after
 * `executeFedosLocalPayloadDeletionPlan()` returns `"executed"`/
 * `"already-executed"` with a `"tombstoned"`/`"payload-removed"` step),
 * composing the two, exactly matching this codebase's own repeated
 * "narrowest boundary, caller composes" discipline (e.g. Archive
 * Restore's own optional `retentionAuthority` dependency, added
 * additively by `feff676` without touching Retention's own file).
 *
 * `nextRevisionForSubject()` derives the next monotonic revision for
 * `(subjectRef, sourceDeviceId)` from the Suppression Observation
 * Authority's own existing records — never a caller-supplied counter,
 * so two independent callers racing to create a fact for the same
 * subject can never silently produce two facts with the same revision.
 */

import { randomBytes as nobleRandomBytes, bytesToHex } from "@noble/hashes/utils.js";
import type { FedosConversationPayloadId } from "../../../../conversation/payload_storage/fedos_conversation_payload_id.js";
import type { FedosDeviceBindingAccountRef } from "../../../../device/fedos_device_binding.js";
import {
  createFedosArchiveSuppressionFact,
  type FedosArchiveSuppressionFact,
  type FedosArchiveSuppressionMeaning,
} from "../../../../conversation/retention/fedos_archive_suppression_fact.js";
import type { FedosArchiveSuppressionObservationAuthority } from "../../../../conversation/retention/fedos_archive_suppression_observation_authority.js";

export interface FedosCreateLocalSuppressionFactInput {
  readonly accountRef: FedosDeviceBindingAccountRef;
  readonly sourceDeviceId: string;
  readonly subjectRef: FedosConversationPayloadId;
  readonly suppressionMeaning: FedosArchiveSuppressionMeaning;
  readonly decidedAt: number;
}

/** Reads the max revision already on file for `(subjectRef, sourceDeviceId)` from THIS device's own log and returns one past it — `0` if none exists yet. */
function nextRevisionForSubject(
  authority: FedosArchiveSuppressionObservationAuthority,
  subjectRef: FedosConversationPayloadId,
  sourceDeviceId: string,
): number {
  const existing = authority.listObservationsForSubject(subjectRef).filter((observation) => observation.sourceDeviceId === sourceDeviceId);
  const maxRevisionSoFar = existing.reduce((max, observation) => Math.max(max, observation.revision), -1);
  return maxRevisionSoFar + 1;
}

export type FedosCreateAndRecordLocalSuppressionFactOutcome =
  | { readonly outcome: "recorded"; readonly fact: FedosArchiveSuppressionFact }
  | { readonly outcome: "invalid-input" }
  | { readonly outcome: "already-present"; readonly fact: FedosArchiveSuppressionFact }
  | { readonly outcome: "failed" };

/**
 * Creates a new, self-authored suppression fact for `subjectRef` at the
 * next monotonic revision, and records it into `authority` as
 * `origin: "self"`. Returns the constructed fact so a caller (Phase F's
 * own outbound propagation step) can enqueue it for Device Sync — this
 * function itself performs NO network I/O and NO enqueueing; it is
 * exactly, and only, "local decision -> durable local fact," step 1-2 of
 * Phase F's own target graph.
 */
export function createAndRecordLocalArchiveSuppressionFact(
  input: FedosCreateLocalSuppressionFactInput,
  authority: FedosArchiveSuppressionObservationAuthority,
): FedosCreateAndRecordLocalSuppressionFactOutcome {
  const revision = nextRevisionForSubject(authority, input.subjectRef, input.sourceDeviceId);
  const fact = createFedosArchiveSuppressionFact({
    accountRef: input.accountRef,
    sourceDeviceId: input.sourceDeviceId,
    subjectType: "payload",
    subjectRef: input.subjectRef,
    suppressionMeaning: input.suppressionMeaning,
    revision,
    decidedAt: input.decidedAt,
    /** 16 bytes (128 bits) of `@noble/hashes/utils.js`'s own `randomBytes()`, hex-encoded — the same margin `FedosSecureRandomDeviceBindingChallengeNonceGenerator` already uses. */
    nonce: bytesToHex(nobleRandomBytes(16)),
  });
  if (fact === null) return { outcome: "invalid-input" };

  const result = authority.recordSelfSuppression(fact);
  if (result === "recorded") return { outcome: "recorded", fact };
  if (result === "already-present") return { outcome: "already-present", fact };
  return { outcome: "failed" };
}
