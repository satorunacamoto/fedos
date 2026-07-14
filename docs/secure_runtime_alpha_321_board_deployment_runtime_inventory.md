# Secure Runtime Alpha 321 — Board Deployment and Runtime Inventory

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** This is Stage 1, the opening Stage, of the Alpha 321–330 Board
Durable Backend Selection & Architecture Arc, following exactly the
pattern every prior Board-layer Arc's own opening Stage already used
(Alpha 251, 261, 271, 281, 291, 301, 311).

## 1. Why now

Alpha 320 closed the Canonical Board Persistence Boundary Arc and
recommended exactly this Arc next: a Board Durable Backend Selection &
Review Arc, because `FedosBoardPersistence` (Alpha 315) was
deliberately built backend-neutral so selection could happen in its own,
properly-scoped Arc. Before comparing SQLite/IndexedDB/D1/append-only
file at all, this Stage inspects what actually exists and actually runs
today — not what the product's README aspires to.

## 2. Inventory method

Direct inspection of `package.json`, `tsconfig.json`, `vitest.config.ts`,
`src/worker.ts`, `src/desktop/*`, `src/runtime/*storage*`,
`src/runtime/fedos_windows_dpapi_helper.ts`, `src/indexer/d1_index.ts`,
`src/community/d1_directory.ts`, `schema/*.sql`, the repository root for
a `wrangler.toml`/deployment manifest, and `README.md`'s own stated
architecture. No code executed beyond the project's own existing
`npm run typecheck`/`npm test`/`cargo check` (already required by this
Arc's own Verification section, run identically to establish this
Stage's baseline). `p2p/` was not entered, read, or reclassified.

## 3. Findings, answering all twelve required questions

### 3.1 Which execution environments currently exist

Exactly two REAL ones, plus one that is typed-for but not wired:

- **Cloudflare Workers** — `src/worker.ts` exports a `{ fetch(request,
  env) }` handler; `tsconfig.json` includes `@cloudflare/workers-types`
  and `lib: ["ES2022", "WebWorker"]` (no `DOM`, no `Node`). This is the
  one environment this repository is actually typed and structured to
  deploy to.
- **Node.js** — `vitest.config.ts` sets `environment: "node"`; every
  `npm test`/`npm run typecheck` run happens under Node. Node is also
  reached, narrowly, from application code: `fedos_windows_dpapi_helper.ts`
  imports `node:child_process`'s `execFile` behind a
  `// @ts-expect-error` (this project's own `tsconfig.json` has no
  `@types/node`, so Node APIs are reached but never formally typed).
- **Browser** — NOT present. No `DOM` lib, no HTML entry point, no
  bundler config for a client, no `window`/`document` reference anywhere
  in `src/`. `src/render/html.ts` produces HTML **strings** returned by
  the Worker's own `fetch` handler — server-rendered markup, not a
  client-side application running IN a browser.

### 3.2 Which environment is primary

**Cloudflare Workers**, per this repository's own stated architecture
(`README.md`: "targeting Cloudflare Workers + D1 + KV + R2") and its own
`src/worker.ts` default export being the only real, request-serving
entry point in this repository. Node is real, but only as the
dev/test harness — no Node process anywhere in `src/` serves a request,
opens a socket, or is a packaged executable a user would run directly.

### 3.3 Whether an actual Desktop shell exists

**No.** `DesktopApplication` (`src/desktop/desktop_application.ts`) is a
plain TypeScript class: one `FedosRuntimeIdentity` field, a
`FedosPublicIdentityReader`, and four methods (`bootstrap`, `start`,
`currentIdentity`, `readPublicIdentity`/`refreshPublicIdentity`). Its own
doc comment states the guardrail directly: "NO GUI, NO Nostr/Relay
connection, NO Observation implementation of any kind exists anywhere in
this file." There is no Electron, Tauri, or native window/process
packaging anywhere in `package.json`, no `main`/`bin` entry pointing at a
Desktop executable, and no OS-level application lifecycle (window
creation, menu, tray, IPC) anywhere in this repository. "Desktop" in this
codebase names an **identity-bootstrap concern**, not a running host
application — there is nothing today a user could double-click, and
nothing that owns a filesystem, a window, or a process lifecycle beyond
constructing one object and awaiting two async calls.

### 3.4 Whether Board code currently runs in Browser, Node, Worker, or none

**Node only — and only under the test suite.** `src/worker.ts` carries
zero reference to `src/board/*` or `src/board/persistence/*` (confirmed
structurally by Alpha 320's own regression test #7, re-confirmed by
direct inspection here). `DesktopApplication`/`create_desktop_application.ts`
carry zero reference to Board of any kind. No browser entry point exists
at all. The **only** place any `FedosBoardService`/`FedosBoardPersistence`/
`hydrateFedosBoardService` code actually executes today is inside
`test/*.test.ts` files, run by vitest under Node. Board has, as of this
Stage, **no wiring into any production runtime entry point whatsoever** —
not the Worker's `fetch` handler, not `DesktopApplication`, not a
browser. This is a stronger and more important finding than "no Desktop
shell exists" alone: **no real caller of Board persistence exists in any
production runtime today**, Worker included.

### 3.5 Existing database dependencies

`package.json`'s own `dependencies` are exactly two: `@noble/curves` and
`@noble/hashes` — both pure cryptography, neither a database/ORM/SQL
client of any kind. No SQL driver, no IndexedDB wrapper, no filesystem
database package exists in `dependencies` or `devDependencies`.

### 3.6 Existing D1 bindings

**Yes, real ones.** `src/worker.ts`'s own `Env` interface declares
`NOSTR_SPACE_DB?: D1LikeDatabase`, consumed by `D1SpaceDirectory`
(`src/community/d1_directory.ts`) for space/member lookup and by
`D1MetadataIndex` (`src/indexer/d1_index.ts`) for event/thread/space-ref
indexing — both real, prepared-statement-bound (never string-interpolated)
implementations, backed by `schema/d1_index.sql` and
`schema/d1_space_directory.sql`. **However**, no `wrangler.toml` or
equivalent Cloudflare deployment manifest exists anywhere in this
repository — these bindings are typed and consumed in code, but this
checkout carries no in-repo record of an actual live deployment
configuring `NOSTR_SPACE_DB`.

### 3.7 Existing IndexedDB wrappers

**None.** No file anywhere in `src/` references `indexedDB`, `IDBDatabase`,
or any IndexedDB-adjacent type or wrapper library.

### 3.8 Existing filesystem abstractions

**None for Board or general application data.** The only filesystem-
adjacent code in this repository is `fedos_windows_dpapi_helper.ts`
shelling out to `powershell.exe` via `node:child_process.execFile` — it
reads/writes the child process's stdin/stdout only, never touches a file
on disk itself, and the ciphertext it protects is held in an in-process
`Map` (`WindowsDpapiStorageBackend`), not persisted to a file. No
`fs`/`fs/promises` reference exists anywhere in `src/`.

### 3.9 Whether SQLite is currently available

**No.** Zero SQLite dependency (native or WASM) exists in `package.json`,
`packages/fedos-core-rust/Cargo.toml`, or anywhere in `src/`. No
`better-sqlite3`, no `node:sqlite`, no `sql.js` reference of any kind.

### 3.10 Whether one backend can honestly serve every environment

**No.** The Worker (V8 isolate) has no filesystem and no native module
support — SQLite and a filesystem-backed append-only file are both
unreachable there. Node has a filesystem and could reach SQLite (with a
new, currently-absent dependency), but nothing in Node is a persistent,
long-running server process — it is the test/dev harness only. No
browser exists at all, so IndexedDB has no host to run in today. Even
`FedosBoardPersistence`'s own synchronous port (Alpha 315) would need a
**separate async port** (already anticipated by that Stage's own design
doc §6) before D1 or IndexedDB — both inherently asynchronous — could
implement it at all.

### 3.11 Whether backend selection must be environment-specific

**Yes**, directly following from §3.10: no single physical backend
reaches every environment that exists (Worker, Node) or might exist
(Desktop, browser) without contradiction. The persistence PORT
(`FedosBoardPersistence`) can and should stay environment-neutral;
the concrete backend behind it cannot.

### 3.12 Whether any backend is already operationally proven in this repository

**D1, but for a different, non-authoritative concern, and without any
in-repo deployment record.** `D1MetadataIndex`/`D1SpaceDirectory` are
real, working, prepared-statement-bound Cloudflare D1 implementations,
already wired through a real `Env` binding shape — the strongest
"proven code path" of any candidate. But (a) they solve a rebuildable
discovery-index problem, explicitly documented as non-authoritative
(`D1MetadataIndex`'s own doc comment: "NOT an audit log or an
authoritative/durable record"), never Board's canonical state, and
(b) no `wrangler.toml`/migrations directory exists in this checkout, so
even this "proven" backend has never been deployed FROM this repository
as far as its own source can attest. `InMemoryFedosBoardPersistence`
(Alpha 316) is trivially "proven" (it ships today), but it is not
durable and was never a candidate for this Stage's question.

## 4. Conclusion

Two real execution environments exist (Cloudflare Workers, Node); no
browser and no real Desktop shell exist. D1 is the most operationally
proven backend technology in this repository, but for an unrelated,
non-authoritative concern, with no in-repo deployment manifest. Most
importantly: **Board persistence has no real caller in any production
runtime today** — not the Worker, not a Desktop process, not a browser.
Every subsequent Stage in this Arc must be read against this finding:
selecting a durable backend for an environment Board does not yet reach
would be selecting against an imaginary caller, which Alpha 329's own
Decision Constraints explicitly forbid.

## 5. See also

- `docs/secure_runtime_alpha_320_board_persistence_completion.md`
- `docs/secure_runtime_alpha_311_existing_board_persistence_inventory.md`
- `docs/secure_runtime_alpha_301_existing_board_repository_inventory.md`
- `docs/secure_runtime_alpha_021_storage_backend_abstraction.md`
- `docs/secure_runtime_alpha_023_windows_dpapi_storage_backend.md`
