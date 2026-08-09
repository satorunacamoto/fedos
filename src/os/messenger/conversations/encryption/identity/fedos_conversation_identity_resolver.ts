/**
 * Secure Runtime Alpha 931 ("Conversation Identity Resolver") — Stage 1
 * of the Alpha 931–990 Conversation Identity Resolution and Encryption
 * Coordinator Arc.
 *
 * Alpha 890's own completion declaration (`docs/secure_runtime_alpha_890_completion_declaration.md`)
 * named ONE remaining blocker standing between the Alpha 861–890
 * Encryption/Decryption Authorities and a real Coordinator: nothing in
 * this codebase mapped a live Conversation/Membership pair to the
 * `localAccountIndex`/`counterpartyPublicKeyHex` pair
 * `resolveConversationKey()` (Alpha 869) needs. This file is the FIRST
 * step of that resolution chain: "who is the LOCAL participant, right
 * now?" — never "who founded this draft" (a different question,
 * `FedosConversationCreatorIdentityAuthority`, Alpha 904, already
 * answers that one for construction and is REUSED here unmodified, not
 * renamed, not re-implemented).
 *
 * `FedosConversationCreatorIdentityAuthority` is reused as the sole
 * dependency rather than inventing a parallel "who am I" mechanism —
 * this codebase has exactly one durable local-identity concept in V1
 * (Alpha 904's own "the ONE authority a caller consults to learn WHO the
 * local participant is"), and duplicating it here would let the two
 * questions silently disagree. A future Arc that gives a local user
 * multiple bound identities (one per Conversation, say) would extend
 * THIS interface's own method signature additively (e.g. accepting a
 * `conversationId` parameter) without touching
 * `FedosConversationCreatorIdentityAuthority` itself — this file exists
 * precisely so that future divergence has a seam to land in, rather than
 * every encryption call site importing the construction-domain authority
 * directly.
 *
 * NON-RESPONSIBILITY: this file does NOT verify that the resolved local
 * participant is cryptographically bound to any particular account index
 * — that composition (over the EXISTING, unmodified Alpha 681–720 Nostr
 * Identity Binding Authority, `../../../board/runtime/identity/fedos_nostr_author_binding_authority.js`)
 * lives in `./fedos_conversation_key_resolver.ts` (Alpha 935), the one
 * place account index and identity are both already in hand together.
 */

import type { FedosConversationCreatorIdentityAuthority, FedosConversationCreatorIdentityResolution } from "../../../../../conversation/construction/fedos_conversation_creator_identity_authority.js";

/** Reuses `FedosConversationCreatorIdentityResolution`'s own closed vocabulary verbatim — see this file's own header for why no parallel type is introduced. */
export type FedosConversationLocalIdentityResolution = FedosConversationCreatorIdentityResolution;

export interface FedosConversationIdentityResolver {
  /** Total, never throws — mirrors every other Authority read in this codebase. */
  resolveLocalParticipant(): FedosConversationLocalIdentityResolution;
}

/**
 * The ONE production implementation — a thin, additive delegation to an
 * injected `FedosConversationCreatorIdentityAuthority`. Performs no
 * membership/network/storage lookup of its own; every real decision
 * belongs to the injected authority.
 */
export class DelegatingFedosConversationIdentityResolver implements FedosConversationIdentityResolver {
  readonly #authority: FedosConversationCreatorIdentityAuthority;

  constructor(authority: FedosConversationCreatorIdentityAuthority) {
    this.#authority = authority;
  }

  resolveLocalParticipant(): FedosConversationLocalIdentityResolution {
    return this.#authority.resolveCreator();
  }
}
