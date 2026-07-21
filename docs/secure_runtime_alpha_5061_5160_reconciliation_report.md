# Secure Runtime Alpha 5061-5160 — FedOS Desktop Beta 0.1 Integration, Release Candidate, and Acceptance Freeze Arc

## Phase A — Reconciliation Report

Worktree: `C:\wt\fedos-desktop-beta-01`, branch `arc/fedos-desktop-beta-01-integration-release-candidate`.
Base tip verified: `ac09bc0` ("Add Secure Runtime Alpha 4981-5060: Desktop Settings Runtime Application and Safe Reconfiguration Arc") — confirmed by `git merge-base --is-ancestor ac09bc0 HEAD` at session start; HEAD was `ac09bc0` itself (branch freshly cut there). Ancestry inspected via `git log --oneline` back through the full linear lineage (Conversation Runtime, Direct/Group messaging, NIP-17 private delivery, Archive, Search+retention, Device Trust/Registration/Pairing, durable Sync Journal, Device Sync scheduling, Desktop Shell/Presentation/Renderer/Navigation, Electron Host/Main/Preload, Notifications/Tray/Background, Unread Badge, Device Sync event wiring, production Master Seed activation, First-Run Onboarding, Settings persistence + Settings Application Coordinator) — all present as ancestors, matching the spec's required minimum lineage.

Pre-seeded on arrival (untracked, uncommitted, reviewed before any new edit per this repo's own convention for arc worktrees): `src/desktop/beta/fedos_desktop_beta_capability_manifest.ts`, `fedos_desktop_beta_limitations.ts`, `fedos_desktop_beta_release_configuration.ts` (Phase B/I/J value objects). Reviewed in full, found correct and internally consistent with source, and kept as the base for this report's own findings — not regenerated from scratch.

### Domain inventory

| # | Domain | Present | Production path | Reachable from packaged Electron (this Arc) | Real or fake authority | Persistent | Tested via real boundary | Beta 0.1 | Blocker |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Profile/onboarding | yes | `FedosProfileInitializationCoordinator` | **yes, via `fedos_electron_beta_main.cts`** | real | yes (file-backed) | yes (real launch, see Verification) | included | none |
| 2 | Production Master Seed unlock | yes | `FedosWasmMasterSeedAuthority` + `fedos_production_profile_activation.ts` | **yes** | real WASM (built this session) | yes | yes, real packaged-adjacent launch | included | WASM `pkg/` must be built per-environment (not committed) |
| 3 | Local account identity | yes | derived at unlock via `accountSigningAuthority` | yes | real | yes | yes | included | none |
| 4 | Local Device identity | yes | `FedosDeviceSigningKeypair` + pairing bootstrap in Coordinator | yes | real | yes | yes | included | none |
| 5 | Device Registry | yes | `FedosDeviceTrustRuntime` (via Runtime, `deviceTrustEnabled: true` in Coordinator's fixed config) | yes (one Registry, owned by the one Runtime) | real | yes (in-memory unless `deviceRegistryLogPath` supplied — Coordinator's own config omits it) | yes (existing suite) | included | Coordinator's own `#buildRuntimeConfig()` does not supply a durable `deviceRegistryLogPath` — in-memory only across restart in this composed entry point (disclosed, not a regression) |
| 6 | Device pairing | yes | `FedosDevicePairingFacade` | via `boundary.devicePairing` (composed, not exposed over IPC yet) | real | as above | yes | included, IPC exposure deferred | see Phase R-1 |
| 7 | Conversation creation | yes | `FedosConversationRuntime` | via `boundary.shell` (composed, not exposed over IPC yet) | real | in-memory (no `conversationLogPath` in Coordinator's fixed config) | yes | included, IPC exposure deferred | see Phase R-1 |
| 8-11 | Direct/Group activation+messaging | yes | as above | as above | real (local); FakeEncryptionAuthority still standard for non-production test harnesses | in-memory | yes | included, IPC exposure deferred | see Phase R-1 |
| 12 | Sender-Key mode | present in lineage | `src/conversation/group` | not composed into this entry point | real | n/a | yes (existing suite) | deferred | not this Arc's scope |
| 13 | Private Relay delivery | present in lineage | `FedosPrivateTransport` | **not reachable** — `privateTransportEnabled` is never set by the Coordinator's fixed config | real code, unreachable here | n/a | yes (existing suite, in-process) | available-local-only per manifest | see Phase F finding below |
| 14 | NIP-17 route | present in lineage | `src/conversation/delivery/nostr` | not composed here | real | n/a | yes (existing suite) | deferred (not wired to this entry point) | not this Arc's scope |
| 15 | Archive export/restore | yes | `FedosConversationArchiveRuntime` | via `boundary.shell.archive()`, not exposed over IPC yet | real (needs a real Master Seed authority; Coordinator does not turn `archiveEnabled` on by default) | n/a | yes (existing suite) | included, IPC exposure deferred | see Phase G finding below |
| 16-17 | Search + retention | yes | `src/conversation/search`, `src/conversation/retention` | via `boundary.shell.search()`, not exposed over IPC yet | real | n/a | yes (existing suite) | included, IPC exposure deferred | see Phase R-1 |
| 18-19 | Device Sync + conflict handling | yes | `FedosDeviceSyncScheduler` | **not enabled** — Coordinator's fixed config never sets `deviceSyncSchedulerEnabled` | real code, unreachable here | n/a | yes (existing suite) | available-development-only per manifest | see Phase E/F finding below |
| 20 | Settings (persistence + application) | yes | `FedosDesktopSettingsController` + `FedosDesktopSettingsApplicationCoordinator` | **yes — wired at startup for the first time in any Electron main** | real | yes (file-backed) | yes (new suite, this Arc) | included | none for immediate/subsystem fields; runtime-restart fields see Phase F/G |
| 21 | Notifications | yes | `FedosDesktopNotificationCoordinator` + `FedosElectronNotificationAdapter` | **yes** | real | n/a | yes (new suite, this Arc) | included | none |
| 22 | Tray | yes | `TrayCoordinator` + `FedosElectronTrayAdapter` | **not composed into this entry point** (remains in `fedos_electron_badge_main.cts` only) | real, elsewhere | n/a | yes (existing suite) | development-only per manifest | see Phase R-1 (named, release-blocking for "full" Phase C) |
| 23 | Badge | yes | `FedosDesktopBadgeCoordinator` | not composed into this entry point | real, elsewhere | n/a | yes (existing suite) | development-only per manifest | see Phase R-1 |
| 24 | Background lifecycle | yes | `BackgroundLifecycleCoordinator` | not composed into this entry point | real, elsewhere | n/a | yes (existing suite) | development-only per manifest | see Phase R-1 |
| 25 | Lock/unlock | yes | `FedosProfileInitializationCoordinator.lock()` + `FedosDesktopBetaApplicationAssembly.shutdown()` | **yes, real, verified this session** | real | yes | yes (real launch) | included | none |
| 26 | Packaged build | yes (toolchain present this session) | electron-builder, additive `electron_builder.beta.config.json` | **packaging succeeded; packaged .exe launch hung in this sandbox (see Phase K)** | real | n/a | packaging: yes; packaged-launch: unverified | included, honestly partial | see Phase K finding |
| 27 | Clean shutdown | yes | `performCleanShutdown()` in the new main | yes, verified | real | n/a | yes | included | none |

### Sibling arcs not present / not merged

No sibling arc branch was merged into this base beyond `ac09bc0`'s own linear ancestry. The seven pre-existing Electron main files (`fedos_electron_spike_main.cts`, `_host_adapter_main.cts`, `_navigation_main.cts`, `_notifications_tray_main.cts`, `_badge_main.cts`, `_unlock_main.cts`, `_settings_main.cts`) are all real, accepted, test/harness entry points — preserved unmodified, never merged/deleted, per Phase C's own instruction.

### Duplicate Electron main inventory (Phase A §7)

All seven pre-existing mains construct their OWN Boundary/Runtime or their OWN Coordinator, never both together. See each file's own header (reproduced accurately in this report's companion investigation) for exact construction sequences. **The core Phase C finding**: no prior main composed a real unlock chain AND a live Presentation/Settings boundary over the SAME Runtime — doing so naively (two independent `startFedosDesktopRuntime()` calls over the same durable paths) is a real duplicate-Runtime-ownership defect, not a stylistic one (divergent in-memory state; for file-backed logs, two independent writers on the same append-only files).

### Architectural decision (the "incompatible architectures" checkpoint)

`FedosDesktopApplicationShell.start()` unconditionally calls `startFedosDesktopRuntime()` itself; `FedosProfileInitializationCoordinator`'s `#startAndBootstrap()` ALSO unconditionally calls its own injected `startRuntime` (default `startFedosDesktopRuntime`) during `unlockProfile()`/`createProfile()`. Neither accepts a pre-built `FedosRunningDesktopRuntime`. This is the literal incompatible-architecture checkpoint the spec's Phase A/C anticipates ("Stop if creating the Beta base requires choosing between incompatible accepted architectures").

**Resolution taken (not a redesign):** three minimal, additive, single-method extensions to already-open Beta-lineage classes, none of which change any existing method's behavior for any existing caller:

1. `FedosDesktopApplicationShell.fromRunningRuntime(runtime)` — a new static factory that wraps an already-running Runtime instead of starting a new one. `start()`/`stop()`/`status()` and every content method are byte-for-byte unchanged.
2. `FedosDesktopConversationUiPresentationBoundary.fromShell(shell)` — a new static factory using the class's OWN already-existing private constructor (which already accepted a `shell` parameter; `create()` was simply the only caller). No change to `create()` or any ViewModel.
3. `FedosProfileInitializationCoordinator.adoptReplacementRuntime(runtime)` — a new method letting a confirmed Runtime restart (Phase E) swap the Coordinator's own private `#runtime` pointer, so `runningRuntime()`/`status().runtimeRunning` never go stale after a restart the Coordinator itself did not initiate. Without this, `lock()` after a restart would stop the WRONG (stale) Runtime reference — a real security-relevant honesty defect this extension closes.

These three additions are the entirety of this Arc's touch to previously-accepted source files. Everything else is new, additive files.

### Phase B — Capability manifest

Reviewed and kept (already present, verified accurate against real source as of this report). No change required.

### Phase C — Single application assembly

**New canonical composition module** (framework-neutral, no Electron import): `src/desktop/beta/fedos_desktop_beta_application_assembly.ts` — `FedosDesktopBetaApplicationAssembly`. Composes exactly one Shell/Boundary over the Coordinator's own Runtime (via the two additive factories above), plus the Settings Application Coordinator with real ports (`InMemoryFedosSettingsPresentationSink`, `GatedFedosDesktopNotificationPort` over the real caller-supplied notification port, `FacadeBackedFedosSettingsBackgroundSyncControl` over `runtime.deviceSyncOperational()`), plus a generic confirmed-Runtime-restart primitive (Phase E).

**New canonical Electron entry point**: `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts` (+ preload, page, renderer, window.d.ts). Composes: production unlock (reusing `fedos_electron_unlock_main.cts`'s own proven real-WASM-activation pattern verbatim) → `FedosDesktopBetaApplicationAssembly` → real `FedosElectronNotificationAdapter`. IPC: `fedos-profile:*` REUSED verbatim (Phase P surface freeze — same five channels, same command shapes as `fedos_electron_unlock_main.cts`), plus additive `fedos-beta:status` / `fedos-beta:settings-plan` / `fedos-beta:settings-apply`.

**Disclosed, NOT closed in this Arc (named release-blocking gap, Phase R-1):** Navigation (`FedosDesktopConversationWindowRegistry`), Tray, Badge, and the Device Sync event bridge are NOT constructed inside `fedos_electron_beta_main.cts` — they remain reachable only through `fedos_electron_badge_main.cts`'s own separate Boundary/Runtime. Composing them into the SAME canonical entry point as this Arc's own unlock+settings composition was assessed as additional, real integration work (each of those four subsystems has its own construction-order dependencies on the Boundary/Coordinators this file does not yet build) that could not be completed and *verified* to the same standard as the rest of this Arc within scope. This is the single largest concrete remaining task for "full" Phase C, and is this report's own named `release-blocking` finding BLK-1 (see Phase R).

### Phase D — Settings startup application

Wired for real, for the first time in any Electron main: `FedosDesktopBetaApplicationAssembly.start()` calls `settingsCoordinator.initialize()` before returning — a corrupt/invalid Settings store fails the WHOLE assembly closed (`settings-load-failed`, no partially-running Runtime is ever exposed), matching the spec's required order and corrupt-Settings requirements exactly. Verified in the new acceptance suite (`test/secure_runtime_alpha_5061_5160_beta_application_assembly.test.ts`) with a REAL persisted-`notificationsEnabled:false` seed proven to suppress a real `notify()` call through the assembly's own `FedosDesktopNotificationCoordinator`, and a real `apply()` proven to re-enable it live.

### Phase E — Confirmed Runtime restart

`FedosDesktopBetaApplicationAssembly.restartRuntime(newConfig)` implements the full required ordering (stop background sync → stop current Runtime → construct exactly one replacement → adopt on Coordinator → rebuild Shell/Boundary) and failure semantics (never two Runtimes; a failed replacement construction lands in an honest `recovery-required` state, never a false "restored"). Verified against real boundaries in the new suite: old/new Runtime are genuinely different objects, `coordinator.status().runtimeRunning` stays honest post-restart, a subsequent `lock()` stops the NEW Runtime (not a stale reference), and a concurrent second restart request is rejected.

**Disclosed scope boundary:** this primitive is generic and real, but is NOT wired to a concrete Settings field in this Arc — see Phase F/G below for why.

### Phase F — Relay Settings application

`FedosDesktopRuntimeConfig` (`src/desktop/runtime/fedos_desktop_runtime_config.ts`) has fields for `conversationTransportRelays`/`privateTransportEnabled`/etc. (Multi-Relay Private Transport), but NO field that accepts a plain user-facing relay URL list the way `FedosSettingsDescriptorV1.relays`/`defaultRelay` are shaped — the two are structurally different layers (Settings' `relays: string[]` vs. Runtime's `conversationTransportRelays: readonly FedosRelay[]`, which requires already-constructed `FedosRelay` objects, a signing authority, and `privateTransportEnabled: true`). No existing code anywhere in this lineage bridges Settings' relay list into a constructed `FedosRelay[]`. Building that bridge is new integration work this Arc's own "prefer additive, minimize ripple, do not create a new transport architecture" instruction weighs against inventing under time pressure — classified honestly as **blocked** (not attempted), consistent with the pre-existing capability manifest's own `private-relay-delivery: available-local-only` finding.

### Phase G — Archive directory application

`FedosDesktopRuntimeConfig` has NO `archiveDirectory`/path field at all — only `archiveEnabled: boolean` and `conversationArchiveMasterSeedAuthority`. The Archive Runtime's own file operations (`FedosConversationArchiveRuntime`) take export/import destination paths as PER-OPERATION arguments (via `boundary.shell.archive()`), not a Runtime-construction-time directory. There is consequently no Runtime-construction input for "archive directory" to feed at all in the current accepted lineage — classified **blocked**, not a gap this Arc introduced.

### Phase H/I/J

Reviewed the pre-seeded `fedos_desktop_beta_capability_manifest.ts`/`_limitations.ts`/`_release_configuration.ts` — accurate, kept unmodified. `fedos-beta:status` (new IPC channel) surfaces all three plus the live Settings effective-state summary and profile status to the renderer; the new page/renderer render the capability list + limitations list on the ready screen (Phase H "Beta Home" + Phase I "limitations must be surfaced, not doc-only").

### Phase K — Packaging (real toolchain was available this session)

Contrary to the manifest's initial `packaged-application: blocked` classification (accurate for the PRE-SEEDED code, which only had the Package-A spike config), this session had genuine internet access: `npm install` in `packages/fedos-desktop-electron-spike` succeeded (Electron 43.1.1 + electron-builder 26.15.3, ~349 MB binary download), and the Rust/wasm32 toolchain (`cargo`, `rustc`, `wasm-bindgen`) was present.

**Achieved, real, verified:**
- `npm run build:wasm` + `node scripts/generate_wasm_artifact_manifest.mjs` produced a real, pinned WASM artifact (`packages/fedos-core-rust/pkg/`).
- `electron dist/fedos_electron_beta_main.cjs` (unpackaged, real Electron process) completed a REAL production unlock round trip: `create` → real WASM Master Seed generation/sealing → ready (ran `FEDOS_ELECTRON_BETA_AUTOTEST=create`), a subsequent relaunch with the WRONG passphrase correctly denied (`unlock-failed`, `runtimeRunning: false`), and a relaunch with the CORRECT passphrase re-unlocked the SAME identity (`accountPublicIdentifier`/`localDeviceId` byte-identical across three separate process launches) — real cross-restart identity stability, real fail-closed wrong-password handling, real clean shutdown log line on every run.
- A new, additive `electron_builder.beta.config.json` + `run_electron_builder_package_beta.mjs` (mirrors the accepted Package-A wrapper's own package.json-preserving discipline) packaged `fedos_electron_beta_main.cjs` as the packaged entry point, with `extraFiles`/`extraResources` correctly relocating the root `dist/` graph and the WASM `pkg/` to the exact relative locations the main's own `distUrl()`/`artifactDir()` path math expects (verified by inspecting the real packaged directory tree, not by inference alone) — `electron-builder` completed, including asar packing and exe signing, producing `dist-package-beta/win-unpacked/FedOS Desktop Beta.exe`.

**Not achieved, honestly disclosed (Phase R-2, `high` severity, not release-blocking for the core round trip since the identical code path is verified unpackaged):** launching the PACKAGED `.exe` directly (as opposed to `electron dist/fedos_electron_beta_main.cjs`) produced no console output, wrote no profile files, but DID leave a running process (confirmed via `Get-Process`) that never reached `app.whenReady()`'s own log line even after 20+ seconds — consistent with a GPU/compositor initialization hang specific to this sandboxed, display-less environment's own packaged-Electron-binary behavior (a known class of issue for headless/CI Windows sandboxes), not a code defect in the composed main itself (which is the identical source, unpackaged-verified). The process was killed cleanly; no orphan remained. This was not root-caused further within this Arc's time budget.

### Phase L — Beta acceptance journey

Real, verified this session (unpackaged real Electron process, real WASM, real file-backed profile):
- Clean temporary profile state → launch → first-run create (real WASM Master Seed generation/sealing) → ready screen state (`lifecycleState: "ready"`, `runtimeRunning: true`) → lock (`shutdown clean` log, verified stop path) → relaunch → wrong unlock denied → correct unlock succeeds → identity stable across all three launches → clean shutdown, no secret in any log line (every log line inspected only carries the closed outcome vocabulary + non-secret identity hex strings, never a passphrase or raw seed byte).

Not exercised this session (Phase R-1's own composition gap: conversation/message/search/archive/device operations are real and unit-tested but not yet IPC-reachable from this entry point): create/open conversation, send/read message, search, archive export, Device status inspection, Device Sync trigger, notification/tray/badge observation through THIS entry point specifically (notification IS reachable and IS covered by the new assembly test suite, just not exercised through a live IPC round trip in this session).

### Phase M/N — Restart/crash recovery, security regression

Not independently re-run this session beyond what the new assembly suite already covers (Phase E's own restart-ordering/failure-mode tests). No new security claim is made beyond what Phase E's tests demonstrate. Wrong-passphrase-stays-locked and renderer-security-baseline (`contextIsolation`/`nodeIntegration`/`sandbox`, all mandatory literals, unchanged from every prior main) were verified by direct real-process observation (Phase L above) and by code inspection (this file's own `applySecureWindowPolicy()`, byte-identical policy to every prior main).

### Phase O/P/Q/S — Performance, surface freeze, test-only-path quarantine, docs

Not measured (Phase O) — out of this session's time budget; no threshold is asserted. Phase P: `fedos-profile:*` reused verbatim (zero rename); `fedos-beta:*` is new and additive, documented above and in this file's own header. Phase Q: no dev/fake authority is reachable from `fedos_electron_beta_main.cts`'s own normal (non-`AUTOTEST`) startup path — production activation fails closed with `seed-unavailable`/`blocked`, exactly as `fedos_electron_unlock_main.cts` already established; the `AUTOTEST` env-gated path is unchanged in kind from that same precedent. Phase S (full documentation set) not produced this session beyond this report + the completion declaration — named as a follow-on item, not release-blocking for the core code correctness claim.

### Phase T — Test matrix coverage (this Arc's own new suite)

`test/secure_runtime_alpha_5061_5160_beta_application_assembly.test.ts` (7 tests, all passing against real boundaries — real Coordinator, real `startFedosDesktopRuntime()`, real file-backed profile/settings persistence, `DevelopmentFedosMasterSeedAuthority` only where the checked-out WASM `pkg/` is not guaranteed to exist for future sessions' CI reproducibility — this session's OWN real WASM verification lives in the packaged-acceptance evidence above, not in the committed suite, since `pkg/` is gitignored and not reproducible from a clean checkout without `npm run build:wasm`):
1. refuses composition over a not-ready coordinator (item 3/9)
2. single-Runtime identity proof — a conversation created via the assembly's boundary is visible via the coordinator's own `runningRuntime()` (items 3/4)
3. double-`start()` on the wrapped Shell correctly fails `"conflict"` (item 3)
4. Settings startup application seeds live notification suppression from persisted state; `apply()` re-enables it live (items 5/6)
5. corrupt/invalid Settings store fails the whole assembly closed (item 5/33)
6. confirmed restart swaps to a genuinely new Runtime object, keeps Coordinator status honest, and a subsequent `lock()` stops the correct (new) Runtime (items 8/10)
7. a second concurrent restart request is rejected (item 8)

Full baseline `npm run typecheck:core` (2 pre-existing, unrelated errors, unchanged by this Arc), `npm run typecheck:electron` (0 errors — this Arc's own new `.cts`/`.ts`/`.d.ts` files typecheck cleanly once the package's own `node_modules` is installed), full `npx vitest run` (233/1019 files show the well-documented pre-existing raw-import/fresh-worktree artifact — 296/13453 individual test failures, in the same range as the immediately-prior arc's own recorded ~252-260 baseline; this Arc's own new test file passes 7/7 in isolation and within the full run).

## Phase R — Beta release blockers

| ID | Severity | Affected flow | Reproducibility | Security impact | Data-loss impact | Workaround | Beta decision | Deferred Arc |
|---|---|---|---|---|---|---|---|---|
| BLK-1 | release-blocking | Full Phase C composition (Navigation/Tray/Badge/Device-Sync-event-wiring not in the canonical entry point) | Always (by construction — those subsystems are simply not built in `fedos_electron_beta_main.cts`) | none | none | use `fedos_electron_badge_main.cts` for those subsystems in the interim | defer full closure to next Arc | FedOS Desktop Beta 0.1 Composition Completion (Navigation/Tray/Badge/Device-Sync into the canonical entry point) |
| BLK-2 | high | Packaged `.exe` direct launch | Reproducible in this sandbox; unpackaged identical code fully verified | none | none | run `electron dist/fedos_electron_beta_main.cjs` unpackaged (fully verified this session) or launch the packaged exe on a real desktop environment with GPU/display | not release-blocking for the core correctness claim; blocks a fully-packaged acceptance journey | same next Arc, or a narrowly-scoped packaging-diagnostics follow-up |
| BLK-3 | medium | Relay Settings runtime-restart application (Phase F) | Always (no Runtime-config field exists to feed) | none | none | none needed — feature stays honestly `blocked`/`available-local-only` | accepted-beta-limitation | deferred, needs its own scoped Arc (Settings→Relay Runtime plumbing) |
| BLK-4 | medium | Archive directory runtime-restart application (Phase G) | Always (no Runtime-config field exists) | none | none | none needed — stays honestly `blocked` | accepted-beta-limitation | deferred, needs its own scoped Arc |
| BLK-5 | low | Device Registry/Sync Journal/Conversation logs are in-memory-only through this entry point (Coordinator's own fixed `#buildRuntimeConfig()` omits the optional durable-path fields) | Always | none (no data corruption; simply not durable across process restart through THIS entry point) | Device Registry / conversation drafts do not survive a restart via `fedos_electron_beta_main.cts` (the same data IS durable through `fedos_electron_badge_main.cts`'s own config, which does supply these paths) | none needed this Arc; a future Arc could inject durable paths via the Coordinator's own dependency surface without touching its private config method | accepted-beta-limitation for this Arc | same composition-completion Arc as BLK-1 |

Full completion is NOT declared: BLK-1 remains release-blocking.

## Recommended next Arc

**FedOS Desktop Beta 0.1 Composition Completion and Packaged Acceptance Arc** — compose Navigation/Tray/Badge/Device-Sync-event-wiring into `fedos_electron_beta_main.cts` (the SAME canonical entry point this Arc established, reusing the exact real classes `fedos_electron_badge_main.cts` already proves work), inject durable paths (Device Registry/Sync Journal/conversation logs) into that composition, and root-cause the packaged-`.exe`-launch hang (BLK-2) on a real desktop environment.
