# FedOS Dynamic Loader Dev Approval — Stage 577

**Status: this document records real code's current state — no
`import()` is implemented by this stage, no import (static or dynamic)
happens as a side effect of anything here, and both remain PROHIBITED.
Runtime/Worker connection and `WebAssembly.instantiate` remain
PROHIBITED as well.**

`docs/runtime_dynamic_loader_gate.md` (Stage 569) fixed EIGHT minimum
conditions before a dynamic `import()` of the generated JS glue could
ever be written and executed — all currently unmet. THIS document goes
one level deeper still: even IF a future stage someday satisfied that
gate, a dynamic loader could NEVER simply "turn on" everywhere — it
would need its OWN dev-only APPROVAL, scoped specifically to
non-production, non-Worker use. This is that approval's condition
set, fixed here without granting it.

## 1. The eight minimum dev-only conditions, all currently unmet

| # | Condition | Question it answers | State today |
|---|---|---|---|
| 1 | **Dynamic Loader Gate passed** | Has `createDynamicLoaderGate()` ever resolved `dynamicLoaderAllowed: true`? | ❌ NO — fixed `dynamicLoaderAllowed: false` (Stage 570) |
| 2 | **Dev build only** | Would this approval ever apply outside a local development build? | ❌ NOT YET DEFINED — no build-mode distinction consulted by anything in this arc |
| 3 | **Disabled in production builds** | Is there a mechanism that forces this approval OFF in any production build? | ❌ NOT YET DEFINED — no such mechanism exists yet |
| 4 | **Runtime Review complete** | Has a dedicated Runtime-side review of dev-only dynamic loading been conducted and recorded? | ❌ NO — no such review exists yet |
| 5 | **Generated JS Glue verified** | Has the generated JS glue/`.wasm` pair been verified (integrity/provenance) before any dev-only load? | ❌ NO — no verification mechanism exists yet |
| 6 | **Fail Closed maintained** | Does every link in this chain still deny by default? | ✅ YES — every placeholder in this arc still returns a fixed denial |
| 7 | **Prohibited in Worker** | Does Worker (`src/worker.ts`) stay categorically excluded from this approval, even in dev builds? | ✅ BY DESIGN — this approval, if ever granted, is Runtime-side ONLY; Worker approval is never sought here |
| 8 | **Prohibited in production deploy** | Is any production deployment path excluded from this approval regardless of build mode detection accuracy? | ✅ BY DESIGN — this approval names dev-only as a NECESSARY, not sufficient, condition; production deploy is out of scope categorically |

**Every condition must hold simultaneously before dev-only dynamic
loader approval could ever be granted.** Today, #1, #2, #3, #4, and #5
are each independently sufficient to keep this approval's answer at
`approved: false` — #6, #7, and #8 already hold, by construction, but
that alone changes nothing.

`src/runtime/fedos_dynamic_loader_dev_approval.ts` (Stage 578) is the
real, fixed-value implementation of this approval's collapsed answer
— `createDynamicLoaderDevApproval()` always resolves
`{ approvalState: "PlanningOnly", approved: false, reason:
"DevApprovalPending" }`, naming the table above as the concrete,
standing reason approval cannot be granted while any of #1–#5 remains
unmet.

## 2. Why this is a SEPARATE approval, not a restatement of the Gate

`docs/runtime_dynamic_loader_gate.md`'s Gate asks whether a dynamic
`import()` may EVER be written at all. THIS document asks a narrower,
later question: assuming the Gate is someday satisfied, under what
CONDITIONS may that dynamic loader ever be ACTIVATED on a given
machine, in a given build. The two are independent — the Gate could in
principle be satisfied while this approval remains unmet (e.g., all
eight Gate conditions hold, but no dev-only flag or Runtime Review has
been built yet), and this approval's own conditions (#2/#3/#7/#8) add
constraints the Gate itself never named: WHERE (dev build only, never
production, never Worker) rather than just WHETHER.

## 3. What this stage does NOT do

- Does **not** write `import()` of any kind, anywhere in this
  repository's source.
- Does **not** write the static `import` statement named by
  `docs/runtime_wasm_static_import_plan.md`.
- Does **not** import, reference, or evaluate the generated JS glue in
  any way.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`.
- Does **not** connect Runtime (`create_runtime.ts`) or Worker
  (`src/worker.ts`) to any of this — no Runtime connection of any kind
  exists yet, even a dev-only one.
- Does **not** define a build-mode/dev-only flag of any kind.
- Does **not** commit any file under `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`) or implement NIP-17/NIP-59.
- Does **not** change any Cargo/`package.json` dependency.

## See also

- `docs/runtime_dynamic_loader_gate.md` (Stage 569) — the eight
  conditions before a dynamic `import()` may ever be written at all,
  condition #1 above.
- `src/runtime/fedos_dynamic_loader_dev_approval.ts` (Stage 578–579) —
  the real, fixed-value implementation of this approval and its
  wiring from `fedos_dynamic_loader_gate.ts`.
- `docs/runtime_internal_execution_contract.md` (updated Stage 581) —
  the diagram naming Dynamic Loader Dev Approval's position between
  Dynamic Loader Gate and Generated JS Glue, and confirming no
  Runtime/Worker connection exists yet.
