/**
 * Secure Runtime Alpha 935 ("Conversation Key Resolver") — Stage 5 of the
 * Alpha 931–990 Conversation Identity Resolution and Encryption
 * Coordinator Arc.
 *
 * THE resolution Alpha 890's own completion declaration named as this
 * codebase's exact remaining activation-boundary blocker: composes
 * Stages 1–4 of this Arc (`./fedos_conversation_identity_resolver.ts`,
 * `./fedos_conversation_participant_resolver.ts`,
 * `./fedos_conversation_local_account_index_authority.ts`,
 * `./fedos_conversation_counterparty_public_key_resolver.ts`) into the
 * exact `(localAccountIndex, counterpartyPublicKeyHex)` pair
 * `FedosConversationEncryptionRequest`/`FedosConversationDecryptionRequest`
 * (`../fedos_conversation_encryption_authority.ts`,
 * `../fedos_conversation_decryption_authority.ts`, Alpha 861/862) accept
 * ALREADY RESOLVED — never inventing the resolution those files' own
 * headers named as out of scope for Alpha 861–890, and never modifying
 * either frozen interface itself.
 *
 * SECURITY STEP beyond pure composition: when the resolved local
 * participant's own `authority === "nostr"`, this resolver additionally
 * calls the EXISTING, unmodified Alpha 681–720 Nostr Identity Binding
 * Authority (`FedosNostrAuthorBindingAuthority.verifyBinding()`,
 * `../../../board/runtime/identity/fedos_nostr_author_binding_types.ts`
 * interface, `fedos_nostr_author_binding_authority.ts` implementation)
 * to CRYPTOGRAPHICALLY confirm the configured local account index
 * (Stage 3) truly derives the resolved local participant's own
 * `publicIdentifier` — never trusting the two to already agree. Without
 * this check, a misconfigured `localAccountIndex` (Stage 3 is a fixed
 * config value, not derived from identity) could silently drive
 * `resolveConversationKey()` against the WRONG local key while still
 * reporting the intended participant's identity. This is a genuine new
 * security property this Arc adds by CONNECTING two already-existing,
 * already-reviewed layers — not a new cryptographic primitive (Alpha
 * 931–990's own explicit constraint): `verifyBinding()` performs no
 * signing, no key derivation, only a public-key equality check.
 *
 * A non-`"nostr"` local participant (`"fedos"`/anonymous-local,
 * `"activitypub"`, `"atproto"`, `"session"`, `"temporary-capability"`)
 * skips the binding check entirely — there is no Nostr-keyed identity to
 * bind, and `resolveFedosConversationCounterpartyPublicKeyHex()` (Stage
 * 4) already fails closed for any counterparty that is not itself
 * `"nostr"` (Alpha 890's own pairwise/Direct-mode, ECDH-only scope).
 */

import type { FedosConversationId } from "../../fedos_conversation_id.js";
import type { FedosConversationMembershipId } from "../../membership/fedos_conversation_membership_id.js";
import type { FedosNostrAuthorBindingAuthority } from "../../../board/runtime/identity/fedos_nostr_author_binding_types.js";
import type { FedosConversationIdentityResolver } from "./fedos_conversation_identity_resolver.js";
import type { FedosConversationParticipantResolver } from "./fedos_conversation_participant_resolver.js";
import type { FedosConversationLocalAccountIndexAuthority } from "./fedos_conversation_local_account_index_authority.js";
import { resolveFedosConversationCounterpartyPublicKeyHex } from "./fedos_conversation_counterparty_public_key_resolver.js";

export type FedosConversationKeyResolution =
  | {
      readonly outcome: "resolved";
      readonly localAccountIndex: number;
      readonly counterpartyPublicKeyHex: string;
      /** The LOCAL participant's own Membership id — carried here so a caller (`FedosConversationEncryptionCoordinator`) never re-resolves Membership a second time just to learn the sender's id for an Envelope. Never a secret. */
      readonly senderMembershipId: FedosConversationMembershipId;
    }
  | { readonly outcome: "identity-unavailable" }
  | { readonly outcome: "not-member" }
  | { readonly outcome: "no-counterparty" }
  | { readonly outcome: "ambiguous-counterparty" }
  | { readonly outcome: "unsupported-counterparty-authority" }
  | { readonly outcome: "invalid-counterparty-public-key" }
  | { readonly outcome: "identity-binding-unavailable" }
  | { readonly outcome: "identity-binding-mismatch" };

export interface FedosConversationKeyResolverDependencies {
  readonly identityResolver: FedosConversationIdentityResolver;
  readonly participantResolver: FedosConversationParticipantResolver;
  readonly accountIndexAuthority: FedosConversationLocalAccountIndexAuthority;
  /**
   * Optional. When the resolved local participant's own `authority` is
   * `"nostr"` and NO binding authority is injected, resolution fails
   * closed to `"identity-binding-unavailable"` rather than skipping the
   * check silently — see this file's own header. Omit only for a
   * deployment that genuinely never uses a Nostr-bound local identity.
   */
  readonly nostrAuthorBindingAuthority?: FedosNostrAuthorBindingAuthority;
}

export class FedosConversationKeyResolver {
  readonly #deps: FedosConversationKeyResolverDependencies;

  constructor(deps: FedosConversationKeyResolverDependencies) {
    this.#deps = deps;
  }

  async resolve(conversationId: FedosConversationId): Promise<FedosConversationKeyResolution> {
    const identity = this.#deps.identityResolver.resolveLocalParticipant();
    if (identity.outcome === "unavailable") return { outcome: "identity-unavailable" };
    const localParticipant = identity.creator;

    const participants = this.#deps.participantResolver.resolveCounterparty(conversationId, localParticipant);
    if (participants.outcome !== "resolved") return { outcome: participants.outcome };

    const counterpartyKey = resolveFedosConversationCounterpartyPublicKeyHex(participants.counterparty.participant);
    if (counterpartyKey.outcome === "unsupported-authority") return { outcome: "unsupported-counterparty-authority" };
    if (counterpartyKey.outcome === "invalid-public-key") return { outcome: "invalid-counterparty-public-key" };

    const localAccountIndex = this.#deps.accountIndexAuthority.localAccountIndex();

    if (localParticipant.authority === "nostr") {
      if (this.#deps.nostrAuthorBindingAuthority === undefined) return { outcome: "identity-binding-unavailable" };
      const binding = await this.#deps.nostrAuthorBindingAuthority.verifyBinding({
        author: { identityId: localParticipant.identityId, protocol: "nostr", publicIdentifier: localParticipant.publicIdentifier },
        accountIndex: localAccountIndex,
      });
      if (binding.outcome !== "bound") return { outcome: "identity-binding-mismatch" };
    }

    return {
      outcome: "resolved",
      localAccountIndex,
      counterpartyPublicKeyHex: counterpartyKey.publicKeyHex,
      senderMembershipId: participants.local.id,
    };
  }
}
