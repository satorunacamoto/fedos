# Secure Runtime Alpha 605 — Executable Entry Point Decision

Stage 5 of the Alpha 601–620 Desktop Local Runtime Entry Point &
Publish Pipeline Ownership Arc.

## Decision: `package.json` needs a minimal, additive change — verified necessary, not assumed

Confirmed (Alpha 601 §2/§8): `tsconfig.json` has `noEmit: true` and no
`build`/`start` script exists; plain `node` cannot run this
repository's own `.ts` sources directly (relative imports are written
with `.js` extensions this repository's own convention already
established, which Node's native TypeScript support does not remap to
the sibling `.ts` file). Without SOME build step, no command exists
that could make an exported function a genuine "production caller"
rather than merely an importable, never-invoked capability.

## What was added — the minimum that makes this true, confirmed by an actual isolated `tsc` run before adoption (Alpha 601 §2)

- `tsconfig.runtime.json` (new file, repo root) — extends the existing
  `tsconfig.json` verbatim, overrides only `noEmit: false` and
  `outDir: "dist"` (already `.gitignore`d — no new ignore rule needed),
  scoped via `include` to `src/desktop/runtime/run_fedos_desktop_runtime.ts`
  alone (`tsc` pulls in its full transitive closure automatically,
  confirmed empirically this Stage — no other file needs listing).
- `package.json` `scripts`: two new entries —
  `"build:runtime": "tsc -p tsconfig.runtime.json"` and
  `"start:runtime": "npm run build:runtime && node dist/desktop/runtime/run_fedos_desktop_runtime.js"`.
  NO new `dependencies`/`devDependencies` — `typescript` is already
  present; `node:fs`/`node:path`/`node:process` are Node builtins.

## Why this counts as a real production caller, not "just an exported function"

Alpha 619 (this Arc's own later Stage) launches `npm run start:runtime`
as an actual child process — not a test importing a function — against
a real, temporary filesystem, observes it reach a ready state, and
sends it a real shutdown signal, confirming a graceful stop. A
`package.json` script backed by a real, `tsc`-emitted, `node`-executed
file, launched as its own OS process, is the same class of "production
caller" a `bin` field would provide — the difference is packaging
promise (Alpha 602), not execution reality.

## See also

- `docs/secure_runtime_alpha_601_current_runtime_caller_inventory.md`
- `docs/secure_runtime_alpha_606_runtime_assembly.md`
- `docs/secure_runtime_alpha_619_production_caller_reality_check.md`
