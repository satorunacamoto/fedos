# Secure Runtime Alpha 075 — Identity Descriptor Acquisition Consolidation

**Status: this Stage adds one small private method and rewires one
existing call site to use it. It changes no observable behavior —
idempotency, Fail Closed, Registry registration, Provider call count,
and Bootstrap semantics are all completely unchanged.**

## 1. Why now

Alpha 068 consolidated the Identity Service READ path
(`#describeIdentity()`). Alpha 069 consolidated Bootstrap STATE WRITES
(`#completeBootstrap()`). Alpha 070 consolidated the Bootstrap ENTRY
point (`#bootstrapIdentity()`). Alpha 072 consolidated the Bootstrap
STATE READ (`#isBootstrapped()`). Alpha 073 consolidated the
Descriptor READ (`#currentIdentity()`). Alpha 074 consolidated the
Bootstrap FLOW itself (`#performBootstrap()`). What remained was the
Flow's own single statement, `return this.#describeIdentity();` —
still reaching the Reader directly, inline. This Stage gives that act
— Descriptor ACQUISITION, as distinct from the Flow that orchestrates
it — its own isolated, named unit: `#acquireDescriptor()`. This is a
further link in the same chain, not a new capability: `#performBootstrap()`
now delegates Acquisition instead of performing it inline.

## 2. What changed, recorded precisely

`src/runtime/fedos_runtime_identity.ts` is the ONLY `src/` file this
Stage modifies. One new private method, and one rewritten statement:

```diff
+  async #acquireDescriptor(): Promise<FedosIdentityDescriptor | null> {
+    return this.#describeIdentity();
+  }
+
   async #performBootstrap(): Promise<FedosIdentityDescriptor | null> {
-    return this.#describeIdentity();
+    return this.#acquireDescriptor();
   }
```

`#acquireDescriptor()`'s own body is EXACTLY one statement —
`return this.#describeIdentity();` — a bare Promise pass-through with
NO `await` keyword of its own, identical in shape to
`#performBootstrap()`'s own body before this Stage. No other line in
the file changed.

## 3. #acquireDescriptor() — constraints confirmed

Per this Stage's own mandate, the new private `#acquireDescriptor()`:

- Is a **pure Promise pass-through** — a single `return` statement,
  nothing more.
- Has **no `await`** of its own — the `Promise` `#describeIdentity()`
  produces is returned directly.
- Has **no `if`** — no branching of any kind.
- Has **no `try`/`catch`** — nothing in its own single statement is
  wrapped.
- Makes **no direct Provider call** — does not reference
  `this.#service`.
- Makes **no direct Registry access** — does not reference
  `this.#registry`.
- Makes **no Resolver access** — does not reference `this.#resolver`.
- Makes **no Storage access** — this class has never had a Storage
  reference, unaffected.
- Performs **no State update** — does not assign to `#descriptor` or
  `#bootstrapped`.
- Is declared `async`, returning `Promise<FedosIdentityDescriptor | null>`,
  matching `#describeIdentity()`'s own return type exactly.

## 4. Confirmation: #describeIdentity()'s sole caller

`#describeIdentity()` has EXACTLY ONE caller anywhere in the file:
`#acquireDescriptor()`'s own single statement — no longer
`#performBootstrap()` directly. `#acquireDescriptor()` in turn has
EXACTLY ONE caller anywhere in the file: `#performBootstrap()`'s own
single statement.

## 5. Confirmation: #performBootstrap() holds no Acquisition logic

`#performBootstrap()`'s own entire body, after this Stage, is
`return this.#acquireDescriptor();` — it no longer reaches
`#describeIdentity()` directly, and holds no Descriptor-acquisition
logic of its own. It is a pure one-statement delegation to Acquisition,
exactly as it was a pure one-statement delegation to the Reader before
this Stage — the responsibility moved, the shape did not.

## 6. Confirmation: the full chain

The complete Bootstrap call chain is now:

```
#bootstrapIdentity()
  → #performBootstrap()
    → #acquireDescriptor()
      → #describeIdentity()
        → FedosIdentityService
```

Each link is reached by EXACTLY ONE caller. No link skips a level; no
link is reached from more than one place.

## 7. What is preserved, explicitly

- **`#bootstrapIdentity()`'s own guard, position, and structure** —
  completely unchanged; it still awaits `#performBootstrap()` as its
  own descriptor-capturing statement.
- **`#completeBootstrap()`** (Alpha 069) — remains the ONLY place in
  this file that ever writes `#descriptor`/`#bootstrapped`, completely
  unaffected by this Stage.
- **Fail Closed** — a rejection propagating from `#describeIdentity()`
  through `#acquireDescriptor()` through `#performBootstrap()` still
  prevents `#completeBootstrap()` from ever being called — identical
  Fail-Closed behavior to every prior Stage.
- **Registry registration / Provider call count / Bootstrap
  semantics** — entirely unaffected; the relocated call performs the
  identical sequence of calls it always did, just through one more
  named hop.

## 8. What this Stage does NOT do

- Does **not** add any new public API.
- Does **not** add any new private field.
- Does **not** modify `src/runtime/create_runtime.ts`.
- Does **not** modify `src/runtime/types.ts` or any `AppRuntime` field.
- Does **not** modify any `src/identity/*` file (Provider, Registry,
  Resolver, Service, Descriptor, or Record).
- Does **not** modify `src/worker.ts`.
- Does **not** modify any Storage file.
- Does **not** modify `packages/fedos-core-rust`, `Cargo.toml`, or
  `package.json`.
- Does **not** change `#describeIdentity()`/`#completeBootstrap()`/
  `#isBootstrapped()`/`#currentIdentity()`/`#bootstrapIdentity()`/
  `findIdentity()`/`listIdentities()`/`isBootstrapped()`/
  `currentIdentity()`/`bootstrapIdentity()` in any way.

## 9. Summary

This Stage adds one minimal private method, `#acquireDescriptor(): Promise<FedosIdentityDescriptor | null>`,
whose own single-statement body is a bare
`return this.#describeIdentity();`, and rewires `#performBootstrap()`'s
own single statement to delegate to it instead of reaching
`#describeIdentity()` directly. Descriptor ACQUISITION now has its own
named, isolated unit, reached by exactly one caller and reaching
`#describeIdentity()` as its own exactly-one caller. The full chain —
`#bootstrapIdentity()` → `#performBootstrap()` → `#acquireDescriptor()`
→ `#describeIdentity()` → `FedosIdentityService` — has each link
reached by exactly one caller. Every observable behavior — idempotency,
Fail Closed, Registry registration, Provider call count, Bootstrap
semantics — is completely unchanged; this is a pure internal
consolidation.

## 10. See also

- `docs/secure_runtime_alpha_068_identity_reader_boundary_consolidation.md`
- `docs/secure_runtime_alpha_069_identity_bootstrap_state_consolidation.md`
- `docs/secure_runtime_alpha_070_identity_bootstrap_entry_consolidation.md`
- `docs/secure_runtime_alpha_073_identity_descriptor_reader_consolidation.md`
- `docs/secure_runtime_alpha_074_identity_bootstrap_flow_consolidation.md`
