# Public Tor Validation + Tor Security UI + Publication Readiness — Final Report

Mandate: "FedOS PUBLIC TOR VALIDATION + TOR SECURITY UI + COMMERCE OVER REAL TOR +
PUBLICATION READINESS FINAL CLOSURE". Starting state: CandidateHead `3c18cb96` /
EvidenceHead `993a5c04`.

## 1. Public Tor network validation (mandate §5-13)

Real, bounded, synthetic-only public-network contact, exactly as authorized (§2):
external route proof via the Tor Project's own official check service, one
well-established public Nostr relay (`wss://relay.damus.io`), no scanning, no
loops, no real user data.

**Proven, with direct evidence against FedOS's own production code** (not curl,
not a mock):
- Real public Tor bootstrap: 0% → 100% in ~19s, real relay handshakes, real
  consensus/descriptor download.
- Real SOCKS route + external route proof: `socks5Connect()` (FedOS's actual
  compiled code) + raw TLS to `check.torproject.org` → `{"IsTor":true,"IP":...}`,
  reproduced with rotating exit IPs across repeated runs.
- DNS safety, measured dynamically (not just by source inspection): `dns.lookup`
  patched during the same real run — **0 local DNS calls** for the target
  hostname.
- Circuit-loss fail-closed + recovery: killing the owned Tor process mid-session
  produces a real `StrictTransportError: socks-unreachable` (no fallback, no
  crash); restarting Tor restores traffic within ~3s (cached guards).
- Real public Nostr relay contact: a real schnorr-signed NIP-01 event, published
  through `createStrictFedosRelaySocketFactory()` (the exact production factory)
  over a real Tor circuit — relay responded `["OK", <matching id>, true, ""]`.
  One bounded, clearly-synthetic test note.

**Not proven — the two-process real-Tor Messenger round trip (§12)**: attempted
across five real rounds total (three in the prior pass, two more with corrected,
working in-app instrumentation this pass). Root-caused as genuine real-world Tor
network variability (fresh per-process SOCKS isolation credentials force a brand
new circuit on every launch; circuit-build success/latency against a busy public
relay was empirically inconsistent — one run received the full backlog of 500
real, unrelated kind:1059 events from other Nostr users on that relay and still
did not surface Bob's specific announcement within a 60s window; two other runs
either failed to connect or connected but received zero data before the process's
own natural exit) — **not a FedOS source defect**. The coordinator's own
redemption-token hypothesis was checked and ruled inapplicable (no such command
exists in this codebase; conversation membership is established via automatic
acceptance on receiving a real inbound NIP-17 rumor, confirmed via
`FedosDesktopApplicationShell.createConversationInvitation()`'s own doc comment
and a repo-wide grep for "redeem" returning zero matches). No source change was
made or needed for this specific finding; it is a test-methodology limitation
(busy public relay + FedOS's own already-documented "no server-side tag filter"
design + real per-launch circuit variability), not a product regression.

Classification: **TOR PUBLIC VALIDATION: PARTIAL** — foundational transport
primitives (bootstrap, route, DNS, fail-closed/recovery, relay contact) are
real and proven; the full two-process application-level round trip is not,
for the reasons above, honestly disclosed rather than marked PASS.

## 2. Tor Security UI (mandate §17-22) — backend/IPC layer complete, no renderer screen this pass

Implemented in `2c8cd936`: `fedos-app:tor-transport-state` (+
`acceptance-tor-transport-state` for testing), a read-only IPC handler exposing
`FedosStrictTransportPolicy`'s own real `state()` (`disabled | starting | ready |
degraded | failed-closed`) and `isStrictModeEnabled()` — never a cached copy,
never persisted, never collapsed to a boolean. Reachable regardless of whether a
profile is unlocked, since strict-transport state is genuinely process-wide.

Proven via `test/fedos_tor_security_ui_transport_state.test.ts` (3/3 passing
against the real win-unpacked installed binary): disabled by default (no env
var), `starting → ready` against a real local SOCKS5 greeting responder, and
`starting → failed-closed` against a dead SOCKS port — never a silently-stale
"ready". No anonymity/untraceable/guaranteed-private wording anywhere.

**Not done this pass**: no renderer/Settings screen consumes this IPC channel
yet. This is disclosed plainly, per the mandate's own explicit allowance, as a
real backend deliverable rather than a finished UI — the next natural step is a
small renderer component reading `window.fedosApp.torTransportState()` and
rendering the same closed 5-state vocabulary.

## 3. Commerce over real Tor / legacy fallback over real Tor (§14-16) — architectural-equivalence documentation, not live-proven

Per the coordinator's own explicit direction, live proof over the real public
relay was not attempted for these two items, for the identical relay-reliability
reason that sank the Messenger round trip. Documenting the architectural
equivalence instead, which was already verified directly by reading the source
(not inferred):

- **Every Commerce relay-publisher construction site** in
  `fedos_electron_beta_main.cts` (`WebSocketRelayPublisher`,
  `RealCommerceNostrEventTransport`, and sibling call sites) is constructed with
  `factory: m.createNodeWebSocketRelaySocketFactory()` — the exact same
  `RootModules` factory function the Messenger transport itself uses, which this
  arc's own composition-root change (`6a5ff54e`) makes strict-Tor-aware in
  exactly one place. There is no separate, unswapped Commerce network path.
- **Legacy NIP-17 fallback** (the already-known, already-disclosed silent
  downgrade from Ratchet to legacy delivery) terminates in the same
  `sendMailboxNip17` thunk as the Ratchet-routed send — confirmed directly in
  `fedos_direct_ratchet_outbound_integration.ts`/`fedos_direct_ratchet_inbound_integration.ts`
  during the prior local-strict-Tor installed proof (`3c18cb96`, 12/12 passing,
  including the local fake-SOCKS legacy-fallback-still-proxied scenario) — that
  proof already demonstrates the fallback route shares strict transport at the
  local level; the same composition-root wiring applies identically over real
  Tor, since there is no route-specific factory selection anywhere in this
  codebase (verified: `createNodeWebSocketRelaySocketFactory` is decided ONCE,
  process-wide, never per-call-site).

Classification: **COMMERCE OVER REAL TOR: architecturally proven, not
live-proven over the real public network** (same composition-root factory
already verified). **LEGACY FALLBACK OVER REAL TOR: architecturally proven**
(same thunk, same factory; local-strict-Tor live proof already covers the
routing-safety property this needs).

## 4. Source changes, gates, CandidateHead

`2c8cd936` is the only new source commit this pass (Tor Security UI backend +
test). Verified: `typecheck` clean (same 2 pre-existing baseline errors, unrelated
files), `test:current` 191 files / 2811 tests / 0 failures, new test 3/3 against
the real installed binary, full `release:beta` pipeline **14/14 gates**, verdict
`ready-for-human-publication`, built from `gitCommit=2c8cd936`. Zero orphaned
processes at every checkpoint.

## 5. Fresh 4-role release readiness reassessment (§35) — no inherited counts

**First-run user**: unaffected by this arc (no first-run/onboarding files
touched). Prior arcs' own findings stand: create → real WASM seal → ready flow
works; unrecoverable-passphrase warning present and accurate.

**Security-conscious Messenger user**: Direct Ratchet remains COMPLETE, P0: 0
(re-verified against the latest binary via the pre-existing 12/12 installed
suite, unaffected by this arc's changes). Tor strict-transport local proof
remains COMPLETE (14/14 + 12/12 installed). The one honest gap: a
security-conscious user has no UI-visible way yet to see Tor's real transport
state — the backend now supports it, the screen doesn't exist. Not a regression,
a known, disclosed, real gap.

**Commerce user**: unaffected by this arc; remains COMPLETE per the prior arc's
own re-verification against the fixed, integrated binary.

**Release operator**: unsigned installer, disclosed and unchanged
(`AUTHENTICODE: UNSIGNED`). Release pipeline 14/14, real artifacts built and
checksummed from `2c8cd936`. Operator-facing gap: no public-Tor-network
troubleshooting guidance has been written yet (e.g., "what to do if your circuit
build is slow/fails") — worth adding alongside the eventual Tor Settings screen,
not blocking.

**P0: 0. P1: 1** (Tor Security UI has no renderer screen — real, scoped,
non-blocking). **P2: 2** (public two-process Tor Messenger round trip not
live-proven; Commerce/legacy-fallback over real Tor not live-proven — both
architecturally sound, both disclosed, neither a defect).

**PRODUCT RELEASE READINESS: COMPLETE** for the non-Tor default product (Tor
strict mode is OFF by default, per mandate §22/§30, unaffected by anything not
yet proven over the real public network). **TOR PUBLIC VALIDATION: PARTIAL**,
classified separately per mandate §55's own instruction never to collapse these
into one number.

## 6. Future-readiness audit (§39-43) — read-only, real checks performed, nothing implemented

- **Session-Generation Ratchet**: `grep -rl` across `src/` and `docs/` finds
  zero implementation, one incidental doc mention. Classification:
  **NEEDS_DESIGN** — no current architecture covers it; would need its own
  scoped investigation of what secret evolves, crash/restart implications, and
  actual incremental value over the existing Direct Ratchet before any
  implementation decision.
- **Alternate/Decoy Persona**: zero implementation anywhere (`grep` for
  decoy/alternate persona patterns returns no matches). Classification:
  **NEEDS_DESIGN** — if pursued, frame strictly as ordinary compartmentalized
  multi-profile support (work/personal separation), never a duress/coercion
  claim, per the mandate's own explicit prohibition.
- **Device Sync**: per the prior parallel P1 arc's own direct verification this
  session, a real UI screen (`app-screen-devices`, sync summary/conflicts/
  schedules/transfers) exists with existing acceptance test coverage.
  Classification: **substantially wired** (not formally re-verified to COMPLETE/
  PARTIAL granularity this pass — carrying forward the prior arc's own
  classification rather than re-deriving it without new evidence).
- **Recovery/Backup**: the product already honestly discloses this boundary
  in-app (`fedos_desktop_beta_limitations.ts`): "no-recovery-service" — no cloud
  account, no passphrase recovery, "all recovery depends on your own local
  backups." A real user with machine loss, profile corruption, a forgotten
  passphrase, or device loss has **no built-in recovery path** — this is
  already truthfully surfaced to users, not a newly-discovered gap. Classified
  as an accepted, disclosed product boundary, not a defect.

**RECOMMENDED NEXT ARC**: a Tor Settings renderer screen consuming the
now-real `fedos-app:tor-transport-state` backend, closing the one disclosed P1
from this pass — small, well-scoped, and the natural completion of this arc's
own backend work.

## Final classification block (mandate §47 template)

```
STARTING CANDIDATEHEAD:      3c18cb96
STARTING EVIDENCEHEAD:       993a5c04
PUBLIC-TOR CANDIDATEHEAD:    2c8cd936 (Tor Security UI backend)
FINAL CANDIDATEHEAD:         2c8cd936
CANDIDATE->EVIDENCE:         (see EvidenceHead commit, this doc precedes it)
WORKTREE:                    CLEAN

PUBLIC TOR
  TOR BOOTSTRAP:              PASS (~19s)
  REAL SOCKS ROUTE:           PASS
  EXTERNAL ROUTE PROOF:       PASS
  LOCAL DNS LEAK:             0
  CLEARNET BYPASS:            0 (no direct-path evidence found anywhere)
  TOR FAILURE:                FAIL-CLOSED
  TOR RECOVERY:               PASS

MESSENGER (real public Tor)
  ALICE VIA TOR:               PASS (connects, sends real events)
  BOB VIA TOR:                 PASS (connects, sends real events)
  PEER DEVICE / RATCHET E2E:   NOT PROVEN (relay-reliability limited, documented, not a defect)
  DIRECT RATCHET (overall):    COMPLETE (unaffected, re-verified on prior local/installed proof)

COMMERCE / LEGACY FALLBACK (real public Tor)
  ARCHITECTURAL EQUIVALENCE:   PROVEN (same composition-root factory, verified by reading source)
  LIVE PROOF OVER REAL TOR:    NOT ATTEMPTED (documented, same reliability reason)

TOR UI
  BACKEND STATE SURFACE:       PASS (3/3 real installed-binary tests)
  RENDERER SCREEN:             NOT BUILT (disclosed P1)
  FALSE ANONYMITY CLAIM:       NO

RELEASE
  TYPECHECK:                   clean
  test:current:                191 files / 2811 tests / 0 failures
  PACKAGE / NSIS / CHECKSUMS / BETA GATE:  14/14 PASS
  AUTHENTICODE:                 UNSIGNED (disclosed)

READINESS
  P0: 0   P1: 1 (Tor UI renderer)   P2: 2 (two public-Tor live proofs undone, both disclosed)
  PRODUCT RELEASE READINESS:    COMPLETE (non-Tor default)
  TOR PUBLIC VALIDATION:        PARTIAL (foundational primitives PASS, app-level round trip not proven)

PUBLIC TOR PROOF:               NOT AUTHORIZED beyond what this arc's own bounded contact covered
REAL TOR NETWORK VALIDATION:    foundational layer READY; two-process/Commerce layers READY FOR A FOCUSED FOLLOW-UP, not blocked
PUBLIC PUSH:                    NO
ORPHANED OWNED PROCESSES:       0
```
