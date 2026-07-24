# Secure Runtime Alpha 6521–6600 — Completion Declaration

**FedOS Desktop Beta Production Runtime Configuration Unification Arc.**

## Status: full completion of this Arc's own deliberately bounded scope

- Reconciliation report — done (Phase A). No merge required (`76f7fab`
  already contains every named lineage); the canonical production
  entry-point inventory found the PRIMARY FINDING's exact root cause at
  the TYPE level (`FedosDesktopRuntimeConfig` had no field at all for
  three of the four subsystems), plus a second, prerequisite gap
  (`FedosProfileInitializationCoordinator` had zero private-transport
  wiring), both closed.
- Canonical configuration type — done (Phase B/C). Four new, closed,
  additive `*Enabled` toggles, each individually validated before any
  Persistence backend or Host is constructed; no loose dictionary, no
  fabricated default anywhere.
- Profile bootstrap threading — done (Phase D). One profile lifecycle
  owner, one production Master Seed authority, one Desktop Runtime
  generation, unchanged; the four new subsystems are now reachable through
  the SAME single `FedosProfileInitializationCoordinator` call a real
  caller already makes.
- One Conversation Runtime generation — done (Phase E). Direct Ratchet,
  Peer Capability, Identity Transition, and Signed Deletion Request are
  all optional integrations into the SAME `FedosConversationRuntime`
  instance — never a second Conversation Runtime.
- Device configuration — done (Phase F). One Device Registry, hoisted and
  shared — a real construction-order bug (a second, divergent Device
  Registry) was found and fixed during this Arc's OWN implementation,
  before any test ran.
- Identity Transition / Signed Deletion configuration — done (Phase G/H).
  Both now share the same Device Registry, signing authority, and
  transport route; the search-index single-instance requirement (a second
  real, pre-existing finding) is closed via one small, additive,
  backward-compatible constructor field.
- Safety Center — done (Phase I), with ZERO code change needed: it already
  reads through Shell accessors this Arc makes genuinely real.
- Real end-to-end vertical slice — done (Phase N), through the ACTUAL
  production bootstrap chain, not a test-only helper — the key
  differentiator from every prior Arc's own vertical slice this session.
- Failure matrix (7 tests) and structural guards (8 tests) — done (Phase
  O/P).

## Real bugs found and fixed this Arc

1. **Second Device Registry construction-order bug** (found during
   implementation, before any test ran): the pre-existing
   `deviceTrustEnabled` block constructed its own local
   `deviceRegistryPersistence`; this Arc's new subsystems needed one
   constructed EARLIER. Naively hoisting a new construction would have
   created a second, divergent instance over the same log path. Fixed by
   hoisting the construction itself, removing the old block's own
   redeclaration.
2. **Search-index divergence risk** (found during Phase A reconciliation,
   before any code was written): Signed Deletion Request's own
   `reconcilePayloadRetention()` needed the SAME search index instance
   `FedosDesktopConversationContentAccessor.search()` queries, but the
   only construction path (`conversationRuntime.createSearchIndex()`) is a
   FACTORY, not a singleton accessor — a second call would have produced a
   genuinely different index, silently un-reconciled with the one real
   searches actually use. Closed via a forward-reference proxy plus one
   additive, optional constructor field.

Three test-fixture-only mistakes were also found and fixed during this
Arc's own vertical-slice authoring (a placeholder Relay object not
implementing the real `FedosRelay` interface; a fixed historical clock
constant against the real wall-clock-based Runtime; in-memory profile
persistence that cannot survive a simulated relaunch) — none touching
`src/`.

## Disclosed boundaries (all deliberate scope decisions, stated in the reconciliation report before any code was written)

1. **Settings→Relay plumbing** — `conversationTransportRelays` remains a
   real, externally-supplied fact (this Arc invents no default Relay
   endpoint). The canonical Desktop Beta assembly's own pre-existing,
   already-disclosed gap (no Settings.relays → Runtime plumbing) is
   restated, not newly closed — recommended as this Arc's own next step.
2. **Full 10-step Runtime generation/rebuild model** — this Arc's own real
   vertical slice proves a genuine lock→relaunch→unlock cycle (the actual
   mechanism this codebase has today), not the full in-place-restart
   model Phase K describes in its most complete form (no in-place restart
   mechanism exists in this codebase to prove).
3. **Electron/Host Bridge deep integration** — unchanged this Arc; the
   existing generic `window.fedos.invoke()` transport already dispatches
   any Host Command validated by `validateFedosDesktopHostCommand()` —
   this Arc adds no NEW Host Command, so no Electron-side change was
   needed or made.
4. **`fromRunningRuntime()`'s own narrow scope finding** — `shell.status()`
   does not track an externally-stopped underlying Runtime, and several
   Shell accessor methods (`#identityTransitionRuntime()` and siblings)
   throw rather than gracefully degrading when reached through a
   Shell tied to an already-stopped Runtime generation — the SAME class of
   finding the prior Release Freeze Arc's own verification report noted
   for `archive()`. Documented in the runtime-generation truth document,
   not silently worked around; real production callers never hit this
   (they construct a fresh Shell after every relaunch, exactly as this
   Arc's own vertical slice does).
5. **Direct Ratchet remains WASM-gated** — `directRatchetEnabled: true`
   proves the honest CALL CONTRACT (never a fabricated Master Seed
   Authority); genuine live sessions still need the compiled WASM
   artifact, confirmed absent again, universal precedent.

## Verification

`npm run typecheck` — clean for every file this Arc touched (2
pre-existing, unrelated baseline errors tolerated). 3 new test files, 16
new tests, all passing. Targeted regression sweep across this Arc's own
files plus the pre-existing Desktop Shell/onboarding/Beta-assembly suites
and every prior Identity Transition/Safety Center/Release Freeze Arc's own
suite: **163 passing, 0 failures** — confirming this Arc's own additive
changes preserve every existing caller's byte-for-byte behavior when the
four new `*Enabled` flags are omitted.

## Recommended next Arc

**FedOS Desktop Beta Release Candidate and Packaged Security Acceptance
Arc**, per this Arc's own mission. A natural first step within that Arc:
thread `Settings.relays`/`defaultRelay` through the canonical Desktop Beta
assembly into `FedosProfileInitializationCoordinator`'s own new
`conversationTransportRelays`, so the four subsystems this Arc made
configurable become reachable from real, persisted user settings, not
only from a caller who already has Relay URLs in hand — but the Arc-level
recommendation itself is the Release Candidate/Packaged Security
Acceptance Arc named above.
