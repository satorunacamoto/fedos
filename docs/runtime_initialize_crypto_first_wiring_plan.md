# FedOS initializeCrypto First Wiring Plan — Stage 683

**Status: this document is a POLICY STATEMENT, not an implementation.
It names what the FIRST real connection between Runtime and the
`initializeCrypto()` chain would need to look like, whenever a future,
separate, explicitly-reviewed stage attempts one. It implements
nothing — no Runtime connection, no Worker connection, no `import()`
of any kind, and no WASM load happens as a result of this document.**

## 1. The single candidate

The FIRST — and, per this plan, ONLY — API candidate ever exposed to
Runtime is `initializeCrypto()`. No other member of the parked chain
(`docs/runtime_initialize_crypto_planning_review.md`'s twelve layers)
is named as a first-exposure candidate. This keeps the first real
connection, whenever it happens, to the smallest possible surface.

## 2. Scope — what is explicitly OUT for the first wiring

| Excluded | Why |
|---|---|
| **Worker** | `docs/runtime_initialize_crypto_wiring_plan.md` §1 already establishes that Runtime and Worker permission are independent, never implied by one another. This plan narrows further: Worker is not merely "not yet approved" — it is OUT OF SCOPE for the first wiring attempt entirely. A Worker-facing exposure, if it ever happens, is a fully separate, later, explicitly-reviewed stage. |
| **`encrypt`/`decrypt`** | The first wiring concerns ONLY the initialization entry point. `RuntimeCryptoProvider.encrypt()`/`.decrypt()` stay exactly as they are today (`"Unsupported"`) — this plan does not touch, wire, or reason about them at all. |
| **NIP-17/NIP-44/NIP-59** | None of these protocols are implemented, referenced, or advanced by this plan in any way. |
| **WASM import (static or dynamic)** | The first wiring plan concerns ONLY the shape of what Runtime would expose — never an actual load. `import()`, static `import`, `WebAssembly.instantiate`/`compile`, `initSync`, and the generated JS glue's default export all remain exactly as prohibited as everywhere else in this arc. |

## 3. What the first wiring would look like, in outline only

1. Runtime would gain a way to ask "is `initializeCrypto` currently
   allowed" — a public-facing check, not a call.
2. That check would resolve `allowed: false` for as long as any layer
   in the parked chain (`docs/runtime_initialize_crypto_planning_review.md`)
   still resolves its own denial — the first wiring does not
   presuppose any of the twelve layers ever changes its answer.
3. Only once `allowed: true` was reachable through EVERY layer in the
   chain — a state nothing in this repository can currently produce —
   would an actual invocation ever be considered, and that
   consideration is explicitly deferred to a separate, later stage
   (`docs/runtime_initialize_crypto_invocation_contract.md`'s own
   terminus).
4. The actual LOAD (WASM instantiation, generated JS glue import) is
   named here only to be excluded — it belongs to a different,
   later, separately-reviewed arc than "does Runtime have a way to
   ask whether it's allowed."

**Step 1 (the `allowed: false` public check) is the ONLY step this
plan names as potentially in scope for a near-term future stage.**
Steps 2–4 exist to make explicit what is NOT being proposed yet.

## 4. What this stage does NOT do

- Does **not** implement step 1 or any other step above — this is a
  policy statement, not code.
- Does **not** add a thirteenth `PlanningOnly` layer or any new
  runtime module.
- Does **not** add or change any diagnostics field.
- Does **not** write `import()` of any kind, anywhere.
- Does **not** connect Runtime or Worker to any of this.
- Does **not** modify `create_runtime.ts` or `src/worker.ts`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`) or implement NIP-17/NIP-44/NIP-59.
- Does **not** change any Cargo/`package.json` dependency.

## See also

- `docs/runtime_initialize_crypto_planning_review.md` (Stage 681) —
  the full inventory of layers this plan's future "allowed" check
  would need to traverse.
- `docs/runtime_initialize_crypto_simplification_plan.md` (Stage 682)
  — the classification of those layers, independent of this plan's
  own scope decision.
- `docs/runtime_initialize_crypto_wiring_plan.md` (Stage 657) — the
  existing Runtime/Worker independence guarantee this plan narrows
  further for the FIRST wiring attempt specifically.
