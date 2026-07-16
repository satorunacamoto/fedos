/**
 * Secure Runtime Alpha 845 ("Durable Redemption Coordinator") — Stage 3
 * of Phase D of the Alpha 821–850 Durable Conversation Membership &
 * Capability Persistence Arc, together with Alpha 846 ("Crash-Window
 * Recovery") and Alpha 847 ("Exactly-Once Contract").
 *
 * `redeemAndAdmit()` is a NEW, additive method name — deliberately NOT a
 * second implementation of the frozen `FedosConversationCapabilityRedemptionAuthority.redeem()`
 * (`../persistence/persisted_fedos_conversation_capability_authority.ts`,
 * Alpha 841, which preserves that exact frozen contract with NO
 * crash-window recovery, by design). This class is layered ON TOP of
 * that authority's own durable Capability persistence plus an injected
 * durable `FedosConversationMembershipAuthority` — an ADDITIVE
 * capability, never a replacement.
 *
 * Required conceptual order (this Arc's own instruction, implemented
 * literally):
 *   1. validate bearer without mutation
 *   2. validate Capability state/expiry/recipient
 *   3. preview Membership admission
 *   4. persist "prepared" coordination fact
 *   5. durably consume Capability
 *   6. durably admit Membership
 *   7. persist "completed" fact
 *   8. return a closed result
 *
 * RECOVERY — a fresh coordinator instance re-derives the SAME
 * deterministic `coordinationId` for `(capabilityId, redeemer)`
 * (`fedosConversationRedemptionCoordinationId`, Alpha 843) and reads
 * `getCoordination()` to find how far a PRIOR attempt got:
 *
 *   - no fact, or only `"prepared"`/`"terminal-failed"` — NOTHING was
 *     actually consumed yet; steps 2–5 re-run from scratch (a genuinely
 *     fresh attempt, safe to fully re-validate).
 *   - `"capability-consumed"` or later — the Capability WAS already
 *     durably spent. Steps 2/3's rejections (expired / recipient-
 *     mismatch / exhausted / blocked) are NEVER re-applied here — Alpha
 *     846's own "no fake rollback" instruction: a real resource is
 *     already spent, so recovery only ever moves FORWARD (re-attempts
 *     Membership admission, idempotently, then persists `"completed"`).
 *   - `"completed"` — the WHOLE attempt already finished; this call
 *     re-reads the now-admitted Membership and returns the identical
 *     `"redeemed"` result, without touching either durable store again.
 *
 * `"terminal-failed"` is written ONLY when Capability consumption itself
 * durably fails (an `AppendOnlyFedosConversationCapabilityPersistence`
 * I/O failure, or an unexpected key conflict) — i.e., strictly BEFORE
 * consumption ever succeeds. It is never written once
 * `"capability-consumed"` exists; recovering from a `"terminal-failed"`
 * fact is identical to recovering from no fact at all (nothing was
 * spent, safe to fully retry).
 *
 * Alpha 847 ("Exactly-Once Contract") — MAY claim: restart-stable,
 * idempotent redemption within this one authoritative durable backend
 * set (one Capability log, one Membership log, one Coordination log) and
 * one supported writer model (single process/thread issuing
 * `redeemAndAdmit()` calls sequentially against a given backend set;
 * this file performs no file locking of its own). Does NOT claim:
 * distributed exactly-once, safety across independent writable
 * replicas, global instantaneous invalidation, network consensus, or
 * multi-process concurrent-writer safety.
 *
 * No fake rollback anywhere in this file — no method un-writes a
 * Capability consumption event or a Membership admission once either has
 * durably succeeded.
 */

import type { FedosConversationId } from "../../fedos_conversation_id.js";
import type { FedosConversationMembershipAuthority } from "../../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationParticipantReference } from "../../membership/fedos_conversation_participant_reference.js";
import {
  fedosConversationCapabilityBearerVerifierMatches,
  type FedosConversationCapabilityBearerVerifier,
} from "../persistence/fedos_conversation_capability_bearer_verifier.js";
import { serializeFedosConversationCapabilityRedeemedEvent } from "../persistence/fedos_conversation_capability_codec.js";
import type { FedosConversationCapabilityPersistence } from "../persistence/fedos_conversation_capability_persistence.js";
import {
  descriptorFromPersistedCapabilityRecord,
  intendedRecipientFromPersistedCapabilityRecord,
} from "../persistence/persisted_fedos_conversation_capability_authority.js";
import type { FedosConversationCapabilityRedemptionRequest } from "../fedos_conversation_capability_redemption_request.js";
import type { FedosConversationCapabilityRedemptionResult } from "../fedos_conversation_capability_redemption_result.js";
import { fedosConversationRedemptionCoordinationId } from "./fedos_persisted_conversation_redemption_coordination_v1.js";
import type {
  FedosConversationRedemptionCoordinationPhase,
  FedosPersistedConversationRedemptionCoordinationV1,
} from "./fedos_persisted_conversation_redemption_coordination_v1.js";
import type { FedosConversationRedemptionCoordinationPersistence } from "./fedos_conversation_redemption_coordination_persistence.js";

function participantsEqual(a: FedosConversationParticipantReference, b: FedosConversationParticipantReference): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier;
}

export class FedosConversationDurableRedemptionCoordinator {
  readonly #capabilityPersistence: FedosConversationCapabilityPersistence;
  readonly #coordinationPersistence: FedosConversationRedemptionCoordinationPersistence;
  readonly #membershipAuthority: FedosConversationMembershipAuthority;

  constructor(deps: {
    capabilityPersistence: FedosConversationCapabilityPersistence;
    coordinationPersistence: FedosConversationRedemptionCoordinationPersistence;
    membershipAuthority: FedosConversationMembershipAuthority;
  }) {
    this.#capabilityPersistence = deps.capabilityPersistence;
    this.#coordinationPersistence = deps.coordinationPersistence;
    this.#membershipAuthority = deps.membershipAuthority;
  }

  redeemAndAdmit(request: FedosConversationCapabilityRedemptionRequest, now: number): FedosConversationCapabilityRedemptionResult {
    // Step 1 — validate bearer without mutation. Checked unconditionally,
    // regardless of any in-flight coordination state, so a wrong secret
    // never reveals whether a coordination attempt already exists.
    const record = this.#capabilityPersistence.getCapability(request.capabilityId);
    if (record === null) return { outcome: "invalid-capability" };
    const verifier = record.bearerVerifier as FedosConversationCapabilityBearerVerifier;
    if (!fedosConversationCapabilityBearerVerifierMatches(verifier, request.bearerSecret)) {
      return { outcome: "invalid-capability" };
    }

    const coordinationId = fedosConversationRedemptionCoordinationId(
      record.capabilityId,
      request.redeemer.authority,
      request.redeemer.publicIdentifier,
    );
    const existing = this.#coordinationPersistence.getCoordination(coordinationId);
    const startedAt = existing?.startedAt ?? now;

    const alreadyConsumed =
      (existing !== null && existing.phase !== "prepared" && existing.phase !== "terminal-failed") ||
      this.#capabilityPersistence.hasRedeemedEvent(record.capabilityId, request.redeemer.authority, request.redeemer.publicIdentifier);

    if (!alreadyConsumed) {
      // Step 2 — validate Capability state/expiry/recipient. Only ever
      // applied on a genuinely fresh attempt — nothing has been spent yet.
      if (record.expiresAt !== null && now > record.expiresAt) return { outcome: "expired" };
      const intendedRecipient = intendedRecipientFromPersistedCapabilityRecord(record);
      if (intendedRecipient !== null && !participantsEqual(intendedRecipient, request.redeemer)) {
        return { outcome: "recipient-mismatch" };
      }
      if (record.currentUses >= record.maxUses) return { outcome: "exhausted" };

      // Step 3 — preview Membership admission, still no mutation anywhere.
      const conversationId = record.conversationId as FedosConversationId;
      const preview = this.#membershipAuthority.previewAdmission(conversationId, request.redeemer);
      if (preview.outcome === "unavailable") return { outcome: "unavailable" };
      if (preview.outcome === "blocked") return { outcome: "conflict" };

      // Step 4 — persist "prepared". A "conflict" here (an EARLIER
      // "prepared" fact already exists for this id, at a different
      // `updatedAt`) is expected and benign on a recovery replay that
      // reaches this branch — "prepared" is advisory bookkeeping, not a
      // resource-consumption gate, so re-marking it is never itself a
      // reason to stop. Only a genuine write failure aborts here.
      const preparedWrite = this.#coordinationPersistence.putCoordinationFact(
        this.#buildFact(coordinationId, record, request, "prepared", startedAt, now),
      );
      if (preparedWrite === "failed") return { outcome: "unavailable" };

      // Step 5 — durably consume Capability. The exactly-once gate.
      const eventWrite = this.#capabilityPersistence.putEvent(
        serializeFedosConversationCapabilityRedeemedEvent(record.capabilityId, request.redeemer, now),
      );
      if (eventWrite === "failed") {
        this.#coordinationPersistence.putCoordinationFact(
          this.#buildFact(coordinationId, record, request, "terminal-failed", startedAt, now),
        );
        return { outcome: "unavailable" };
      }
      if (eventWrite === "conflict") {
        this.#coordinationPersistence.putCoordinationFact(
          this.#buildFact(coordinationId, record, request, "terminal-failed", startedAt, now),
        );
        return { outcome: "already-redeemed" };
      }

      this.#coordinationPersistence.putCoordinationFact(
        this.#buildFact(coordinationId, record, request, "capability-consumed", startedAt, now),
      );
    }

    // From here the Capability is durably consumed — either just now, or
    // by a prior attempt this call is recovering. Only forward progress
    // from here on; no validation rejection is ever returned past this
    // point (see this file's own header, "no fake rollback").
    const descriptor = descriptorFromPersistedCapabilityRecord(record);

    if (existing?.phase === "completed") {
      // The redemption itself already durably completed. Membership's
      // OWN current state is re-read fresh, never cached on the
      // coordination fact — an independent `revoke()`/`leave()` call
      // made entirely outside this redemption flow, at any point after
      // this coordination attempt finished, must be reflected honestly
      // here rather than this replay silently re-asserting a stale
      // "redeemed" outcome (Alpha 849's own "revocation preserved"
      // requirement applies to EVERY reader, including a replayed
      // redemption). The Capability was still genuinely spent, so a
      // no-longer-active Membership is disclosed as `"conflict"` — the
      // same coarse token every other "capability spent, Membership not
      // currently granted" case in this Arc already uses.
      const membership = this.#membershipAuthority.findMembership(descriptor.conversationId, request.redeemer);
      if (membership === null || membership.state !== "active") return { outcome: "conflict" };
      return { outcome: "redeemed", descriptor, membership };
    }

    // Step 6 — durably admit Membership. Idempotent (Alpha 771/830), so
    // replaying this on every recovery attempt from "capability-consumed"
    // onward is always safe.
    const admission = this.#membershipAuthority.admit(descriptor.conversationId, request.redeemer, "member", now);
    if (admission.outcome !== "admitted" && admission.outcome !== "already-present") {
      // Capability already durably spent, Membership not (yet) granted —
      // honestly disclosed, exactly like Alpha 841's own `redeem()`.
      // Coordination phase STAYS at "capability-consumed" so the NEXT
      // call keeps trying forward; never marked terminal-failed here.
      return { outcome: "conflict" };
    }
    this.#coordinationPersistence.putCoordinationFact(
      this.#buildFact(coordinationId, record, request, "membership-admitted", startedAt, now),
    );

    // Step 7 — persist "completed".
    this.#coordinationPersistence.putCoordinationFact(this.#buildFact(coordinationId, record, request, "completed", startedAt, now));

    // Step 8 — return a closed result.
    return { outcome: "redeemed", descriptor, membership: admission.membership };
  }

  #buildFact(
    coordinationId: string,
    record: { capabilityId: string; conversationId: string },
    request: FedosConversationCapabilityRedemptionRequest,
    phase: FedosConversationRedemptionCoordinationPhase,
    startedAt: number,
    now: number,
  ): FedosPersistedConversationRedemptionCoordinationV1 {
    return {
      schemaVersion: 1,
      coordinationId,
      capabilityId: record.capabilityId,
      conversationId: record.conversationId,
      redeemerAuthority: request.redeemer.authority,
      redeemerPublicIdentifier: request.redeemer.publicIdentifier,
      redeemerIdentityId: request.redeemer.identityId,
      phase,
      startedAt,
      updatedAt: now,
    };
  }
}
