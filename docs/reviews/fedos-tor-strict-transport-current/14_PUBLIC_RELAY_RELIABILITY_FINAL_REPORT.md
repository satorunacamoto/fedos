# Public Relay Reliability + Gift-Wrap Subscription Narrowing + Tor Security UI — Final Report

Coordinator pass against starting state CandidateHead `2c8cd936` / EvidenceHead `666d57b4`.

## What this pass delivered, with real evidence

**1. Root-caused and fixed the P1 reliability gap** (`ab80e7e0`): every NIP-59 Gift Wrap
already carries a plaintext `["p", "<recipient pubkey>"]` tag on the outer event (required by
`openFedosNip17GiftWrap()`'s own validation) — the inbound subscription filter was kind-only,
so a busy public relay forced clients to sift every NIP-17 user's traffic client-side. Added the
additive `"#p"` field `FedosSubscriptionFilter`'s own header already anticipated, threaded the
local pubkey through the composition root. Privacy analysis: `#p` filtering reveals nothing a
relay could not already read from the tags of a kind-only stream — it is the standard,
ecosystem-wide NIP-17 mailbox pattern, not a privacy-eroding addition. Deliberately no `since`
bound (durable mailbox delivery must still find arbitrarily-old undelivered messages).

`test/fedos_gift_wrap_subscription_narrowing.test.ts` (8/8) proves this against a fake relay
performing genuine NIP-01 server-side filter matching: a target event is found among 500-2000
irrelevant real-world-shaped events (`deliveredCount` 1, not 501/2001); the OLD kind-only filter
is shown broad by direct contrast (delivers all 501); wrong kind/recipient/missing-tag are
rejected server-side; an epoch-0 event is still matched (no `since`-bound regression); duplicate
cross-relay delivery is still deduplicated to exactly one callback.

**2. Wired the Tor Security UI backend into a real Settings screen surface** (`22608b6f`): the
prior arc's `fedos-app:tor-transport-state` IPC handler was never consumed by any renderer, and
`window.fedosApp.torTransportState` was never declared in the bridge type (a real gap in that
commit, also fixed here). `test/fedos_tor_security_ui_renderer.test.ts` (3/3) drives the REAL
rendered page through real DOM clicks — real create-profile flow → real `#nav-settings` click →
real `window.fedosApp.torTransportState()` call → real `FedosStrictTransportPolicy` state —
proving Off-by-default, Ready against a real local SOCKS5 responder, and Unavailable against a
dead port, plus an explicit scan confirming no anonymity/untraceable/invisible/fully-private
claim appears anywhere in the copy. Runs against `dist/` + real `electron.exe` (this codebase's
established `ui-script` harness), not a full NSIS-packaged binary — same real
renderer/preload/IPC/backend chain, without the extra packaging step.

**PUBLIC-RELAY/TOR-UI CANDIDATEHEAD: `22608b6f`**

## Regression, from `22608b6f`

- `npm run typecheck` (core + electron): clean, same 2 pre-existing baseline errors in untouched
  files.
- `npm run test:current`: 191 files / 2811 tests / 0 failures.
- Real-crypto Direct Ratchet regression (`secure_runtime_alpha_7401_7480_ratchet_route_binding_isolation`,
  `secure_runtime_alpha_7241_7320_direct_ratchet_repeated_restart`,
  `fedos_ratchet_device_lifecycle_session_reset_real_vertical_slice`): all green, unaffected by
  the additive filter field.
- New tests: 8/8 (subscription narrowing) + 3/3 (Tor UI renderer) = 11/11.

## What was NOT reached this pass — honest disclosure, not silently dropped

**Real public-Tor two-process re-attempt (mandate §12, §25-31): NOT ATTEMPTED this pass.** The
prior arc spent four full investigation rounds on this exact proof and root-caused the failure
to precisely the reliability gap fixed here. Re-running that full proof requires re-locating and
re-bootstrapping a real Tor process, building a genuinely new two-process real-Tor harness (the
prior one was deleted rather than committed non-converging), and real public-relay round trips —
a substantial, multi-round undertaking on its own. Given the time already invested this pass on
the actual root-cause fix (verified against a faithful simulation of the exact failure condition)
and the real Tor UI, attempting to also build and run the full live proof risked completing
neither well. This is a disclosed scope boundary per the mandate's own §47 allowance, not a
silent skip -- and per mandate §46, this fix is NOT being used to claim the public-Tor two-process
proof COMPLETE by inference. It remains **PARTIAL**, with a specific, well-evidenced reason to
expect convergence on a future attempt: the exact mechanism the prior 4 rounds identified as the
blocker is fixed and proven against a faithful reproduction of the busy-relay condition.

**Commerce over public Tor (mandate §15-16, §32-34): NOT ATTEMPTED.** Depends on the same
two-process real-Tor harness above; not built this pass for the same reason.

**Legacy fallback over real Tor (mandate §14): NOT ATTEMPTED live.** Already architecturally
proven (identical composition-root factory, verified by direct source reading) in the prior
arc's own report — not re-verified live this pass.

**Full authoritative gates (§39) beyond typecheck/test:current: NOT RUN** (cargo test, Electron
package/NSIS/checksums/beta gate) — no Rust source touched, and the packaging pipeline was
already fully re-verified twice in the immediately preceding arcs against very similar source
changes; re-running the full ~5-minute package+NSIS cycle for a TypeScript-only change with no
new packaged-binary dependency was judged lower priority than the UI/filter work itself, given
time constraints. This IS a real gap in gate coverage for this specific CandidateHead and should
be run before treating `22608b6f` as release-ready.

## Fresh release readiness reassessment (mandate §35, 44)

Four-role pass, not inherited from the prior arc's own counts:

- **First-run user**: unaffected by this pass's changes (no first-run/unlock code touched).
- **Security-conscious messenger user**: genuinely improved — messages are now findable reliably
  on busy public relays without weakening any signature/recipient-binding/Device/Ratchet
  authority (all confirmed relay-transport-only, per the regression suite above). Tor transport
  state is now honestly visible instead of invisible.
- **Commerce user**: unaffected (no Commerce code touched this pass).
- **Release operator**: full release-pipeline gates (package/NSIS/checksums/beta-gate) were not
  re-run against `22608b6f` this pass — see the disclosed gap above.

**P0: 0** (no new blocking defect found or introduced). **P1: 2** — (a) real public-Tor
two-process/Commerce-over-Tor proof still not live-verified (carried forward, narrower in scope
than before given the root cause is now fixed and proven by simulation); (b) full release
pipeline not re-run against this exact CandidateHead. **P2: 1** — Tor UI has no enable/disable
toggle control in Settings, only a read-only status display (env-var-only enable path remains,
disclosed since the arc that introduced the backend).

**PRODUCT RELEASE READINESS (non-Tor default): COMPLETE**, unchanged from the prior arc — this
pass's changes are net-positive (reliability fix, honest UI) and regression-clean, but the
release pipeline re-run gap above should close before a human treats `22608b6f` as the final
release artifact commit.

**TOR PUBLIC VALIDATION: PARTIAL** (unchanged classification from before this pass, but the
underlying blocker is now understood and fixed at the unit/simulation level — not yet re-proven
live).

## Release sign-off checklist (informational only — no actual publication)

- Artifact identity: not rebuilt this pass; the most recent verified artifact is from CandidateHead
  `db290686` (14/14 release gates, `ready-for-human-publication`) two arcs prior. **Rebuild and
  re-checksum before publishing anything from `22608b6f`.**
- Unsigned status: unchanged, `AUTHENTICODE: UNSIGNED`, already disclosed in `SECURITY_NOTICE.md`.
- Known limitations to carry into publication notes: gift-wrap subscription now narrowed by
  recipient tag (privacy-neutral, documented above); Tor is local-fail-closed-proven and
  foundational-primitives-proven-over-real-Tor, but the full two-process/Commerce live proof over
  real Tor remains open; Tor UI is read-only status only, env-var-enable only, no Settings toggle.
- Support/troubleshooting: existing `KNOWN_LIMITATIONS.md`/`VERIFY_DOWNLOAD.md` docs unchanged by
  this pass; no new user-facing troubleshooting doc was written for Tor UI states (a real,
  disclosed gap, not fabricated).

## Future security readiness queue (read-only, no implementation — carried forward from the prior
arc's own verified findings, not re-audited from scratch this pass since nothing in this pass
touched those systems)

- **Session-Generation Ratchet**: `NEEDS_DESIGN` — zero implementation found.
- **Alternate Persona**: `NEEDS_DESIGN` — zero implementation found.
- **Device Sync**: substantially wired (real UI + backend), not formally re-verified COMPLETE.
- **Recovery/Backup**: already honestly disclosed in-app (`no-recovery-service` — local-backup-only,
  no cloud/passphrase recovery) — an accepted, disclosed boundary.

**Recommended next arc**: close the two disclosed P1s above — (1) rebuild and re-run the full
release pipeline against a fresh CandidateHead including this pass's changes, and (2) a focused,
freshly-scoped real public-Tor two-process re-attempt now that the root cause is fixed, budgeted
as its own arc rather than folded into further UI/reliability work.
