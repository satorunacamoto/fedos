# Secure Runtime Alpha 334 — Desktop Host Dependency Assembly

**Status: this Stage implements code.** Stage 4 of the Alpha 331–340
Desktop Host Runtime Foundation Arc. Adds
`src/desktop/host/fedos_desktop_host.ts` (the
`FedosDesktopHostDependencies` interface and the `FedosDesktopHost`
constructor) and `src/desktop/host/create_fedos_desktop_host.ts`
(`createFedosDesktopHost`).

## 1. Why now

Alpha 333 fixed the state vocabulary. Before `start()`/`stop()` can be
implemented (Alpha 335/337), this Stage fixes HOW a `FedosDesktopHost`
receives its two dependencies — construction only, no startup, no
global singleton, matching `createDesktopApplication()`'s own Alpha
099 discipline exactly.

## 2. The dependency interface

```ts
export interface FedosDesktopHostDependencies {
  readonly desktopApplication: DesktopApplication;
  readonly boardPersistence: FedosBoardPersistence;
}
```

`FedosDesktopHost`'s own constructor takes exactly one value of this
shape and performs ONLY field assignment plus initializing
`#state = "constructed"` — no hydration, no `DesktopApplication.start()`
call, no I/O of any kind.

## 3. The factory: what it constructs, and what it does not

```ts
export function createFedosDesktopHost(
  dependencies: Partial<FedosDesktopHostDependencies> = {},
): FedosDesktopHost
```

**Decision: the factory constructs BOTH dependencies by default, and
accepts an override for EITHER.** Compared against the three narrower
alternatives named by this Arc's own Objective (DesktopApplication
only, Persistence only, or neither):

- Constructing neither would force every caller — including this Arc's
  own end-to-end verification (Alpha 339) — to hand-assemble both
  dependencies every time, duplicating `createDesktopApplication()`'s
  own default resolution logic at every call site.
- Constructing only one of the two leaves the other's default
  unspecified, which this Stage is explicitly chartered to fix (the
  Objective's own "keep tests able to inject fakes" requirement is
  about OVERRIDING a default, not about the factory omitting one).
- Constructing both, each independently overridable via
  `Partial<FedosDesktopHostDependencies>`, matches
  `createDesktopApplication()`'s own optional-parameter shape (Alpha
  109) and keeps every test able to inject a fake/throwing
  `DesktopApplication` and/or a pre-populated `FedosBoardPersistence`
  without touching the other.

`desktopApplication` defaults to `createDesktopApplication()`'s own
UNMODIFIED default construction (Alpha 099) — the exact same Nostr
public-identity Reader resolution that function has used since Alpha
103, untouched by this Arc. `boardPersistence` defaults to a FRESH
`InMemoryFedosBoardPersistence()` (Alpha 316) — this Arc's own
explicitly-documented in-memory-only default; Alpha 329's Option E
durable-backend deferral stands completely unmodified, and this
factory selects NO durable backend of any kind.

## 4. Guardrails confirmed against the actual source

- **Construction only** — `createFedosDesktopHost` calls no method on
  either dependency beyond the `new FedosDesktopHost({...})`
  constructor call itself; it never calls `.start()` on the
  `DesktopApplication` it builds or resolves, and never calls
  `hydrateFedosBoardService` on the `boardPersistence` it builds or
  resolves.
- **No global singleton** — every call to `createFedosDesktopHost()`
  (with no override) constructs a brand-new `DesktopApplication` and a
  brand-new `InMemoryFedosBoardPersistence`; no module-level `let`/
  `const` instance is shared across calls (confirmed: Alpha 339 §
  "independent instances do not share state").
- **No module-load side effect** — this file contains no top-level
  statement beyond `import`s and the one function declaration.
- **No environment-variable read** — no `process.env` reference of any
  kind; Runtime Mode Authority
  (`src/runtime/fedos_runtime_mode_authority.ts`) is never duplicated
  or bypassed.
- **No filesystem path selection, no `p2p/` dependency** — confirmed
  by direct inspection; neither file imports `node:fs`, `node:path`,
  or anything under `p2p/`.

## 5. Conclusion

`createFedosDesktopHost()` assembles both dependencies by default —
reusing `createDesktopApplication()`'s own unmodified factory and a
fresh in-memory persistence instance — while remaining fully
overridable for tests, with zero async work, zero singleton state, and
zero environment/filesystem/`p2p` coupling of any kind.

## 6. See also

- `docs/secure_runtime_alpha_333_desktop_host_state_model.md`
- `docs/secure_runtime_alpha_099_desktop_factory.md`
- `docs/secure_runtime_alpha_109_desktop_wiring.md`
- `docs/secure_runtime_alpha_316_in_memory_board_persistence.md`
- `docs/secure_runtime_alpha_329_first_durable_backend_selection.md`
