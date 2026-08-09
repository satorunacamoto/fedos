/**
 * Secure Runtime Alpha 643 ("Public Author Resolution Result") / Alpha
 * 646 ("Public Author Authority Interface") — Stages 3/6 of the Alpha
 * 641–680 Public Identity, Conversation Policy & Application Runtime
 * Integration Arc.
 *
 * `FedosPublicAuthorAuthority` is the SOLE seam `FedosBoardRuntime`
 * consults to learn "what author reference may a new local public post
 * carry" (Alpha 642's own adopted Option B — a dedicated Authority
 * injected into `FedosBoardRuntime`, replacing Alpha 627's own direct
 * `resolvePublicAuthorReference(desktopApplication)` call, which let a
 * command caller's own `FedosBoardRuntime` reach into
 * `DesktopApplication` with no seam a future authority (a real Nostr
 * identity binding, a private-mode identity, a test double) could
 * intercept without also owning the whole class).
 *
 * `FedosPublicAuthorResolution` is a CLOSED vocabulary, never a raw key,
 * `Error`, provider object, or Reader instance (Alpha 643's own explicit
 * exclusion list):
 *   - `"resolved"` — a real, structurally valid identity was found
 *     (`DesktopApplication.currentPublicIdentity()` returned a
 *     Descriptor whose `provider`/`publicIdentifier` are well-formed).
 *   - `"anonymous-local"` — no identity is configured at all
 *     (`currentPublicIdentity()` returned `null`) — today's default,
 *     every time, per the confirmed Alpha 627/641 finding that
 *     `createDesktopApplication()`'s own default Source
 *     (`resolveNostrPublicIdentitySource()`) always resolves through
 *     `NullNostrPublicIdentitySource`.
 *   - `"conflict"` — an identity WAS returned but is structurally
 *     malformed for Board authorship (an unrecognized `provider`, or an
 *     empty `publicIdentifier`) — DISTINCT from `"anonymous-local"`
 *     (nothing configured) so a caller/log can tell "nothing is there"
 *     apart from "something is there but broken," a distinction Alpha
 *     627's own single anonymous-local fallback collapsed into one
 *     silent case.
 *   - `"unavailable"` — the Authority itself cannot be consulted right
 *     now (e.g. the `FedosDesktopHost` it wraps is not `"ready"`) —
 *     DISTINCT from both of the above: this is not a statement about
 *     identity at all, only about whether the question could be asked.
 *
 * `resolvePublicAuthor()` NEVER throws. It performs NO Relay call, NO
 * protocol adapter call, NO signing, and NO mutation of Identity
 * Runtime — see `fedos_desktop_public_author_authority.ts` for the one
 * production implementation's own, narrower guarantees.
 */

import type { FedosBoardAuthorReference } from "../../fedos_board_author.js";

export type FedosPublicAuthorResolution =
  | {
      readonly outcome: "resolved";
      readonly author: FedosBoardAuthorReference;
    }
  | {
      readonly outcome: "anonymous-local";
      readonly author: FedosBoardAuthorReference;
    }
  | {
      readonly outcome: "unavailable";
    }
  | {
      readonly outcome: "conflict";
    };

/**
 * Alpha 646. Exactly one method — no `refresh()`, no `currentAuthor()`
 * synchronous accessor, no Reader/Provider/Registry surface of any
 * kind. A conforming implementation MAY read a cached value internally
 * (see `FedosDesktopPublicAuthorAuthority`'s own header for why it
 * never forces a fresh async re-read per post) — this interface itself
 * promises nothing about caching either way.
 */
export interface FedosPublicAuthorAuthority {
  resolvePublicAuthor(): Promise<FedosPublicAuthorResolution>;
}

/** `true` only for the two outcomes that carry a real `author` reference. */
export function isResolvedPublicAuthorResolution(
  resolution: FedosPublicAuthorResolution,
): resolution is Extract<FedosPublicAuthorResolution, { author: FedosBoardAuthorReference }> {
  return resolution.outcome === "resolved" || resolution.outcome === "anonymous-local";
}
