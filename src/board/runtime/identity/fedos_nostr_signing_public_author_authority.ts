/**
 * Secure Runtime Alpha 690 ("Public Author Authority Assembly") / Alpha
 * 691 ("Resolved Nostr Author Authority") — Stages 10–11 of Phase A of
 * the Alpha 681–720 Nostr Identity Binding & Outbound Delivery
 * Activation Arc.
 *
 * Alpha 690 compares three ways to make a runtime's canonical public
 * author and its Nostr signing authority provably consistent, rather
 * than "two independent sources, hope they match":
 *   A. derive public author directly from Signing Authority — ADOPTED.
 *   B. retain Desktop reader but verify binding on each outbound request
 *      — ALSO in effect, unconditionally, via
 *      `FedosNostrAuthorBindingAuthority` (`./fedos_nostr_author_binding_authority.ts`),
 *      which `FedosBoardRuntime` consults for every Nostr-protocol
 *      resolved author, regardless of which `FedosPublicAuthorAuthority`
 *      produced it (Alpha 694/698) — so a caller using
 *      `FedosDesktopPublicAuthorAuthority` with a real Nostr identity
 *      source still gets the SAME real binding proof this class gets
 *      "for free," by construction.
 *   C. configure both from a shared account authority — subsumed by A.
 *
 * `FedosNostrSigningPublicAuthorAuthority` is this Arc's own OPTIONAL,
 * additive `FedosPublicAuthorAuthority` implementation — NOT wired as
 * any global default (Alpha 691's own "do not replace imported identity
 * readers globally" requirement); `FedosDesktopPublicAuthorAuthority`
 * remains `FedosBoardRuntime`'s own unchanged default. A caller
 * assembling a Local Runtime around one controlled Nostr signing
 * identity may inject this class instead, so `resolvePublicAuthor()`'s
 * own `publicIdentifier` is trivially the account's real, derived Nostr
 * public key — always eligible to bind (Alpha 694), never dependent on
 * a SEPARATE identity source happening to agree.
 *
 * `identityId` is always `null` — this authority has no local
 * `FedosIdentityRecord` to link (Alpha 690's own "identityId policy
 * explicit" requirement: `null` is the explicit, honest answer, not an
 * omission). `displayName`/`avatar` are never populated — matching
 * `FedosBoardAuthorReference`'s own permanent exclusion of both.
 */

import type { FedosBoardAuthorReference } from "../../fedos_board_author.js";
import type { FedosNostrSigningAuthority } from "../../../nostr/sign/fedos_nostr_signing_authority.js";
import type { FedosPublicAuthorAuthority, FedosPublicAuthorResolution } from "./fedos_public_author_authority.js";

export class FedosNostrSigningPublicAuthorAuthority implements FedosPublicAuthorAuthority {
  readonly #signingAuthority: FedosNostrSigningAuthority;
  readonly #accountIndex: number;

  constructor(signingAuthority: FedosNostrSigningAuthority, accountIndex: number) {
    this.#signingAuthority = signingAuthority;
    this.#accountIndex = accountIndex;
  }

  async resolvePublicAuthor(): Promise<FedosPublicAuthorResolution> {
    const identity = await this.#signingAuthority.publicIdentityForAccount(this.#accountIndex);
    if (identity === null) {
      return { outcome: "unavailable" };
    }

    const author: FedosBoardAuthorReference = Object.freeze({
      identityId: null,
      protocol: "nostr",
      publicIdentifier: identity.publicKeyHex,
    });
    return { outcome: "resolved", author };
  }
}
