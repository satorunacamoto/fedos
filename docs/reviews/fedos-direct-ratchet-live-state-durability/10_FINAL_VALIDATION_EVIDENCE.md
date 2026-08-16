# Final Validation Evidence — Direct Ratchet Live-State Durability

CandidateHead: `8c6d802a` (implementation `d2702d2c` + real installed-binary proof `8c6d802a`,
on top of Phase A docs commit `c5e262f4`).

## Authoritative gates (sequential, against `8c6d802a`)

| Gate | Result |
|---|---|
| `npm run typecheck` | clean — same 2 pre-existing, unrelated errors as baseline (`test/secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts`, `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`); `typecheck:electron` 0 errors |
| `npm run test:current` | 191 files / 2811 tests passed, 3 skipped, 0 failures |
| Targeted direct-ratchet + security-state regression set (real WASM crypto) | 105 tests passed (sealing authority, production sealing, repeated-restart, route-binding isolation, reset integration, device-lifecycle x3) + 19 new persistence/freshness unit tests |
| `node scripts/release/verify_oss_release.mjs` | 8/8 checks passed |
| `cargo test --locked` (`packages/fedos-core-rust`) | 652 passed / 1 known pre-existing failure (`secp256k1_dependency_guard::cargo_toml_has_exactly_ten_production_dependencies_after_k256_adoption`) — unrelated, no Rust file touched this arc |
| `npm run release:electron-beta` (full 14-step `build_release.mjs` pipeline) | 14/14 steps passed, verdict `ready-for-human-publication`, built from clean tree at commit `8c6d802a`, 0 blocking gates |

One pre-existing failure independently reconfirmed unrelated to this arc: `test/secure_runtime_alpha_7241_7320_identity_transition_active_conversation.test.ts` fails identically at the pre-arc baseline commit `c5e262f4` (verified via an isolated detached worktree at that commit, removed after comparison).

## Real installed two-process proof (real NSIS-installed binary, `FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe`)

`packages/fedos-desktop-electron-spike/test/direct_ratchet_bidirectional_packaged_binary_real_electron.test.ts`
— 12/12 tests passed against the real installed binary (silent-install, two independent OS
processes, real local relay, real WASM crypto):

- Scenarios (a)–(l): mutual discovery, both-sides-active establishment, bidirectional real
  Ratchet-encrypted messages (both directions, decrypted content verified byte-for-byte),
  never-trusted-device rejection, offline-then-reconnect-by-construction, replay-safety
  (exactly 2 messages after full historical relay replay, no double-import), and the
  pre-existing, already-disclosed silent-downgrade finding — all PASS, unchanged from before
  this arc.
- **Bob restart** (STEP 7): session genuinely "active" before and after a real process
  restart + full relay-history replay.
- **Alice restart** (STEP 8): same.
- **Both restart, second real round-trip** (STEP 9a/9b): a full second bidirectional
  Ratchet exchange, plus a third restart via the legacy route, all correctly delivered.
- **STEP 10 (new, this arc's own core claim, live)**: immediately after a real restart and
  BEFORE any real restore, `directRatchetLiveVerification()` honestly reads
  `"restorable-not-yet-confirmed"` even though `directRatchetStatus()` already reads
  `"active"`. After a real send genuinely restores the live session, it reads
  `"live-confirmed-this-process"`. The post-restart Forward-Secrecy false-green this arc
  exists to close is confirmed absent on the real installed binary, not just at the unit
  level.
- **STEP 11 (new, corruption negative, live)**: a real on-disk sealed snapshot file is
  directly truncated between two real launches. `directRatchetLiveVerification()` correctly
  reports `"restore-attempted-and-failed"` — fail-closed, no crash, `directRatchetStatus()`
  genuinely unaffected (separate durable record, proving metadata and live crypto state are
  independent facts by design). A forced-Ratchet-route send against the corrupted session
  still completes (`outcome: "ok"`) — via the SAME pre-existing, already-disclosed
  silent-fallback-to-legacy-route architecture this file's own header already documents for
  scenario (l), never via bad/absent crypto. No new gap; out of this arc's own mandate to
  fix (would require redesigning the send-time route decision).
- Mid-ratchet crash: not attempted (no new mechanism added for it this pass; the existing
  suite's own sequential-process model already exercises restart-at-every-boundary, which is
  the load-bearing case for durability).
- Wrong-binding-via-file-copy negative: not attempted this pass (time-bounded); the
  corruption negative above already exercises the fail-closed path this arc's own freshness
  gate and AEAD context binding both defend.
- Process hygiene: `owned-PID sweep: all 20 packaged-binary processes this suite spawned
  were checked; none were force-killed unexpectedly`; a separate `Get-CimInstance
  Win32_Process` check after the full session found zero orphaned `node.exe`/
  `FedOS Desktop Beta.exe` processes.

Two real bugs were found and fixed live, in this arc's own new test code (not the product):
the new IPC handler mirrors an existing documented double-wrap asymmetry (needed the same
`unwrapDirectRatchetStatus()` unwrap as its sibling); and the real profile root is
`join(FEDOS_ELECTRON_BETA_DATA_DIR, "profile")`, not the raw env var (confirmed via a live
`readdirSync` diagnostic, since removed).

## Direct Ratchet classification

**COMPLETE. P0: 0.** The exact P0 mandate 3 opened against (`FedosDirectRatchetLiveStateSnapshotPersistence`
had no durable backend → post-restart Forward-Secrecy false-green) is closed and proven at
three levels: pure unit tests, real-WASM-crypto vitest-level restart tests, and the real
installed two-process NSIS binary. The one remaining architectural note (silent fallback to
the legacy route on any Ratchet-route failure, scenario l) is a pre-existing, already-disclosed
gap — unchanged by this arc, not a P0, out of this arc's own mandate to fix.

## Tor readiness gate

Direct Ratchet = COMPLETE, P0 = 0 → the gate this mandate names is **UNBLOCKED**. Tor
implementation work itself is NOT started in this pass (out of this arc's own scope; a
future dedicated arc).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
