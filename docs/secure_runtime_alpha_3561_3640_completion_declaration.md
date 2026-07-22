# Secure Runtime Alpha 3561–3640 — Desktop Electron Host Boundary Arc —
# Completion Declaration

Phase A's own inventory is `docs/secure_runtime_alpha_3561_3640_reconciliation_report.md`
(written before any production edit). This document covers Phases B–J and
the completion declaration itself.

## 1. Dependency and Electron inventory (restated from Phase A)

No Electron dependency exists in this repository (`package.json`/
`package-lock.json` confirmed clean). Per this Arc's own instruction, this
is therefore an **honest partial completion**: the full host abstraction
plus `FedosDesktopHostBridge` (the in-process reference host) are
implemented and fully tested; Phase E's own Electron IPC boundary is not
attempted, and no Electron dependency is added.

## 2. Host ownership graph

`FedosDesktopHostBridge.start(config)` constructs, in order: one
`FedosDesktopConversationUiPresentationBoundary` (which itself owns
exactly one `FedosDesktopApplicationShell`, which owns exactly one
`FedosRunningDesktopRuntime`) → one `FedosDesktopRenderer` over that same
boundary. `stop()` releases both references then calls
`boundary.runtimeStatus.stop()` — the ONE real stop call needed (the
Boundary/Renderer own no independent resource of their own beyond the
ViewModels' in-memory fields — see the reconciliation report §11). No
internal mutable object (`#boundary`/`#renderer`) is ever returned by any
public method.

## 3. Lifecycle

`"stopped"` (initial, and after a successful `stop()`) → `"running"`
(after a successful `start()`). A failed `start()` (Shell/Runtime-layer
error, OR a genuine exception from a structurally invalid config) leaves
status `"stopped"` — never a corrupted "half-running" state; no
`this.#boundary`/`this.#renderer` assignment happens on any failure path.
`dispatch()`/`render()` fail closed to `"unavailable"` before `start()`/
after `stop()`. `stop()` itself is idempotent in the SAME sense
`FedosDesktopApplicationShell.stop()` already is: a second call returns a
closed `"unavailable"` failure, never a throw, never corrupting the
already-stopped state (confirmed by test). `dispatch()` calls are
serialized through one internal Promise queue (`#dispatchQueue`) — two
concurrent calls never interleave their own ViewModel-mutating logic
(confirmed by a real 5-way-concurrent-creation test: all five conversations
are created with zero corruption/collision).

## 4. Command vocabulary (Phase C)

Fourteen commands, exactly matching what the real Shell/ViewModel stack
supports — see `fedos_desktop_host_command.ts`'s own header for the two
categories deliberately EXCLUDED and why (`archive-list`/`archive-verify`:
no such real Archive Runtime operation exists; `archive-export`/
`preflightRestore`/`restore`: excluded pending a real path-authority story,
see Phase H below). Every command is validated STRUCTURALLY
(`validateFedosDesktopHostCommand()`) before it ever reaches a ViewModel —
type-checked, bounded (`FEDOS_DESKTOP_HOST_MAX_ID_LENGTH = 512` for ids,
reusing `FEDOS_CONVERSATION_DIRECT_MESSAGE_MAX_BODY_LENGTH = 10_000`
verbatim for message bodies, a new `500`-char bound for search query text
since no domain limit exists for it), and participant-authority-checked
against `FEDOS_CONVERSATION_PARTICIPANT_AUTHORITIES` — never re-deriving a
domain decision the Shell/Accessor already owns.

## 5. Response vocabulary (Phase D)

One closed shape, `FedosDesktopHostResponse<T> = {outcome:"ok",value,requestId?}
| {outcome:"error",code,message,requestId?}` — `code` is the same closed
outcome vocabulary Shell/ViewModel/Accessor already use, plus
`"unknown-command"` for a structurally invalid `dispatch()` input. Every
response is `Object.freeze`d, JSON-safe data (confirmed by a dedicated
serialization test covering every command type used in one real session).
**`dispatch()` returns the raw ViewModel action result, not a
Renderer-shaped screen model** — Phase G's own "explicit action → state →
render" separation, and this Arc's own "do not duplicate ViewModel state" /
"do not put business logic into the Host" rules, mean re-shaping data into
list/empty form a SECOND time inside `dispatch()` would duplicate exactly
what the Renderer layer (Alpha 3401-3480) already owns. A caller wanting
the shaped screen calls `render()` separately, exactly as Phase G
describes ("request a current screen model" as its own, distinct step).

## 6. IPC decision (Phase E)

Not attempted — no Electron dependency exists (§1). `FedosDesktopHostPort`
(`fedos_desktop_host_port.ts`) is deliberately framework-neutral (no
`BrowserWindow`/`ipcMain`/`ipcRenderer` reference anywhere) so a FUTURE
Electron adapter can implement it directly: a preload script would expose
exactly `start`/`stop`/`dispatch`/`render`/`status` (this port's own
public surface) via `contextBridge.exposeInMainWorld`, main-process
`ipcMain.handle` would call the SAME `FedosDesktopHostBridge` instance (or
a sibling `FedosDesktopHostPort` implementation) this Arc already wrote and
tested, and renderer code would never see a generic `invoke`/arbitrary
channel name — only this one, already-closed command union. No redesign
of anything in this Arc would be required.

## 7. Preload boundary

N/A — no Electron (§1/§6).

## 8. Renderer integration (Phase G)

`render()` aggregates all eight content renderers'
own `render()` output into one `FedosDesktopFullRenderModel` — confirmed
to call NO ViewModel action method itself (matches the Renderer layer's own
existing "reads only public getters" guarantee, Alpha 3401-3480,
unchanged). No hidden polling of any kind exists anywhere in this Arc —
every state change is caller-initiated via `dispatch()`, and `render()` is
a pure, on-demand snapshot read.

## 9. Archive/file safety (Phase H)

Only `archive-inspect` is exposed — read-only, never decrypts (Alpha
3081-3160's own unchanged guarantee), and the ONE Archive command genuinely
safe to expose without a real path-authority/file-picker story. Its
`sourcePath` is validated to reject any `".."` path segment (on either
separator) BEFORE the real `FedosConversationArchiveFileAuthority`'s own
(separate, already-real) filesystem checks are ever reached — confirmed by
a dedicated path-traversal test. `archive-export`/`preflightRestore`/
`restore` are DELIBERATELY excluded from this Arc's own command vocabulary
(§4) — they need a raw filesystem destination path plus
account-index/counterparty-key parameters, and Phase H's own "If a native
file picker is not available without adding dependencies, expose a
validated path-input host port and document the future adapter" is
exactly the right shape for a FUTURE Arc, not invented speculatively here.
No secret value is ever accepted in a command payload (no field on
`FedosContentAccessorArchiveCommand`'s `inspect` variant carries one).

## 10. Threat model

- **Untrusted renderer input** (the eventual Electron threat model this
  port anticipates): every `dispatch()` payload is treated as `unknown`
  and structurally validated before touching any ViewModel; an unknown
  `type`, wrong-typed field, oversized string, invalid participant
  authority, or path-traversal attempt all fail closed to
  `"unknown-command"` before reaching business logic.
- **No secret crosses the boundary**: no persistence port, crypto
  authority, key handle, or Master Seed reference is imported anywhere
  under `src/desktop/host_boundary/` (confirmed by grep, §Structural
  Guards below).
- **No raw Error crosses the boundary**: every `dispatch()`/`start()`/
  `stop()` path is wrapped so a genuine lower-layer exception (e.g.
  `startFedosDesktopRuntime()` throwing on a structurally invalid config)
  is converted to a closed `{outcome:"error",code:"failed",message}` —
  confirmed by a dedicated test asserting `not.toBeInstanceOf(Error)` and
  a full JSON round-trip.
- **No orphaned Runtime**: a failed `start()` never assigns
  `this.#boundary`/`this.#renderer`, so a caller can immediately retry
  with a corrected config against the SAME durable paths (confirmed by
  test).

## 11. Test matrix (Phase I)

`test/secure_runtime_alpha_3561_3640_host_bridge.test.ts` — 17 tests, real
Runtime/Shell/ViewModel/Renderer stack throughout, covering scenarios
1–3 (start/initial render/empty list), 4–6 (create Direct/updated
list/open detail), 7 (real send→reveal→reply), 8–9 (create Group/render
Membership), 10–11 (Search + a real out-of-band retention transition
removing both the Search hit and the message's own plaintext), 12
(Archive inspect, both feature-disabled and real not-found, plus a
path-traversal rejection), 13–14 (invalid/malformed commands), 15–16
(command before start/after stop, stop idempotency), 17 (5-way concurrent
creation, serialized, zero corruption), 18–19 (structurally-invalid-config
startup failure with no orphan state, and a real Shell-layer `"conflict"`
on double-start), 20 (stop waits for Runtime, verified via a real
restart + `conversation-open` durable re-read — NOT `conversations-list`,
which is a session-scoped in-memory registry per Alpha 2841-2920's own
already-documented, unchanged behavior), 21 (two independent Hosts never
leak state), 22–24 (full-session JSON-safety/no-Error/no-secret sweep),
25 (20 real, distinct conversations). Scenarios requiring Electron
(preload allowlist, forbidden channel, nodeIntegration/contextIsolation
config, real main/preload IPC) do not apply (§1/§6) and are not attempted.

## 12. Full versus partial completion

**Partial, honestly declared.** Phases B, C, D, F, G, H, I are FULLY
complete and tested against the real stack. Phase E (Electron IPC) is not
attempted — no accepted Electron dependency exists in this repository, and
this Arc's own instruction is explicit that adding one is prohibited
without authorization. The in-process `FedosDesktopHostBridge` is a
complete, real, tested substitute that implements the FULL
`FedosDesktopHostPort` contract a future Electron adapter would also
implement, unchanged.

## 13. Baseline/final comparison

**Baseline** (this exact worktree, before this Arc's own production
edits): `npm run typecheck` clean except the one pre-existing, unrelated,
already-documented failure. **Final:** identical typecheck result. Full
`npm test`: 12815 tests, 253 failing — the identical count and,
file-for-file, the identical set already confirmed pre-existing and
environment-only in every prior Arc's own completion declaration in this
lineage (fresh-worktree Cargo.toml/lib.rs raw-import artifact; missing
compiled WASM artifact; transiently, before this commit lands, the same
unrelated historical review tests that assert a clean `git status`). Zero
failures traceable to any file this Arc changed. Targeted regression
(this Arc + every prior Arc in this lineage + Archive/Search/Retention, 9
files, 126 tests) — all pass.

## 14. Structural guards (Phase J) confirmed

- `src/desktop/host_boundary/` imports ONLY `../presentation/`,
  `../renderer/`, and `../runtime/fedos_desktop_runtime_config.ts` (the
  config TYPE, not a persistence/crypto module) from the Desktop tree, plus
  narrow conversation-domain TYPES/constants already re-exported for
  command validation (`FedosConversationParticipantReference`,
  `FEDOS_CONVERSATION_PARTICIPANT_AUTHORITIES`,
  `FEDOS_CONVERSATION_DIRECT_MESSAGE_MAX_BODY_LENGTH`,
  `CreateDirectDraftCommand`/`CreatePrivateGroupDraftCommand`,
  `FedosConversationListFilter`) — confirmed by direct inspection, zero
  persistence port, crypto authority, or Runtime-internal import.
- No `conversationRuntime()`/`conversationContentAccessor()` call anywhere
  in `src/desktop/host_boundary/` — every real action goes through
  `FedosDesktopApplicationShell`/the ViewModel layer.
- No raw key/handle getter, no Retention bypass (retention is enforced
  exactly where it always was, inside the Accessor/Shell), no
  caller-supplied author override (every `sender`/`issuer` field the Host
  accepts is validated for SHAPE only — the deeper "does this participant
  actually hold Membership" check remains entirely the Shell/Accessor's
  own job, unchanged).
- No new dependency (package.json unchanged — confirmed).
- No Rust/Cargo change. `p2p/`/`.tmp_gen/` untouched.

## 15. Completion declaration

**PARTIAL COMPLETION, HONESTLY DECLARED.** The complete host abstraction
(`FedosDesktopHostPort`) and its in-process reference implementation
(`FedosDesktopHostBridge`) are real, fully tested against the real
Runtime/Shell/ViewModel/Renderer stack, and own process/window lifecycle
only — no Conversation business logic lives in the Host. Electron's own
IPC boundary (Phase E) is honestly stopped at the external dependency
decision this repository has not made.

**Recommended next Arc:** Electron Dependency and Packaging Decision
Review.
