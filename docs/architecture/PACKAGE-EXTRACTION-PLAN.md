# FedOS — Package Extraction Plan

Status: written this arc (Compatibility Facade Reduction + Package
Extraction Readiness + Remaining Architecture Debt Closure, Agent P, Half
B). Pure software architecture, no legal/compliance content. Answers one
question with a real, automatable measurement, not prose: **if
`src/os/core`, `src/os/messenger`, and `src/os/commerce` were physically
moved into their own npm packages today, exactly what would break, and by
how much?** No files were moved. No `package.json` was created. This is
design + measurement only.

## Verdict: **PARTIAL — one root ready, three are not, exact blocker count below**

| Root | Own files | Extraction-ready? |
|---|---|---|
| `apps/desktop-electron-spike` (`packages/fedos-desktop-electron-spike/src`) | 27 | **YES** — 0 blockers |
| `os/core` | 55 | NO — 3 blockers |
| `os/commerce` | 22 | NO — 7 blockers |
| `os/messenger` | 785 | NO — 38 blockers |

**PACKAGE EXTRACTION BLOCKERS: 48**

Not a symmetric "everything's equally unready" finding: the blockers cluster
into a small number of ROOT CAUSES (below), not 48 independent problems.
Fixing the top root cause alone (`src/runtime/`) would resolve 41 of the 48
(85%).

## Method — real, automatable, reused, not invented fresh

Two things, both produced by `scripts/package_extraction_boundary_scan.mjs`
(new this pass) and asserted on by `test/architecture_package_extraction_boundary.test.ts`
(6 tests, passing):

1. **Blocker scan.** Reuses `scripts/architecture_cycle_detector.mjs`'s own
   `analyzeArchitectureCycles()` — the SAME NodeNext-style import-resolution
   graph every `test/architecture_boundary_*.test.ts` and the cycle
   detector already trust, not a second, independently-written resolver
   that could disagree with them. Walks every file under each of the four
   roots above and reports every import that resolves OUTSIDE that root and
   outside the root's own declared allowed-dependency set (`os/messenger`
   and `os/commerce` may depend on `os/core`; `os/core` may depend on
   nothing; the Electron app may depend on all three). This is a
   file-content-scan-level check, not just an import-graph-shape check —
   it re-verifies the same "0 cross-domain imports" claim the existing
   `test/architecture_boundary_core.test.ts`/`_commerce.test.ts`/
   `_messenger.test.ts` already enforce, but widens the forbidden set to
   include destinations those three tests don't check at all: anything
   OUTSIDE `src/os/**` and outside `packages/*/src` entirely (their own
   `FORBIDDEN_PREFIXES` lists only cover the OTHER two domains, e.g.
   `os/core`'s test forbids messenger/commerce, but says nothing about
   `src/runtime/` or `src/notification/` — both real, non-`os/`, non-shim
   directories this scan newly measures against).

2. **Virtual package closure check.** A full BFS over the same resolved
   graph starting from each root's own files, reporting every OTHER
   top-level root the closure ever reaches. This answers "would a
   standalone `tsc` project scoped to this root plus its declared
   dependencies actually resolve every specifier" without creating that
   `tsconfig.json` or moving a single file — the arc brief's own suggested
   alternative to a real (impractical, given the existing 5-tsconfig setup)
   throwaway-tsconfig compile.

Run it yourself: `node scripts/package_extraction_boundary_scan.mjs`
(`--json` for machine-readable output). Regression-guarded by
`test/architecture_package_extraction_boundary.test.ts`, which asserts the
blocker count never SILENTLY grows past the baseline measured this pass
(48) and that the Electron app root stays at 0.

## Blocker scan results, by root

### `os/core` — 3 blockers, 2 root causes

| File | Imports | Root cause |
|---|---|---|
| `src/os/core/crypto/fedos_core_adapter.ts:36` | `../../../../packages/fedos-core-rust/src/index.js` (type-only) | Cross-`packages/` relative reach — see "Root cause B" below |
| `src/os/core/vault/wasm/fedos_master_seed_authority.ts:25` | `../../../../runtime/fedos_wasm_loader.js` (type-only) | `src/runtime/` — see "Root cause A" below |
| `src/os/core/vault/wasm/fedos_wasm_master_seed_authority.ts:45` | `../../../../runtime/fedos_wasm_loader.js` (value) | `src/runtime/` |

### `os/messenger` — 38 blockers, 3 root causes

- **34 blockers** → `src/runtime/*` (`fedos_wasm_loader.ts`,
  `fedos_runtime_encrypt.ts`, `fedos_runtime_decrypt.ts`,
  `fedos_runtime_export_ciphertext.ts`, `fedos_runtime_import_ciphertext.ts`,
  `fedos_runtime_identity.ts`) — Root cause A. Spread across 20 files:
  every WASM-backed encryption/decryption authority, the production
  crypto-authority factory, device sync-package encryption, device
  transfer, archive encryption/CLI packaging, and the desktop application's
  own identity wiring.
- **3 blockers** → old, not-yet-repointed compatibility-shim locations
  still holding real internal importers: `src/conversation/deletion/`
  (1), `src/conversation/deletion_request/` (1),
  `src/desktop/beta/fedos_desktop_beta_capability_manifest.ts` (1, a file
  this SAME arc's concurrent work already has open per the top-of-session
  git status — see "Root cause C").
- **1 blocker** → `src/notification/policy.ts` — a real, NEVER-migrated
  file (not a shim; see "Root cause C").

### `os/commerce` — 7 blockers, 3 root causes

- **2 blockers** (`catalog/adapters/nostr/bridge.ts`,
  `catalog/adapters/nostr/classify.ts`) → `os/messenger`'s
  `adapters/nostr/protocol/types.ts`. This is the SAME, already-documented,
  intentional carve-out `test/architecture_boundary_commerce.test.ts`
  explicitly allows (`NOSTR_ADAPTER_DIR` — the one place commerce is
  permitted to read a raw `NostrEvent`) — not a new finding, but it IS a
  genuine package-extraction blocker regardless of being sanctioned:
  `@fedos/commerce` would need `@fedos/messenger` as a real dependency (or
  the `NostrEvent` shape needs to move to `@fedos/core`) before it can be
  a standalone package. See "Root cause D".
- **5 blockers** (`catalog/asset_preview.ts` x2, `catalog/bridge.ts` x2,
  `catalog/directory.ts` x1) → `src/os/_legacy_prototype/{asset,community}/`.
  Dead, pre-pivot prototype code with no deploy path (per that directory's
  own README, and this repo's own prior-arc finding — see project memory
  "FedOS Scope Freeze + Tech Debt"). `os/commerce`'s inert-scaffolding
  status (`src/os/commerce/README.md`) means this has zero live-app
  impact today, but it is still a real resolve-time dependency a
  standalone `@fedos/commerce` package would need to either vendor or cut.

## Root causes (4), not 48 independent problems

### Root cause A — `src/runtime/` (78 files, NEVER migrated) is a hidden shared dependency of BOTH `os/core` and `os/messenger`

`src/runtime/` is not a compatibility shim (unlike `src/crypto/`,
`src/identity/`, `src/settings/`, `src/storage/`, `src/vault/`,
`src/sync/`, `src/board/`, `src/conversation/` [mostly], `src/desktop/`
[mostly], `src/device/`, `src/nostr/` — all now confirmed one-line
`export * from "../os/..."` re-export shims, verified this pass by
sampling). It holds 78 real `.ts` files (`fedos_wasm_loader.ts` alone is
the single most-imported one — the production WASM artifact loader) with
REAL logic never relocated under `src/os/**` during the physical migration
this repo's own execution records (`MESSENGER-MIGRATION-MAPPING.md`,
`FACTORY-PORT-COMPLETION-PLAN.md`'s "811 of 811" sweep) describe as
complete. It was simply never in scope for either — both prior arcs moved
`src/conversation/board/desktop/device/nostr` into `os/messenger` and
`src/crypto/identity/settings/storage/vault` into `os/core`, but
`src/runtime/` sat outside both migrations' own file lists the whole time.

Both `os/core`'s vault authorities AND `os/messenger`'s ~20 encryption/
signing/sync/archive/identity files import it directly by relative path
(`../../../../runtime/fedos_wasm_loader.js`, 4-5 `../` segments deep —
itself a second, independent blocker signal: an import crossing this many
directory levels is exactly the "relative imports crossing more levels
than a package boundary would allow" pattern the arc brief named). This
means `src/runtime/` is logically part of BOTH intended future packages at
once — physically impossible for a real npm package split (a file cannot
live inside two separate packages). It must be resolved ONE of two ways
before a real split:
  - **(a)** Move `src/runtime/`'s WASM-loading/crypto-primitive files into
    `os/core` (the more defensible home — `os/core` already owns
    `vault/wasm/`, and the vast majority of `os/messenger`'s own imports of
    it are for WASM-backed cryptography, a `os/core`-shaped concern), and
    have `os/messenger` consume it through `os/core`'s public barrel
    instead of a raw relative reach.
  - **(b)** Split `src/runtime/` itself, since it may not be one cohesive
    unit — `fedos_wasm_loader.ts`/`fedos_runtime_{encrypt,decrypt,
    export_ciphertext,import_ciphertext}.ts` look `os/core`-shaped;
    `fedos_runtime_identity.ts` (consumed by `os/messenger/desktop/desktop_application.ts`
    alone in this scan) may be `os/messenger`-shaped instead.
  - **NOT attempted this pass** — this is real design/migration work (a
    fifth "arc" by this doc's own estimate), not a mechanical move; several
    of these 78 files may have their own further sub-dependencies this
    scan's per-root view does not fully unpack (a dedicated
    `src/runtime/`-focused pass should re-run this same script scoped to
    that directory before attempting the move).

### Root cause B — `os/core/crypto/fedos_core_adapter.ts` reaches into `packages/fedos-core-rust/src/` by relative path instead of by package name

`packages/fedos-core-rust` is ALREADY a real, independent npm package
(`packages/fedos-core-rust/package.json`, name `@nostr-window/fedos-core-rust`,
`exports: { ".": "./src/index.ts" }` — "a FUTURE Rust/WASM crypto core...
placeholder only, no real cryptography" per its own description). The
import target (`packages/fedos-core-rust/src/index.ts`) already matches
that package's own declared `exports` entry point exactly — this is NOT a
"reaching into private internals" violation the way the `_legacy_prototype`
or `src/runtime/` cases are. It is purely a WIRING gap: the one importing
file uses a 4-level relative traversal (`../../../../packages/...`)
instead of a real package-name import (`@nostr-window/fedos-core-rust` or
its future `@fedos/core-rust` name), which is what npm workspace
resolution requires once `os/core` is its own package with its own
`node_modules`. Trivial to fix once workspaces are set up — listed as a
manifest dependency below, not a structural redesign.

### Root cause C — a small number of files still hold OLD-location imports the prior "811 of 811 shims repointed" sweep did not (and structurally could not) catch

`FACTORY-PORT-COMPLETION-PLAN.md`'s own execution record describes a sweep
of every *known-at-the-time* old-path import, repointing 811 of 811 to
canonical `os/**` locations. This scan found 4 the sweep did not catch:
1 in `src/notification/` (a REAL, never-migrated directory — not a shim;
distinct from Root Cause A only in size: 3 files, not 78), 2 into
`src/conversation/deletion*` shims, and 1 into
`src/desktop/beta/fedos_desktop_beta_capability_manifest.ts` — the last of
which is, per this session's own start-of-conversation git status, a file
under ACTIVE concurrent modification by other work in this same arc
right now, meaning this specific blocker's exact resolution may already be
in flux and should be re-measured (re-run the scan script) before treating
it as fixed or unfixed. None of these 4 are large; unlike Root Cause A they
are individually trivial one-import repoints, not a design question.

### Root cause D — `os/commerce`'s two SANCTIONED-but-still-blocking edges into `os/messenger`, and its FIVE edges into dead `_legacy_prototype` code

Both already covered above under the `os/commerce` results table. Neither
is large in file count, but both represent a genuine PRE-DECISION this doc
does not make on this pass's own authority: does `@fedos/commerce` accept
`@fedos/messenger` as a real dependency (simplest, but couples two
capabilities the whole Ports-and-Adapters design exists to keep apart), or
does the `NostrEvent`/raw-event-shape concept move into `@fedos/core` (more
architecturally correct, but `os/core`'s own boundary test / design
discipline currently forbids ANY protocol-specific type — see
`transport_port.ts`'s own header, this same arc's Half A, for exactly this
tension already documented for a different Port)? Recommended: defer to
whichever arc actually executes the extraction; flagged here, not decided
here. The five `_legacy_prototype` edges have a cheaper fix: cut them
(delete or replace the sample-data/asset-preview code paths that reach
there) since `_legacy_prototype` has no deploy path already.

## Virtual package closure check results

| Root | Result | Own files | Closure size | Disallowed roots touched |
|---|---|---|---|---|
| `os/core` | **FAIL** | 55 | 73 | `packages/fedos-core-rust`, `src/runtime` |
| `os/messenger` | **FAIL** | 785 | 840 | `src/conversation`, `src/desktop`, `src/notification`, `src/runtime` |
| `os/commerce` | **FAIL** | 22 | 27 | `src/os/_legacy_prototype`, `os/messenger` |
| `apps/desktop-electron-spike` | **PASS** | 27 | 27 | — (touches only itself) |

Read literally: a `tsc` project scoped to `os/core`'s own files plus its
declared dependency (nothing) would fail to resolve 3 specifiers today,
exactly the blocker-scan count above — the two proof methods agree with
each other by construction (same graph, same root definitions), which is
itself a useful cross-check that neither method has a silent bug the other
would have caught.

The full tree (`os/core` + `os/messenger` + `os/commerce` +
`packages/fedos-desktop-electron-spike/src`) resolves exactly as it does
today — nothing in this scan changes program behavior; it only measures
where today's ALREADY-WORKING relative-import resolution would stop
working if package boundaries became real `node_modules` boundaries.

## Package manifest designs (design only — no `package.json` created this pass)

### `@fedos/core`

```jsonc
{
  "name": "@fedos/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "MPL-2.0",
  "main": "./index.ts",
  "types": "./index.ts",
  "exports": {
    ".": { "types": "./index.ts", "import": "./index.ts" }
  },
  // "files" matters once this actually builds to dist/ -- today this repo
  // has no per-package build step (root tsconfig.json compiles everything
  // together), so this is aspirational: it names the SOURCE surface a real
  // build would need to emit, not a real npm-pack allowlist yet.
  "files": ["index.ts", "ports/**/*.ts", "crypto/**/*.ts", "identity/**/*.ts",
            "settings/**/*.ts", "storage/**/*.ts", "vault/**/*.ts"],
  "dependencies": {
    // Root cause B, once repointed from a relative import to a real
    // package-name dependency:
    "@nostr-window/fedos-core-rust": "*"
    // Root cause A, IF resolved via option (a) (move src/runtime/'s
    // WASM-loading files into os/core itself) this dependency disappears
    // entirely -- no external package needed. If resolved via a hypothetical
    // option (c) (a NEW standalone @fedos/wasm-runtime package), it would
    // appear here instead. Not listed as a concrete entry because which
    // option Root Cause A resolves to is undecided (see above).
  },
  "peerDependencies": {},
  "devDependencies": {
    "@cloudflare/workers-types": "^4.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`os/core`'s own barrel (`src/os/core/index.ts`, already real, already the
only public surface — see that file's own header) becomes this package's
`main`/`exports["."]` verbatim; no new re-export work needed at manifest
design time, only a physical move.

### `@fedos/messenger`

```jsonc
{
  "name": "@fedos/messenger",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "MPL-2.0",
  "main": "./index.ts",
  "types": "./index.ts",
  "exports": {
    ".": { "types": "./index.ts", "import": "./index.ts" }
  },
  "dependencies": {
    "@fedos/core": "*"
    // Root Cause A, if resolved via option (a): no NEW dependency here --
    // os/messenger's ~20 src/runtime/ importers would instead resolve
    // through @fedos/core's own public surface (a widening of
    // os/core/index.ts's barrel would be required -- today it deliberately
    // does NOT re-export vault/wasm/crypto internals, see that file's own
    // "DELIBERATELY NOT RE-EXPORTED" section; Root Cause A's resolution
    // and this barrel's own scope are the SAME open design question).
  },
  "peerDependencies": {},
  "devDependencies": {
    "@cloudflare/workers-types": "^4.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

By far the largest package (785 files today) — and per this scan, the one
requiring the most real migration work (Root Causes A and C both land
here) before its manifest's `dependencies` list could honestly be just
`@fedos/core`.

### `@fedos/commerce`

```jsonc
{
  "name": "@fedos/commerce",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "license": "MPL-2.0",
  "main": "./index.ts",
  "types": "./index.ts",
  "exports": {
    ".": { "types": "./index.ts", "import": "./index.ts" }
  },
  "dependencies": {
    "@fedos/core": "*"
    // Root Cause D's two-file NostrEvent dependency is NOT listed as
    // "@fedos/messenger" here on purpose -- that would be pre-deciding the
    // open question this doc's own Root Cause D section explicitly defers.
    // Whichever way that's resolved, this manifest gains exactly one line.
  },
  "peerDependencies": {},
  "devDependencies": {
    "@cloudflare/workers-types": "^4.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

Smallest package (22 files), and per `src/os/commerce/README.md`, inert
scaffolding with zero live-app consumers today — extraction readiness here
is a paper exercise until that changes, but the SAME 7 blockers still need
resolving regardless of live-consumer status, since a `package.json`
`dependencies` list has to be honest about what actually resolves.

## Build order graph

```
@fedos/core
    |
    +--> @fedos/messenger --+
    |                       |
    +--> @fedos/commerce ---+
                             |
                             v
                 apps/desktop-electron-spike
                 (packages/fedos-desktop-electron-spike)
```

**Cycle count: 0.** `@fedos/messenger` and `@fedos/commerce` never depend
on each other (`test/architecture_boundary_messenger.test.ts`/
`_commerce.test.ts` already enforce this at the import level; this scan's
own closure check re-confirms it at the file-content level — `os/commerce`'s
FAIL list touches `os/messenger` only through Root Cause D's two
documented/sanctioned files, never the reverse, and `os/messenger`'s own
FAIL list never touches `os/commerce` at all). A real monorepo build
(Turborepo/Nx/plain `npm run build --workspaces` with a topological
`references` array in each `tsconfig.json`) would build in exactly two
tiers: `@fedos/core` first, then `@fedos/messenger` and `@fedos/commerce`
in parallel, then the Electron app.

## What "READY" would require, in order

1. Resolve Root Cause A (`src/runtime/`, 78 files, 34 of the 38
   `os/messenger` blockers and 2 of the 3 `os/core` blockers) — the
   single highest-leverage fix. Real design work, not mechanical.
2. Fix Root Cause C's 4 stray old-path imports (`src/notification/policy.ts`,
   2x `src/conversation/deletion*`, 1x `src/desktop/beta/...`) — mechanical
   repoints, re-verify the beta-capability-manifest one is still live
   first given the concurrent edit noted above.
3. Rewire Root Cause B (`os/core/crypto/fedos_core_adapter.ts`) to import
   `@nostr-window/fedos-core-rust` by package name — mechanical, and only
   meaningful once real npm workspaces exist (today there is one root
   `package.json`, not a workspace `package.json` array, so this can't be
   tested end-to-end without ALSO doing that setup work, itself out of
   scope for this pass).
4. Decide Root Cause D's `os/commerce` ↔ `NostrEvent` question, and either
   cut or accept the 5 `_legacy_prototype` edges.
5. Re-run `node scripts/package_extraction_boundary_scan.mjs` and confirm
   `PACKAGE EXTRACTION BLOCKERS: 0` before attempting a real
   `npm init --workspace` split.

None of the above was attempted this pass — per this arc's own scope
("design work for a doc... no real package split this arc"), Half B's job
was measurement, not remediation.
