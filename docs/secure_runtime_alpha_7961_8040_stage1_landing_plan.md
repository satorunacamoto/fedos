# Secure Runtime Alpha 7961–8040 — Stage 1: Staged Landing Plan

Derived from the ACTUAL 113-commit history between `master` (`3eb9eadd`)
and `81b5f0d1` (`git log --oneline master..81b5f0d1`) — not guessed Alpha
boundaries. Since this history is already fully linear and conflict-free
(Stage 0's own `git merge-tree` proof), every checkpoint below is a pure
`git merge --ff-only <target>` — never a real three-way merge, never a
rebase, never a squash. Checkpoints are chosen at natural completion
points in the real commit list, matching (not forcing) the requested
8-theme shape.

| # | Theme | Target commit | Primary capability closed at this point |
|---|---|---|---|
| 1 | Pre-Secure-Runtime prerequisites | `767eb54e` (Alpha 2041-2120) | Conversation/Group Archive/Identity Restoration foundation — the last commit before Desktop Shell work begins. |
| 2 | Desktop Runtime / Device Trust foundation | `568ddb88` (Alpha 4581-4660) | Desktop Local Shell, Device Trust/Registry, Electron main/preload adapter, Device Sync foundation, UI renderer. |
| 3 | Beta 0.1 initial packaging | `9ab4eac1` (Alpha 5321-5400) | First-run/Unlock, Settings, canonical Beta composition, NSIS/ZIP/checksum pipeline v1, manual publication readiness. |
| 4 | Ratchet / NIP-17 / Device lifecycle | `d825aa0c` (Alpha 5721-5800) | Direct Double Ratchet core+runtime, NIP-17 Rumor/Seal/Gift-Wrap, Session Reset, Peer Capability advertisement. |
| 5 | Identity Transition / Signed Deletion | `9cdd74ec` (Alpha 6121-6200) | Identity Transition types/validation/evidence/peer notification, Signed Deletion Request foundation/private-transport/multi-Device UI. |
| 6 | Secure Memory / Safety Center / Security Acceptance | `ed5128f6` (Alpha 6441-6520) | Safety Center, Secure Memory Secret Buffer/Zeroization foundation, Security Acceptance threat-scenario testing and Release Freeze. |
| 7 | Invitation / messaging reachability / route isolation / Archive parity | `4c6fa3b3` (Alpha 7401-7480) | Secure Memory production wiring, Settings-to-Relay production wiring, Direct Ratchet production crypto graph, Conversation Invitation, production crypto/identity wiring (FULL COMPLETION), long-running reliability, packaged feature reachability, same-peer route binding. |
| 8 | Scalability / multi-Device suppression / final hardening | `81b5f0d1` (Alpha 7881-7960, this Arc's own base) | Outbox restart hydration, Archive retention parity, Observation subject index, Archive Multi-Device Suppression, Direct Conversation Archive product, Observation write-time index, Suppression production wiring, prior release-readiness pass. |

## Per-checkpoint execution contract

For every checkpoint, in order:

1. `git merge --ff-only <target>` on `integration/fedos-secure-runtime-master-landing-rc`.
2. `git diff --stat <previous-checkpoint>..<target>` inspected (scale sanity check only — no conflict possible under `--ff-only`).
3. Run the checkpoint's own assigned focused tests (below).
4. Confirm `git status` clean.
5. Record PASS/FAIL in the checkpoint execution report.
6. **Rollback boundary**: `git reset --hard <previous-checkpoint-target>` (checkpoint 1's own rollback boundary is `master` itself, i.e. `3eb9eadd`) — never touches `master`, only this integration branch.
7. Generated artifacts to clean before the NEXT checkpoint: `packages/fedos-core-rust/pkg/`, `packages/fedos-core-rust/target/`, any `packages/fedos-desktop-electron-spike/release/` or `dist/` output.
8. **Stop immediately** on any NEW security-correctness failure (not already named in Stage 0's own known-baseline list) — do not continue to the next checkpoint.

## Assigned focused tests per checkpoint

| # | Focused test selection |
|---|---|
| 1 | Conversation construction/encryption/activation/Group Archive recovery test files (`test/secure_runtime_alpha_1181_1260*`, `test/secure_runtime_alpha_1841_1920*`, `test/secure_runtime_alpha_1921_1980*`, `test/secure_runtime_alpha_2041_2120*`). |
| 2 | Desktop Shell/Device Trust/Electron adapter tests (`test/secure_runtime_alpha_2841_2920*`, `test/secure_runtime_alpha_2921_3000*`, `test/secure_runtime_alpha_3161_3240*`, `test/secure_runtime_alpha_3641_3720*`, `test/secure_runtime_alpha_4101_4180*`, `test/secure_runtime_alpha_4581_4660*`). |
| 3 | Onboarding/Unlock/Settings/packaging tests (`test/secure_runtime_alpha_4661_4740*`, `test/secure_runtime_alpha_4741_4820*`, `test/secure_runtime_alpha_5061_5160*`, `test/secure_runtime_alpha_5161_5240*`, `test/secure_runtime_alpha_5241_5320*`, `test/secure_runtime_alpha_5321_5400*`). |
| 4 | Ratchet/NIP-17/Session Reset/Peer Capability tests (`test/fedos_ratchet_device_lifecycle_session_reset_real_vertical_slice.test.ts`, `test/secure_runtime_alpha_5481_5560*`, `test/secure_runtime_alpha_5561_5640*`, `test/secure_runtime_alpha_5721_5800*`). |
| 5 | Identity Transition/Signed Deletion tests (`test/secure_runtime_alpha_5801_5880*`, `test/secure_runtime_alpha_5881_5960*`, `test/secure_runtime_alpha_5961_6040*`, `test/secure_runtime_alpha_6041_6120*`, `test/secure_runtime_alpha_6121_6200*`). |
| 6 | Safety Center/Secure Memory/Security Acceptance tests (`test/secure_runtime_alpha_6201_6280*`, `test/secure_runtime_alpha_6281_6360*`, `test/secure_runtime_alpha_6361_6440*`, `test/secure_runtime_alpha_6441_6520*`, `cargo test` for `secret_handle`/`secret_handle_store`). |
| 7 | Production wiring/Invitation/reliability/reachability/route-binding tests (`test/secure_runtime_alpha_6521_6600*`, `test/secure_runtime_alpha_6681_6760*`, `test/secure_runtime_alpha_6761_6840*`, `test/secure_runtime_alpha_6841_6920*`, `test/secure_runtime_alpha_6921_7000*`, `test/secure_runtime_alpha_7001_7080*`, `test/secure_runtime_alpha_7081_7160*`, `test/secure_runtime_alpha_7161_7240*`, `test/secure_runtime_alpha_7241_7320*`, `test/secure_runtime_alpha_7321_7400*`, `test/secure_runtime_alpha_7401_7480*`). |
| 8 | Everything from the prior Arc's own final verification (`test/secure_runtime_alpha_7481_7560*` through `test/secure_runtime_alpha_7881_7960*`), already exhaustively re-run and passing per the prior session — spot re-confirmed, not fully re-derived. |

Full, unabridged `npm test`/`cargo test`/typecheck runs happen ONCE,
after ALL checkpoints land, in Stage 3 — not 8 times redundantly.

## Rollback quick-reference

| Checkpoint | Rollback target |
|---|---|
| 1 | `3eb9eadd` (master) |
| 2 | `767eb54e` |
| 3 | `568ddb88` |
| 4 | `9ab4eac1` |
| 5 | `d825aa0c` |
| 6 | `9cdd74ec` |
| 7 | `ed5128f6` |
| 8 | `4c6fa3b3` |
