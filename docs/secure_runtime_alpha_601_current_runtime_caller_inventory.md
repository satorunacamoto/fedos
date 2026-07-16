# Secure Runtime Alpha 601 — Current Runtime Caller Inventory

Stage 1 of the Alpha 601–620 Desktop Local Runtime Entry Point & Publish
Pipeline Ownership Arc. Investigation only — no code changed this
Stage.

## 1. Entry points that actually exist

- `src/index.ts` — a pure barrel re-export module (Nostr/Ingest/Thread/
  Query/Cache/Community/Sign/Render + `handleRequest`/`Env` from
  `worker.js`). Importing it has NO side effect and constructs nothing
  — confirmed by direct read, no top-level statement beyond `export`.
  It does NOT reference `FedosDesktopHost`/`createFedosDesktopHost`
  anywhere.
- `src/worker.ts` — the ONE real Cloudflare Worker entry
  (`handleRequest(request, env)`), confirmed a separate execution
  environment from `FedosDesktopHost` (no import of `src/desktop/host/*`
  anywhere in `worker.ts`, confirmed by grep).
- **No Node entry point exists anywhere.** No `bin` field in
  `package.json`, no `src/main.ts`/`src/cli.ts`, no shebang line found
  anywhere in `src/`.

## 2. Node-executable build output

**None exists.** `tsconfig.json`'s own `compilerOptions.noEmit` is
`true`; `package.json`'s own `scripts` contains no `build`/`compile`
entry. `moduleResolution: "Bundler"` + every relative import already
written with an explicit `.js` extension (this repository's own
established convention, confirmed across dozens of files) means: this
source CANNOT run directly under plain `node` today — verified by
direct execution (`node` on a `.ts` file importing a sibling `.js`
specifier fails with `ERR_MODULE_NOT_FOUND`, since only the `.ts`
sibling exists on disk; Node's own native TypeScript support, present
in this environment's Node v24, strips TS syntax but performs no
`.js`-to-`.ts` extension remapping). **`tsc` itself, however, already
resolves and emits correctly** — confirmed by an actual, isolated
`tsc -p <scoped-config> --noEmit false --outDir <dir>` run against a
real file (`fedos_desktop_host.ts`) this Stage performed: real,
directly `node`-importable `.js` output was produced, with every
`.js`-suffixed relative import already valid Node ESM as-emitted. See
`docs/secure_runtime_alpha_605_executable_entry_point_decision.md`.

## 3. `FedosDesktopHost`'s own required dependencies

`FedosDesktopHostDependencies`: `desktopApplication` (required, no
default at the Host's own constructor — `createFedosDesktopHost()`
defaults it), `boardPersistence` (required, same), `outboxPersistence`/
`publisher`/`observationRepository`/`deliveryIntervalMs` (all optional
at the Host's own constructor, each independently defaulted — Alpha
419/507). `createFedosDesktopHost()` (Alpha 334) defaults
`desktopApplication` to `createDesktopApplication()` (resolves a
`NullNostrPublicIdentitySource` by default — confirmed no network, no
env read, no filesystem access) and `boardPersistence` to
`InMemoryFedosBoardPersistence` — **explicitly, deliberately in-memory
by that Stage's own design** (its own doc: "NO durable backend is
selected here"). `outboxPersistence` defaults, INSIDE `FedosDesktopHost`
itself, to `InMemoryFedosBoardOutboxPersistence`; `publisher` defaults
to `MockFedosBoardOutboxPublisher` (Alpha 507) — a SILENT mock
fallback this Arc's own runtime must not inherit unnoticed (Alpha 610).
`observationRepository` defaults to
`FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence())`.

## 4. Path authority — undecided, confirmed nowhere in this repository today

No file anywhere selects a filesystem path for ANY durable backend.
`AppendOnlyFedosBoardPersistence`/`AppendOnlyFedosBoardOutboxPersistence`
(both already exist, `node:fs`-only, no new dependency) each take a
caller-supplied `filePath: string` with NO default — their own HARD
GUARDRAILS explicitly forbid selecting one internally. See Alpha 604.

## 5. Delivery auto-start

`FedosDesktopHost.startDelivery()` is a SEPARATE call from `start()` —
this repository's own established, unchanged decision (Alpha 501–520
Arc: "Host起動とdelivery起動は分離"). This Arc inherits, does not
revisit, that decision (Alpha 611).

## 6. Shutdown API

`FedosDesktopHost.stop()` (throws if not `"ready"`, non-idempotent by
design) and `stopDelivery()` (throws if delivery not running) both
already exist, unchanged, with the correct internal ordering already
enforced (Alpha 505/506/564). This Arc's own runtime must respect, not
duplicate, this ordering (Alpha 612).

## 7. Signal handling precedent

**None exists anywhere in `src/`** — confirmed by grep (`process.on(`,
`SIGINT`, `SIGTERM`, `process.exit(` all absent). `fedos_desktop_host.ts`'s
own HARD GUARDRAILS explicitly state Host itself must never call
`process.exit()` or register a signal handler — this Arc's own signal
boundary (Alpha 613) is genuinely new work, not a rewiring of anything
existing.

## 8. Executable without a `package.json` change?

**No.** No `build`/`start` script exists; `noEmit: true` blocks any
`tsc` invocation from producing output without an override. A working
executable entry point requires, at minimum, one new build-capable
tsconfig and one new npm script — decided in Alpha 605.

## 9. Exact RIPPLE scope

Zero existing files require modification for this Arc's own core
objective — `FedosDesktopHost`/`FedosPublishScheduler`/
`FedosHostDeliveryController`/`createFedosDesktopHost` are all usable,
UNCHANGED, exactly as their own existing constructors already allow.
The one exception: `FedosDeliveryObservationPersistence` has only ONE
implementation, `InMemoryFedosDeliveryObservationPersistence` —
confirmed by repository-wide search — meaning a durable delivery
option requires ONE new file (Alpha 609), never a modification to any
existing one.

## See also

- `docs/secure_runtime_alpha_334_desktop_host_dependency_assembly.md`
- `docs/secure_runtime_alpha_418_append_only_durable_outbox.md`
- `docs/secure_runtime_alpha_602_local_runtime_responsibility_decision.md`
