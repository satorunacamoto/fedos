# FedOS — Package Extraction Plan

Status: written by the Compatibility Facade Reduction + Package
Extraction Readiness + Remaining Architecture Debt Closure arc (Agent P,
Half B); **UPDATED by the Runtime Ownership Extraction + Package
Readiness Closure arc**, which executed Root Cause A (below) — the one
piece of real design/migration work this doc's own original "What READY
would require" section named as step 1 and explicitly deferred. Pure
software architecture, no legal/compliance content. Answers one question
with a real, automatable measurement, not prose: **if `src/os/core`,
`src/os/messenger`, and `src/os/commerce` were physically moved into
their own npm packages today, exactly what would break, and by how
much?** Physical moves NOW HAVE happened for Root Cause A's 19-file live
closure (see `docs/architecture/RUNTIME-OWNERSHIP-MAP.md`); no
`packages/*` npm package itself was created — this remains design +
measurement for the actual workspace split.

## Verdict: **NEARLY READY — one root ready, one fully closed this arc, two carry a single documented design-decision blocker each**

| Root | Own files | Extraction-ready? |
|---|---|---|
| `apps/desktop-electron-spike` (`packages/fedos-desktop-electron-spike/src`) | 27 | **YES** — 0 blockers (unchanged) |
| `os/messenger` | 787 | **YES** — 0 blockers (was 38; closed this arc) |
| `os/core` | 74 | NO — 1 blocker (was 3; Root Cause B, needs real npm workspaces) |
| `os/commerce` | 26 | NO — 2 blockers (was 7; Root Cause D's sanctioned `NostrEvent` carve-out, an open design decision) |

**PACKAGE EXTRACTION BLOCKERS: 3** (was 48 as originally measured by this
doc, 46 as freshly re-measured at the start of the Runtime Ownership
Extraction arc — 2 of the original 48 had already been fixed by an
intervening commit).

The dominant root cause (Root Cause A, `src/runtime/`) is now **fully
closed** — see "Root cause A — RESOLVED" below. The 2 remaining root
causes (B and D) were always flagged by this doc as genuine design
decisions for a future extraction arc to make, not mechanical gaps; that
recommendation still stands and neither was attempted this pass. `os/core`
grew from 55 to 74 own files (the 19-file live closure moved in) and
`os/commerce` grew from 22 to 26 (the 4 new vendored files from Root
Cause D's mechanical fix, below).

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

### Root cause A — `src/runtime/` (78 files, NEVER migrated) is a hidden shared dependency of BOTH `os/core` and `os/messenger` — **RESOLVED, Runtime Ownership Extraction Arc**

**Resolution**: option (b) below (split `src/runtime/`, not move it whole)
was the one actually executed, refined by direct evidence rather than
guessed. Of the 78 files, only a **19-file live closure** — the real
transitive dependency graph of the production `fedos_wasm_loader.ts`
(103 importers) plus the 4 AEAD ciphertext functions and
`fedos_runtime_identity.ts` — needed to move to resolve every real
package-extraction blocker; verified via `grep -n "^import"` on every
file in the chain, not assumed. All 19 moved to `src/os/core/vault/wasm/`
(18 files) and `src/os/core/identity/` (`fedos_runtime_identity.ts` — its
content is 100% `os/core/identity/*` imports, resolving THIS document's
own "may be Messenger-shaped" speculation in favor of Core). The
remaining 54 files are genuinely dead scaffolding (zero live
reachability, independently verified) and were deliberately left in
place — see `docs/architecture/RUNTIME-OWNERSHIP-MAP.md` for the full
78-file classification and the exact evidence. **RUNTIME-CAUSED
PACKAGE-EXTRACTION BLOCKERS: 0** (was 36 of the original 46/48).

The historical analysis below (as this doc originally found it) is kept
for the record.

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

### Root cause C — a small number of files still hold OLD-location imports the prior "811 of 811 shims repointed" sweep did not (and structurally could not) catch — **RESOLVED, all 4**

`FACTORY-PORT-COMPLETION-PLAN.md`'s own execution record describes a sweep
of every *known-at-the-time* old-path import, repointing 811 of 811 to
canonical `os/**` locations. This scan originally found 4 the sweep did
not catch: 1 in `src/notification/`, 2 into `src/conversation/deletion*`
shims, and 1 into
`src/desktop/beta/fedos_desktop_beta_capability_manifest.ts`. **All 4 now
fixed**: the 2 `src/conversation/deletion*` ones were fixed by a commit
prior to the Runtime Ownership Extraction arc's own start (already gone
by the time that arc re-measured, 48→46); that arc fixed the remaining 2
— `fedos_desktop_beta_capability_manifest.ts` physically moved to
`src/os/messenger/desktop/beta/` (the concurrent-modification risk this
doc flagged did not materialize inside that arc's own isolated worktree,
independently re-verified before acting), and
`src/notification/policy.ts`'s one pure helper
(`isSensitiveNotificationField`) forked into a local, independently-owned
copy inside `os/messenger` rather than accepting the live cross-root
import — see `docs/architecture/RUNTIME-OWNERSHIP-EXTRACTION-FINAL-VALIDATION.md`.

### Root cause D — `os/commerce`'s two SANCTIONED-but-still-blocking edges into `os/messenger` (still open), and its FIVE edges into dead `_legacy_prototype` code (**RESOLVED**)

The five `_legacy_prototype` edges are fixed: the Runtime Ownership
Extraction arc vendored the small `AssetMetadata`/`canCacheAsset`/
`Space`/`canPost` types+policy `asset_preview.ts`/`bridge.ts`/`directory.ts`
actually used into 4 new local files
(`src/os/commerce/catalog/{asset_cache_types,asset_cache_policy,space_types,space_policy}.ts`,
verbatim copies at fork time) rather than deleting the dead-code paths
outright — preserves existing test coverage and behavior with zero
functional change while cutting the cross-root import; `_legacy_prototype`
itself untouched.

The two SANCTIONED `NostrEvent` edges are still open — both already
covered above under the `os/commerce` results table, and both represent a
genuine PRE-DECISION this doc does not make on its own authority: does
`@fedos/commerce` accept `@fedos/messenger` as a real dependency (simplest,
but couples two capabilities the whole Ports-and-Adapters design exists to
keep apart), or does the `NostrEvent`/raw-event-shape concept move into
`@fedos/core` (more architecturally correct, but `os/core`'s own boundary
test / design discipline currently forbids ANY protocol-specific type —
see `transport_port.ts`'s own header for exactly this tension already
documented for a different Port)? Recommended, still: defer to whichever
arc actually executes the extraction; flagged here, not decided here.
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

1. ~~Resolve Root Cause A~~ — **DONE, Runtime Ownership Extraction arc.**
   36 of 46 blockers closed in one motion; `os/messenger`'s virtual
   package now PASSES.
2. ~~Fix Root Cause C's 4 stray old-path imports~~ — **DONE**, all 4
   (2 by an intervening commit before this arc started, 2 by this arc).
3. ~~Decide Root Cause D's 5 `_legacy_prototype` edges~~ — **DONE**
   (cut, via vendoring — see above). The `os/commerce` ↔ `NostrEvent`
   SANCTIONED-edge question is a SEPARATE, still-open part of Root Cause
   D — see below.
4. Rewire Root Cause B (`os/core/crypto/fedos_core_adapter.ts`) to import
   `@nostr-window/fedos-core-rust` by package name — mechanical, and only
   meaningful once real npm workspaces exist (today there is one root
   `package.json`, not a workspace `package.json` array, so this can't be
   tested end-to-end without ALSO doing that setup work). **Still open.**
5. Decide Root Cause D's remaining `os/commerce` ↔ `NostrEvent` question
   (2 sanctioned edges). **Still open**, deliberately — a genuine design
   decision, not this arc's call to make.
6. Re-run `node scripts/package_extraction_boundary_scan.mjs` and confirm
   `PACKAGE EXTRACTION BLOCKERS: 0` before attempting a real
   `npm init --workspace` split. **Currently measures 3** (down from 48
   originally / 46 as re-measured) — steps 4 and 5 above are the only two
   remaining before this hits 0.

Steps 1-3 were executed by the Runtime Ownership Extraction + Package
Readiness Closure arc. Steps 4-5 remain genuine open design decisions for
a future arc — per that arc's own scope, it did not attempt either (no
npm workspace setup, no `os/commerce`/`NostrEvent` architectural
decision), consistent with this document's own original recommendation
to defer both to whichever arc actually executes the real package split.
