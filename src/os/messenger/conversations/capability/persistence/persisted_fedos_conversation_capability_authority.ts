/**
 * Secure Runtime Alpha 841 ("Durable Capability Authority") — Stage 9 of
 * Phase C of the Alpha 821–850 Durable Conversation Membership &
 * Capability Persistence Arc.
 *
 * A NEW implementation of `FedosConversationCapabilityIssuerAuthority` +
 * `FedosConversationCapabilityRedemptionAuthority` (Alpha 780/783, frozen,
 * unmodified interfaces) backed by a `FedosConversationCapabilityPersistence`
 * port (Alpha 837) instead of an in-memory `Map` — an ADAPTER alongside
 * `InMemoryFedosConversationCapabilityAuthority` (also frozen, unmodified),
 * never a replacement of it. Reuses the SAME bearer-secret boundary
 * (Alpha 778, unmodified) and the SAME two-step redemption sequence Alpha
 * 785/786 already established (validate without mutation, preview
 * Membership admission, commit Capability use, commit Membership
 * admission) — only re-plumbed onto durable backends for both halves.
 *
 * Alpha 785's own honesty requirement is preserved exactly: `redeem()`
 * performs two SEPARATE durable writes (this authority's own Capability
 * persistence, then the injected `FedosConversationMembershipAuthority`)
 * with no shared transaction. A failure admitting Membership AFTER the
 * Capability use already durably committed is disclosed as `"conflict"`,
 * never silently retried or hidden — the exact same disclosure the
 * in-memory Authority already makes. Genuine CRASH-WINDOW recovery
 * between those two writes is explicitly NOT this file's job — that is
 * `FedosConversationDurableRedemptionCoordinator`'s own, separate,
 * additive responsibility (Alpha 843–847, `../coordination/`), layered
 * ON TOP of this authority's durable Capability persistence, never
 * folded into this frozen-interface-preserving `redeem()`.
 *
 * HARD GUARDRAILS:
 *   - Public interface identical to `FedosConversationCapabilityIssuerAuthority`
 *     / `FedosConversationCapabilityRedemptionAuthority` — a caller
 *     cannot tell which implementation it holds.
 *   - Never persists or returns a plaintext bearer secret except as the
 *     direct return value of `issueJoinCapability()` to its own
 *     immediate caller (Alpha 834/835's own boundary).
 *   - `redeem()` checks `hasRedeemedEvent()` (Alpha 841's own small,
 *     additive Alpha 837 port extension) BEFORE ever touching exhaustion
 *     or writing anything — an already-successful redeemer replaying the
 *     SAME call is told `"already-redeemed"`, never `"exhausted"`, even
 *     when their own earlier success is what filled the last slot.
 */

import type { FedosConversationId } from "../../../../../conversation/fedos_conversation_id.js";
import type { FedosConversationMembershipAuthority } from "../../../../../conversation/membership/fedos_conversation_membership_authority.js";
import type { FedosConversationParticipantReference } from "../../../../../conversation/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationCapabilityAction, FedosConversationCapabilityDescriptor } from "../../../../../conversation/capability/fedos_conversation_capability_descriptor.js";
import { toFedosConversationCapabilityId, type FedosConversationCapabilityId } from "../../../../../conversation/capability/fedos_conversation_capability_id.js";
import type { FedosConversationCapabilitySecretGenerator } from "../../../../../conversation/capability/fedos_conversation_capability_bearer_secret.js";
import type {
  FedosConversationCapabilityIssueRequest,
  FedosConversationCapabilityIssuerAuthority,
  FedosConversationExistenceCheck,
  FedosConversationCapabilityIssuanceAuthorizationCheck,
} from "../../../../../conversation/capability/fedos_conversation_capability_issuer_authority.js";
import type { FedosConversationCapabilityIssuanceResult } from "../../../../../conversation/capability/fedos_conversation_capability_issuance_result.js";
import type { FedosConversationCapabilityRedemptionRequest } from "../../../../../conversation/capability/fedos_conversation_capability_redemption_request.js";
import type { FedosConversationCapabilityRedemptionResult } from "../../../../../conversation/capability/fedos_conversation_capability_redemption_result.js";
import type { FedosConversationCapabilityRedemptionAuthority } from "../../../../../conversation/capability/fedos_conversation_capability_redemption_authority.js";
import type { FedosConversationCapabilityIdGenerator } from "../../../../../conversation/capability/in_memory_fedos_conversation_capability_authority.js";
import {
  createFedosConversationCapabilityBearerVerifier,
  fedosConversationCapabilityBearerVerifierMatches,
  type FedosConversationCapabilityBearerVerifier,
} from "../../../../../conversation/capability/persistence/fedos_conversation_capability_bearer_verifier.js";
import {
  serializeFedosConversationCapabilityIssuedEvent,
  serializeFedosConversationCapabilityRedeemedEvent,
} from "../../../../../conversation/capability/persistence/fedos_conversation_capability_codec.js";
import type { FedosConversationCapabilityPersistence } from "../../../../../conversation/capability/persistence/fedos_conversation_capability_persistence.js";
import type { FedosPersistedConversationCapabilityRecordV1 } from "../../../../../conversation/capability/persistence/fedos_persisted_conversation_capability_v1.js";

function isValidMaxUses(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isValidExpiresAt(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0);
}

function isValidIssueRequest(request: FedosConversationCapabilityIssueRequest): boolean {
  if (request === null || typeof request !== "object") return false;
  if (request.action !== "join-conversation") return false;
  if (!isValidMaxUses(request.maxUses)) return false;
  if (!isValidExpiresAt(request.expiresAt)) return false;
  return true;
}

function participantsEqual(a: FedosConversationParticipantReference, b: FedosConversationParticipantReference): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier;
}

/** Rebuilds the public descriptor from a reconstructed durable record — never includes the bearer verifier. */
export function descriptorFromPersistedCapabilityRecord(record: FedosPersistedConversationCapabilityRecordV1): FedosConversationCapabilityDescriptor {
  const action: FedosConversationCapabilityAction = "join-conversation";
  return Object.freeze({
    capabilityId: record.capabilityId as FedosConversationCapabilityId,
    conversationId: record.conversationId as FedosConversationId,
    action,
    issuer: Object.freeze({
      authority: record.issuerAuthority,
      publicIdentifier: record.issuerPublicIdentifier,
      identityId: record.issuerIdentityId,
    }) as FedosConversationParticipantReference,
    intendedRecipient: intendedRecipientFromPersistedCapabilityRecord(record),
    maxUses: record.maxUses,
    expiresAt: record.expiresAt,
    issuedAt: record.issuedAt,
  });
}

/** Reused by `FedosConversationDurableRedemptionCoordinator` (Alpha 845) to avoid a second recipient-reconstruction implementation. */
export function intendedRecipientFromPersistedCapabilityRecord(
  record: FedosPersistedConversationCapabilityRecordV1,
): FedosConversationParticipantReference | null {
  if (record.intendedRecipientAuthority === null) return null;
  return Object.freeze({
    authority: record.intendedRecipientAuthority,
    publicIdentifier: record.intendedRecipientPublicIdentifier!,
    identityId: record.intendedRecipientIdentityId,
  }) as FedosConversationParticipantReference;
}

export class PersistedFedosConversationCapabilityAuthority
  implements FedosConversationCapabilityIssuerAuthority, FedosConversationCapabilityRedemptionAuthority
{
  readonly #persistence: FedosConversationCapabilityPersistence;
  readonly #idGenerator: FedosConversationCapabilityIdGenerator;
  readonly #secretGenerator: FedosConversationCapabilitySecretGenerator;
  readonly #existenceCheck: FedosConversationExistenceCheck;
  readonly #authorizationCheck: FedosConversationCapabilityIssuanceAuthorizationCheck;
  readonly #membershipAuthority: FedosConversationMembershipAuthority;

  constructor(deps: {
    persistence: FedosConversationCapabilityPersistence;
    idGenerator: FedosConversationCapabilityIdGenerator;
    secretGenerator: FedosConversationCapabilitySecretGenerator;
    existenceCheck: FedosConversationExistenceCheck;
    authorizationCheck: FedosConversationCapabilityIssuanceAuthorizationCheck;
    membershipAuthority: FedosConversationMembershipAuthority;
  }) {
    this.#persistence = deps.persistence;
    this.#idGenerator = deps.idGenerator;
    this.#secretGenerator = deps.secretGenerator;
    this.#existenceCheck = deps.existenceCheck;
    this.#authorizationCheck = deps.authorizationCheck;
    this.#membershipAuthority = deps.membershipAuthority;
  }

  issueJoinCapability(request: FedosConversationCapabilityIssueRequest, now: number): FedosConversationCapabilityIssuanceResult {
    if (!isValidIssueRequest(request)) return { outcome: "invalid-request" };
    if (!this.#existenceCheck(request.conversationId)) return { outcome: "denied", reason: "conversation-not-found" };
    if (!this.#authorizationCheck(request.conversationId, request.issuer)) {
      return { outcome: "denied", reason: "issuer-not-authorized" };
    }

    const capabilityId = toFedosConversationCapabilityId(this.#idGenerator.generateCapabilityId());
    if (capabilityId === null) return { outcome: "unavailable" };
    if (this.#persistence.getCapability(capabilityId) !== null) return { outcome: "unavailable" };

    const descriptor: FedosConversationCapabilityDescriptor = Object.freeze({
      capabilityId,
      conversationId: request.conversationId,
      action: request.action,
      issuer: request.issuer,
      intendedRecipient: request.intendedRecipient,
      maxUses: request.maxUses,
      expiresAt: request.expiresAt,
      issuedAt: now,
    });

    const bearerSecret = this.#secretGenerator.generateBearerSecret();
    const verifier = createFedosConversationCapabilityBearerVerifier(bearerSecret);
    const writeResult = this.#persistence.putEvent(serializeFedosConversationCapabilityIssuedEvent(descriptor, verifier));
    if (writeResult === "failed" || writeResult === "conflict") return { outcome: "unavailable" };

    return { outcome: "issued", descriptor, bearerSecret };
  }

  inspectDescriptor(capabilityId: FedosConversationCapabilityId): FedosConversationCapabilityDescriptor | null {
    const record = this.#persistence.getCapability(capabilityId);
    return record === null ? null : descriptorFromPersistedCapabilityRecord(record);
  }

  /** Alpha 1000 — additive, read-only directory of every descriptor issued for one conversation, forwarded to the durable `listConversationCapabilities()`. Descriptors only; never a bearer secret. */
  listIssuedDescriptorsForConversation(conversationId: FedosConversationId): readonly FedosConversationCapabilityDescriptor[] {
    return this.#persistence.listConversationCapabilities(conversationId).map(descriptorFromPersistedCapabilityRecord);
  }

  redeem(request: FedosConversationCapabilityRedemptionRequest, now: number): FedosConversationCapabilityRedemptionResult {
    // Step 1 — validate without mutation.
    const record = this.#persistence.getCapability(request.capabilityId);
    if (record === null) return { outcome: "invalid-capability" };

    const verifier = record.bearerVerifier as FedosConversationCapabilityBearerVerifier;
    if (!fedosConversationCapabilityBearerVerifierMatches(verifier, request.bearerSecret)) {
      return { outcome: "invalid-capability" };
    }
    if (record.expiresAt !== null && now > record.expiresAt) return { outcome: "expired" };

    const intendedRecipient = intendedRecipientFromPersistedCapabilityRecord(record);
    if (intendedRecipient !== null && !participantsEqual(intendedRecipient, request.redeemer)) {
      return { outcome: "recipient-mismatch" };
    }

    if (this.#persistence.hasRedeemedEvent(record.capabilityId, request.redeemer.authority, request.redeemer.publicIdentifier)) {
      return { outcome: "already-redeemed" };
    }
    if (record.currentUses >= record.maxUses) return { outcome: "exhausted" };

    // Step 2 — preview Membership admission, still no mutation anywhere.
    const conversationId = record.conversationId as FedosConversationId;
    const preview = this.#membershipAuthority.previewAdmission(conversationId, request.redeemer);
    if (preview.outcome === "unavailable") return { outcome: "unavailable" };
    if (preview.outcome === "blocked") return { outcome: "conflict" };

    // Step 3 — commit the capability use. The exactly-once gate.
    const eventWrite = this.#persistence.putEvent(serializeFedosConversationCapabilityRedeemedEvent(record.capabilityId, request.redeemer, now));
    if (eventWrite === "failed") return { outcome: "unavailable" };
    if (eventWrite === "conflict") return { outcome: "already-redeemed" };

    // Step 4 — commit Membership admission. See this file's own header
    // for why a failure HERE, after step 3 already committed, is
    // returned as an honestly-disclosed "conflict", never hidden.
    const descriptor = descriptorFromPersistedCapabilityRecord(record);
    const admission = this.#membershipAuthority.admit(descriptor.conversationId, request.redeemer, "member", now);
    if (admission.outcome === "admitted" || admission.outcome === "already-present") {
      return { outcome: "redeemed", descriptor, membership: admission.membership };
    }
    return { outcome: "conflict" };
  }
}
