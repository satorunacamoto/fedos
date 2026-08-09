/**
 * Secure Runtime Alpha 688 ("Binding Authority Interface") — Stage 8 of
 * Phase A of the Alpha 681–720 Nostr Identity Binding & Outbound
 * Delivery Activation Arc.
 *
 * `FedosSigningAuthorityNostrAuthorBinding` is the ONE production
 * `FedosNostrAuthorBindingAuthority` — the "narrow Nostr Author Binding
 * Authority" Alpha 682's own adopted architecture names: it holds
 * exactly one injected `FedosNostrSigningAuthority`, calls ONLY its
 * `publicIdentityForAccount()` (never `signEvent()` — this class never
 * signs), and performs an exact string comparison between the derived
 * `publicKeyHex` and the resolved author's own `publicIdentifier`.
 *
 * Alpha 687's own "hex only" normalization decision: `author.publicIdentifier`
 * must ALREADY be a well-formed 64-character lowercase hex Nostr public
 * key for a binding to ever succeed — an `npub`-form (or any other)
 * identifier fails closed to `"invalid-author-identifier"` rather than
 * being decoded (no Bech32 decoder exists anywhere in this repository,
 * and this Arc adds none — Alpha 687's own explicit "no new Bech32
 * dependency" guard). This is a real, narrowing V1 limitation, not a
 * silent one — see `docs/secure_runtime_alpha_687_public_identifier_normalization_decision.md`.
 *
 * Responsibilities, exactly: validate `author.protocol === "nostr"`,
 * validate `author.publicIdentifier`'s own hex shape, call
 * `signingAuthority.publicIdentityForAccount(accountIndex)`, compare.
 * Non-responsibilities: signing, publishing, policy, Outbox, Relay,
 * retry, observation (Alpha 688's own explicit exclusion list).
 */

import type { FedosBoardAuthorReference } from "../../fedos_board_author.js";
import type { FedosNostrSigningAuthority } from "../../../../../nostr/sign/fedos_nostr_signing_authority.js";
import type {
  FedosNostrAuthorBindingAuthority,
  FedosNostrAuthorBindingResult,
} from "./fedos_nostr_author_binding_types.js";

const NOSTR_PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

export class FedosSigningAuthorityNostrAuthorBinding implements FedosNostrAuthorBindingAuthority {
  readonly #signingAuthority: FedosNostrSigningAuthority;

  constructor(signingAuthority: FedosNostrSigningAuthority) {
    this.#signingAuthority = signingAuthority;
  }

  async verifyBinding(input: {
    readonly author: FedosBoardAuthorReference;
    readonly accountIndex: number;
  }): Promise<FedosNostrAuthorBindingResult> {
    if (input.author.protocol !== "nostr") {
      return { outcome: "author-not-nostr" };
    }
    if (!NOSTR_PUBLIC_KEY_HEX_PATTERN.test(input.author.publicIdentifier)) {
      return { outcome: "invalid-author-identifier" };
    }

    const identity = await this.#signingAuthority.publicIdentityForAccount(input.accountIndex);
    if (identity === null) {
      return { outcome: "signing-authority-unavailable" };
    }
    if (identity.publicKeyHex !== input.author.publicIdentifier) {
      return { outcome: "public-key-mismatch" };
    }

    return {
      outcome: "bound",
      accountIndex: input.accountIndex,
      publicKeyHex: identity.publicKeyHex,
    };
  }
}
