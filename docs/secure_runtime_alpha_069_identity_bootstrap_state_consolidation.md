# Secure Runtime Alpha 069 — Identity Bootstrap State Consolidation

**Status: this Stage adds one small private helper method and rewires
`bootstrapIdentity()` to use it. It changes no observable behavior —
idempotency, Fail Closed, Registry registration, Provider call count,
and Bootstrap semantics are all completely unchanged.**

## 1. Why now

Alpha 068 consolidated the Identity Service access path to a single
private `#describeIdentity()` method. What remained scattered were the
TWO field assignments that record a successful Bootstrap —
`this.#descriptor = …` and `this.#bootstrapped = true;` — written
inline, directly inside `bootstrapIdentity()`'s own guarded body. This
Stage finishes the consolidation: those two assignments move into one
dedicated, minimal private method, so Bootstrap STATE (not just
Bootstrap Service ACCESS) has a single, named write site.

## 2. What changed, recorded precisely

`src/runtime/fedos_runtime_identity.ts` is the ONLY `src/` file this
Stage modifies. One new private method, and one rewritten statement in
`bootstrapIdentity()`:

```diff
+  #completeBootstrap(descriptor: FedosIdentityDescriptor | null): void {
+    this.#descriptor = descriptor;
+    this.#bootstrapped = true;
+  }
+
   async bootstrapIdentity(): Promise<void> {
     if (this.#bootstrapped) {
       return;
     }
-    this.#descriptor = await this.#describeIdentity();
-    this.#bootstrapped = true;
+    const descriptor = await this.#describeIdentity();
+    this.#completeBootstrap(descriptor);
   }
```

`#completeBootstrap()`'s own body is EXACTLY two statements — the same
two assignments that previously lived inline, in the same order,
performing the exact same effect. No new field, no new public API, no
branching, no I/O.

## 3. #completeBootstrap() — constraints confirmed

Per this Stage's own mandate, `#completeBootstrap()`:

- Is **synchronous** — no `async` keyword, no `await` anywhere in its
  own body.
- Has **no conditional branching** of any kind — no `if`, no ternary,
  no `switch`.
- Makes **no Provider call** — does not reference `this.#service`.
- Makes **no Registry access** — does not reference `this.#registry`.
- Makes **no Storage access** — this class has never had a Storage
  reference, unaffected.
- Makes **no Resolver access** — does not reference `this.#resolver`.
- Has **no `try`/`catch`** — nothing in its own two statements can
  throw.
- Takes exactly one parameter, `descriptor: FedosIdentityDescriptor | null`,
  and returns `void`.

## 4. Confirmation: single write site

`#descriptor` and `#bootstrapped` are each assigned in EXACTLY ONE
place in the entire file: inside `#completeBootstrap()`, and nowhere
else. Confirmed by literal extraction of the class body: a search for
`#descriptor\s*=` finds exactly one match (`this.#descriptor =
descriptor;`), and a search for `#bootstrapped\s*=` finds exactly one
match (`this.#bootstrapped = true;`) — both inside
`#completeBootstrap()`'s own body. `bootstrapIdentity()`'s own body no
longer assigns to either field directly; its own guarded body is now
exactly three statements: the guard, the descriptor-capturing `await`
(now bound to a local `descriptor`), and the single
`this.#completeBootstrap(descriptor);` call.

## 5. What is preserved, explicitly

- **Idempotency guard** — `if (this.#bootstrapped) { return; }`
  remains `bootstrapIdentity()`'s own first statement, completely
  unchanged.
- **`#describeIdentity()`** — completely unchanged; still the sole
  path to `FedosIdentityService.describeIdentity()`.
- **Fail Closed** — a rejection from `#describeIdentity()`'s own
  `await` still prevents `#completeBootstrap()` from ever being
  called, leaving `#descriptor`/`#bootstrapped` exactly as they were —
  identical Fail-Closed behavior to every prior Stage.
- **Descriptor Cache** — `currentIdentity()` remains
  `return this.#descriptor;`, byte-for-byte unchanged.
- **Registry registration** — still entirely
  `FedosIdentityService.describeIdentity()`'s own responsibility,
  reached identically through `#describeIdentity()`; this Stage adds
  no Registry access anywhere.
- **Provider call count** — unaffected; `#completeBootstrap()` never
  calls the Provider, and `#describeIdentity()`'s own call count is
  unchanged.
- **Bootstrap semantics** — `#completeBootstrap(descriptor)` records
  EXACTLY what `#describeIdentity()` resolved, `null` or real,
  unconditionally — the same semantics `bootstrapIdentity()`'s own
  inline assignment always had.

## 6. What this Stage does NOT do

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
- Does **not** change `findIdentity()`/`listIdentities()`/
  `isBootstrapped()`/`currentIdentity()`/`#describeIdentity()` in any
  way.
- Does **not** change the ORDER of `bootstrapIdentity()`'s own
  statements, nor the sequence in which `#descriptor` and
  `#bootstrapped` are set (descriptor first, then bootstrapped —
  `#completeBootstrap()`'s own body preserves that exact order).

## 7. Summary

This Stage adds one minimal private method, `#completeBootstrap(descriptor)`,
whose own two-statement body performs exactly the `#descriptor`/
`#bootstrapped` assignments `bootstrapIdentity()` previously performed
inline, and rewires `bootstrapIdentity()` to call it. `#descriptor` and
`#bootstrapped` are now each written in exactly one place in the
entire file. Every observable behavior — idempotency, Fail Closed,
Registry registration, Provider call count, Bootstrap semantics — is
completely unchanged; this is a pure internal consolidation.

## 8. See also

- `docs/secure_runtime_alpha_060_identity_bootstrap_status.md`
- `docs/secure_runtime_alpha_061_identity_bootstrap_idempotency.md`
- `docs/secure_runtime_alpha_063_runtime_identity_descriptor_cache.md`
- `docs/secure_runtime_alpha_067_identity_reader_boundary_review.md`
- `docs/secure_runtime_alpha_068_identity_reader_boundary_consolidation.md`
