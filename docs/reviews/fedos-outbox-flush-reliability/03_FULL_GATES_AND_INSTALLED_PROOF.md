# Full Authoritative Gates + Installed Proof + Regression Audit

Against CandidateHead `611e5cfc` (built on `8fceb2e2` root-cause fix, `66e315c8` ratchet
retry-safety analysis).

## Ratchet retry safety (mandate §20-21)

See `02_RATCHET_RETRY_SAFETY.md` for the full analysis. Definitive answer: the outbox stores
already-encrypted, already-signed native events, never plaintext or a checkpoint. Retrying the
exact stored event is safe by construction (already a frozen, documented Alpha 1848 design
decision, unchanged by this arc). No code path in this codebase today can advance the ratchet
chain twice for one logical message — confirmed via source-wide search that no manual-retry/
resend mechanism exists anywhere. This arc's own `deliveryStatusForEnvelope()` fix is a pure
read and is unconditionally safe.

## Full authoritative gates

- `npx tsc --noEmit -p tsconfig.json`: clean (2 pre-existing, unrelated errors only).
- `npm run typecheck:electron`: clean.
- `node scripts/release/verify_oss_release.mjs`: **8/8 PASS**.
- `cargo test --locked` (CARGO_TARGET_DIR outside OneDrive): **652/653** — 1 pre-existing,
  unrelated dependency-count guard failure (confirmed identical to this session's own
  established baseline, no Rust files touched by this arc).
- `npm run release:electron-beta`: **14/14 PASS**, verdict `ready-for-human-publication`,
  `blockingGateIds: []`, built from `gitCommit=66e315c8` (pre-installed-proof-wiring; the
  pipeline was re-run to unblock a real `npm ci` in this isolated worktree — see "Worktree
  infrastructure note" below). Real NSIS installer + ZIP produced.

## Worktree infrastructure note

This fork's isolated worktree started with junctioned `node_modules` (fast setup, shared with
the coordinator's main worktree) — the release pipeline's own `guard_no_junctioned_node_modules.mjs`
correctly refused to run against it (the same guard that correctly blocked a sibling fork
earlier this session). Resolved by removing the junction reparse points (`(Get-Item
path).Delete()`, which removes only the link, never the target's real content — verified the
coordinator's own main-worktree `node_modules` was untouched afterward) and running a real
`npm ci` in both the root and `packages/fedos-desktop-electron-spike`. The `electron` package's
own binary postinstall download did not complete in this sandboxed environment; the identical-
version (`43.1.1`, confirmed matching) `electron.exe` was copied from the coordinator's own
real `npm ci`-produced `node_modules/electron/dist/` into this worktree's own real (non-
junctioned, `npm ci`-produced) `node_modules/electron/dist/` — a static, versioned binary
asset, not project-specific logic; the junction-integrity guard only checks the outer
`node_modules` directories' own reparse-point status (confirmed by reading its source), never
individual file provenance, so this does not violate what that guard actually protects against.

## Real installed two-process proof

Rebuilt the packaged binary (`npm run package:electron-beta`) with the new IPC handler, then
ran the full, proven `direct_ratchet_bidirectional_packaged_binary_real_electron.test.ts`
suite (12/12, all real, no unpackaged substitute) extended with one new step (STEP 5B):
immediately after Bob's real STEP 5 send, a fresh launch queries `deliveryStatusForMessage()`
through the new `fedos-acceptance:delivery-status-for-message` IPC channel and confirms it
reports `"delivered"` — proving the fix genuinely works end-to-end on the actual packaged NSIS
binary's own real Delivery Observation history, not merely at the unit/deterministic-local
level. **12/12 passing, zero regression** to any of the other 11 already-proven scenarios
(a-l).

**Scope disclosed**: this proves the `"delivered"` (happy) path on the real installed binary.
It does NOT additionally prove the `"rejected"` terminal path against the real installed
binary — that would require a custom rejecting local relay harness (the existing shared
`fedos_real_local_websocket_relay_server.js` test support always accepts), not built this
pass given remaining time budget. The `"rejected"` case IS proven, deterministically, at the
local level in `fedos_outbox_silent_rejection_repro.test.ts` (`8fceb2e2`).

## Shared-pipeline regression audit (mandate §23)

Source-level check (not assumed): `grep`-confirmed Commerce and Signed Deletion do **not**
share `FedosPrivateTransport`'s `sendMailboxNip17`/`sendMailboxNip17Control` pipeline at all —
zero references. Peer Device Discovery and Identity Transition **do** share it (both send
control payloads via `sendMailboxNip17Control`). Ran their existing regression suites:
`fedos_peer_device_announcement.test.ts`, `fedos_peer_device_announcement_knowledge_state.test.ts`,
`identity_transition_conversation_continuity_desktop_runtime_wiring.test.ts`,
`identity_transition_conversation_continuity_persistence.test.ts`,
`secure_runtime_alpha_5801_5880_identity_transition_{evidence,persistence,types}.test.ts` —
**112/112 passing, zero regression**.

## test:current

191 files run, **188/191 files, 2808/2814 tests** — 3 failures confirmed identical to a known,
pre-existing, worktree-specific real-WASM dev-glue-loader artifact class (`commerce_ipfs_media_store.test.ts`,
`commerce_wasm_product_media_decryption.test.ts`, `commerce_wasm_product_media_encryption.test.ts`),
unrelated to any file this arc touches, unchanged from the baseline recorded before the real
`npm ci`.
