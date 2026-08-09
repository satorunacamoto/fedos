/**
 * Secure Runtime Alpha 644 ("Resolved Identity Mapping Policy") / Alpha
 * 647 ("Desktop Identity Adapter") — Stages 4/7 of the Alpha 641–680
 * Public Identity, Conversation Policy & Application Runtime
 * Integration Arc.
 *
 * `FedosDesktopPublicAuthorAuthority` is the production
 * `FedosPublicAuthorAuthority` — a thin adapter over the SAME
 * `FedosDesktopHost` a `FedosBoardRuntime` already holds, reusing
 * Host's own existing "return the owned instance only when ready, else
 * `null`" contract (`host.desktop()`) as its sole readiness check —
 * exactly the pattern `FedosBoardRuntime` itself already uses for
 * `board()`/`query()` (Alpha 632). This class never receives
 * `DesktopApplication` directly and never exposes one — only
 * `FedosDesktopHost`'s own already-public `desktop()` accessor.
 *
 * Mapping policy (Alpha 644), applied to
 * `DesktopApplication.currentPublicIdentity()`'s own resolved
 * `FedosIdentityDescriptor`:
 *   - `publicIdentifier` is preserved VERBATIM — never transformed,
 *     never re-encoded (no hex-to-npub conversion of any kind; nothing
 *     in this Arc's own scope requires one).
 *   - `identityId` is preserved as `descriptor.id` ONLY when the
 *     Descriptor's own `provider` is a recognized
 *     `FedosBoardSourceProtocol` AND `publicIdentifier` is non-empty —
 *     i.e. `identityId === descriptor.id` is treated as valid and
 *     stable EXACTLY when the whole Descriptor is accepted as
 *     `"resolved"`. There is no case in this codebase today where `id`
 *     would need to be `null`ed out while the rest of the Descriptor is
 *     accepted — `FedosIdentityDescriptor.id` (Alpha 028) is already a
 *     bare, caller-supplied opaque id with no format constraint
 *     narrower than "non-empty," so no separate validity check on `id`
 *     itself is needed beyond the Descriptor being accepted at all.
 *   - `displayName`/`avatar` are NEVER read here, let alone mapped —
 *     `FedosBoardAuthorReference` (Alpha 254) deliberately excludes
 *     both; see that file's own header for why a display-only field
 *     baked into an immutable post would go stale.
 *   - NO signature is created, NO Relay is called, NO protocol adapter
 *     is invoked, and NO Identity Runtime mutation of any kind occurs —
 *     this class only ever calls `host.desktop()` and, on success,
 *     `.currentPublicIdentity()` — both pure, synchronous, already-
 *     cached reads (Alpha 128).
 *
 * `resolvePublicAuthor()` never calls `refreshPublicIdentity()` — per
 * Alpha 647's own instruction, a fresh async re-read on every single
 * post command is NOT adopted by this Arc; whatever
 * `DesktopApplication`'s own `#currentPublicIdentity` cache already
 * holds (populated once at `start()`, Alpha 136) is what this class
 * reads, exactly matching Alpha 627's own prior, superseded behavior in
 * this one respect.
 */

import type { FedosDesktopHost } from "../../../../../desktop/host/fedos_desktop_host.js";
import { isFedosBoardSourceProtocol } from "../../fedos_board_source.js";
import type { FedosPublicAuthorAuthority, FedosPublicAuthorResolution } from "./fedos_public_author_authority.js";
import {
  anonymousLocalAuthorReference,
} from "../fedos_board_runtime_author_authority.js";

export class FedosDesktopPublicAuthorAuthority implements FedosPublicAuthorAuthority {
  readonly #host: FedosDesktopHost;

  constructor(host: FedosDesktopHost) {
    this.#host = host;
  }

  async resolvePublicAuthor(): Promise<FedosPublicAuthorResolution> {
    const desktopApplication = this.#host.desktop();
    if (desktopApplication === null) {
      return { outcome: "unavailable" };
    }

    const identity = desktopApplication.currentPublicIdentity();
    if (identity === null) {
      return { outcome: "anonymous-local", author: anonymousLocalAuthorReference() };
    }

    if (!isFedosBoardSourceProtocol(identity.provider) || identity.publicIdentifier.trim().length === 0) {
      return { outcome: "conflict" };
    }

    return {
      outcome: "resolved",
      author: Object.freeze({
        identityId: identity.id,
        protocol: identity.provider,
        publicIdentifier: identity.publicIdentifier,
      }),
    };
  }
}
