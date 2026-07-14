# Secure Runtime Alpha 386 — Host Query Delegation Review

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** Stage 6 of the Alpha 381–390 Canonical Board Query Host
Integration & Startup Failure Closure Arc.

## 1. Candidates compared

- **Option A — no delegation; callers use `host.query()`.**
- **Option B — add all Query methods to Host** (e.g.
  `host.recentBoardPosts(...)`, `host.threadPosts(...)`, each a thin
  wrapper calling `this.query()!.recentFeed(...)`/`.thread(...)`).
  Rejected: this creates TWO public read APIs
  (`FedosDesktopHost`'s own delegated methods AND `FedosBoardQuery`'s
  own original methods) that must be kept in sync forever — any
  future Query method addition (e.g. a hypothetical fifth filter
  dimension) would require a matching Host-level change too, a
  real, ongoing maintenance ripple this Stage's own review declines to
  accept ahead of any actual caller demonstrating the need.
- **Option C — add only one common read operation** (e.g. just
  `host.recentBoardPosts(...)`, omitting `thread()`). Rejected: an
  arbitrary asymmetry — why one Query method gets a Host-level
  shortcut and the other does not — with no principled selection rule
  this Stage can name, and the SAME ripple-maintenance cost as Option
  B for whichever one method is chosen.

## 2. Decision

**Option A**, exactly as this Arc's own instruction states.

## 3. Why duplication creates ripple, concretely

If `FedosDesktopHost` gained `recentBoardPosts(boardId, filter?, page?)`
as a thin wrapper, EVERY future change to `FedosBoardQuery.recentFeed()`'s
own parameter shape (a hypothetical future Alpha Arc extending the
filter model, for instance) would need a MATCHING, hand-synchronized
change to the Host-level wrapper — a maintenance obligation that
exists ONLY because the wrapper exists, with zero corresponding
benefit today, since `host.query()!.recentFeed(...)` already reaches
the identical capability in one extra method call.

## 4. No current caller requires it

Confirmed by direct inspection (Alpha 381 §8, re-confirmed by this
Arc's own new test suite, Alpha 387/388/389): every test this Arc adds
calls `host.query()!.recentFeed(...)`/`.thread(...)` directly, with no
friction, no repeated boilerplate across call sites that a
convenience method would meaningfully shorten. "No convenience
methods unless an actual current caller requires them" — this Arc's
own instruction — is satisfied by inspection, not merely assumed.

## 5. A future façade may still delegate selected operations

This Stage does NOT foreclose a FUTURE, separately-reviewed
Application/GUI façade layer (explicitly out of scope for this
repository today — no GUI exists anywhere, Alpha 331 §3.1 unchanged)
choosing to delegate SELECTED `FedosBoardQuery` operations for ITS OWN
callers' convenience. That decision belongs to whichever future Arc
actually builds such a façade, informed by real caller needs at that
time — `FedosDesktopHost` itself, as the Ownership boundary, stays
minimal regardless.

## 6. Conclusion

No delegation method is added to `FedosDesktopHost` — `host.query()`
is the sole, sufficient path to every `FedosBoardQuery` capability,
avoiding a real, ongoing maintenance ripple with no current caller
demonstrating a need for the alternative.

## 7. See also

- `docs/secure_runtime_alpha_385_board_service_access_review.md`
- `docs/secure_runtime_alpha_384_host_query_access_boundary.md`
- `docs/secure_runtime_alpha_381_host_query_integration_inventory.md`
