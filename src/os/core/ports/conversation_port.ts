/**
 * OS Capability Modularization — `ConversationPort` (widened).
 *
 * Factory/Port Completion pass (Architecture Dependency Closure +
 * Ports/Factories Completion + OSS Catalog Completion arc): widens the
 * original create/list-only seam per
 * `docs/architecture/FACTORY-PORT-COMPLETION-PLAN.md`'s gap analysis,
 * measured against the real
 * `FedosPrivateConversationConstructionCoordinator`
 * (`src/os/messenger/conversations/construction/fedos_private_conversation_construction_coordinator.ts`,
 * `createDirectDraft`/`createPrivateGroupDraft`) and
 * `FedosConversationMembershipAuthority`
 * (`src/os/messenger/conversations/membership/fedos_conversation_membership_authority.ts`,
 * `admit`/`revoke`/`leave`).
 *
 * Interface segregation: split into `ConversationCreationPort` (direct vs.
 * group creation — two genuinely separate real entrypoints, never flattened
 * into one),  `ConversationQueryPort` (participant listing),
 * `ConversationMembershipPort` (admit/revoke/leave — entirely absent
 * before this pass), and `ConversationReadinessPort` (draft/readiness
 * visibility — also entirely absent before this pass). Composed back into
 * `ConversationPort` below for a consumer that wants the whole surface.
 *
 * Deliberately generic — no messenger-internal type (no Nostr event shape,
 * no ratchet/session state, no FedOS `Conversation` record).
 *
 * This file is an INTERFACE ONLY. It must never import from `src/conversation`,
 * `src/os/messenger`, or any other messenger-specific module — a future
 * Messenger package provides the adapter that implements this port.
 */

/** Opaque identifier for a conversation. */
export type ConversationId = string;

/**
 * Opaque identifier for a counterparty. Intentionally not typed as any
 * specific identity/pubkey shape — that belongs to a concrete adapter.
 */
export type CounterpartyRef = string;

/**
 * Mirrors the real construction coordinator's own two draft modes
 * (`FedosPrivateConversationMode`). A `direct` conversation always has
 * exactly two participants (creator + one bound recipient); a `group`
 * conversation admits members after creation via `ConversationMembershipPort`.
 */
export type ConversationMode = "direct" | "group";

/** A conversation as observed through this port. */
export interface ConversationDescriptor {
  readonly conversationId: ConversationId;
  readonly mode: ConversationMode;
  /** Participant references, including the local party. */
  readonly participants: readonly CounterpartyRef[];
}

/** Outcome of a create/resolve attempt. Failures are reported here, not thrown. */
export interface ConversationResult {
  readonly ok: boolean;
  readonly conversation?: ConversationDescriptor;
  /** Non-sensitive, human-readable explanation (e.g. on failure). */
  readonly reason?: string;
}

/**
 * Creation is a distinct entrypoint per mode — never one flattened
 * `create(mode, counterparty?)` call — mirroring the real coordinator's own
 * `createDirectDraft()`/`createPrivateGroupDraft()` split (different
 * validation, different fanout, per that coordinator's own header).
 */
export interface ConversationCreationPort {
  /**
   * Create a new direct conversation with the given counterparty, or
   * resolve to an existing one if the adapter considers one to already
   * exist (an adapter-local idempotency convention — see the Messenger
   * adapter's own doc comment for the one it picked).
   */
  createDirect(counterparty: CounterpartyRef): Promise<ConversationResult>;
  /**
   * Create a new group conversation with only the local caller as a
   * member. Further participants are admitted afterward via
   * `ConversationMembershipPort.admit()` — a group's membership is never
   * fully specified at creation time, mirroring the real coordinator's own
   * "no fabricated Membership" discipline.
   */
  createGroup(): Promise<ConversationResult>;
}

/** Read-only queries over an existing conversation's membership. */
export interface ConversationQueryPort {
  /** List the participants of an existing conversation. Never throws. */
  listParticipants(conversationId: ConversationId): Promise<readonly CounterpartyRef[]>;
}

/**
 * The real membership authority's closed six-transition outcome set
 * (`FedosConversationMembershipMutationOutcome`), minus nothing — every
 * branch is a real outcome, not a Port-invented one.
 */
export type MembershipMutationOutcome =
  | "admitted"
  | "revoked"
  | "left"
  | "already-present"
  | "conflict"
  | "invalid-transition"
  | "not-found"
  | "unavailable";

/** Outcome of a membership mutation. Discriminated union; failures are reported here, never thrown. */
export type MembershipMutationResult =
  | { readonly outcome: "admitted" | "revoked" | "left" | "already-present"; readonly participant: CounterpartyRef }
  | { readonly outcome: "conflict" | "invalid-transition" | "not-found" | "unavailable" };

/**
 * Membership mutation — entirely absent from this Port before this pass.
 * `admit`/`revoke` name the OTHER participant being added/removed;
 * `leave` never takes a participant argument — mirroring every other
 * Port method's "the caller never asserts who they are" discipline (the
 * local participant is always resolved internally by the adapter, exactly
 * like `MessagingPort.send()`'s sender).
 */
export interface ConversationMembershipPort {
  /** Admit a new participant into an existing conversation. Never throws. */
  admit(conversationId: ConversationId, counterparty: CounterpartyRef): Promise<MembershipMutationResult>;
  /** Revoke an existing participant's membership. Never throws. */
  revoke(conversationId: ConversationId, counterparty: CounterpartyRef): Promise<MembershipMutationResult>;
  /** The local caller leaves the conversation. Never throws. */
  leave(conversationId: ConversationId): Promise<MembershipMutationResult>;
}

/**
 * Mirrors the real coordinator's closed `FedosConversationOverallReadinessOutcome`
 * (`draft-ready` | `activation-ready` | `blocked`) — see
 * `fedos_conversation_readiness.ts`'s own header for the full per-axis
 * model this collapses to one coarse read.
 */
export type ConversationReadinessOverall = "draft-ready" | "activation-ready" | "blocked";

/** A coarse, single-value readiness read. The full multi-axis breakdown stays Messenger-internal. */
export interface ConversationReadiness {
  readonly overall: ConversationReadinessOverall;
}

/**
 * Draft/readiness visibility — entirely absent from this Port before this
 * pass. A conversation is not simply "resolved or not"; it passes through
 * draft -> readiness-checked -> active states, and a Commerce-side
 * consumer may need to know which state it's in before assuming messages
 * can flow.
 */
export interface ConversationReadinessPort {
  /** Live readiness recompute for an existing conversation, or `null` if unknown. Never throws. */
  readiness(conversationId: ConversationId): Promise<ConversationReadiness | null>;
}

/**
 * The full conversation seam — the union of the four narrower interfaces
 * above, kept as one name for every existing consumer/adapter that wants
 * the whole surface. An adapter implementing this port owns the actual
 * conversation-creation/session logic; `os/core` and `os/commerce` depend
 * only on this shape.
 */
export interface ConversationPort
  extends ConversationCreationPort,
    ConversationQueryPort,
    ConversationMembershipPort,
    ConversationReadinessPort {}
