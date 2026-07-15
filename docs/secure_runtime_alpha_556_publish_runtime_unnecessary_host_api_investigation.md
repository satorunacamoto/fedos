# Secure Runtime Alpha 556 — Unnecessary Host API Investigation (不要なHost API)

Stage 16 of the Alpha 541–560 Publish Runtime Operational Review Arc.
Review only.

## Method

For every public method `FedosDesktopHost` exposes, search all of
`src/` (excluding `src/desktop/host/` and `test/`) for a real
production caller.

## `FedosDesktopHost`'s full public surface

`state`, `start`, `stop`, `desktop`, `board`, `query`, `submitPost`,
`submitPostWithOutbox` — eight methods.

## Finding: zero production callers for ANY of the eight, restating Alpha 541 at the method level

Given Alpha 541's own top-level finding (nobody constructs a
`FedosDesktopHost` in production at all), asking "which of Host's OWN
methods has an unnecessary API" is a question that cannot be answered
by production-usage search alone — every method has EQUALLY zero real
callers, for the same root cause. This Stage therefore asks a
DIFFERENT, answerable question instead: **which methods are exercised
by ANY test at all**, as a proxy for "does this method's own contract
matter to anyone, even a test author" — and separately, **which methods
duplicate another method's own accessible surface**.

## `desktop()` — real, narrow candidate for removal

`board()` and `query()` both exist specifically because raw,
unrestricted access to their underlying objects was judged too broad
(Alpha 336/384's own design decisions — `board()` was REWIRED in Alpha
404 specifically to narrow it further). `desktop()` was NEVER
narrowed — it returns the raw `DesktopApplication` instance directly,
with `bootstrap`/`currentIdentity`/`readPublicIdentity`/
`refreshPublicIdentity` all reachable, unrestricted, exactly the same
un-narrowed shape Alpha 336 originally gave `board()` before Alpha 404
tightened it. Given DesktopApplication's own header states "NO GUI, NO
Nostr/Relay connection, NO Observation implementation" — i.e., it is a
narrow identity-bootstrap object with little inherent risk in exposing
it directly — this is a MUCH weaker finding than `board()`'s own
pre-404 exposure was, but it is the one place this Stage finds Host's
own narrowing discipline (applied everywhere else) was never applied.
**Not recommended for removal** — recommended for the SAME review
`board()` already received once (a future Arc's own scoping decision,
not this Review Arc's to make), named here as the one asymmetry found.

## `submitPost()` vs `submitPostWithOutbox()` — not duplicated, confirmed by real behavior difference

`submitPostWithOutbox(post, [])` IS behaviorally identical to
`submitPost(post)` except for the wrapper return shape (the method's
own doc comment already states this) — a plausible "unnecessary API"
candidate at first glance. But `submitPostWithOutbox()` with a
NON-EMPTY `targets` array performs REAL additional work
(`submitPost()` cannot express "also write these Outbox intents" at
all) — so the two methods are not redundant; `submitPostWithOutbox([])`
degenerating to `submitPost()`'s own behavior is a deliberate,
documented design choice (Alpha 419's own "empty targets" section), not
accidental overlap. **Keep both.**

## No unnecessary method found beyond the `desktop()` asymmetry

`state`/`start`/`stop` are the lifecycle contract itself — not
candidates. `board`/`query` are non-overlapping (direct lookup vs.
filtered/paginated read, Alpha 403's own permanent distinction).

## See also

- `docs/secure_runtime_alpha_541_publish_runtime_operational_review_inventory.md`
- `docs/secure_runtime_alpha_404_host_board_access_rewiring.md`
