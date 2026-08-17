# Real Installed Two-Process Tor Strict-Transport Final Proof — Evidence

Against `TOR-INSTALLED-PROOF CandidateHead 3c18cb96` (starting state: CandidateHead `db290686`,
EvidenceHead `b96ae28a`).

## Installed binary identity

- Installer: `FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe`, SHA-256 `2309b86fa9462430917dc84eb3e6eba72418eb4d39e75d02058a784017fa887a`
- Running exe SHA-256 (win-unpacked, used for the actual test launches): recorded per-run in
  `docs/reviews/fedos-tor-strict-transport-current/evidence/installed_two_process_strict_transport_evidence.md`
- Running process executable path verified against the launched exe path on every launch
  (`queryWin32ProcessAlive`/PID tracking in the new test's own harness).

## New test: `fedos_tor_installed_two_process_strict_transport.test.ts` — 12/12, reproduced twice

Two consecutive full runs, identical results both times: 12/12 passing, 28 real SOCKS
connections observed, 0 clearnet-trap connections.

| # | Scenario | Result |
|---|---|---|
| 1 | Installed binary identity (installer/exe SHA-256) | PASS |
| 2 | Bob + Alice real Persona creation, strict mode ON | PASS — proxy observed, trap 0 |
| 3 | Bob creates conversation + announces device | PASS — proxy observed, trap 0 |
| 4 | Alice discovers Bob, rejects never-trusted device, establishes Ratchet | PASS — proxy observed, trap 0 |
| 5 | Bob reaches Ratchet "active", sends first real Ratchet message | PASS — proxy observed, trap 0 |
| 6 | Alice decrypts+replies; legacy NIP-17 fallback ALSO proxied | PASS — proxy observed, trap 0 |
| 7 | Bob restart — status survives, fresh probe, still proxied | PASS — proxy observed, trap 0 |
| 8 | DNS proof — literal unresolved `.invalid` hostname reaches SOCKS | PASS |
| 9 | Proxy absent — fails closed, trap 0 | PASS |
| 10 | Malformed SOCKS reply — fails closed, trap 0 | PASS |
| 11 | Proxy dies mid-session — one success, then fails closed, trap 0 | PASS |
| 12 | Final consolidated summary (SOCKS > 0, trap == 0 across whole suite) | PASS |

Zero source defects found this pass — the Tor Strict-Transport implementation (as fixed by the
prior P0 packaging commit `db290686`) worked correctly against the real installed binary on the
first attempt, with no bisection or fix needed.

## Full regression gates, from `3c18cb96`

- `npm run typecheck` — clean (same 2 pre-existing baseline errors, unrelated files).
- `npm run test:current` — 191 files / 2811 tests, 0 failures.
- Targeted Tor local-loopback suite (`fedos_electron_strict_transport_local_socks.test.ts` +
  `fedos_tor_strict_transport_ratchet_legacy_shared_route.test.ts`) — 14/14.
- OSS release verifier (`scripts/release/verify_oss_release.mjs`) — 8/8.
- `cargo test --locked` (`packages/fedos-core-rust`) — 652/653, the 1 failure is the same
  pre-existing, unrelated `secp256k1_dependency_guard` dependency-count check.
- `npm run release:electron-beta` — 14/14 gates, verdict `ready-for-human-publication`,
  `blockingGateIds: []`. Artifacts: `FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe` (111,636,436
  bytes, sha256 `2309b86fa9462430917dc84eb3e6eba72418eb4d39e75d02058a784017fa887a`), matching
  `.zip`, manifest, `SHA256SUMS.txt`.

## Process hygiene

Verified clean (`Get-CimInstance Win32_Process` filtered on `electron|FedOS`) before and after
every heavy run this pass; zero orphaned owned processes at close. Several transient `node.exe`
processes observed mid-session were confirmed to be unrelated tooling noise (already exited by
the time of the next query), not orphans from this suite's own spawned Electron processes.

## Scope disclosures (honest, not gaps hidden as pass)

- **Commerce**: not separately live-proven through this specific harness. Architecturally
  covered — Phase A's own `01_CURRENT_NETWORK_SURFACE.md` already confirmed Commerce reuses the
  identical composition-root `createNodeWebSocketRelaySocketFactory()` binding this suite
  exercises for Messenger, with no Commerce-specific network exit or bypass path. Given this
  session's own repeated evidence that Commerce's heavy real-installed E2E tests are prone to
  timeout/crash under accumulated resource load, and that no lightweight Commerce-only
  acceptance command exists to slip into an existing launch cheaply, a live Commerce proof was
  not attempted this pass.
- **Security UI truthfulness**: not testable. No IPC/UI surface currently exposes the strict
  transport policy's live state at all (`strictTransportPolicy` is used only at module-load and
  at the single composition-root factory-selection point — confirmed by direct source read).
  This mirrors the Tor arc's own disclosed scope cut (a Settings-UI toggle was deferred, and so,
  it turns out, was any state-observability channel). There is no false-anonymity-claim risk
  (nothing is shown at all), but the positive truthfulness bar (showing real Off/Starting/Ready/
  Failed states) remains unimplemented — a real, disclosed gap for a future pass, not something
  this proof can honestly claim PASS on.
- Alice-restart and both-restart are not independently re-run in this new suite (only Bob-restart
  is, as a representative case) — the underlying Direct Ratchet restart-survival property across
  all three permutations is already exhaustively proven by the pre-existing
  `direct_ratchet_bidirectional_packaged_binary_real_electron.test.ts` (12/12); this suite's own
  unique contribution is the strict-transport aspect, which the one representative restart
  demonstrates holds.

## Final classification

- TOR STRICT ARCHITECTURE: COMPLETE
- TOR LOCAL IMPLEMENTATION: COMPLETE
- TOR LOCAL FAIL-CLOSED PROOF: PASS (14/14)
- TOR INSTALLED LOCAL PROOF: **PASS** (12/12, real NSIS binary, two independent processes, zero
  clearnet bypass, DNS-safe, all four failure modes fail closed) — with the two disclosures
  above (Commerce architectural-only, Security UI not yet observable) honestly carried forward
  rather than silently waived.
- TOR STRICT-TRANSPORT LOCAL: COMPLETE
- DIRECT RATCHET: still COMPLETE, P0: 0
- PUBLIC TOR NETWORK CONTACT: NO
- PUBLIC TOR PROOF: NOT AUTHORIZED
- REAL TOR NETWORK VALIDATION: READY FOR AUTHORIZATION (next arc's own decision, not executed
  here)

## Head discipline

- TOR-INSTALLED-PROOF CandidateHead: `3c18cb96`
- This commit is the FINAL EvidenceHead.
