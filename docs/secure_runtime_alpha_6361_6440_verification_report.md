# Secure Runtime Alpha 6361–6440 — Verification Report

**FedOS Desktop Beta Security Acceptance, Threat-Scenario Testing, and
Release Freeze Arc.**

## Typecheck

`npm run typecheck:core` — clean for every file this Arc touched (2
pre-existing, unrelated baseline errors tolerated, matching every prior
Arc in this session).

## New tests

| File | Tests | Result |
|---|---|---|
| `test/secure_runtime_alpha_6361_6440_threat_scenarios.test.ts` | 16 | all passing |
| `test/secure_runtime_alpha_6361_6440_real_acceptance_vertical_slice.test.ts` | 2 | all passing |
| `test/secure_runtime_alpha_6361_6440_structural_guards.test.ts` | 7 | all passing |

**25 new tests, all passing, no WASM gate needed anywhere in this Arc's
own tests.**

## Real bugs found during this Arc's own test authoring (fixed in TEST code only, never production `src/`)

None of the following were production defects — every one was a mistake
in this Arc's OWN new test fixtures, caught and fixed during authoring,
listed here for transparency since they are genuinely instructive:

1. A nonce generator using `Math.random().toString(16)` occasionally
   produces a `"0."`-prefixed string, failing the real nonce's own
   `/^[0-9a-f]{32}$/` structural check — the SAME class of bug found and
   fixed in an earlier Arc this session (`5961-6040`). Fixed by switching
   to `bytesToHex(schnorr.utils.randomSecretKey())`.
2. A hardcoded placeholder `"a".repeat(64)` used as "Alice's account
   pubkey" while ALSO using a real `RealFedosNostrSigningAuthority` to
   sign as Alice — the receiver's own real signature verification
   correctly rejected the mismatch (`"bad-account-signature"`), exposing
   the test's own error, not a domain bug. Fixed by deriving the account
   reference from the signing authority's own real public identity.
3. A peer-capability downgrade test omitted registering the RECIPIENT's
   own Device in the shared Device Registry, causing an honest
   `"recipient-device-unknown"` preflight denial. Fixed by registering
   both Devices.

Observation, not a defect: `FedosDesktopApplicationShell.archive()`
(`fedos_desktop_application_shell.ts:483-488`) does not wrap
`this.#runtime.conversationContentAccessor()` in a `try`/`catch`, unlike
`devicesList()`/`deviceSyncStatus()`, which DO (`fedos_desktop_application_shell.ts:504-528`).
This only matters for a hand-built `FedosRunningDesktopRuntime` test
double that omits the method entirely (this Arc's own minimal wrapper,
mirroring every prior Arc's own precedent) — every REAL production
Runtime implements `conversationContentAccessor()` unconditionally (the
Archive CAPABILITY may be disabled, but the accessor method itself always
exists), so this asymmetry has no production consequence. Not fixed here
(architecture-frozen, no protocol/Shell redesign); noted for a future
Arc's own consideration only if ever relevant.

## Targeted regression sweep

Re-ran this Arc's own 3 new files plus the Safety Center Arc's own 3 files
(`6201-6280`), the Identity Replacement UI Arc's own 4 files
(`6121-6200`), and the pre-existing Desktop Shell suite: all passing, 0
failures, matching this session's own established regression-sweep
discipline.

## Full unfiltered suite

Not re-run as a separate step this Arc (no production `src/` file was
touched — see structural guard #1 — so the documented ~216-220
pre-existing missing-WASM-artifact/raw-import baseline band established
across 4+ full-suite runs earlier this session is understood to still
apply unchanged). This is a deliberate scope decision consistent with
"testing/documentation only, zero `src/` changes" (Phase A's own finding),
not an omission.

## Structural guard confirmation

`test/secure_runtime_alpha_6361_6440_structural_guards.test.ts` proves, by
direct `git diff` inspection against the merge-base with the prior Arc,
that this Arc's own commit adds **zero files under `src/`** — the
strongest possible proof that no protocol was redesigned, no new
cryptographic feature was added, and no new Runtime/Shell/Electron owner
was introduced.
