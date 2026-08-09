/**
 * Secure Runtime Alpha 786 ("In-Memory Capability Authority") — Stage 12
 * of Phase B of the Alpha 761–790 Canonical Conversation Membership &
 * Capability Foundation Arc, implementing the Alpha 785 ("Capability-to-
 * Membership Coordination") sequence for real:
 *
 *   1. Validate the capability WITHOUT mutation (unknown id, wrong
 *      secret — collapsed into one `"invalid-capability"` outcome,
 *      expiry, recipient mismatch, already-redeemed-by-this-redeemer,
 *      exhausted).
 *   2. Preview Membership admission (`FedosConversationMembershipAuthority.previewAdmission()`,
 *      a pure read) — a `"blocked"` preview stops here, BEFORE any
 *      mutation, so a doomed redemption never consumes the capability.
 *   3. Commit the capability use (mark this redeemer as having
 *      redeemed) — the exactly-once gate.
 *   4. Commit Membership admission
 *      (`FedosConversationMembershipAuthority.admit()`).
 *
 * Alpha 784 ("Local Exactly-Once Semantics") — this guarantee holds
 * ONLY within this one in-memory instance: a `maxUses: 1` capability is
 * redeemed by at most one distinct redeemer, full stop, no claim beyond
 * this instance's own state. No distributed consensus, no cross-process
 * atomicity, no "disappears from every Node in the world instantly"
 * claim is made anywhere in this file.
 *
 * Alpha 785's own honesty requirement, restated: steps 3 and 4 are TWO
 * separate commits against TWO separate authorities (this class's own
 * capability map, and the injected `FedosConversationMembershipAuthority`)
 * — no shared transaction exists. If step 4 fails or is blocked AFTER
 * step 3 already committed, `redeem()` returns `"conflict"`, honestly
 * disclosing that the capability was consumed but Membership was not
 * granted — never hidden, never silently retried. Membership's own
 * `admit()` is idempotent (Alpha 771), so the SAME failure mode never
 * compounds on a second, separate call.
 *
 * Alpha 787 ("Capability Observation Decision") — no separate
 * Observation/Repository layer: `remainingUses()` derives current
 * redemption state honestly from this authority's own map, with a real
 * consumer (`test/secure_runtime_alpha_786_in_memory_capability_authority.test.ts`'s
 * own "no mutation after terminal exhaustion" check).
 */

import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";
import type { FedosConversationCapabilityAction, FedosConversationCapabilityDescriptor } from "../../../../conversation/capability/fedos_conversation_capability_descriptor.js";
import { toFedosConversationCapabilityId, type FedosConversationCapabilityId } from "../../../../conversation/capability/fedos_conversation_capability_id.js";
import {
  fedosConversationCapabilityBearerSecretsMatch,
  type FedosConversationCapabilityBearerSecret,
  type FedosConversationCapabilitySecretGenerator,
} from "../../../../conversation/capability/fedos_conversation_capability_bearer_secret.js";
import type { FedosConversationCapabilityIssuanceResult } from "../../../../conversation/capability/fedos_conversation_capability_issuance_result.js";
import type {
  FedosConversationCapabilityIssueRequest,
  FedosConversationCapabilityIssuerAuthority,
  FedosConversationExistenceCheck,
  FedosConversationCapabilityIssuanceAuthorizationCheck,
} from "../../../../conversation/capability/fedos_conversation_capability_issuer_authority.js";
import type { FedosConversationCapabilityRedemptionRequest } from "../../../../conversation/capability/fedos_conversation_capability_redemption_request.js";
import type { FedosConversationCapabilityRedemptionResult } from "../../../../conversation/capability/fedos_conversation_capability_redemption_result.js";
import type { FedosConversationCapabilityRedemptionAuthority } from "../../../../conversation/capability/fedos_conversation_capability_redemption_authority.js";
import type { FedosConversationMembershipAuthority } from "../../../../conversation/membership/fedos_conversation_membership_authority.js";
import type { FedosConversationParticipantReference } from "../../../../conversation/membership/fedos_conversation_participant_reference.js";

/** Injected — this Arc mints no real random capability id itself, mirroring `FedosConversationCapabilitySecretGenerator`'s own "generation stays out of scope" boundary (Alpha 778). */
export interface FedosConversationCapabilityIdGenerator {
  generateCapabilityId(): string;
}

interface StoredFedosConversationCapability {
  readonly descriptor: FedosConversationCapabilityDescriptor;
  readonly bearerSecret: FedosConversationCapabilityBearerSecret;
  readonly redeemedByParticipantKeys: Set<string>;
}

function participantKey(participant: FedosConversationParticipantReference): string {
  return `${participant.authority}::${participant.publicIdentifier}`;
}

function participantsEqual(a: FedosConversationParticipantReference, b: FedosConversationParticipantReference): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier;
}

function isValidMaxUses(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isValidExpiresAt(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0);
}

export class InMemoryFedosConversationCapabilityAuthority
  implements FedosConversationCapabilityIssuerAuthority, FedosConversationCapabilityRedemptionAuthority
{
  readonly #capabilities = new Map<FedosConversationCapabilityId, StoredFedosConversationCapability>();
  readonly #idGenerator: FedosConversationCapabilityIdGenerator;
  readonly #secretGenerator: FedosConversationCapabilitySecretGenerator;
  readonly #existenceCheck: FedosConversationExistenceCheck;
  readonly #authorizationCheck: FedosConversationCapabilityIssuanceAuthorizationCheck;
  readonly #membershipAuthority: FedosConversationMembershipAuthority;

  constructor(deps: {
    idGenerator: FedosConversationCapabilityIdGenerator;
    secretGenerator: FedosConversationCapabilitySecretGenerator;
    existenceCheck: FedosConversationExistenceCheck;
    authorizationCheck: FedosConversationCapabilityIssuanceAuthorizationCheck;
    membershipAuthority: FedosConversationMembershipAuthority;
  }) {
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

    this.#capabilities.set(capabilityId, {
      descriptor,
      bearerSecret: this.#secretGenerator.generateBearerSecret(),
      redeemedByParticipantKeys: new Set(),
    });

    return { outcome: "issued", descriptor, bearerSecret: this.#capabilities.get(capabilityId)!.bearerSecret };
  }

  inspectDescriptor(capabilityId: FedosConversationCapabilityId): FedosConversationCapabilityDescriptor | null {
    return this.#capabilities.get(capabilityId)?.descriptor ?? null;
  }

  /** Alpha 1000 — additive, read-only directory of every descriptor issued for one conversation. Descriptors only; never a bearer secret. */
  listIssuedDescriptorsForConversation(conversationId: FedosConversationId): readonly FedosConversationCapabilityDescriptor[] {
    const result: FedosConversationCapabilityDescriptor[] = [];
    for (const stored of this.#capabilities.values()) {
      if (stored.descriptor.conversationId === conversationId) result.push(stored.descriptor);
    }
    return result;
  }

  /** Alpha 787 — honest, derivable current state; `null` for an unknown capability. */
  remainingUses(capabilityId: FedosConversationCapabilityId): number | null {
    const stored = this.#capabilities.get(capabilityId);
    if (stored === undefined) return null;
    return Math.max(0, stored.descriptor.maxUses - stored.redeemedByParticipantKeys.size);
  }

  redeem(request: FedosConversationCapabilityRedemptionRequest, now: number): FedosConversationCapabilityRedemptionResult {
    // Step 1 — validate without mutation.
    const stored = this.#capabilities.get(request.capabilityId);
    if (stored === undefined) return { outcome: "invalid-capability" };
    if (!fedosConversationCapabilityBearerSecretsMatch(stored.bearerSecret, request.bearerSecret)) {
      return { outcome: "invalid-capability" };
    }
    if (stored.descriptor.expiresAt !== null && now > stored.descriptor.expiresAt) {
      return { outcome: "expired" };
    }
    if (stored.descriptor.intendedRecipient !== null && !participantsEqual(stored.descriptor.intendedRecipient, request.redeemer)) {
      return { outcome: "recipient-mismatch" };
    }
    const redeemerKey = participantKey(request.redeemer);
    if (stored.redeemedByParticipantKeys.has(redeemerKey)) {
      return { outcome: "already-redeemed" };
    }
    if (stored.redeemedByParticipantKeys.size >= stored.descriptor.maxUses) {
      return { outcome: "exhausted" };
    }

    // Step 2 — preview Membership admission, still no mutation anywhere.
    const preview = this.#membershipAuthority.previewAdmission(stored.descriptor.conversationId, request.redeemer);
    if (preview.outcome === "unavailable") return { outcome: "unavailable" };
    if (preview.outcome === "blocked") return { outcome: "conflict" };

    // Step 3 — commit the capability use. The exactly-once gate.
    stored.redeemedByParticipantKeys.add(redeemerKey);

    // Step 4 — commit Membership admission. See this file's own header
    // for why a failure HERE, after step 3 already committed, is
    // returned as an honestly-disclosed "conflict", never hidden.
    const admission = this.#membershipAuthority.admit(stored.descriptor.conversationId, request.redeemer, "member", now);
    if (admission.outcome === "admitted" || admission.outcome === "already-present") {
      return { outcome: "redeemed", descriptor: stored.descriptor, membership: admission.membership };
    }
    return { outcome: "conflict" };
  }
}

function isValidIssueRequest(request: FedosConversationCapabilityIssueRequest): boolean {
  if (request === null || typeof request !== "object") return false;
  if (request.action !== "join-conversation") return false;
  if (!isValidMaxUses(request.maxUses)) return false;
  if (!isValidExpiresAt(request.expiresAt)) return false;
  return true;
}
