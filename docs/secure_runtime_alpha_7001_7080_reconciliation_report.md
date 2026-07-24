# Secure Runtime Alpha 7001–7080 — Mandatory Reconciliation Report

**FedOS Desktop Beta Final Runtime Validation and End-to-End Messaging
Acceptance Arc.** Phase A. Written BEFORE any source edit, per mission
mandate. All findings below are grounded in direct source reads (file:line
citations) against this Arc's base (`1dfb7a48`), not narrative inference.

## Symbol inventory

| Symbol | File | Owner | Packaged reachable? | Node-only? | Test-only? | Safe to expose via Host command? | Secret-bearing? | Required modification? |
|---|---|---|---|---|---|---|---|---|
| `ipcMain.handle` registrations | `fedos_electron_beta_main.cts:868-882` | Electron main | YES (only these 10) | no | no | n/a (already the boundary) | no | ADD new closed acceptance commands |
| `unifiedGraphDiagnostics()` | `fedos_electron_beta_main.cts:779-817` | Electron main | NO — console-log only (AUTOTEST), not an IPC channel | no | effectively yes | already safe | no | EXTEND with a truthful operational field (Phase D) |
| `fedos_electron_beta_preload.cts` | same package | Electron preload | YES | no | no | n/a | no | ADD narrow exposures for new commands |
| `fedos_electron_beta_page.html`/`_renderer.ts` | same package | Electron renderer | YES | no | no | n/a | no | untouched (acceptance drives IPC directly, not the renderer UI) |
| `FedosDesktopApplicationShell.sendMessage/listMessages/readMessage` | `fedos_desktop_application_shell.ts:391-415` | Shell | reachable via Runtime, but NOT via any registered IPC channel today | no | no | YES | no | expose via new IPC commands (Phase C) |
| `FedosDesktopApplicationShell.createDirectConversation` | `fedos_desktop_application_shell.ts:329-333` | Shell | same as above | no | no | YES | no | expose via new IPC command |
| `FedosDirectRatchetConversationRuntime.initializeDirectRatchetSession` | `fedos_direct_ratchet_conversation_runtime.ts:207-213` | Conversation Runtime | reachable only through `cr.directRatchet()`, no Shell wrapper exists, no IPC | no | no | YES (narrow wrapper) | no | add ONE narrow Shell wrapper + IPC command |
| `FedosDirectRatchetConversationRuntime.sendDirectRatchetMessage`/`getDirectRatchetStatus` | same file, lines 250-305 | Conversation Runtime | same | no | no | YES | no | reachable once `messageDelivery` is wired (see bug below); status already exposed via `shell.directRatchetStatus()` |
| `conversationDirectRatchetDeps` auto-construction | `fedos_desktop_runtime.ts:833-847` | Desktop Runtime | YES (packaged) | no | no | n/a | no | **REAL BUG: `messageDelivery` field never populated** (see below) |
| `directMessageDelivery` (legacy static route) auto-construction | `fedos_desktop_runtime.ts:742-751` | Desktop Runtime | YES (packaged) | no | no | n/a | no | untouched — reference pattern for the fix above |
| `WebSocketRelay` | `src/desktop/websocket_relay.ts:232` | Conversation transport | YES, client only | no | no | n/a | no | untouched (real client, unchanged) |
| Real WebSocket relay **server** | — | — | **DOES NOT EXIST ANYWHERE IN THIS REPO** | — | — | — | no | ADD (Phase F) — narrow, test/acceptance-side Node process, not a new protocol |
| `FakeRelayServer`/`LiveRelayConnection` | `test/secure_runtime_alpha_5561_5640_real_vertical_slice.test.ts:110-178` | that test file only | NO — in-memory, no sockets | YES | YES | not reusable for a packaged test (no real transport) | no | not reused; superseded by the real server above |
| Device Registry trust establishment | `src/device/binding_challenge/fedos_device_binding_registration_authority.ts`, `fedos_device_pairing_facade.ts` | Device subsystem | no Shell method registers a peer Device as trusted | no | no | narrow closed command needed | no | ADD narrow closed acceptance command |
| `FedosSafetyCenterController`/`fedosSafetyCenterBuildSummary` | `src/desktop/presentation/safety_center/*.ts` | Safety Center | YES (Node-level; no IPC channel yet) | no | no | already safe | already has a `"secure-messaging"` slot (`ratchetSessionStatuses`) — no new field needed | none (Phase D threads into it) |
| Settings `relays`/`defaultRelay` | `src/settings/fedos_settings_descriptor.ts:67-70`, `fedos_settings_codec.ts` | Settings domain | YES, file-backed, read once per Coordinator construction (`fedos_electron_beta_main.cts:510-532`) | no | no | already real | no | none — real fixture files written via the REAL encoder, not hand-rolled JSON |
| Two-concurrent-Electron-process precedent | — | — | **NONE FOUND ANYWHERE IN THIS REPO** — every prior multi-spawn test runs processes strictly sequentially | — | — | — | — | this Arc is the first; Phase B must choose a topology that does not require it if a safer alternative exists |

## The real, named production bug (Phase A finding, not fabricated)

`fedos_desktop_runtime.ts:742-751` auto-wires `directMessageDelivery`
(the LEGACY static-route delivery config
`FedosConversationDirectMessagingCoordinator` reads) whenever
`config.conversationDirectMessageDeliveryRoute === "nostr-nip17-v1"`. The
sibling field, `conversationDirectRatchetDeps.messageDelivery` (consumed
by `FedosConversationRuntime.sendDirectMessage()` at
`fedos_conversation_runtime.ts:814-830` to decide whether to route a real
user `sendMessage()` call through Ratchet instead of the legacy route), is
**never populated** by the SAME auto-construction block
(`fedos_desktop_runtime.ts:833-847`) — even when Direct Ratchet is fully
enabled and reachable. Net effect, confirmed by direct source read: **the
packaged app's own real, user-facing `FedosDesktopApplicationShell.sendMessage()`
always uses the legacy static NIP-17 route today, never Direct Ratchet,
even after Alpha 6841-6920/6921-7000 made a Ratchet session establishable.**
This is the concrete, deeper reason the packaged app could report
`directRatchetConfigured: true` and even establish a session, yet a real
user-level send would silently never touch it.

**Fix scope**: mirror the EXISTING `directMessageDelivery` pattern
(`fedos_desktop_runtime.ts:742-751`) for `conversationDirectRatchetDeps.messageDelivery`,
using the SAME `privateTransportInstance` forward-reference-via-closure
discipline already established one block above it. This is additive,
narrow, touches one object literal, and requires zero change to
`FedosConversationDirectMessagingCoordinator` itself (an accepted
boundary this Arc must not redesign).

## Why the prior Arc proved Node-level but not packaged operations

Confirmed by direct inspection, not assumption: it is **not** solely a
missing-IPC-diagnostic problem, as the mission itself warns against
assuming. Three independent, concrete gaps exist simultaneously:

1. The messaging bug above — even a perfect IPC surface would silently
   route through the legacy path, not Ratchet.
2. Zero IPC commands exist for conversation creation, session
   establishment, message send/read, or Device trust — a real Shell
   method existing is not the same as it being packaged-reachable; this
   repo's own convention (confirmed: 10 registered channels, all
   profile/beta-status/settings/tray/badge only) never wired the
   messaging-domain Shell methods to IPC in the first place.
3. No real relay server, and no real Device-trust-establishment path,
   exist anywhere in this repository — both are structural prerequisites
   for a real two-party session, not just packaging gaps.

## Phase B input: topology constraints found

- A **one-Electron + one-Node** topology (`FedosConversationRuntime`
  driven directly in Node for the second peer using the exact same real
  production classes Phase I already proved, e.g. via
  `startFedosDesktopRuntime()`) is explicitly permitted by the mission
  ("acceptable only if... the Node side uses the real production Runtime
  rather than a fake peer") and avoids inventing a first-ever
  two-concurrent-Electron-process pattern in one step. This is the lower-
  risk topology given zero existing precedent for two live Electron
  subprocesses.
- A **two-Electron-process** topology is achievable (both binary and
  package-relative path are now available in this environment — see
  Environment section) but requires this Arc to be the FIRST to prove
  concurrent (not sequential) subprocess coordination in this codebase's
  test history — a real, but larger, new risk surface, best attempted
  only after the one-Electron+one-Node path is proven first.

## Environment (verified this session)

- Real Electron `v43.1.1` binary IS available in this environment (found
  under a sibling worktree's `node_modules`, wired in via targeted
  package-local junctions — the shared root `node_modules` junction was
  NOT used for this, avoiding side effects on other concurrent worktree
  sessions). `packages/fedos-core-rust/pkg/` built fresh this session
  (`npm run build:wasm` + `npm run build:wasm:manifest`, bypassing
  `build:production-wasm`'s own `cargo test` gate, which hits the same
  pre-existing, unrelated `secp256k1_dependency_guard` dependency-count
  failure documented by the immediately-prior Arc — confirmed still
  present, still unrelated to Direct Ratchet, zero Rust file touched this
  session).
- No `ws`-style WebSocket server package is currently a dependency
  anywhere in this repo; Node's own runtime provides a global WebSocket
  **client** only (used by `createNodeWebSocketRelaySocketFactory`). A
  real relay SERVER for this Arc's own test/acceptance harness needs
  either Node's built-in `node:http`+a minimal RFC 6455 handshake, or a
  new dev-only dependency — decided in Phase B/F below.
