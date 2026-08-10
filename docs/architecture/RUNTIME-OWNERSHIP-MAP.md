# FedOS — `src/runtime/` Ownership Map (78/78 classified, 0 UNKNOWN)

Status: written this arc (Runtime Ownership Extraction + Package Readiness
Closure). Read-only classification phase, frozen BEFORE any physical move
began (per this arc's own kickoff brief). Produced by four parallel
read-only agents (R1/R2/R3: `src/runtime/*` file-set inventory; P: the
remaining 10 non-runtime blockers + type SCC), then reconciled and, in one
case, corrected by the Coordinator against direct first-hand evidence (see
"Correction" below) before any file was moved.

Classification taxonomy (semantic ownership, never "shared = core"):
A CORE PRIMITIVE · B MESSENGER DOMAIN · C MESSENGER ADAPTER · D COMMERCE
DOMAIN · E APP/COMPOSITION · F DESKTOP/ELECTRON ADAPTER · G SHARED CONTRACT
· H TEST SUPPORT · I LEGACY/DEAD · J OTHER.

## Headline numbers

- **78 files total** under `src/runtime/`. **5** (`master_seed/`) already
  migrated to `src/os/core/vault/wasm/` by a prior arc (shims left,
  verified still in place). **73** were this arc's real scope.
- Of the 73: **19** form the real, verified transitive-import closure of
  the live production WASM/AEAD path and move to `src/os/core/` this arc
  (see "The 19-file live closure" below). **54** are genuinely dead
  scaffolding (zero reachability from any live entrypoint) — classified,
  canonical target proposed, **migration deferred** to a future low-risk
  cleanup arc (see "Deferred: 54 dead-scaffolding files" — this is a
  recorded decision, not an unresolved unknown; consistent with this
  arc's own instruction not to force `src/runtime/` implementation files
  to exactly 0 without justification).
- **UNKNOWN: 0.**

## A correction to the raw agent reports (recorded, not silently fixed)

Agent R1 classified 6 of its 27 files (`fedos_generated_artifact_distribution.ts`,
`fedos_generated_artifact_presence.ts`, `fedos_build_time_loader_strategy.ts`,
`fedos_dynamic_loader_gate.ts`, `fedos_dynamic_loader_dev_approval.ts`,
`fedos_explicit_crypto_initialization.ts`) and Agent R2 classified 1 of its
24 files (`fedos_static_import_activation_review.ts`) as "LEGACY/DEAD,
zero real importers outside the dead `_legacy_prototype/runtime/create_runtime.ts`."
That conclusion was reached by tracing reachability from the dead legacy
`AppRuntime` composition root — a real, valid method — but it missed a
second, live reachability path: these 7 files are the tail of a genuine
transitive `import` chain hanging off `fedos_wasm_loader.ts` (Agent R3's
file, confirmed live: 103 real importers, 23 of the 46 package-extraction
blockers). The Coordinator verified this directly, file by file, with
`grep -n "^import"` on the actual source (not by trusting either agent's
claim):

```
fedos_wasm_loader.ts
  -> fedos_wasm_loader_plan.ts
    -> fedos_wasm_loader_import_policy.ts
      -> fedos_wasm_static_import_plan.ts
        -> fedos_wasm_static_import_review.ts
          -> fedos_wasm_static_import_readiness.ts
            -> fedos_generated_artifact_presence.ts        [was: R1, marked dead]
              -> fedos_static_import_activation_review.ts  [was: R2, marked dead]
                -> fedos_generated_artifact_distribution.ts [was: R1, marked dead]
                  -> fedos_build_time_loader_strategy.ts    [was: R1, marked dead]
                    -> fedos_dynamic_loader_gate.ts         [was: R1, marked dead]
                      -> fedos_dynamic_loader_dev_approval.ts [was: R1, marked dead]
                        -> fedos_explicit_crypto_initialization.ts [was: R1, marked dead; terminus, 0 imports]
```

Because ES module `import` statements are evaluated (the module graph is
loaded) whenever the importing module is loaded — independent of whether
the imported function's return value is ever used for anything besides a
fixed placeholder answer — these 7 files ARE part of the real, live
compiled/bundled surface reached by ~36 production importers of
`fedos_wasm_loader.ts`, even though every function in the chain always
resolves a fixed `{approved:false}`-shaped placeholder. **Practical
consequence**: these 7 files cannot be left behind in `src/runtime/` while
`fedos_wasm_loader.ts` moves to `os/core` — doing so would create a BRAND
NEW `os/core -> src/runtime` reverse blocker (the exact defect this whole
arc exists to close), so they are reclassified from I (LEGACY/DEAD) to
**part of the live closure**, moving together with `fedos_wasm_loader.ts`.
This is exactly the kind of cross-check this arc's own brief asked for
("実測をauthoritativeとする") — not a criticism of the agents' method,
which was sound for the question they were individually asked, but a
reminder that "reachable from the one entrypoint I checked" is not the
same claim as "reachable from any live entrypoint," and this arc's
Coordinator is responsible for reconciling exactly this kind of seam
between three parallel, independently-scoped investigations.

## The 19-file live closure (moving to `src/os/core/` this arc)

| # | File | New target | Live evidence |
|---|---|---|---|
| 1 | `fedos_wasm_loader.ts` | `src/os/core/vault/wasm/fedos_wasm_loader.ts` | 103 importers (67 test + 36 prod); 23/46 blocker rows; foundational dep of most other `src/runtime/*` files |
| 2 | `fedos_wasm_loader_plan.ts` | `src/os/core/vault/wasm/fedos_wasm_loader_plan.ts` | sole caller `fedos_wasm_loader.ts` |
| 3 | `fedos_wasm_loader_import_policy.ts` | `src/os/core/vault/wasm/fedos_wasm_loader_import_policy.ts` | sole caller #2 |
| 4 | `fedos_wasm_static_import_plan.ts` | `src/os/core/vault/wasm/fedos_wasm_static_import_plan.ts` | sole caller #3 |
| 5 | `fedos_wasm_static_import_review.ts` | `src/os/core/vault/wasm/fedos_wasm_static_import_review.ts` | sole caller #4 |
| 6 | `fedos_wasm_static_import_readiness.ts` | `src/os/core/vault/wasm/fedos_wasm_static_import_readiness.ts` | sole caller #5 |
| 7 | `fedos_generated_artifact_presence.ts` | `src/os/core/vault/wasm/fedos_generated_artifact_presence.ts` | sole caller #6 (see Correction) |
| 8 | `fedos_static_import_activation_review.ts` | `src/os/core/vault/wasm/fedos_static_import_activation_review.ts` | sole caller #7 (see Correction) |
| 9 | `fedos_generated_artifact_distribution.ts` | `src/os/core/vault/wasm/fedos_generated_artifact_distribution.ts` | sole caller #8 (see Correction) |
| 10 | `fedos_build_time_loader_strategy.ts` | `src/os/core/vault/wasm/fedos_build_time_loader_strategy.ts` | sole caller #9 (see Correction) |
| 11 | `fedos_dynamic_loader_gate.ts` | `src/os/core/vault/wasm/fedos_dynamic_loader_gate.ts` | sole caller #10 (see Correction) |
| 12 | `fedos_dynamic_loader_dev_approval.ts` | `src/os/core/vault/wasm/fedos_dynamic_loader_dev_approval.ts` | sole caller #11 (see Correction) |
| 13 | `fedos_explicit_crypto_initialization.ts` | `src/os/core/vault/wasm/fedos_explicit_crypto_initialization.ts` | chain terminus (0 imports); doc-flagged "Class A load-bearing" independent of this chain |
| 14 | `fedos_runtime_mode_authority.ts` | `src/os/core/vault/wasm/fedos_runtime_mode_authority.ts` | direct dep of `fedos_wasm_loader.ts` and of live `fedos_runtime_ciphertext_storage.ts` (deferred file, satisfied by shim) |
| 15 | `fedos_runtime_encrypt.ts` | `src/os/core/vault/wasm/fedos_runtime_encrypt.ts` | 3 prod importers, 3 blocker rows |
| 16 | `fedos_runtime_decrypt.ts` | `src/os/core/vault/wasm/fedos_runtime_decrypt.ts` | 3 prod importers, 3 blocker rows |
| 17 | `fedos_runtime_export_ciphertext.ts` | `src/os/core/vault/wasm/fedos_runtime_export_ciphertext.ts` | 3 prod importers, 3 blocker rows |
| 18 | `fedos_runtime_import_ciphertext.ts` | `src/os/core/vault/wasm/fedos_runtime_import_ciphertext.ts` | 3 prod importers, 3 blocker rows |
| 19 | `fedos_runtime_identity.ts` | `src/os/core/identity/fedos_runtime_identity.ts` | 1 prod importer (`os/messenger/desktop/desktop_application.ts`); content is 100% `os/core/identity/*` imports (7, zero Messenger types) — resolves the plan doc's own open "may be Messenger-shaped" question in favor of Core |

All classified **A. CORE PRIMITIVE**. Old-path shims (`@deprecated`,
`export * from "..."`, identical boilerplate to the `master_seed/`
precedent) left at all 19 old `src/runtime/` locations. This closure
resolves all 36 runtime-caused package-extraction blockers (fixing
`fedos_wasm_loader.ts`, the 4 ciphertext functions, and `fedos_runtime_identity.ts`)
without introducing any new `os/core -> outside` edge, because every
in-set dependency (the 12-file transitive chain above) moves together.

## Deferred: 54 dead-scaffolding files (classified, not moved)

All 54 were independently verified (by R1/R2/R3, each doing full-repo
`grep` for every importer, not name-based guessing) to have **zero
importers outside**: (a) each other, within their own arc's isolated
chain; (b) their own dedicated `test/runtime_*.test.ts` assertions; and
(c) `src/os/_legacy_prototype/runtime/create_runtime.ts` / `src/worker.ts`
— both confirmed dead by that directory's own README (no deploy path, no
wrangler config, not referenced by any of the 5 real packaging tsconfigs).
**0 of the 46 package-extraction blockers involve any of these 54 files**
(cross-checked against the scan's own `resolvedTo` field). Migrating them
carries no package-extraction benefit and non-trivial mechanical risk
(dozens of test-file import sites, deep internal chains) for a purely
cosmetic "0 files left in `src/runtime/`" goal — deferred to a dedicated
future cleanup arc, consistent with this arc's own instruction (`§34`) to
document rather than force a zero that isn't load-bearing for the
Primary Objective.

| Bucket | Count | Files (grouped by proposed future target) |
|---|---:|---|
| I. LEGACY/DEAD — "Chain 1" facade/loader-backend/provider-init scaffolding | 17 | `crypto_provider.ts`, `crypto_provider_env.ts`, `fedos_crypto_backend_interface.ts`, `fedos_crypto_backend_resolver.ts`, `fedos_crypto_initialization_result.ts`, `fedos_crypto_loader_backend.ts`, `fedos_crypto_loader_backend_kind.ts`, `fedos_crypto_loader_facade.ts`, `fedos_crypto_provider_facade_boundary.ts`, `fedos_crypto_provider_initialization_request.ts`, `fedos_initialize_crypto_api_contract.ts`, `fedos_initialize_crypto_exposure_review.ts`, `fedos_initialize_crypto_invocation_contract.ts`, `fedos_initialize_crypto_public_api.ts`, `fedos_initialize_crypto_wiring_plan.ts`, `fedos_provider_init_facade_contract.ts`, `fedos_provider_initialization_approval.ts` — future target `src/os/core/crypto/runtime_activation/` |
| I. LEGACY/DEAD — "Chain 4" Rust-provider-internal bridge | 11 | `fedos_execution_backend.ts`, `fedos_internal_rust_call.ts`, `fedos_internal_rust_call_shape.ts`, `fedos_opaque_api.ts`, `fedos_runtime_crypto_provider.ts`, `fedos_runtime_opaque_request.ts`, `fedos_runtime_operation.ts`, `fedos_rust_api.ts`, `fedos_rust_boundary.ts`, `fedos_rust_execution_review.ts`, `fedos_rust_invocation_adapter.ts` — future target `src/os/core/crypto/rust_provider/` |
| I. LEGACY/DEAD — dead "Public Runtime API" / storage family (genuinely NOT the same seam as `os/core/storage`, confirmed by direct trace) | 9 | `fedos_runtime_aead_key_generation.ts`, `fedos_runtime_ciphertext_storage.ts`, `fedos_runtime_platform_authority.ts`, `fedos_runtime_prototype_execution.ts`, `fedos_runtime_random_bytes.ts`, `fedos_runtime_storage_backend.ts`, `fedos_runtime_storage_backend_windows_dpapi.ts`, `fedos_runtime_storage_resolver.ts`, `fedos_wasm_artifact.ts` — future target `src/os/core/vault/wasm/` |
| I. LEGACY/DEAD — `fedos_wasm_backend.ts` | 1 | depends on live `fedos_wasm_loader.ts` (satisfied via shim, no break); still zero real callers itself — future target `src/os/core/vault/wasm/` |
| I. LEGACY/DEAD — `fedos_wasm_boundary.ts`, `fedos_wasm_loader_contract.ts`, `fedos_wasm_loader_import_policy.ts` (⚠ name collision with a different, LIVE file of nearly the same name — see note), `fedos_wasm_toolchain.ts` | 4 | future target `src/os/core/vault/wasm/` |
| A. CORE PRIMITIVE (dead-reachability, real designed-pair scaffolding — see Group Summary note) — `runtime_crypto_*`/`worker_crypto_*` family | 11 | `runtime_crypto_activation_policy.ts`, `runtime_crypto_bridge.ts`, `runtime_crypto_capability.ts`, `runtime_crypto_config.ts`, `runtime_crypto_diagnostics.ts`, `runtime_crypto_registry.ts`, `worker_crypto_activation_policy.ts`, `worker_crypto_bridge.ts`, `worker_crypto_config.ts`, `worker_crypto_diagnostics.ts`, `worker_crypto_registry.ts` — future target `src/os/core/crypto/` (flat) |
| F. DESKTOP/ELECTRON ADAPTER | 1 | `fedos_windows_dpapi_helper.ts` — spawns `powershell.exe` for Win32 DPAPI; sole caller is the deferred, also-dead `fedos_runtime_storage_backend_windows_dpapi.ts`; future target behind a Port, not a bare `os/core` internal |
| G. SHARED CONTRACT | 1 | `health_check.ts` — pure interface, cross-domain `HealthCheckTargetKind` union (commerce+messenger concepts by name only, never by import); zero production importers; future target `src/os/core/ports/health_check_port.ts` |

**Note on the name collision**: `fedos_wasm_loader_import_policy.ts` (one
of the 19 LIVE closure files, listed above) and `fedos_wasm_loader_plan.ts`
must not be confused with similarly-named deferred files in this table —
double-checked, no actual collision exists (the deferred group's own
distinct filenames — `fedos_wasm_loader_contract.ts`, `fedos_wasm_boundary.ts`,
`fedos_wasm_toolchain.ts` — are each real, distinct files, verified by
directory listing, not by name pattern-matching alone).

**`runtime_crypto_*` vs `worker_crypto_*`**: confirmed genuinely distinct
by design (each redeclares its own types independently; `worker_crypto_registry.ts`'s
own header states "DELIBERATELY a SEPARATE, independently-written
implementation"; `docs/runtime_worker_activation_boundary.md` documents
the "separate knob per boundary" doctrine outright) — not an accidental
duplication, but both halves are currently equally unreachable from any
live entrypoint (the only two files that would call them,
`AppRuntime`/`create_runtime.ts` and `src/worker.ts`, exist only under
dead `_legacy_prototype/`). Classified CORE PRIMITIVE on content/design
grounds (not I/LEGACY-DEAD, unlike the other dead groups) because this is
forward-built, intentionally-paired scaffolding for a not-yet-implemented
crypto provider, not code that regressed into deadness — a distinction
this ownership map records but does not act on (no file in this bucket
is part of the moving closure; deleting deliberately-designed-but-inert
scaffolding is a bigger call than an ownership-inventory pass should make
on its own authority).

## Already-resolved: `master_seed/` (5 files, prior arc)

`fedos_master_seed_authority.ts`, `fedos_passphrase_provider.ts`,
`fedos_sealed_master_seed_envelope.ts`,
`fedos_sealed_master_seed_envelope_persistence.ts`,
`fedos_wasm_master_seed_authority.ts` — moved to
`src/os/core/vault/wasm/` by the Architecture Dependency Closure arc
(`docs/architecture/CORE-SECRETS-OWNERSHIP-PLAN.md`, status EXECUTED).
Verified still in place, shims still functioning, this arc. Classified
**A. CORE PRIMITIVE** (uncontested).

## Migration order (dependency-respecting, closure only)

Innermost-first (files with the fewest remaining unmigrated dependencies
move first, though since all 18 `vault/wasm/`-bound files move together
as one flat-directory group their sibling `./x.js` relative imports need
no rewriting at all — only `fedos_runtime_identity.ts`, moving to a
DIFFERENT directory (`os/core/identity/`, not `vault/wasm/`), needs its 7
import lines rewritten from `../os/core/identity/*.js` to `./*.js`):

1. `fedos_explicit_crypto_initialization.ts` (terminus, 0 deps)
2. `fedos_dynamic_loader_dev_approval.ts`
3. `fedos_dynamic_loader_gate.ts`
4. `fedos_build_time_loader_strategy.ts`
5. `fedos_generated_artifact_distribution.ts`
6. `fedos_static_import_activation_review.ts`
7. `fedos_generated_artifact_presence.ts`
8. `fedos_wasm_static_import_readiness.ts`
9. `fedos_wasm_static_import_review.ts`
10. `fedos_wasm_static_import_plan.ts`
11. `fedos_wasm_loader_import_policy.ts`
12. `fedos_wasm_loader_plan.ts`
13. `fedos_runtime_mode_authority.ts` (0 deps, independent)
14. `fedos_wasm_loader.ts` (depends on #12, #13)
15. `fedos_runtime_encrypt.ts`, `fedos_runtime_decrypt.ts`, `fedos_runtime_export_ciphertext.ts`, `fedos_runtime_import_ciphertext.ts` (each depends only on #14)
16. `fedos_runtime_identity.ts` (0 `src/runtime/`-internal deps; only `os/core/identity/*`)

In practice all 19 moved together in one mechanical pass (git mv preserves
history per file; a flat-directory group move needs no internal path
rewriting except file #16) rather than 19 sequential commits — the
dependency order above is recorded for audit purposes and because it is
the same order that would be required if done incrementally.
