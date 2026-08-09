/**
 * OS Capability Modularization — `ConversationPort` adapter.
 *
 * Implements `ConversationPort` (`../../core/ports/conversation_port.js`,
 * owned by a concurrent agent in this same arc) by delegating to the real,
 * unmoved `FedosPrivateConversationConstructionCoordinator`
 * (`../../../conversation/construction/fedos_private_conversation_construction_coordinator.js`)
 * for creation/resolution, and to the real, unmoved
 * `FedosConversationMembershipAuthority`
 * (`../../../conversation/membership/fedos_conversation_membership_authority.js`)
 * for participant listing. Zero new conversation-creation or membership
 * logic lives here — this file only translates between the Port's
 * protocol-neutral shape and the coordinator's own command/result shapes.
 *
 * Like the `MessagingPort` adapter, this takes ALREADY-CONSTRUCTED
 * dependency instances rather than assembling them — wiring
 * `FedosPrivateConversationConstructionCoordinatorDependencies` is the
 * composition root's job, not this seam's.
 *
 * `CounterpartyRef` is deliberately opaque at the Port level (see that
 * file's own header) — this adapter picks ONE concrete encoding,
 * `"<authority>:<publicIdentifier>"` (e.g. `"nostr:<hex-pubkey>"`), using
 * this codebase's own `FedosConversationParticipantAuthority` vocabulary
 * for the authority half. This is an adapter-local convention, not a
 * repo-wide standard — a different adapter for a different Port
 * implementation could choose differently.
 *
 * `createOrResolve()` maps to `createDirectDraft()`. There is no existing
 * "find the conversation I already have with this counterparty" query
 * anywhere in the unmoved messenger code to delegate a genuine "resolve"
 * to, so this adapter reuses the coordinator's OWN idempotency contract
 * instead (Alpha 907/916/917 — a retried `createDirectDraft()` call with
 * the same `idempotencyKey` re-derives the same Conversation id and
 * returns `"already-present"` rather than minting a second draft): the
 * idempotency key is deterministically derived from the counterparty
 * reference itself, so calling `createOrResolve()` twice for the same
 * counterparty always resolves to the same conversation, without this
 * adapter inventing a second lookup mechanism.
 */

import type {
  ConversationDescriptor,
  ConversationId,
  ConversationPort,
  ConversationResult,
  CounterpartyRef,
} from "../../core/ports/conversation_port.js";
import type { FedosPrivateConversationConstructionCoordinator } from "../../../conversation/construction/fedos_private_conversation_construction_coordinator.js";
import type { FedosConversationMembershipAuthority } from "../../../conversation/membership/fedos_conversation_membership_authority.js";
import {
  FEDOS_CONVERSATION_PARTICIPANT_AUTHORITIES,
  type FedosConversationParticipantAuthority,
} from "../../../conversation/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationId } from "../../../conversation/fedos_conversation_id.js";

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

export interface FedosMessengerConversationPortAdapterDependencies {
  readonly constructionCoordinator: FedosPrivateConversationConstructionCoordinator;
  readonly membershipAuthority: FedosConversationMembershipAuthority;
}

export class FedosMessengerConversationPortAdapter implements ConversationPort {
  readonly #deps: FedosMessengerConversationPortAdapterDependencies;

  constructor(deps: FedosMessengerConversationPortAdapterDependencies) {
    this.#deps = deps;
  }

  async createOrResolve(counterparty: CounterpartyRef): Promise<ConversationResult> {
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
      participants: this.#listParticipants(conversationId),
    };
    return { ok: true, conversation: descriptor };
  }

  async listParticipants(conversationId: ConversationId): Promise<readonly CounterpartyRef[]> {
    if (typeof conversationId !== "string" || conversationId.length === 0) return [];
    return this.#listParticipants(conversationId as FedosConversationId);
  }

  #listParticipants(conversationId: FedosConversationId): readonly CounterpartyRef[] {
    return this.#deps.membershipAuthority
      .listMemberships(conversationId)
      .map((membership) => toCounterpartyRef(membership.participant.authority, membership.participant.publicIdentifier));
  }
}
