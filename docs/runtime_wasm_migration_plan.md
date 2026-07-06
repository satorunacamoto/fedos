# FedOS WASM migration plan — Stage 421 (docs only, no code)

**Status: this document adds no code.** It fixes the ORDER in which a
real WASM migration would walk `docs/runtime_wasm_build_contract.md`
(Stage 418)'s diagram from top to bottom — restating, at Production
Review granularity, the same arc
`docs/runtime_backend_implementation_sequence.md` (Stage 410) already
fixed, with two additions: an explicit "Runtime unchanged" step 1 (so
the starting point is never ambiguous) and a final "Production
review" step 10 (so activation is never treated as the last step).
Nothing here is scheduled, approved, or started by writing it down.

## 1. Fixed migration order

1. **Runtime変更なし (Runtime unchanged).** The explicit starting
   point: before any toolchain, build, or wiring work begins,
   `create_runtime.ts`/`src/worker.ts` import none of the chain's
   files, and every `plan*()` method in the chain resolves its fixed,
   non-executing answer. This step is not an action — it is the
   confirmed baseline every later step is measured against.
2. **Toolchain導入 (Toolchain introduction).** Install the `wasm32`
   target, `wasm-bindgen-cli`, and `wasm-pack` — closing the gap
   `docs/runtime_wasm_toolchain_readiness.md` (Stage 417) inventories.
   No build, no bindgen run, no artifact yet.
3. **Build確認 (Build confirmation).** Run `cargo build --target
   wasm32-unknown-unknown` against the EXISTING, unmodified
   `packages/fedos-core-rust` crate, confirming it compiles for the
   target — still no `wasm-bindgen`, no `.wasm` artifact consumed by
   anything.
4. **wasm生成 (WASM generation).** Run `wasm-bindgen`/`wasm-pack`
   against the item 3 build output, producing a real `.wasm` file and
   generated JS glue for the first time.
5. **Loader接続 (Loader connection).** Wire `FedosWasmBoundary`'s
   `planLoad()` (`src/runtime/fedos_wasm_boundary.ts`) to actually call
   `WebAssembly.instantiate`/`compile` against the item 4 artifact,
   replacing its fixed `"BlockedByImplementation"` answer with a real
   load result.
6. **ping実行 (`ping` execution).** Only after items 4–5 are real,
   wire `planPing()`'s pure-TypeScript mirror
   (`docs/runtime_first_rust_ping_execution.md`) to actually call
   across the now-loaded WASM boundary into
   `fedos_runtime_ping_internal()` — the lowest-risk possible real
   cross-boundary call, carrying no secret or key material.
7. **NIP44.** Only after item 6 proves the load-and-call mechanics
   work, wire the real `fedos_encrypt`/`fedos_decrypt` (already real
   and independently tested inside `packages/fedos-core-rust`) through
   the now-real chain to an actual NIP-44 v2 wire operation — the
   first step in this plan where any cryptographic operation actually
   executes.
8. **Runtime dev-only.** Only after item 7 is real and tested, flip
   `FedosRuntimeCryptoProvider`'s selection to actually reach it,
   gated behind an explicit, default-OFF dev-only flag —
   `NoopCryptoProvider`/`"Unsupported"` stays the production default
   until item 10 reviews removing the gate.
9. **Worker.** Only after item 8 is real, dev-gated, and reviewed in
   isolation, connect `src/worker.ts` to the same activated path for
   Nostr DM handling.
10. **Production review.** A dedicated review of items 2–9 as a whole
    — toolchain provenance, artifact reproducibility, the dev-only
    gate's removal criteria, and every risk in
    `docs/runtime_backend_risk_register.md` (Stage 411) — BEFORE (if
    ever) the dev-only flag from item 8 is considered for a
    non-dev-only default. This step is explicitly NOT part of any
    single implementation stage; it is a gate a future stage must pass
    before changing item 8's default.

## 2. Relationship to the Stage 410 sequence

This plan's items 2–9 are the same eight items
`docs/runtime_backend_implementation_sequence.md` (Stage 410) already
fixed, renumbered to make room for two additions:

| This plan | Stage 410 sequence | Note |
|---|---|---|
| 1. Runtime unchanged | — (implicit baseline) | NEW — makes the starting point explicit. |
| 2. Toolchain introduction | 1–2 (toolchain check + wasm32/bindgen introduction) | Combines the Stage 410 "final check" and "introduction" items into one migration-plan step; the Stage 410 document's own two-item split still governs how many STAGES this step takes. |
| 3. Build confirmation | 3 (WASM artifact generation, first half) | Split out as its own step: confirm the crate builds for `wasm32` BEFORE running bindgen. |
| 4. WASM generation | 3 (WASM artifact generation, second half) | The bindgen/`.wasm`-producing half of Stage 410 item 3. |
| 5. Loader connection | 4 (TS loader real connection) | Same item. |
| 6. `ping` execution | 5 (`ping` real cross-boundary execution) | Same item. |
| 7. NIP44 | 6 (NIP-44 real connection) | Same item. |
| 8. Runtime dev-only | 7 (Runtime dev-only activation) | Same item. |
| 9. Worker | 8 (Worker/Nostr integration) | Same item. |
| 10. Production review | — (implicit, never named) | NEW — makes explicit that dev-only activation is not the final word. |

No item's underlying substance changes — this plan does not reorder,
skip, or combine any Stage 410 item; it only makes explicit the two
endpoints (the confirmed starting baseline and the required
production gate) that Stage 410's own numbered list left implicit.

## 3. What must NOT be combined

Consistent with `docs/runtime_backend_implementation_sequence.md` §1's
"one concern per stage" rule and
`docs/implementation_phase_roadmap.md` §3's equivalent rule for the
crypto core: no two numbered items in §1 may land in the same future
stage, and item 10 (Production review) may never be folded into item
8 (Runtime dev-only) or item 9 (Worker) — a dev-only activation stage
proving its own gate works is not the same review as a later stage
deciding whether that gate should ever be widened.

## 4. What this document does not do

- Does not install any toolchain component.
- Does not run `cargo build --target wasm32-*`, `wasm-bindgen`, or
  `wasm-pack`.
- Does not produce a `.wasm` file or generated JS bindings.
- Does not connect `FedosWasmBoundary`, `FedosExecutionBackend`,
  `Runtime`, or `Worker` to anything.
- Does not change `Cargo.toml`, `package.json`, or any Rust public
  API.
- Does not execute `encrypt`/`decrypt` in any form.

## See also

- `docs/runtime_backend_implementation_sequence.md` (Stage 410) — the
  eight-item sequence this plan's items 2–9 restate at Production
  Review granularity.
- `docs/runtime_wasm_build_contract.md` (Stage 418) — the diagram this
  plan's items walk top to bottom.
- `docs/runtime_wasm_toolchain_readiness.md` (Stage 417) — the
  inventory item 2 closes.
- `docs/runtime_backend_risk_register.md` (Stage 411) — the six risks
  item 10's Production Review must re-check against items 2–9's
  actual, landed implementation.
