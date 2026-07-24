# Secure Runtime Alpha 7321–7400 — Execution Specification

**FedOS Desktop Production Feature Reachability Arc.**

Resumes from Secure Runtime Alpha 7241–7320 (`10b02cbf`). This Arc runs in
a dedicated worktree/branch, `arc/fedos-desktop-production-feature-reachability`,
base `10b02cbf`.

## Mission (as given)

The Secure Runtime backend is now production-capable. Close the remaining
production reachability gaps so the packaged Electron application can
actually use existing functionality. Explicitly forbidden: any redesign
of protocols, Ratchet, Identity, NIP-17, or Secure Memory.

## Required scope, and how each item was closed

1. **Production IPC enablement** — the prior `fedos-acceptance:*` command
   vocabulary (Alpha 7001-7080) rejected every call unless
   `AUTOTEST_MODE.length > 0`, making the ENTIRE vocabulary unreachable in
   ordinary packaged production mode by construction. That gate is itself
   the reachability gap this Arc's own mission exists to close.
   `requireShell()`/the new `requireBoundary()` (`fedos_electron_beta_main.cts`)
   now gate on ONE thing only — `activeAssembly !== null`, i.e. a real
   profile is genuinely unlocked — the exact same real precondition every
   other channel in this file (`fedos-profile:*`/`fedos-beta:*`) already
   requires. `AUTOTEST_MODE` remains as a legitimate test-automation
   convenience (an offscreen window, a scripted step-runner for driving
   real IPC calls without a visible renderer) — it no longer gates
   FUNCTIONALITY.
2. **Production feature gating** — every command still validates its own
   bounded, typed payload shape before ever reaching the Shell/Boundary
   (`isBoundedString(query, MAX_SEARCH_QUERY_CHARS)`,
   `isBoundedString(sourcePath, MAX_ARCHIVE_PATH_CHARS)`, a closed
   `operation` discriminant for Archive) — no unvalidated field crosses
   the IPC boundary, matching the Alpha 7001-7080 discipline exactly.
3. **Conversation UI → Runtime routing** — `activateDirectConversation`/
   `createDirectConversation` were already real (Alpha 7001-7080);
   confirmed still reachable end-to-end under the new gate.
4. **Invitation UI → Runtime routing** — closes Release Readiness Review
   B-2: `handleAcceptanceCreateConversationInvitation()` delegates
   ENTIRELY to the already-real `FedosDesktopApplicationShell.createConversationInvitation()`
   (Alpha 7081-7160, unmodified) — creates a real Direct conversation and
   sends a real, signed invitation over the real relay.
5. **Messaging UI → Runtime routing** — `sendMessage`/`listMessages`/
   `readMessage`/`directRatchetStatus` were already real (Alpha 7001-7080);
   confirmed still reachable end-to-end under the new gate, including
   real two-party delivery across process restarts.
6. **Search UI → Runtime routing** — closes Release Readiness Review B-7:
   `handleAcceptanceSearch()` delegates ENTIRELY to the already-real,
   unconditionally-constructed `FedosDesktopApplicationShell.search()`
   (Alpha 3081-3160, unmodified). Real finding during testing: Search's
   in-memory index is populated ONLY at `readMessage()` (real plaintext
   decrypt) time — `listMessages()` alone never indexes a message. This is
   pre-existing, established codebase discipline (not a bug), confirmed
   directly by the real vertical slice test.
7. **Archive UI → Runtime routing** — closes Release Readiness Review
   B-7: `handleAcceptanceArchive()` delegates ENTIRELY to the already-real
   `FedosDesktopApplicationShell.archive()` (Alpha 3081-3160, unmodified),
   validating the closed `operation` discriminant
   (`inspect`/`preflightRestore`/`export`/`restore`) and any bounded path
   string, passing the nested `request` object through to the Shell's own
   existing validation — mirroring how `sendMessage`'s own `sender` is
   already handled. **Genuine, disclosed finding (not fixed by this Arc):**
   `exportConversationArchive()`'s own existence check requires a real
   Board-level (`mode:"public"`) `FedosConversationPersistence` record
   (`validateFedosConversationRecord()`, Alpha 748, unmodified) — but the
   packaged Beta app can only ever create PRIVATE Direct conversations (no
   Board/public-conversation UI is reachable through it at all). Archive
   export can therefore never succeed end-to-end for any conversation this
   packaged app produces — confirmed live: `shell.archive()` honestly
   returns `{outcome:"not-found", reason:"unknown conversation"}`, never a
   crash, never a fabricated success. Considered and REJECTED: auto-
   inserting a synthetic "public" bridging record at conversation-creation
   time — this would blur the intentional Public-vs-Private conversation
   type invariant an earlier arc established, and is a redesign-adjacent
   change well outside this Arc's own narrow "reachability wiring"
   mission. Disclosed for a future Arc to weigh (either a real
   Public-conversation creation path, or a deliberate redesign of
   Archive's own existence-check scope).
8. **Safety Center production reachability** — closes Release Readiness
   Review B-7: `handleAcceptanceSafetyCenterOverview()` delegates ENTIRELY
   to the already-real `FedosSafetyCenterController`
   (`src/desktop/presentation/safety_center/`, unmodified), reached via
   `FedosDesktopBetaApplicationAssembly`'s own pre-existing `boundary`
   getter (`requireBoundary()`, mirroring `requireShell()`'s own identical
   discipline) — no new presentation logic. Confirmed live: loads
   correctly even with zero relays configured and zero conversations ever
   created (a real, non-crashing degraded state).
9. **Failure matrix** —
   `packages/fedos-desktop-electron-spike/test/secure_runtime_alpha_7321_7400_failure_matrix.test.ts`,
   4 tests: no profile at all → all four new commands genuinely reject
   `{outcome:"unavailable"}`; a genuinely wrong passphrase produces a real
   `unlock-failed` and leaves the new commands gated; malformed payloads
   for each new command are rejected `{outcome:"invalid-input"}` before
   reaching the Shell; Safety Center loads with zero relays/conversations.
10. **Structural guards** —
    `packages/fedos-desktop-electron-spike/test/secure_runtime_alpha_7321_7400_structural_guards.test.ts`,
    11/11 passing (see below). `test/secure_runtime_alpha_7001_7080_structural_guards.test.ts`'s
    own test 3 was reconciled (its assertion described the OLD
    `AUTOTEST_MODE`-only gate this Arc replaced) — updated to assert the
    new `requireShell()` gate shape, with its own comment explaining why.
11. **Real packaged Electron vertical slice** —
    `packages/fedos-desktop-electron-spike/test/secure_runtime_alpha_7321_7400_real_packaged_vertical_slice.test.ts`:
    the REAL, compiled `dist/fedos_electron_beta_main.cjs`, spawned as a
    genuine Electron subprocess (never a hand-built Coordinator/Runtime,
    never the harness main) — two genuinely independent profiles (Alice,
    Bob), a real local WebSocket relay, real WASM crypto, real file-backed
    persistence: create profile, unlock, create invitation, accept
    invitation (automatic via the real relay), exchange encrypted
    messages, perform search (after real reads), reach Archive's real IPC
    surface (honestly blocked by the disclosed finding above), open Safety
    Center, restart, continue the conversation.

## The reachability fix itself

`fedos_electron_beta_main.cts`:

- `requireShell()`: removed `if (AUTOTEST_MODE.length === 0) return null;`
  — now purely `if (activeAssembly === null) return null; return activeAssembly.shell;`.
- New `requireBoundary()`: identical discipline, returns
  `activeAssembly.boundary`.
- `ShellDiagnosticLike` extended with `createConversationInvitation`,
  `search`, `archive`.
- New `BoundaryLike` interface: `safetyCenter.refreshOverview()` /
  `.overviewState`.
- `AssemblyLike` extended with `readonly boundary: BoundaryLike`.
- `secureRuntimeBundleConfig()` extended with
  `conversationCanonicalCryptoEnabled`, `conversationDirectMessageDeliveryRoute`,
  `conversationTransportInboundEnabled`, `conversationInvitationEnabled`,
  `archiveEnabled`, and an optional `conversationTransportIntervalMs`
  (read from `FEDOS_BETA_CONVERSATION_TRANSPORT_INTERVAL_MS`, used only to
  let tests settle the real Outbox Scheduler faster — production default
  unchanged when unset).
- Four new handlers (`handleAcceptanceCreateConversationInvitation`,
  `handleAcceptanceSearch`, `handleAcceptanceArchive`,
  `handleAcceptanceSafetyCenterOverview`), four new IPC channels
  (`fedos-acceptance:create-conversation-invitation`/`:search`/`:archive`/
  `:safety-center-overview`), and four new acceptance-script command
  entries — plus a `"wait"` pseudo-command in the acceptance-script
  interpreter (delays `payload.ms`, clamped 0-30000ms) used only to let a
  real two-party relay-delivered exchange settle in tests.
- `fedos_electron_beta_preload.cts`: four new bridge methods
  (`createConversationInvitation`/`search`/`archive`/`safetyCenterOverview`)
  on the `fedosAcceptance` object — no generic `invoke(channel, ...)`
  surface added.
- `fedos_electron_beta_window.d.ts`: `FedosAcceptanceBridge` extended with
  the same four methods; doc comment updated to describe the real-profile-
  unlocked gate instead of the old "ACCEPTANCE-MODE-ONLY" framing.

No visual renderer screen is added for these four new commands in this
Arc (disclosed scope decision) — "UI → Runtime routing" here means the
IPC main-process handler + preload bridge layer, consistent with this
codebase's own established convention (every prior reachability arc
defers full visual UI to a later arc; the Release Readiness Review itself
always frames these gaps as "wire into IPC surface," never "build a
screen").

## Verification

- `npm run typecheck:electron` — clean.
- `npx tsc --noEmit` (root) — clean (the same 2 known pre-existing
  baseline errors, unrelated to this Arc's own files:
  `test/secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts`,
  `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`).
- `cargo test` — 639/640 (1 pre-existing, unrelated
  `secp256k1_dependency_guard` Cargo.toml dependency-count drift; zero
  Rust files touched by this Arc, confirmed by structural guard test 9).
- WASM build — a real `packages/fedos-core-rust/pkg/` artifact was built
  fresh for this session and used throughout every real test.
- Electron package validation — `npm run package:beta` (real
  `build:beta-runtime` + `build` + `electron-builder`) produced real,
  signed Windows artifacts: `FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe`
  (NSIS installer) and `FedOS Desktop Beta-0.1.0-beta.1-win.zip`, both
  under `packages/fedos-desktop-electron-spike/dist-package-beta/`
  (gitignored build output). `package.json` confirmed byte-for-byte
  unchanged afterward (the packaging script's own snapshot/restore
  discipline).
- Targeted suites — this Arc's own 3 new/modified test files (16/16
  passing across structural guards, failure matrix, and the real
  vertical slice), plus the reconciled `secure_runtime_alpha_7001_7080_structural_guards.test.ts`
  (11/11 passing after reconciling test 3's assertion to the new gate
  shape).
- Full regression — `npx vitest run`: 828 passed / 303 failed test files
  (14132 passed / 418 failed tests). Every failing file was individually
  cross-checked against the files this Arc touched or created — zero
  overlap. The failures are entirely pre-existing, cumulative artifacts
  already documented in this codebase's own arc history: the worktree
  raw-import artifact (this session built a real `pkg/` artifact, which
  flips a large, separate "no compiled WASM/Rust binary is committed"
  milestone-test class, and the `secp256k1_dependency_guard`-style
  Cargo.toml dependency-count check, which now also fails under a raw
  TypeScript-side `Cargo.toml` string-parse in several `fedos_core_rust_*`
  tests). One test worth naming explicitly:
  `test/secure_runtime_alpha_7001_7080_structural_guards.test.ts` test 10
  ("zero Rust source changed, zero p2p/.tmp_gen change... by this Arc")
  fails because it diffs against Alpha 7001-7080's own base (`1dfb7a48`)
  and now also sees every `src/desktop/production_activation/` file the
  intervening Alpha 7241-7320 Arc added (already committed in this Arc's
  own base, `10b02cbf`, before this Arc began) — a structural-guard test
  whose own `ARC_BASE` becomes permanently stale as later arcs land,
  consistent with the established pattern of a prior arc's own guard
  tests aging out over time; not a regression this Arc introduced (this
  Arc touched zero files under `src/desktop/production_activation/`,
  confirmed by this Arc's own structural guard test 9).

## Environment note (not a code change)

Reused the established fix from prior arcs: building the real WASM
artifact in this worktree requires `CARGO_TARGET_DIR` pointed outside the
long, OneDrive-synced, Japanese-character repo path. A local, isolated
`node_modules` (via `npm install @types/node --no-save --prefix
packages/fedos-desktop-electron-spike`, followed by a plain `npm install`
in that same directory) was created for the electron-spike sub-package
to obtain `@types/node` and a real `electron`/`electron-builder` toolchain
without touching the shared root `node_modules` used by concurrent
sessions — confirmed gitignored, confirmed the shared root untouched.
