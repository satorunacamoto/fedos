/**
 * Secure Runtime Alpha 915 ("Private Construction Coordinator") / Alpha
 * 916 ("Failure Semantics") / Alpha 917 ("Restart Recovery") — Phase C of
 * the Alpha 891–930 Private Conversation Draft Construction and Readiness
 * Runtime Arc.
 *
 * Implements `createPrivateGroupDraft()` and `createDirectDraft()` over
 * the durable draft record, creator Membership, optional/required initial
 * Capability, and a narrow construction-coordination log — reusing
 * `FedosConversationDurableRedemptionCoordinator`'s own crash-recovery
 * discipline (Alpha 845) exactly: re-derive a DETERMINISTIC id, read how
 * far a prior attempt got, and only ever move FORWARD. No activation, no
 * message operation, no encryption of any kind is ever performed here.
 *
 * SEQUENCE (Alpha 915), both modes:
 *   validate command -> resolve creator identity -> validate mode/policy
 *   -> prepare ids -> persist coordination "prepared" -> persist
 *   Conversation draft -> admit creator Membership -> issue initial
 *   Capability (when requested for private-group / required for direct)
 *   -> record "draft-completed" -> evaluate readiness -> return.
 *
 * FAILURE SEMANTICS (Alpha 916): at every step, completed durable facts
 * are preserved (no append-only backend has a rollback); a mid-sequence
 * failure returns `"partial-construction"` (or a specific closed failure
 * token) that names exactly what exists; success is never reported before
 * the draft AND creator Membership are durable; a second Capability is
 * never issued once one is recorded; the creator Membership is never
 * duplicated (its id is deterministic and `admit()` is idempotent).
 *
 * RECOVERY (Alpha 917): a fresh coordinator over the same backends
 * re-derives the same coordination id from the same request id and
 * converges every partial state — prepared-only, conversation-persisted,
 * creator-membership-admitted, capability-issued,
 * completed-marker-missing, and a duplicate recovery invocation — to ONE
 * honest state, with no infinite loop (each step is idempotent and only
 * ever advances).
 *
 * CORRUPTION (Alpha 918): a corrupt draft/coordination record makes its
 * backend's own replay throw (fail closed) — this coordinator never
 * activates or re-creates an authority fact from missing/corrupt data.
 */

import { randomBytes as nobleRandomBytes, bytesToHex } from "@noble/hashes/utils.js";
import type { FedosBoardRuntimeClock } from "../../board/runtime/fedos_board_runtime_clock.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationMembership } from "../membership/fedos_conversation_membership.js";
import type { FedosConversationMembershipAuthority } from "../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationParticipantReference } from "../membership/fedos_conversation_participant_reference.js";
import { validateFedosConversationParticipantReference } from "../membership/fedos_conversation_participant_reference_validator.js";
import type { FedosConversationCapabilityIssuerAuthority } from "../capability/fedos_conversation_capability_issuer_authority.js";
import type { FedosConversationCapabilityId } from "../capability/fedos_conversation_capability_id.js";
import type { FedosConversationReadinessAxisState } from "../readiness/fedos_conversation_readiness_axis.js";
import {
  evaluateFedosConversationReadiness,
  type FedosConversationReadiness,
  type FedosConversationReadinessAxisStates,
} from "../readiness/fedos_conversation_readiness.js";
import type { FedosConversationEncryptionReadinessAuthority } from "../readiness/fedos_conversation_encryption_readiness_authority.js";
import { toFedosPrivateConversationId, type FedosPrivateConversationMode } from "./fedos_private_conversation_id.js";
import { validateFedosConversationDraftRecord } from "./fedos_conversation_draft_record_validator.js";
import type { FedosConversationDraftRecord, FedosPrivateConversationPolicyReference } from "./fedos_conversation_draft_record.js";
import { serializeFedosConversationDraftRecord } from "./fedos_conversation_draft_record_codec.js";
import type { FedosConversationDraftPersistence } from "./fedos_conversation_draft_persistence.js";
import { resolveFedosPrivateConversationPolicy } from "./fedos_private_conversation_policy.js";
import type { FedosConversationCreatorIdentityAuthority } from "./fedos_conversation_creator_identity_authority.js";
import type {
  CreateDirectDraftCommand,
  CreatePrivateGroupDraftCommand,
  FedosPrivateConversationInitialCapabilityRequest,
} from "./fedos_private_conversation_construction_command.js";
import type {
  FedosConversationDraftView,
  FedosPrivateConversationInitialCapabilityGrant,
} from "./fedos_conversation_draft_view.js";
import type { FedosPrivateConversationConstructionResult } from "./fedos_private_conversation_construction_result.js";
import {
  fedosConversationConstructionCoordinationId,
  type FedosConversationConstructionCoordinationPhase,
  type FedosPersistedConversationConstructionCoordinationV1,
} from "./coordination/fedos_persisted_conversation_construction_coordination_v1.js";
import type { FedosConversationConstructionCoordinationPersistence } from "./coordination/fedos_conversation_construction_coordination_persistence.js";

/** Injected — mints the opaque request id a Conversation id is derived from (Alpha 908). Never caller-supplied. */
export interface FedosConversationConstructionIdGenerator {
  generateRequestId(): string;
}

/** Default — 16 bytes of `@noble/hashes` randomness, hex-encoded, exactly like `FedosSecureRandomBoardRuntimeIdGenerator` (Alpha 626). Zero new dependency. */
export class FedosSecureRandomConstructionIdGenerator implements FedosConversationConstructionIdGenerator {
  generateRequestId(): string {
    return bytesToHex(nobleRandomBytes(16));
  }
}

/** Coarse per-axis signals a deployment may inject for the storage axes; both default `"ready"` (in-memory backends are always locally constructible). */
export interface FedosConversationStorageReadinessSignal {
  readonly payloadStorage: FedosConversationReadinessAxisState;
  readonly retention: FedosConversationReadinessAxisState;
}

export interface FedosPrivateConversationConstructionCoordinatorDependencies {
  readonly draftPersistence: FedosConversationDraftPersistence;
  readonly coordinationPersistence: FedosConversationConstructionCoordinationPersistence;
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  /** Optional — without it, a requested/required Capability cannot be issued (private-group: non-fatal; direct: partial-construction). */
  readonly capabilityIssuerAuthority?: FedosConversationCapabilityIssuerAuthority;
  readonly creatorIdentityAuthority: FedosConversationCreatorIdentityAuthority;
  readonly encryptionReadinessAuthority: FedosConversationEncryptionReadinessAuthority;
  readonly idGenerator: FedosConversationConstructionIdGenerator;
  readonly clock: FedosBoardRuntimeClock;
  /** Alpha 904 — when `true`, an `"anonymous-local"` creator fails closed. Default `false`. */
  readonly requireResolvedCreatorIdentity?: boolean;
  /** Optional storage-axis signals; default both `"ready"`. */
  readonly storageReadiness?: FedosConversationStorageReadinessSignal;
}

/** Internal, mode-independent capability plan resolved before the durable sequence. */
interface CapabilityPlan {
  readonly required: boolean;
  readonly intendedRecipient: FedosConversationParticipantReference | null;
  readonly maxUses: number;
  readonly expiresAt: number | null;
}

const REQUEST_ID_MAX_LENGTH = 256;

function isSafeRequestId(value: string): boolean {
  return value.length > 0 && value.length <= REQUEST_ID_MAX_LENGTH && !value.includes("::");
}

function isValidCapabilityRequest(request: FedosPrivateConversationInitialCapabilityRequest): boolean {
  if (request === null || typeof request !== "object") return false;
  if (typeof request.maxUses !== "number" || !Number.isInteger(request.maxUses) || request.maxUses < 1) return false;
  if (request.expiresAt !== null) {
    if (typeof request.expiresAt !== "number" || !Number.isFinite(request.expiresAt) || !Number.isInteger(request.expiresAt) || request.expiresAt < 0) {
      return false;
    }
  }
  return true;
}

function participantsEqual(a: FedosConversationParticipantReference, b: FedosConversationParticipantReference): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier;
}

export class FedosPrivateConversationConstructionCoordinator {
  readonly #deps: FedosPrivateConversationConstructionCoordinatorDependencies;

  constructor(deps: FedosPrivateConversationConstructionCoordinatorDependencies) {
    this.#deps = deps;
  }

  createPrivateGroupDraft(command: CreatePrivateGroupDraftCommand): FedosPrivateConversationConstructionResult {
    if (command === null || typeof command !== "object") return { outcome: "invalid-command" };
    if (command.idempotencyKey !== undefined && (typeof command.idempotencyKey !== "string" || !isSafeRequestId(command.idempotencyKey))) {
      return { outcome: "invalid-command" };
    }
    let plan: CapabilityPlan;
    if (command.initialCapability === undefined) {
      plan = { required: false, intendedRecipient: null, maxUses: 1, expiresAt: null };
    } else {
      if (!isValidCapabilityRequest(command.initialCapability)) return { outcome: "invalid-command" };
      plan = {
        required: true,
        intendedRecipient: null,
        maxUses: command.initialCapability.maxUses,
        expiresAt: command.initialCapability.expiresAt,
      };
    }
    return this.#run("private-group", "private-group-draft-v1", command.idempotencyKey, plan, null);
  }

  createDirectDraft(command: CreateDirectDraftCommand): FedosPrivateConversationConstructionResult {
    if (command === null || typeof command !== "object") return { outcome: "invalid-command" };
    if (command.idempotencyKey !== undefined && (typeof command.idempotencyKey !== "string" || !isSafeRequestId(command.idempotencyKey))) {
      return { outcome: "invalid-command" };
    }
    if (command.recipient === null || typeof command.recipient !== "object") return { outcome: "invalid-command" };
    const recipient = validateFedosConversationParticipantReference({
      authority: command.recipient.authority,
      publicIdentifier: command.recipient.publicIdentifier,
      identityId: null,
    });
    if (recipient === null) return { outcome: "invalid-command" };
    // A `direct` draft's recipient is bound via an intendedRecipient
    // Capability with exactly one use — never a general capability, never a
    // fabricated Membership (Alpha 902/906/907).
    const plan: CapabilityPlan = { required: true, intendedRecipient: recipient, maxUses: 1, expiresAt: null };
    return this.#run("direct", "direct-draft-v1", command.idempotencyKey, plan, recipient);
  }

  /** Live readiness recompute for an existing draft (Alpha 922/13) — never cached from construction time. */
  readinessForDraft(draft: FedosConversationDraftRecord): FedosConversationReadiness {
    const coordinationId = fedosConversationConstructionCoordinationId(draft.id);
    const coordination = this.#deps.coordinationPersistence.getCoordination(coordinationId);
    const ownerMembership = this.#deps.membershipAuthority.findMembership(draft.id, draft.creator);
    return evaluateFedosConversationReadiness(
      this.#buildReadinessStates(draft.id, draft.mode, ownerMembership, coordination),
    );
  }

  #run(
    mode: FedosPrivateConversationMode,
    policyReference: FedosPrivateConversationPolicyReference,
    idempotencyKey: string | undefined,
    plan: CapabilityPlan,
    recipient: FedosConversationParticipantReference | null,
  ): FedosPrivateConversationConstructionResult {
    // Step: resolve creator identity (before any durable write).
    const identity = this.#deps.creatorIdentityAuthority.resolveCreator();
    if (identity.outcome === "unavailable") return { outcome: "identity-unavailable" };
    if (identity.outcome === "anonymous-local" && this.#deps.requireResolvedCreatorIdentity === true) {
      return { outcome: "identity-unavailable" };
    }
    const creator = identity.creator;
    // A direct draft's recipient must be a DIFFERENT participant from the creator (Alpha 902's "exactly two").
    if (recipient !== null && participantsEqual(recipient, creator)) return { outcome: "invalid-command" };

    const now = this.#deps.clock();
    const requestId = idempotencyKey ?? this.#deps.idGenerator.generateRequestId();
    if (!isSafeRequestId(requestId)) return { outcome: "unavailable" }; // a generator that produced an unusable id — fail closed.
    const conversationId = toFedosPrivateConversationId(mode, requestId);
    const coordinationId = fedosConversationConstructionCoordinationId(conversationId);

    const existing = this.#deps.coordinationPersistence.getCoordination(coordinationId);
    const startedAt = existing?.startedAt ?? now;
    const wasAlreadyComplete = existing?.phase === "draft-completed";
    let issuedCapabilityId: string | null = existing?.issuedCapabilityId ?? null;

    // Build (or rebuild, idempotently) the draft record. Sole constructor.
    const draftRecord = validateFedosConversationDraftRecord({
      id: conversationId,
      mode,
      lifecycleState: "draft",
      policyReference,
      creator: { authority: creator.authority, publicIdentifier: creator.publicIdentifier, identityId: creator.identityId },
      createdAt: startedAt,
    });
    if (draftRecord === null) return { outcome: "invalid-command" };

    // Persist "prepared" (advisory) then the draft record.
    this.#deps.coordinationPersistence.putCoordinationFact(
      this.#fact(coordinationId, conversationId, mode, "prepared", null, startedAt, now),
    );
    const draftWrite = this.#deps.draftPersistence.putDraft(serializeFedosConversationDraftRecord(draftRecord));
    if (draftWrite === "failed") {
      this.#deps.coordinationPersistence.putCoordinationFact(
        this.#fact(coordinationId, conversationId, mode, "terminal-failed", null, startedAt, now),
      );
      return { outcome: "persistence-failed" };
    }
    if (draftWrite === "conflict") return { outcome: "conflict" };
    this.#deps.coordinationPersistence.putCoordinationFact(
      this.#fact(coordinationId, conversationId, mode, "conversation-persisted", null, startedAt, now),
    );

    const draftView = this.#draftView(draftRecord);

    // Admit creator Membership (owner). Idempotent — a retry re-derives the
    // same deterministic id and returns "already-present", never a duplicate.
    const admission = this.#deps.membershipAuthority.admit(conversationId, creator, "owner", now);
    if (admission.outcome === "unavailable") {
      const readiness = this.#readinessFor(conversationId, mode, null, issuedCapabilityId);
      return { outcome: "partial-construction", draft: draftView, readiness, ownerMembership: null, detail: "creator-membership-pending" };
    }
    if (admission.outcome !== "admitted" && admission.outcome !== "already-present") {
      // "conflict"/"invalid-transition" — a genuinely conflicting Membership
      // already occupies the creator's deterministic id (Alpha 916).
      return { outcome: "membership-failed", draft: draftView };
    }
    const ownerMembership: FedosConversationMembership = admission.membership;
    this.#deps.coordinationPersistence.putCoordinationFact(
      this.#fact(coordinationId, conversationId, mode, "creator-membership-admitted", issuedCapabilityId, startedAt, now),
    );

    // Initial Capability step.
    let capabilityAxisFailed = false;
    let issuedGrant: FedosPrivateConversationInitialCapabilityGrant | undefined;
    if (plan.required) {
      if (issuedCapabilityId !== null) {
        // Recovery: a Capability was already issued on a prior attempt. Do
        // NOT issue a second one (Alpha 916). The bearer secret is one-time
        // and not re-derivable, so no grant is returned on this replay.
        const descriptor = this.#deps.capabilityIssuerAuthority?.inspectDescriptor(issuedCapabilityId as FedosConversationCapabilityId);
        if (descriptor === null || descriptor === undefined) capabilityAxisFailed = true;
      } else if (this.#deps.capabilityIssuerAuthority === undefined) {
        capabilityAxisFailed = true;
        if (mode === "direct") {
          const readiness = this.#readinessFor(conversationId, mode, ownerMembership, null);
          return { outcome: "partial-construction", draft: draftView, readiness, ownerMembership, detail: "recipient-capability-pending" };
        }
      } else {
        const issuance = this.#deps.capabilityIssuerAuthority.issueJoinCapability(
          {
            conversationId,
            issuer: creator,
            action: "join-conversation",
            intendedRecipient: plan.intendedRecipient,
            maxUses: plan.maxUses,
            expiresAt: plan.expiresAt,
          },
          now,
        );
        if (issuance.outcome === "issued") {
          issuedCapabilityId = issuance.descriptor.capabilityId;
          issuedGrant = { descriptor: issuance.descriptor, bearerSecret: issuance.bearerSecret };
          this.#deps.coordinationPersistence.putCoordinationFact(
            this.#fact(coordinationId, conversationId, mode, "capability-issued", issuedCapabilityId, startedAt, now),
          );
        } else {
          capabilityAxisFailed = true;
          if (mode === "direct") {
            // A direct draft's recipient MUST be represented by a Capability —
            // a durable draft + owner exists, recipient is pending (Alpha 906).
            return { outcome: "capability-failed", draft: draftView, ownerMembership };
          }
        }
      }
    }

    // Record completion (carry the issued capability id forward).
    this.#deps.coordinationPersistence.putCoordinationFact(
      this.#fact(coordinationId, conversationId, mode, "draft-completed", issuedCapabilityId, startedAt, now),
    );

    const readiness = this.#readinessFor(conversationId, mode, ownerMembership, capabilityAxisFailed ? null : issuedCapabilityId);

    if (wasAlreadyComplete) {
      // Idempotent replay — the bearer secret was delivered exactly once on
      // the original call and is never returned again (Alpha 907).
      return { outcome: "already-present", draft: draftView, readiness, ownerMembership };
    }
    return { outcome: "draft-created", draft: draftView, readiness, ownerMembership, capability: issuedGrant };
  }

  #readinessFor(
    conversationId: FedosConversationId,
    mode: FedosPrivateConversationMode,
    ownerMembership: FedosConversationMembership | null,
    issuedCapabilityId: string | null,
  ): FedosConversationReadiness {
    const coordination: Pick<FedosPersistedConversationConstructionCoordinationV1, "phase" | "issuedCapabilityId"> = {
      phase: "draft-completed",
      issuedCapabilityId,
    };
    return evaluateFedosConversationReadiness(this.#buildReadinessStates(conversationId, mode, ownerMembership, coordination));
  }

  #buildReadinessStates(
    conversationId: FedosConversationId,
    mode: FedosPrivateConversationMode,
    ownerMembership: FedosConversationMembership | null,
    coordination: Pick<FedosPersistedConversationConstructionCoordinationV1, "phase" | "issuedCapabilityId"> | null,
  ): FedosConversationReadinessAxisStates {
    const storage = this.#deps.storageReadiness ?? { payloadStorage: "ready", retention: "ready" };
    const draftDurable = this.#deps.draftPersistence.getDraft(conversationId) !== null;

    let capability: FedosConversationReadinessAxisState;
    const issuedId = coordination?.issuedCapabilityId ?? null;
    if (issuedId !== null) {
      const descriptor = this.#deps.capabilityIssuerAuthority?.inspectDescriptor(issuedId as FedosConversationCapabilityId);
      capability = descriptor === null || descriptor === undefined ? "failed" : "ready";
    } else if (mode === "direct") {
      // A direct draft always needs a recipient Capability; none recorded means it is still pending.
      capability = "unavailable";
    } else {
      capability = "not-required";
    }

    const encryption = ((): FedosConversationReadinessAxisState => {
      const e = this.#deps.encryptionReadinessAuthority.evaluateEncryptionReadiness(conversationId);
      if (e.state === "ready") return "ready";
      if (e.state === "unsupported") return "unsupported";
      if (e.state === "failed") return "failed";
      return "unavailable";
    })();

    return {
      identity: ownerMembership !== null ? "ready" : "unavailable",
      conversationPersistence: draftDurable ? "ready" : "failed",
      policy: "ready",
      creatorMembership: ownerMembership !== null && ownerMembership.state === "active" ? "ready" : "unavailable",
      capability,
      encryption,
      payloadStorage: storage.payloadStorage,
      retention: storage.retention,
      // A draft is honestly local-only (federation "local-only") — protocol
      // delivery is never a draft requirement (Alpha 899/18).
      protocolDelivery: "not-required",
    };
  }

  #draftView(record: FedosConversationDraftRecord): FedosConversationDraftView {
    return Object.freeze({
      id: record.id,
      mode: record.mode,
      lifecycleState: record.lifecycleState,
      policyReference: record.policyReference,
      policy: resolveFedosPrivateConversationPolicy(record.policyReference),
      creator: record.creator,
      createdAt: record.createdAt,
    });
  }

  #fact(
    coordinationId: string,
    conversationId: string,
    mode: string,
    phase: FedosConversationConstructionCoordinationPhase,
    issuedCapabilityId: string | null,
    startedAt: number,
    now: number,
  ): FedosPersistedConversationConstructionCoordinationV1 {
    return {
      schemaVersion: 1,
      coordinationId,
      conversationId,
      mode,
      phase,
      issuedCapabilityId,
      startedAt,
      updatedAt: now,
    };
  }
}
