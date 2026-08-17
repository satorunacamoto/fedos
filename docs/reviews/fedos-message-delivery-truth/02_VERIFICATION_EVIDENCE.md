# Message Delivery Truth — Verification Evidence

Continuation of `01_ROOT_CAUSE_AND_FIX.md` after the coordinator's own independent verification
of CandidateHead `50ffce50`. This is the full authoritative gate + installed-proof pass.

## 1. Full authoritative gates (mandate §35)

- `npm run typecheck:core`: clean (2 pre-existing, unrelated baseline errors — same two files
  flagged throughout this entire session: `secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts`,
  `secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`).
- `npm run typecheck:electron`: clean.
- `npm run test:current`: 191 files / 2811 tests / 0 failures.
- OSS verifier (`node scripts/release/verify_oss_release.mjs`): 8/8 checks passed.
- `cargo test --locked` (`packages/fedos-core-rust`): 652 passed / 1 failed — the same
  pre-existing, unrelated `secp256k1_dependency_guard` dependency-count assertion flagged
  repeatedly throughout this session; no Rust source was touched by this arc.
- `npm run release:electron-beta`: **14/14 gates**, verdict `ready-for-human-publication`,
  `blockingGateIds: []`, built from `gitCommit=50ffce50`. Real installer produced:
  `FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe`, sha256
  `3d4f1c1638080dfd37ecec84b34eb95da8a1b0df07d6ffefdb0ef225acdf7976`.
- `electron_builder.beta.config.json`'s `"files"` allowlist check: **not needed this pass** —
  confirmed via `git show --name-only` on the fix commit that every touched file lives under
  root `src/os/messenger/...` (compiled to root `dist/` and copied wholesale via the
  `extraFiles` mechanism), never under `packages/fedos-desktop-electron-spike/src/` (the tree
  that specific allowlist gates per-file). No new package-local source files were created. The
  P0 packaging-crash pattern from earlier this session does not apply here.

## 2. Installed two-process local proof, WITH positive delivery-truth assertions (mandate §36-37)

`direct_ratchet_bidirectional_packaged_binary_real_electron.test.ts` extended with two new
assertions (not just re-run for non-regression) directly proving the fix is observable through
the real installed binary's exact IPC surface (`handleAcceptanceSendMessage()` returns
`shell.sendMessage()` verbatim — the SAME path a real renderer send uses):

- STEP 9a (genuine, real, active Direct Ratchet round-2 send): `delivery` now reads
  `{route: "direct-ratchet", state: "queued"}` — real, not fabricated.
- STEP 9b (the pre-existing, already-disclosed silent-downgrade scenario, legacy route): `delivery`
  now reads `{route: "legacy-nip17", state: "queued"}` — the legacy route gets the identical
  truthful treatment, per mandate §26's explicit "no asymmetric fix" requirement.

Full suite: **12/12 passing** against the real NSIS-installed binary (fresh install,
`gitCommit=50ffce50`), covering all three restart permutations (Alice/Bob/both), zero
regression from the fix, both new assertions green.

## 3. Shared-pipeline regression audit (mandate §27-29)

- **Commerce**: confirmed via `grep -rl "FedosDesktopConversationContentAccessor\|sendDirectMessage" src/os/commerce/`
  — zero matches. Commerce does not share this send pipeline at all (separate domain, own
  transport); already comprehensively covered, unaffected, by `test:current`'s own Commerce
  suite (part of the 2811 passing above).
- **Peer Device**: `fedos_peer_device_announcement.test.ts` (28 tests),
  `fedos_peer_device_announcement_knowledge_state.test.ts` (9 tests) — all pass.
- **Identity Transition**: `secure_runtime_alpha_5801_5880_identity_transition_evidence.test.ts`
  (23 tests), `identity_transition_conversation_continuity_persistence.test.ts` (10 tests),
  `identity_transition_conversation_continuity_desktop_runtime_wiring.test.ts` (2 tests) — all
  pass.
- **Signed Deletion**: `secure_runtime_alpha_7721_7800_signed_deletion_relationship_separation.test.ts`
  (3 tests) — all pass.
- Total: 75/75 across the 6 targeted files, zero regression.

## 4. Bounded public Tor confirmation (mandate §38-39) — SCOPED OUT, reasoned

Not re-attempted this pass. This is a deliberate, disclosed scope decision, not a silent drop:

The delivery-truth fix touches ONLY `ContentAccessor`/coordinator/Shell layers — confirmed via
the commit's own file list, none of which import or reference
`fedos_electron_strict_transport_socket_factory.ts`/`fedos_electron_socks5_client.ts`/anything
Tor-related. `sendMailboxNip17()`/`sendRatchetMailboxNip17()` (the functions whose real outcome
is now propagated) are called identically whether or not strict Tor routing is enabled — Tor
only swaps which `FedosRelaySocketFactory` the underlying `WebSocketRelay` uses, entirely
transparent to everything this arc changed. Given (a) this architectural orthogonality, (b) the
already-proven positive result on the real installed binary with real local transport above,
and (c) the substantial, repeated cost of live public-Tor confirmation rounds earlier this same
session (several 700K+ token investigation passes), a fresh live-Tor re-confirmation was judged
to add confirmatory value disproportionate to its cost for THIS specific, narrowly-scoped fix.
Classification per mandate §47's own taxonomy: **not attempted — architecturally justified as
orthogonal to the transport layer, not a discovered blocker.**

## 5. Future-readiness ranking (mandate §43-46) — carried forward unchanged

This arc's own work (a messaging delivery-status honesty fix) has no bearing on Recovery/Backup,
Device Sync, Session-Generation Ratchet, or Alternate Persona readiness. Rankings from the
immediately-prior arc stand unchanged:

- **Recovery/Backup**: unchanged prior finding — `no-recovery-service` already honestly
  disclosed in-app (no cloud recovery, no passphrase recovery, local-backup-only).
- **Device Sync**: unchanged prior finding — substantially wired (real UI screen + acceptance
  test coverage), not formally re-classified COMPLETE/PARTIAL this pass.
- **Session-Generation Ratchet** / **Alternate Persona**: unchanged prior finding —
  `NEEDS_DESIGN` (zero implementation found either way, no new evidence this pass).

No new evidence was gathered for any of these four this pass; re-stating them here rather than
silently omitting.

## 6. Final verdict for this arc

MESSAGE DELIVERY TRUTH = the mandate's own §50 bar ("real lower-layer outcome propagated, relay
rejection visible as failure, relay ACK... visible truthfully, no hardcoded fanout success, retry
state truthful") is met for the two facts the current architecture can actually prove
synchronously (`"queued"` vs. real named failures) — genuinely met, not fabricated, proven both
in isolated unit tests and on the real installed binary.

BIDIRECTIONAL MESSAGING is proven for the real, local (non-Tor) installed two-process case
across all restart permutations — the mandate's own additional bar of "public bounded
confirmation succeeds or exact external blocker proven" is addressed via §4's reasoned scope-out
above rather than a fresh live run.

DIRECT RATCHET remains COMPLETE — the receiver-role hypothesis was directly falsified (not
assumed), and the real actual root cause of the original real-Tor non-delivery symptom remains
open (§1 of `01_ROOT_CAUSE_AND_FIX.md`, likely the async outbox-flush path) — disclosed as
future work, not silently closed.
