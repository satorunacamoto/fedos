# Secure Runtime Alpha 331 — Existing Host / Entry-Point Inventory

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** This is Stage 1, the opening Stage, of the Alpha 331–340
Desktop Host Runtime Foundation Arc, following exactly the pattern
every prior Arc's own opening Stage already used (Alpha 251, 261, 271,
281, 291, 301, 311, 321).

## 1. Why now

Alpha 330 closed the Board Durable Backend Selection & Architecture
Arc with one converging finding, restated across four candidate
reviews: Board persistence has no real host to be authoritative FOR.
It recommended exactly this Arc next — a Desktop Host Runtime
Foundation Arc — because every deferred backend (SQLite, append-only
file, and a hypothetical webview-based IndexedDB) needs the SAME
missing prerequisite: a real host PROCESS that owns `DesktopApplication`
and Board together, for a long-lived local run. Before designing that
boundary, this Stage inspects what actually exists today — not what a
future host might look like.

## 2. Inventory method

Direct inspection of `package.json`, `src/index.ts`, `src/worker.ts`,
every file under `src/desktop/`, `src/runtime/create_runtime.ts`, the
Board repository/persistence layer, `tsconfig.json`, and this
repository's own prior Desktop-Arc docs (Alpha 086–140). No code
executed beyond `npm run typecheck`/`npm test` (already required by
this Arc's own Verification section, run identically to establish this
Stage's baseline). `p2p/` was not entered, read, or reclassified.

## 3. Findings, answering all twelve required questions

### 3.1 Whether a local-process entry point exists

**No.** `src/index.ts` is a pure barrel — a `.js`-suffixed re-export
list of every public building block (`nostr/*`, `ingest/*`, `thread/*`,
`query/*`, `cache/*`, `community/*`, `sign/*`, `render/*`, plus
`handleRequest`/`selectCache`/`selectVerifier` from `src/worker.ts`).
It contains no top-level executable statement, no `main()`, no
`if (require.main === module)` equivalent, and is never itself
imported by anything that runs it as a process — it is a library
surface, not an entry point.

### 3.2 Whether package.json exposes a bin

**No.** `package.json`'s own top level has no `"bin"` field of any
kind. `"private": true` and `"type": "module"` are its only
process-relevant fields besides `"scripts"`.

### 3.3 Whether any CLI exists

**No.** No file anywhere in `src/` parses `process.argv`, and no
`scripts` entry in `package.json` invokes anything beyond `tsc`,
`vitest`, and `cargo build`/`wasm-bindgen` (the `build:wasm` script,
unrelated to a Desktop CLI).

### 3.4 Whether process signals are handled

**No.** No `process.on("SIGINT" | "SIGTERM" | ...)` reference exists
anywhere in `src/`. No signal handling of any kind exists in this
repository today.

### 3.5 Whether DesktopApplication owns shutdown resources

**No.** `DesktopApplication` (`src/desktop/desktop_application.ts`,
Alpha 096–136) holds exactly one `FedosRuntimeIdentity`, one
`FedosPublicIdentityReader`, an optional public-identity
configuration, and two pieces of mutable state (`#started`,
`#currentPublicIdentity`) — no open resource, no dispose/close method,
no file handle, no socket, no timer. Its own doc comment states
directly: "NO GUI, NO Nostr/Relay connection, NO Observation
implementation of any kind exists anywhere in this file."

### 3.6 Whether BoardService has a construction factory

**Partially.** `FedosBoardService` (`src/board/repository/fedos_board_service.ts`,
Alpha 307) has a constructor with fully-defaulted parameters
(`new FedosBoardService()` wires an `InMemoryFedosBoardRepository`,
`FedosBoardSourceIndex`, and `FedosBoardIndex` automatically) — this
serves the SAME role a dedicated `createFedosBoardService()` function
would, without a separate file. There is no standalone factory
FUNCTION, but none is needed: the constructor's own defaults already
are one.

### 3.7 Whether hydration has a real caller

**No.** `hydrateFedosBoardService` (`src/board/persistence/fedos_board_hydration.ts`,
Alpha 318) is called only from `test/*.test.ts` files today — exactly
the same finding Alpha 321 §3.4 made about Board persistence as a
whole. No production entry point calls it.

### 3.8 Whether Node runtime APIs can be used without new dependencies

**Yes, narrowly.** `vitest.config.ts` sets `environment: "node"`, so
every test already runs under real Node. `tsconfig.json` carries no
`@types/node` (confirmed unchanged, Alpha 321 §3.5), so any Node API
this Arc's own Host code might reach would be formally untyped — this
Arc reaches NONE: the Host built in this Arc uses only plain
TypeScript classes, `Promise`, and the existing `DesktopApplication`/
`FedosBoardPersistence`/`FedosBoardService` surface, with zero
`node:*` import of any kind.

### 3.9 Whether src/index.ts is appropriate as a host entry point

**No.** It is a library barrel (§3.1) with a fixed, already-large
public export surface; adding host-construction/startup logic to it
would conflate "public library surface" with "process entry point" —
two different concerns this repository has always kept separate
(`src/worker.ts` is the Worker's own separate entry point, never
folded into `src/index.ts` either).

### 3.10 Whether a new host module can be tested without creating a real process

**Yes.** `FedosDesktopHostDependencies` (Alpha 334) accepts an
already-constructed `DesktopApplication` and `FedosBoardPersistence`
directly — a test can inject an `InMemoryFedosBoardPersistence`
pre-populated with fixtures and a real `DesktopApplication` (built
with a custom, throwing or succeeding `FedosPublicIdentityReader`,
Alpha 101) with zero process, network, or filesystem involvement,
exactly like every existing Board/Desktop test in this repository
already does.

### 3.11 Which existing patterns are reusable

`createDesktopApplication()`'s (Alpha 099) construct-only, no-startup
factory discipline; `DesktopApplication`'s own `#started`
throw-on-second-`start()` guard (Alpha 098); `hydrateFedosBoardService`'s
own fail-closed, no-partial-service contract (Alpha 318, reused
UNCHANGED — this Arc calls it, never reimplements it); and the
closed-string-union state-token convention already used by
`FedosBoardRegistrationResult` (Alpha 307) and
`FedosBoardPersistenceWriteResult` (Alpha 315).

### 3.12 Which environment assumptions remain unresolved

Whether the eventual real process entry point is a plain Node script,
a packaged executable, or something else; whether SQLite or an
append-only file (Alpha 329's own two local-Node-capable candidates)
is selected once a real Host caller exists; and whether Board
Ontology Projection (explicitly out of scope for this Arc) ever
becomes a Host-owned concern or stays a separate, downstream adapter.
None of these are resolved by this Arc — see Alpha 338 (entry-point
review) and Alpha 340 §5 (next-Arc recommendation).

## 4. Conclusion

No local-process entry point, `bin` field, CLI, or signal handling
exists anywhere in this repository today. `DesktopApplication` owns no
disposable resource. `FedosBoardService`'s defaulted constructor
already serves as its own construction factory. Hydration has no real
caller. Node APIs are reachable without a new dependency, but this
Arc's own Host code reaches none. `src/index.ts` is the wrong home for
Host logic; a new, dedicated, fully test-injectable module is both
possible and — per Alpha 332 — the adopted approach.

## 5. See also

- `docs/secure_runtime_alpha_330_durable_backend_selection_completion.md`
- `docs/secure_runtime_alpha_321_board_deployment_runtime_inventory.md`
- `docs/secure_runtime_alpha_099_desktop_factory.md`
- `docs/secure_runtime_alpha_318_board_hydration_index_rebuild.md`
