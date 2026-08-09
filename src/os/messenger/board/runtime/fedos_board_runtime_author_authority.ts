/**
 * Secure Runtime Alpha 627 ("Author Authority Decision") — Stage 7 of
 * the Alpha 621–640 Public Board Runtime Application API Foundation Arc.
 *
 * The prior review's own B1 finding
 * (`docs/reviews/board_runtime_conversation_foundation_09_architectural_blockers.md`):
 * `DesktopApplication`'s default `FedosPublicIdentityReader` always
 * resolves to `NullNostrPublicIdentitySource`, so
 * `DesktopApplication.currentPublicIdentity()` returns `null` by
 * default in this repository TODAY — no real identity source is wired
 * as the default. This file resolves the resulting Alpha 627 choice
 * between:
 *   A. Identity required — fail closed to a command rejection whenever
 *      `currentPublicIdentity()` is `null`.
 *   B. Anonymous local author reference — an explicit, honest fallback
 *      author kind for exactly this (today's default) situation.
 *   C. Caller-supplied public identifier — FORBIDDEN by this Arc's own
 *      instruction (lets a caller impersonate any identity).
 *   D. Thread-local pseudonym as author — FORBIDDEN by this Arc's own
 *      instruction (conflates a DISPLAY name with the CRYPTOGRAPHIC
 *      author — the prior review's own §07 finding names this
 *      conflation explicitly as something to never do).
 *
 * DECISION: **B, with A preferred whenever real identity resolves.**
 * `resolvePublicAuthorReference()` below tries a real, validated
 * identity FIRST (via `DesktopApplication.currentPublicIdentity()`)
 * and falls back to the explicit anonymous-local author reference ONLY
 * when no real identity resolves — meaning today, by default, it
 * ALWAYS falls back (B1's own finding), and the moment a future Arc
 * wires a real default identity source, this SAME function starts
 * resolving real authors with zero change to its own logic — this is
 * the concrete reason Alpha 640 recommends "Conversation Identity &
 * Public Author Authority Arc" as next: THIS function is exactly what
 * that Arc would give a real answer to resolve, more of the time, once
 * it lands.
 *
 * `resolvePublicAuthorReference()` NEVER returns `null` and never
 * throws — public post creation in this Arc is never blocked on
 * identity, per the "B, not A-only" decision above.
 */

import type { DesktopApplication } from "../../../../desktop/desktop_application.js";
import type { FedosBoardAuthorReference } from "../fedos_board_author.js";
import { isFedosBoardSourceProtocol } from "../fedos_board_source.js";

/**
 * The single, well-known, non-secret `publicIdentifier` every
 * anonymous-local-authored public post shares, when no real identity
 * resolves. Deliberately a FIXED sentinel, not a per-`FedosBoardRuntime`-
 * instance or per-post randomly generated value — a random-but-stable
 * per-instance id would LOOK like a persistent identity across posts
 * without actually being backed by any real authentication, which is
 * exactly the kind of misleading pseudo-identity this Arc's own
 * instruction warns against ("display pseudonymとcryptographic author
 * を混同しない"). This sentinel makes the degenerate, provisional
 * nature of anonymous-local authorship impossible to mistake for a
 * real, distinguishable identity.
 */
export const FEDOS_BOARD_RUNTIME_ANONYMOUS_LOCAL_AUTHOR_PUBLIC_IDENTIFIER = "local-anonymous";

/**
 * A `FedosBoardAuthorReference` for a post whose author could not be
 * resolved to any real identity. `protocol: "fedos"` reuses the
 * EXISTING `FedosBoardSourceProtocol` value already documented
 * (`../fedos_board_source.ts`) as "reserved for content authored
 * directly through FedOS" — no new protocol vocabulary, no
 * `FedosBoardAuthorReference` field added, satisfying this Arc's own
 * "既存FedosBoardAuthorReferenceの契約を壊さない" requirement.
 */
export function anonymousLocalAuthorReference(): FedosBoardAuthorReference {
  return Object.freeze({
    identityId: null,
    protocol: "fedos",
    publicIdentifier: FEDOS_BOARD_RUNTIME_ANONYMOUS_LOCAL_AUTHOR_PUBLIC_IDENTIFIER,
  });
}

/**
 * Resolves the author reference a new locally-created public post
 * should carry. Prefers `desktopApplication.currentPublicIdentity()`'s
 * real, resolved identity when present and structurally valid (its own
 * `provider` must be a recognized `FedosBoardSourceProtocol` — fails
 * closed to the anonymous-local fallback rather than guessing at an
 * unrecognized provider label); falls back to
 * `anonymousLocalAuthorReference()` otherwise. Synchronous — reads only
 * `DesktopApplication`'s own already-cached identity snapshot
 * (`currentPublicIdentity()`), never triggers a fresh async
 * `readPublicIdentity()` re-read per post.
 */
export function resolvePublicAuthorReference(desktopApplication: DesktopApplication): FedosBoardAuthorReference {
  const identity = desktopApplication.currentPublicIdentity();
  if (identity === null) {
    return anonymousLocalAuthorReference();
  }
  if (!isFedosBoardSourceProtocol(identity.provider)) {
    return anonymousLocalAuthorReference();
  }
  if (identity.publicIdentifier.trim().length === 0) {
    return anonymousLocalAuthorReference();
  }
  return Object.freeze({
    identityId: identity.id,
    protocol: identity.provider,
    publicIdentifier: identity.publicIdentifier,
  });
}
