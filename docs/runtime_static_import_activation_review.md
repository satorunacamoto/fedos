# FedOS Static Import Activation Review — Stage 545

**Status: this document records real code's current state — the
static import this review gates has NOT happened, does NOT happen as
a side effect of anything in this stage, and remains PROHIBITED.
Generated JS Glue is NEVER imported by anything in this arc.**

`docs/runtime_generated_artifact_presence_policy.md` (Stage 537) is
the last safety layer BEFORE a static import could ever be written,
fixing that "the generated artifact exists" and "Runtime may import
it" are separate concepts. THIS document is the FINAL GATE
immediately before real static import could ever be permitted — one
level below Presence, gathering every prior gate's answer into a
single, named ACTIVATION decision.

## 1. Purpose

The Static Import Activation Review exists so that no future stage can
ever grant static import permission by satisfying only ONE prior gate
in isolation. It names ALL SEVEN conditions that would need to hold
SIMULTANEOUSLY before this review could ever approve activation:

| # | Condition | Question it answers | State today |
|---|---|---|---|
| 1 | **Safety Review passed** | Has `reviewStaticImport()` ever resolved `approved: true`? | ❌ NO — fixed `approved: false` (Stage 526) |
| 2 | **Readiness complete** | Has `createStaticImportReadiness()` ever resolved `ready: true`? | ❌ NO — fixed `ready: false` (Stage 534) |
| 3 | **Artifact Presence confirmed** | Has `createGeneratedArtifactPresence()` ever resolved `present: true`? | ❌ NO — fixed `present: false` (Stage 538) |
| 4 | **Generated JS Glue built** | Does a real `.wasm` + JS glue pair exist at `packages/fedos-core-rust/pkg/`? | ❌ NOT CONFIRMED — never live-checked by this review (same discipline as every prior gate) |
| 5 | **Runtime-side review completed** | Has an explicit, dedicated Runtime-side review of this activation been conducted and recorded? | ❌ NO — no such review exists yet |
| 6 | **Fail Closed maintained** | Does every link in this chain still deny by default? | ✅ YES — every placeholder in this arc still returns a fixed denial |
| 7 | **Crypto API unexposed** | Is any FedOS crypto operation (`encrypt`/`decrypt`) reachable from Runtime/Worker today? | ✅ NO, correctly — `encrypt`/`decrypt` stay `"Unsupported"` |

**Every condition must hold simultaneously before activation could ever
be approved.** Today, #1, #2, #3, #4, and #5 are each independently
sufficient to keep this review's answer at `approved: false` — #6 and
#7 already hold, by construction, but that alone changes nothing.

`src/runtime/fedos_static_import_activation_review.ts` (Stage 546) is
the real, fixed-value implementation of this review's collapsed
answer — `createStaticImportActivationReview()` always resolves
`{ state: "PlanningOnly", approved: false, reason:
"RuntimeActivationReviewPending" }`, naming the table above as the
concrete, standing reason activation cannot be approved while any of
#1–#5 remains unmet.

## 2. Presence is not import

This review restates, at the FINAL gate, the same distinction Stage
537 already drew one level up: **"the Generated Artifact exists on
disk" and "Runtime imports it" are different questions, answered by
different mechanisms.** Presence is a build-output fact; import is an
explicit, reviewed, Runtime-side ACT. No amount of the generated
artifact being present — confirmed or not — changes whether Runtime
has ever been authorized to import it, and this review's own
`approved` field is the ONLY place in this arc that would ever name
that authorization. Today it is fixed `false`, and nothing in this
repository can flip it.

## 3. What this stage does NOT do

- Does **not** write the static `import` statement named by
  `docs/runtime_wasm_static_import_plan.md` (or any dynamic `import()`
  equivalent) anywhere in this repository's source.
- Does **not** import, reference, or evaluate the generated JS glue in
  any way.
- Does **not** call `initSync`/the default export.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`.
- Does **not** call `fetch`.
- Does **not** connect Runtime (`create_runtime.ts`) or Worker
  (`src/worker.ts`) to any of this.
- Does **not** edit, generate, or commit any file under
  `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`) or implement NIP-17/NIP-59.
- Does **not** change any Cargo/`package.json` dependency.

## See also

- `docs/runtime_generated_artifact_presence_policy.md` (Stage 537) —
  the Presence Policy one level up this arc, whose own `present:
  false` answer is condition #3 above.
- `docs/runtime_wasm_static_import_readiness.md` (Stage 533) — the
  Readiness checklist, condition #2 above.
- `docs/runtime_wasm_static_import_safety_review.md` (Stage 525) —
  the Safety Review, condition #1 above.
- `src/runtime/fedos_static_import_activation_review.ts` (Stage
  546–547) — the real, fixed-value implementation of this review and
  its wiring from `fedos_generated_artifact_presence.ts`.
- `docs/runtime_internal_execution_contract.md` (updated Stage 549) —
  the diagram naming Static Import Activation Review's position
  between Generated Artifact Presence and Generated JS Glue.
