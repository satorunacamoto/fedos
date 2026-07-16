/**
 * Secure Runtime Alpha 686 ("Canonical Nostr Author Binding Type") —
 * Stage 6 of Phase A of the Alpha 681–720 Nostr Identity Binding &
 * Outbound Delivery Activation Arc.
 *
 * `FedosNostrAuthorBindingResult` is the closed vocabulary
 * `FedosNostrAuthorBindingAuthority.verifyBinding()`
 * (`./fedos_nostr_author_binding_authority.ts`, Alpha 688) ever returns —
 * mirroring `FedosPublicAuthorResolution`/`FedosOutboundEligibilityResult`'s
 * own "coarse, stable, closed-vocabulary result, never a raw `Error`"
 * shape. `"bound"` is the ONLY outcome that ever unlocks Nostr Outbound
 * Eligibility (`../eligibility/fedos_outbound_eligibility_evaluator.ts`,
 * Alpha 694).
 *
 *   - `"bound"` — the resolved author's own `publicIdentifier` was
 *     cryptographically confirmed to equal the Nostr Signing Authority's
 *     OWN derived public key for `accountIndex`.
 *   - `"author-not-nostr"` — `author.protocol !== "nostr"` (an
 *     anonymous-local, ActivityPub, AT Protocol, or Session author can
 *     never bind — Alpha 692's own required guard).
 *   - `"signing-authority-unavailable"` — no Signing Authority is
 *     configured, or its own Master Seed is not currently held/cleared.
 *   - `"public-key-mismatch"` — a Signing Authority IS available and DID
 *     derive a public key for `accountIndex`, but it does not equal
 *     `author.publicIdentifier` — the exact case that protects against
 *     an imported author sharing a similar-looking, but not actually
 *     locally-controlled, identifier.
 *   - `"invalid-author-identifier"` — `author.publicIdentifier` is not a
 *     well-formed 64-character lowercase hex Nostr public key (Alpha
 *     687's own "hex only" decision — an `npub`-form or otherwise
 *     malformed identifier can never be verified without guessing, so it
 *     fails closed here rather than being treated as a match).
 *
 * No `Error`, no provider/signer object, no raw key, and no arbitrary
 * metadata anywhere in this file.
 */

import type { FedosBoardAuthorReference } from "../../fedos_board_author.js";

export type FedosNostrAuthorBindingResult =
  | {
      readonly outcome: "bound";
      readonly accountIndex: number;
      readonly publicKeyHex: string;
    }
  | {
      readonly outcome: "author-not-nostr";
    }
  | {
      readonly outcome: "signing-authority-unavailable";
    }
  | {
      readonly outcome: "public-key-mismatch";
    }
  | {
      readonly outcome: "invalid-author-identifier";
    };

/**
 * Secure Runtime Alpha 688. Exactly one method — no `refresh()`, no
 * signer accessor, no Relay reference, no Outbox reference, no Board
 * reference. `FedosBoardRuntime` is this interface's sole reviewed
 * caller (Alpha 694/698).
 */
export interface FedosNostrAuthorBindingAuthority {
  verifyBinding(input: {
    readonly author: FedosBoardAuthorReference;
    readonly accountIndex: number;
  }): Promise<FedosNostrAuthorBindingResult>;
}
