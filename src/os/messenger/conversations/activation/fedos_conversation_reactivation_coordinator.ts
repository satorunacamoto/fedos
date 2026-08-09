/**
 * Secure Runtime Alpha 2041–2120 ("Conversation Identity Restoration and
 * Reactivation Arc").
 *
 * `reactivateRestoredConversation(conversationId)` — the ONE narrow
 * operation that reconstructs the Draft(+Activation, for a `direct` id)
 * fact(s) an archive restore deliberately never replays (see this Arc's
 * own reconciliation report,
 * `docs/secure_runtime_alpha_2041_2120_reconciliation_report.md`),
 * deterministically re-derived from already-restored, durable Membership
 * facts — never invented, never caller-asserted. Composed entirely over
 * EXISTING, unmodified machinery:
 *   - `FedosConversationDraftPersistence`/`validateFedosConversationDraftRecord()`
 *     (Alpha 894/895, unmodified) — the SAME sole constructor every other
 *     Draft write in this codebase already uses.
 *   - `FedosConversationMembershipAuthority` (Alpha 761–790, unmodified) —
 *     both the source of the re-derived `creator` fact (the ONE Membership
 *     with `role === "owner"` — Alpha 915's own
 *     `FedosPrivateConversationConstructionCoordinator.#run()` is the ONLY
 *     place in this codebase that ever admits a creator with that role) and
 *     the authorization gate (see below).
 *   - `FedosConversationIdentityResolver` (Alpha 931, unmodified) — resolves
 *     the local controlled participant.
 *   - `FedosConversationDirectActivationCoordinator.activateDirectConversation()`
 *     (Alpha 1122, unmodified) — fully re-verifies (policy, identity,
 *     Membership, key readiness, encryption/storage availability) and
 *     activates a `direct` conversation once its Draft exists. This file
 *     invents no crypto, no Membership concept, no activation phase of its
 *     own — every `direct` id, including a Group's own pairwise child, is
 *     activated through this SAME frozen coordinator.
 *   - `FedosGroupGenerationPersistence`/`FedosGroupDirectPathPersistence`
 *     (Alpha 1321–1390, unmodified, read-only here) — to detect whether an
 *     id is a `private-group` (a real generation already exists for it, the
 *     SAME authoritative signal Alpha 1921–1980's own Phase A/B finding
 *     established) and to enumerate every distinct child
 *     `directConversationId` its restored Paths reference.
 *
 * SCOPE (this Arc's own frozen boundary): reactivates Draft(+Activation)
 * ONLY. Never writes Membership, Capability, Envelope, Payload, Generation,
 * or Path — every one of those is ALREADY correctly restored by the
 * completed Direct/Group Archive Arcs (Alpha 1541–1610/1691–1760/1921–1980);
 * this coordinator only ever READS them.
 *
 * A `private-group` id is never itself "activated" (Alpha 1123's own frozen
 * Private-Group Gate, untouched) — only its OWN Draft is reconstructed here,
 * so `FedosGroupGenerationAuthority.createNextGeneration()`/
 * `evaluateFedosGroupUsability()` (both of which require
 * `draft.mode === "private-group"`) keep working for a restored Group. Every
 * pairwise child Direct Conversation the Group's restored Paths reference is
 * reactivated independently, one per distinct `directConversationId` — this
 * is the ACTUAL messaging-resuming step, since `FedosGroupDirectPathAuthority.preparePath()`
 * returns early (never touching Draft/Activation) whenever an existing,
 * restored Path already reports `state === "ready"` (see the reconciliation
 * report §3's own finding), so a real post-restore Group send would
 * otherwise still fail deep inside `sendDirectMessage()`.
 *
 * AUTHORIZATION (reused, not invented — this Arc's own governing
 * instruction): the SAME "local identity resolves, and holds an ACTIVE
 * Membership on the conversation" check `activateDirectConversation()`/
 * `FedosGroupSendCoordinator.sendGroupMessage()` already enforce elsewhere
 * in this codebase, applied here per id (top-level AND, independently, per
 * child) — never a new authorization model. A caller whose local identity
 * was never a genuine, currently-active member of the restored conversation
 * gets `"unauthorized"` (top level) or `"not-member"` (a child) — it can
 * reactivate/hijack nothing it has no legitimate claim to.
 *
 * IDEMPOTENT, FAIL CLOSED (this Arc's own explicit requirement): every Draft
 * write is skipped entirely once a Draft already durably exists for that id
 * (never overwritten, mirrors Alpha 894's own "immutable once written"
 * discipline); `activateDirectConversation()` is already fully idempotent
 * (Alpha 1122's own "the ONLY short-circuit is `completed` itself"). Calling
 * this operation once, twice, or on an already-active conversation never
 * duplicates or corrupts anything — every branch below is a pure read
 * followed by an idempotent write, and a per-child failure never aborts any
 * other child.
 */

import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosConversationDraftPersistence } from "../construction/fedos_conversation_draft_persistence.js";
import { validateFedosConversationDraftRecord } from "../construction/fedos_conversation_draft_record_validator.js";
import {
  deserializeFedosConversationDraftRecord,
  serializeFedosConversationDraftRecord,
} from "../construction/fedos_conversation_draft_record_codec.js";
import type { FedosPrivateConversationMode } from "../construction/fedos_private_conversation_id.js";
import type { FedosConversationMembership } from "../membership/fedos_conversation_membership.js";
import type { FedosConversationMembershipAuthority } from "../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationParticipantReference } from "../membership/fedos_conversation_participant_reference.js";
import type { FedosConversationIdentityResolver } from "../encryption/identity/fedos_conversation_identity_resolver.js";
import type { FedosGroupGenerationPersistence } from "../group/fedos_group_generation.js";
import type { FedosGroupDirectPathPersistence } from "../group/fedos_group_direct_path.js";
import type { FedosConversationDirectActivationCoordinator } from "./fedos_conversation_direct_activation_coordinator.js";
import type {
  FedosConversationReactivationChildOutcome,
  FedosConversationReactivationResult,
} from "./fedos_conversation_reactivation_result.js";

export interface FedosConversationReactivationCoordinatorDependencies {
  readonly draftPersistence: FedosConversationDraftPersistence;
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly identityResolver: FedosConversationIdentityResolver;
  readonly groupGenerationPersistence: FedosGroupGenerationPersistence;
  readonly groupDirectPathPersistence: FedosGroupDirectPathPersistence;
  readonly activationCoordinator: FedosConversationDirectActivationCoordinator;
}

/** Internal-only outcome of `#ensureDraft()` — folded into the public per-id/per-child vocabulary by each caller. */
type EnsureDraftOutcome = "ok" | "creator-unresolvable" | "invalid-restored-state" | "persistence-failed";

export class FedosConversationReactivationCoordinator {
  readonly #deps: FedosConversationReactivationCoordinatorDependencies;

  constructor(deps: FedosConversationReactivationCoordinatorDependencies) {
    this.#deps = deps;
  }

  async reactivateRestoredConversation(conversationId: string): Promise<FedosConversationReactivationResult> {
    if (typeof conversationId !== "string" || conversationId.length === 0) {
      return { outcome: "conversation-not-found" };
    }
    const id = conversationId as FedosConversationId;

    const existingDraft = this.#deps.draftPersistence.getDraft(id);
    const isGroup = this.#deps.groupGenerationPersistence.currentGenerationForGroup(id) !== null;
    const memberships = this.#deps.membershipAuthority.listMemberships(id);
    // Fail closed for a genuinely unknown id -- no Draft, no Group generation, no Membership of any
    // kind ever restored for it. Never a raw persistence-port read from a caller's own perspective;
    // this coordinator legitimately owns every one of these ports already.
    if (existingDraft === null && !isGroup && memberships.length === 0) {
      return { outcome: "conversation-not-found" };
    }

    const identity = this.#deps.identityResolver.resolveLocalParticipant();
    if (identity.outcome === "unavailable") return { outcome: "identity-unavailable" };
    const localParticipant = identity.creator;

    // Authorization -- the SAME "local identity holds an ACTIVE Membership on this id" gate
    // `activateDirectConversation()`/`sendGroupMessage()` already enforce (see this file's own header).
    const localMembership = this.#deps.membershipAuthority.findMembership(id, localParticipant);
    if (localMembership === null || localMembership.state !== "active") {
      return { outcome: "unauthorized" };
    }

    let mode: FedosPrivateConversationMode;
    if (existingDraft !== null) {
      // A Draft already exists (e.g. a second reactivation call, or a conversation this Arc never
      // needed to touch) -- trust its OWN already-validated mode, never re-derive or overwrite it.
      // A corrupt existing record fails closed rather than silently re-deriving over it (mirrors Alpha
      // 918's own "never activates or re-creates a fact from missing/corrupt data" discipline).
      const deserialized = deserializeFedosConversationDraftRecord(existingDraft);
      if (deserialized === null) return { outcome: "invalid-restored-state" };
      mode = deserialized.mode;
    } else {
      mode = isGroup ? "private-group" : "direct";
    }

    const draftOutcome = this.#ensureDraft(id, mode, memberships);
    if (draftOutcome !== "ok") return { outcome: draftOutcome };

    if (mode === "direct") {
      const activation = await this.#deps.activationCoordinator.activateDirectConversation(id);
      if (activation.outcome === "activated") return { outcome: "reactivated", mode: "direct" };
      if (activation.outcome === "already-active") return { outcome: "already-active", mode: "direct" };
      return { outcome: "activation-failed", detail: activation.outcome };
    }

    // mode === "private-group" -- the Group id itself is never "activated" (Alpha 1123's own frozen
    // gate); only its Draft was needed above. Reactivate every distinct pairwise child Direct
    // Conversation the Group's own restored Paths reference, independently -- one failing/skipped
    // child never aborts any other (mirrors the archive restore's own per-domain loop discipline).
    const childIds = new Set<string>();
    for (const generation of this.#deps.groupGenerationPersistence.listGenerations(id)) {
      for (const path of this.#deps.groupDirectPathPersistence.listPathsForGeneration(id, generation.generationId)) {
        childIds.add(path.directConversationId);
      }
    }
    const children = new Map<string, FedosConversationReactivationChildOutcome>();
    for (const childId of childIds) {
      children.set(childId, await this.#reactivateChild(childId as FedosConversationId, localParticipant));
    }
    return { outcome: "reactivated", mode: "private-group", children };
  }

  async #reactivateChild(
    childId: FedosConversationId,
    localParticipant: FedosConversationParticipantReference,
  ): Promise<FedosConversationReactivationChildOutcome> {
    // The SAME per-id authorization gate as the top level -- a member excluded from (or never party
    // to) this particular pairwise child is legitimately skipped, never forced through.
    const localMembership = this.#deps.membershipAuthority.findMembership(childId, localParticipant);
    if (localMembership === null || localMembership.state !== "active") return "not-member";

    const memberships = this.#deps.membershipAuthority.listMemberships(childId);
    const draftOutcome = this.#ensureDraft(childId, "direct", memberships);
    if (draftOutcome !== "ok") return draftOutcome;

    const activation = await this.#deps.activationCoordinator.activateDirectConversation(childId);
    if (activation.outcome === "activated") return "reactivated";
    if (activation.outcome === "already-active") return "already-active";
    return "activation-failed";
  }

  /** Idempotent -- a no-op ("ok") once a Draft already durably exists for `id` (NEVER overwritten). */
  #ensureDraft(
    id: FedosConversationId,
    mode: FedosPrivateConversationMode,
    memberships: readonly FedosConversationMembership[],
  ): EnsureDraftOutcome {
    if (this.#deps.draftPersistence.getDraft(id) !== null) return "ok";

    // The ONE re-derivable, already-restored, never-invented source of "who created this" (see this
    // file's own header) -- the creator Membership is always admitted with role "owner".
    const owner = memberships.find((m) => m.role === "owner");
    if (owner === undefined) return "creator-unresolvable";

    const draftRecord = validateFedosConversationDraftRecord({
      id,
      mode,
      lifecycleState: "draft",
      policyReference: mode === "direct" ? "direct-draft-v1" : "private-group-draft-v1",
      creator: owner.participant,
      createdAt: owner.joinedAt,
    });
    if (draftRecord === null) return "invalid-restored-state";

    const write = this.#deps.draftPersistence.putDraft(serializeFedosConversationDraftRecord(draftRecord));
    if (write === "failed") return "persistence-failed";
    // "inserted"/"already-present"/"conflict" (a concurrent, identical deterministic write racing us)
    // all leave a durable, correct record behind -- never a caller-visible error for this narrow write.
    return "ok";
  }
}
