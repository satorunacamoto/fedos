/**
 * OS Capability Modularization — `ConversationPort` adapter.
 *
 * Implements the widened `ConversationPort`
 * (`../../core/ports/conversation_port.js` — direct/group creation
 * distinction, membership mutation, draft/readiness visibility, per the
 * Factory/Port Completion pass; see that file's own header for the full
 * rationale) by delegating to the real, unmoved
 * `FedosPrivateConversationConstructionCoordinator`
 * (`../conversations/construction/fedos_private_conversation_construction_coordinator.js`
 * — imported from its CANONICAL post-migration location, not the
 * `src/conversation/construction/` compatibility shim this file used
 * before this pass) for creation/resolution/readiness, and to the real,
 * unmoved `FedosConversationMembershipAuthority`
 * (`../conversations/membership/fedos_conversation_membership_authority.js`
 * — likewise repointed to its canonical location) for participant
 * listing and membership mutation. Zero new conversation-creation or
 * membership logic lives here — this file only translates between the
 * Port's protocol-neutral shape and the coordinators' own command/result
 * shapes.
 *
 * Like before this pass, this takes ALREADY-CONSTRUCTED dependency
 * instances rather than assembling them — wiring
 * `FedosPrivateConversationConstructionCoordinatorDependencies` is the
 * composition root's job, not this seam's.
 *
 * THREE NEW DEPENDENCIES ARE OPTIONAL, not required, mirroring this
 * codebase's own established "optional, honestly-degraded" pattern
 * (`FedosConversationDirectMessagingCoordinatorDependencies.delivery`/
 * `ratchetDelivery`):
 *   - `identityResolver` (`FedosConversationIdentityResolver`) — needed to
 *     answer "who is the local caller" for `leave()` (mirrors
 *     `sendDirectMessage()`'s own "the caller never asserts who they are"
 *     discipline: the local participant is always resolved internally,
 *     never accepted as a Port argument). Omitted, `leave()` returns
 *     `{ outcome: "unavailable" }` rather than guessing an identity.
 *   - `draftPersistence` (`FedosConversationDraftPersistence`) — needed by
 *     `readiness()` to look up the underlying draft record the
 *     construction coordinator's `readinessForDraft()` requires. Omitted,
 *     `readiness()` returns `null` rather than fabricating a reading.
 *   - `clock` (`() => number`, Unix seconds) — needed by every membership
 *     mutation (`admit`/`revoke`/`leave` all take a caller-supplied `now`
 *     on the real authority, mirroring `FedosBoardRuntimeClock`'s own
 *     "caller-supplied, deterministic, testable" discipline). Defaults to
 *     a real wall-clock reading when omitted.
 *
 * `CounterpartyRef` is deliberately opaque at the Port level (see that
 * file's own header) — this adapter picks ONE concrete encoding,
 * `"<authority>:<publicIdentifier>"` (e.g. `"nostr:<hex-pubkey>"`), using
 * this codebase's own `FedosConversationParticipantAuthority` vocabulary
 * for the authority half. This is an adapter-local convention, not a
 * repo-wide standard — a different adapter for a different Port
 * implementation could choose differently.
 *
 * `createDirect()` maps to `createDirectDraft()`. There is no existing
 * "find the conversation I already have with this counterparty" query
 * anywhere in the unmoved messenger code to delegate a genuine "resolve"
 * to, so this adapter reuses the coordinator's OWN idempotency contract
 * instead (Alpha 907/916/917 — a retried `createDirectDraft()` call with
 * the same `idempotencyKey` re-derives the same Conversation id and
 * returns `"already-present"` rather than minting a second draft): the
 * idempotency key is deterministically derived from the counterparty
 * reference itself, so calling `createDirect()` twice for the same
 * counterparty always resolves to the same conversation, without this
 * adapter inventing a second lookup mechanism. `createGroup()` maps to
 * `createPrivateGroupDraft()` with no idempotency key (every call mints a
 * genuinely new group) and no initial Capability request (further
 * participants are admitted afterward, per `ConversationCreationPort`'s
 * own doc comment).
 */

import type {
  ConversationDescriptor,
  ConversationId,
  ConversationMembershipPort,
  ConversationPort,
  ConversationReadiness,
  ConversationResult,
  CounterpartyRef,
  MembershipMutationResult,
} from "../../core/ports/conversation_port.js";
import type { FedosPrivateConversationConstructionCoordinator } from "../conversations/construction/fedos_private_conversation_construction_coordinator.js";
import type { FedosConversationMembershipAuthority } from "../conversations/membership/fedos_conversation_membership_authority.js";
import {
  FEDOS_CONVERSATION_PARTICIPANT_AUTHORITIES,
  type FedosConversationParticipantAuthority,
  type FedosConversationParticipantReference,
} from "../conversations/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationId } from "../conversations/fedos_conversation_id.js";
import type { FedosConversationIdentityResolver } from "../conversations/encryption/identity/fedos_conversation_identity_resolver.js";
import type { FedosConversationDraftPersistence } from "../conversations/construction/fedos_conversation_draft_persistence.js";
import { deserializeFedosConversationDraftRecord } from "../conversations/construction/fedos_conversation_draft_record_codec.js";

const KNOWN_AUTHORITIES: ReadonlySet<string> = new Set(FEDOS_CONVERSATION_PARTICIPANT_AUTHORITIES);

interface ParsedCounterparty {
  readonly authority: FedosConversationParticipantAuthority;
  readonly publicIdentifier: string;
}

/** `"<authority>:<publicIdentifier>"` -> parsed, or `null` for anything unrecognized/malformed. Never throws. */
function parseCounterpartyRef(ref: CounterpartyRef): ParsedCounterparty | null {
  if (typeof ref !== "string" || ref.length === 0) return null;
  const separatorIndex = ref.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex === ref.length - 1) return null;
  const authority = ref.slice(0, separatorIndex);
  const publicIdentifier = ref.slice(separatorIndex + 1);
  if (!KNOWN_AUTHORITIES.has(authority)) return null;
  return { authority: authority as FedosConversationParticipantAuthority, publicIdentifier };
}

function toCounterpartyRef(authority: string, publicIdentifier: string): CounterpartyRef {
  return `${authority}:${publicIdentifier}`;
}

function defaultClock(): number {
  return Math.floor(Date.now() / 1000);
}

/** Every mutating-outcome branch a `MembershipMutationResult` may carry a `participant` on. */
const PARTICIPANT_CARRYING_OUTCOMES: ReadonlySet<string> = new Set(["admitted", "revoked", "left", "already-present"]);

export interface FedosMessengerConversationPortAdapterDependencies {
  readonly constructionCoordinator: FedosPrivateConversationConstructionCoordinator;
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  /** OPTIONAL — omitted, `leave()` returns `{ outcome: "unavailable" }`. See this file's own header. */
  readonly identityResolver?: FedosConversationIdentityResolver;
  /** OPTIONAL — omitted, `readiness()` returns `null`. See this file's own header. */
  readonly draftPersistence?: FedosConversationDraftPersistence;
  /** OPTIONAL — real wall-clock `Unix seconds` reading by default. */
  readonly clock?: () => number;
}

export class FedosMessengerConversationPortAdapter implements ConversationPort {
  readonly #deps: FedosMessengerConversationPortAdapterDependencies;
  readonly #clock: () => number;

  constructor(deps: FedosMessengerConversationPortAdapterDependencies) {
    this.#deps = deps;
    this.#clock = deps.clock ?? defaultClock;
  }

  async createDirect(counterparty: CounterpartyRef): Promise<ConversationResult> {
    const recipient = parseCounterpartyRef(counterparty);
    if (recipient === null) {
      return { ok: false, reason: 'unrecognized counterparty reference; expected "<authority>:<publicIdentifier>"' };
    }
    const idempotencyKey = `os-messenger-conversation-port-adapter:direct:${recipient.authority}:${recipient.publicIdentifier}`;
    const result = this.#deps.constructionCoordinator.createDirectDraft({ recipient, idempotencyKey });
    if (result.outcome !== "draft-created" && result.outcome !== "already-present") {
      return { ok: false, reason: result.outcome };
    }
    const conversationId = result.draft.id;
    const descriptor: ConversationDescriptor = {
      conversationId,
      mode: "direct",
      participants: this.#listParticipants(conversationId),
    };
    return { ok: true, conversation: descriptor };
  }

  async createGroup(): Promise<ConversationResult> {
    const result = this.#deps.constructionCoordinator.createPrivateGroupDraft({});
    if (result.outcome !== "draft-created" && result.outcome !== "already-present") {
      return { ok: false, reason: result.outcome };
    }
    const conversationId = result.draft.id;
    const descriptor: ConversationDescriptor = {
      conversationId,
      mode: "group",
      participants: this.#listParticipants(conversationId),
    };
    return { ok: true, conversation: descriptor };
  }

  async listParticipants(conversationId: ConversationId): Promise<readonly CounterpartyRef[]> {
    if (typeof conversationId !== "string" || conversationId.length === 0) return [];
    return this.#listParticipants(conversationId as FedosConversationId);
  }

  async admit(conversationId: ConversationId, counterparty: CounterpartyRef): Promise<MembershipMutationResult> {
    const parsed = parseCounterpartyRef(counterparty);
    if (parsed === null || typeof conversationId !== "string" || conversationId.length === 0) {
      return { outcome: "not-found" };
    }
    const participant: FedosConversationParticipantReference = {
      authority: parsed.authority,
      publicIdentifier: parsed.publicIdentifier,
      identityId: null,
    };
    const result = this.#deps.membershipAuthority.admit(
      conversationId as FedosConversationId,
      participant,
      "member",
      this.#clock(),
    );
    return this.#toMutationResult(result, counterparty);
  }

  async revoke(conversationId: ConversationId, counterparty: CounterpartyRef): Promise<MembershipMutationResult> {
    const parsed = parseCounterpartyRef(counterparty);
    if (parsed === null || typeof conversationId !== "string" || conversationId.length === 0) {
      return { outcome: "not-found" };
    }
    const participant: FedosConversationParticipantReference = {
      authority: parsed.authority,
      publicIdentifier: parsed.publicIdentifier,
      identityId: null,
    };
    const result = this.#deps.membershipAuthority.revoke(
      conversationId as FedosConversationId,
      participant,
      this.#clock(),
    );
    return this.#toMutationResult(result, counterparty);
  }

  async leave(conversationId: ConversationId): Promise<MembershipMutationResult> {
    if (typeof conversationId !== "string" || conversationId.length === 0) return { outcome: "not-found" };
    if (this.#deps.identityResolver === undefined) return { outcome: "unavailable" };
    const identity = this.#deps.identityResolver.resolveLocalParticipant();
    if (identity.outcome === "unavailable") return { outcome: "unavailable" };
    const result = this.#deps.membershipAuthority.leave(
      conversationId as FedosConversationId,
      identity.creator,
      this.#clock(),
    );
    return this.#toMutationResult(result, toCounterpartyRef(identity.creator.authority, identity.creator.publicIdentifier));
  }

  async readiness(conversationId: ConversationId): Promise<ConversationReadiness | null> {
    if (typeof conversationId !== "string" || conversationId.length === 0) return null;
    if (this.#deps.draftPersistence === undefined) return null;
    const persisted = this.#deps.draftPersistence.getDraft(conversationId as FedosConversationId);
    if (persisted === null) return null;
    const draft = deserializeFedosConversationDraftRecord(persisted);
    if (draft === null) return null;
    const readiness = this.#deps.constructionCoordinator.readinessForDraft(draft);
    return { overall: readiness.overall };
  }

  #toMutationResult(
    result: ReturnType<FedosConversationMembershipAuthority["admit"]>,
    fallbackParticipant: CounterpartyRef,
  ): MembershipMutationResult {
    if (!PARTICIPANT_CARRYING_OUTCOMES.has(result.outcome)) {
      return { outcome: result.outcome as "conflict" | "invalid-transition" | "not-found" | "unavailable" };
    }
    const participant =
      "membership" in result
        ? toCounterpartyRef(result.membership.participant.authority, result.membership.participant.publicIdentifier)
        : fallbackParticipant;
    return { outcome: result.outcome as "admitted" | "revoked" | "left" | "already-present", participant };
  }

  #listParticipants(conversationId: FedosConversationId): readonly CounterpartyRef[] {
    return this.#deps.membershipAuthority
      .listMemberships(conversationId)
      .map((membership) => toCounterpartyRef(membership.participant.authority, membership.participant.publicIdentifier));
  }
}
