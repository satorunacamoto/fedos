# FedOS WASM Loader Import Policy — when may `import` ever run? — Stage 509

**Status: this document records real code's current state — every
condition below is, and remains, UNMET. It orders the conditions; it
satisfies none of them.**

`docs/runtime_wasm_loader_planning.md` (Stage 501) named phase #2
("Import Permission") as one of five ordered gates before the
generated JS glue (`packages/fedos-core-rust/pkg/fedos_core_rust.js`)
may ever load. THIS document goes one level deeper: it fixes the
CONDITIONS phase #2 itself requires — the actual IMPORT POLICY a
future, separate, explicitly-reviewed stage would need to satisfy
before writing a real `import`/`import()` statement anywhere in this
repository.

## 1. The six minimum conditions, all currently unmet

| # | Condition | Question it answers | State today |
|---|---|---|---|
| 1 | **Loader Plan import allowed** | Does `fedos_wasm_loader_plan.ts`'s own `loaderImportAllowed()` report `true`? | ❌ NO — fixed `false` (Stage 502) |
| 2 | **Generated artifact present** | Does a real `.wasm` + JS glue pair exist at `packages/fedos-core-rust/pkg/` right now? | ❌ NOT CONFIRMED — never live-checked by this policy (see §2) |
| 3 | **Artifact untracked/gitignored** | Is any generated artifact excluded from version control? | ✅ STRUCTURALLY YES (`.gitignore`, Stage 451) — but a POLICY GUARANTEE, not sufficient BY ITSELF to permit import |
| 4 | **Runtime dev-only approval** | Has a Runtime-side, explicit, dev-only approval been granted? | ❌ NO — no such approval mechanism exists yet |
| 5 | **No Worker approval** | Does Worker stay OUT of scope for this policy? | ✅ BY DESIGN — Worker approval is never sought or granted here; import, if it ever happens, is Runtime-side ONLY |
| 6 | **Execution Review approval** | Has `FedosRustExecutionReview` (Stage 345) approved real execution? | ❌ NO — `fedosRustExecutionApproved()` fixed `false` |

**Every condition must hold simultaneously before import may ever
run.** A single unmet condition — and today ALL of #1, #2, #4, and #6
are unmet — is sufficient to keep the policy's answer
`{ allowed: false, reason: "BlockedByPolicy" }`, regardless of how
many of the others happen to already hold (#3 and #5 do, today, by
construction — that alone changes nothing).

## 2. Why "generated artifact present" is never a live check

`src/runtime/fedos_wasm_loader_import_policy.ts` (Stage 510) NEVER
inspects the filesystem, `import.meta`, or any environment variable —
the SAME discipline every other file in this WASM arc already
follows (`fedos_wasm_artifact.ts`'s `fedosWasmArtifactGenerated()`,
`fedos_wasm_loader_plan.ts`'s `loaderImportAllowed()`, etc.). Whether
`packages/fedos-core-rust/pkg/fedos_core_rust.js` happens to exist on
a given machine at a given moment is IRRELEVANT to this policy's
fixed answer — a policy whose answer depended on local filesystem
state would not be an auditable, reviewable POLICY at all, only an
accident of whichever machine last ran `npm run build:wasm`.

## 3. What this stage does NOT do

- Does not import, `require()`, or dynamically `import()`
  `fedos_core_rust.js`/`fedos_core_rust_bg.wasm`, or any other
  generated artifact.
- Does not call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `initSync`/the JS glue's default export.
- Does not reference `create_runtime.ts`/`src/worker.ts`.
- Does not grant Runtime dev-only approval, Worker approval, or
  Execution Review approval — no flag, env var, or parameter exists
  anywhere in this codebase that flips any of these.
- Does not touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`).

## See also

- `docs/runtime_wasm_loader_planning.md` (Stage 501) — the five-phase
  ordering this document's phase #2 belongs to.
- `src/runtime/fedos_wasm_loader_import_policy.ts` (Stage 510) — the
  real, fixed-value implementation of this policy.
- `src/runtime/fedos_wasm_loader_plan.ts` (Stage 502/511) — the file
  that references this policy, discarding the result.
- `docs/runtime_fedos_execution_approval_checklist.md` — the broader
  approval checklist condition #6 (Execution Review) belongs to.
- `docs/runtime_internal_execution_contract.md` (updated Stage 513) —
  the diagram naming Import Policy's position between Loader Plan and
  Generated JS Glue.
