# Disaster Recovery / Portable Backup — Agent B: Fresh-Machine Restore Findings

Real, compiled `packages/fedos-desktop-electron-spike/dist/fedos_electron_beta_main.cjs`,
spawned via the real `electron.exe` binary, driving the real rendered DOM
(`AUTOTEST_MODE=ui-script`), with the real compiled WASM crypto artifact
(`packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm`). No mock, no
`window.fedosAcceptance` shortcut for anything the shipped UI can drive.

New test: `packages/fedos-desktop-electron-spike/test/fedos_disaster_recovery_fresh_machine_restore.test.ts`.
Run via `npx vitest run --config vitest.electron-spike.config.ts packages/fedos-desktop-electron-spike/test/fedos_disaster_recovery_fresh_machine_restore.test.ts` — **passed, twice in a row** (65.8s, 53.3s).

"Machine A" and "Machine B" are two independent `mkdtempSync` directories. Machine
A onboards, sends/receives a real encrypted message, pairs a real second
Device. The process exits cleanly. The **entire** Machine A directory tree
(`profile/` + sibling `settings.json` + `logs/`/`session/`) is `cpSync`'d,
recursive, byte-for-byte, into a brand-new never-before-used directory.
Machine B is a genuinely fresh Electron process pointed at the copy only.

## Real Electron/WASM binaries: HAD to be fixed, not just present

The `pkg/` artifact and `electron.exe` were present, but a fully clean
`npm run build:beta-runtime` + electron-spike `npm run build` did **not**
produce a bootable app: `tsconfig.beta-runtime.json` had no explicit
`rootDir` (it inferred `src/os`, dropping the `os/` segment every
`distUrl("os", "messenger", ...)` call needs) and was missing three legacy
top-level modules (`src/desktop/beta/...`, `src/device/sync_events/...`,
`src/runtime/master_seed/...`) the main process also dynamically imports.
Separately, the gitignored `packages/fedos-core-rust/pkg/fedos_wasm_artifact_manifest.v1.json`
had a stale `wasmSha256Hex` that didn't match the actual `.wasm` bytes
present in this worktree, so production activation reported
`artifact-invalid`. **Before these two fixes, this file's own test —
and the pre-existing `secure_runtime_alpha_8041_8120_...`/`secure_runtime_alpha_7321_7400_...`
reference tests — silently self-skipped or failed at process startup.**
Fixed with a build-configuration-only change (`tsconfig.beta-runtime.json`:
pinned `rootDir: "src"`, added the 3 missing includes) plus regenerating the
manifest (`npm run build:wasm:manifest`) — no Direct Ratchet/Own-Device-Sync
logic file touched. Re-ran both reference tests afterward: both now genuinely
pass (previously "2 skipped" / startup crash).

## Per-asset classification

| Asset | Classification | Evidence |
|---|---|---|
| **IDENTITY** | **RECOVERED** | `readAt(machineB, 11)` (`#ready-account` after real unlock with Alice's real passphrase) equals the identifier captured at Machine A creation: `cf05daa97186edbe0df1707d3abbd24ddc713c9bcc28adca5fd051cc18ca1955`. Assertion passed. |
| **CONTACTS** | **RECOVERED** (this product has no separate address book — a "contact" *is* a Direct Conversation counterparty) | `#conversations-list` on Machine B reads `"direct conversation ⚠ blocked…"` — present, not `"No conversations yet"`. Caveat: the real UI shows a `⚠ blocked` status tag on the restored conversation until reactivated (this Runtime's own established per-process-lifetime reactivation requirement, not a copy defect) — the counterparty/contact relationship itself is fully intact. |
| **CONVERSATIONS** | **RECOVERED** | Same conversation opens on Machine B: `readAt(machineB, 15)` (`#chat-title`) = `"direct conversation"`. |
| **MESSAGES** | **RECOVERED** | `readAt(machineB, 20)` (`#chat-messages`, after real "Show message" reveal clicks) contains **both** real plaintexts sent before the copy: `"disaster-recovery-test message from alice, really sent through the real chat composer"` and `"disaster-recovery-test reply from bob, really sent through the real chat composer"`. This is genuine end-to-end proof — the copied sealed Master Seed successfully unlocks and decrypts real ciphertext on a process that never touched Machine A. |
| **DEVICE TRUST** | **RECOVERED** | `readAt(machineB, 23)` (`#devices-list`) = `"✓ device-bd2d9b4481ec6b88 (this device) – trusted✓ AlicesSecondLaptop  – trustedRevoke"`. The second Device paired on Machine A (via the real `device-pairing-create/approve/complete` IPC flow, same technique as `secure_runtime_alpha_8201_8280_...`) still shows `trusted` on Machine B. |
| **RATCHET** | **N/A — no state exists to restore** | Read directly from Machine A's own `profile/direct-ratchet-session.ndjson` (never the excluded transport/integration files): file absent or 0 bytes after the full real send/receive flow — assertion passed. Independently corroborated by Machine B's own real Safety Center text: `"secure-messaging: unavailable – no Ratchet session was assessed (no known Conversation/Device pair supplied)"`. The shipped Beta HTML/renderer has **zero** control anywhere that calls `establishDirectRatchetSession` — ordinary chat, exactly as this test drove it, never touches Direct Ratchet. There is no forward-secrecy ratchet state on the default send path to back up in the first place. |
| **TOR SETTINGS** | **N/A — feature does not exist in the shipped build** | Real seeded `settings.json` keys: `schemaVersion, theme, language, relays, defaultRelay, notificationsEnabled, backgroundSyncEnabled, archiveDirectory, autoStart, autoLockTimeoutMinutes, windowLayout` — filtered for `/\btor\b|onion|socks/i`, result `[]` (assertion passed). No Tor/onion/proxy control exists anywhere in the Beta HTML/renderer either. |
| **COMMERCE RECEIPTS** | **N/A (pre-confirmed, not tested)** | `src/os/commerce/creator/entitlement.ts` STATUS: "inert scaffolding, not reachable from the shipped Electron app." No durable state exists to back up. |
| **PURCHASED CONTENT** | **N/A (pre-confirmed, not tested)** | Same — no `media_access_grant_persistence.ts` in `src/os/commerce/` on this branch. |

## Negative check: wrong passphrase fails closed

Same Machine B copy, first unlock attempt used a wrong passphrase:
`readAt(machineB, 4)` (`#current-screen`) = `"unlock-failed"`; `#conversations-list`
read back empty (its populate code never runs before a successful unlock).
No partial data, no crash, no bypass. **No dangerous or wrong behavior was
observed anywhere** — every category either genuinely recovered or was
cleanly absent; raw directory copy never produced incorrect/misleading
state, only correctly-decrypted state or correctly-refused access.

## Single most important surprise

Not a disaster-recovery-specific finding at all: **the real packaged Beta
Electron app currently cannot boot from a clean build on this branch**,
independent of anything this arc is testing. Two separate, unrelated build
defects (a `tsconfig.beta-runtime.json` `rootDir`/include gap, and a stale
gitignored WASM artifact manifest hash) meant every "real binary" test in
this package — including the two pre-existing reference tests this arc's
own instructions pointed at as the pattern to follow — was silently
self-skipping or crashing at startup before any of today's work. Both are
now fixed (build-config only) and verified: the reference tests pass for
real now too. Secondary, product-level surprise: **RATCHET/forward secrecy
is not an asset category this backup mechanism can affect either way**,
because the shipped product never creates any ratchet session through its
own UI-reachable send path — so "does backup/restore preserve forward
secrecy" is currently a moot question for real users of this build.

## Commit

New test file + this report committed locally on
`arc/fedos-disaster-recovery-portable-backup`. The `tsconfig.beta-runtime.json`
build fix was committed separately in the same worktree since it was a
required precondition for running any real-binary evidence at all.
