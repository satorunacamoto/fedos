# Secure Runtime Alpha 074 — Identity Bootstrap Flow Consolidation

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
Descriptor READ (`#currentIdentity()`). Every named unit so far has
been a single responsibility — a Reader, a Writer, an Entry point, a
State reader. What had not yet been named was the Bootstrap FLOW
itself: the act of actually performing a Bootstrap attempt (as
distinct from the guard that decides whether to attempt one, and the
Writer that records the outcome). This Stage gives that Flow its own
isolated, named unit — `#performBootstrap()` — so `#bootstrapIdentity()`
becomes a pure orchestrator: guard, delegate to the Flow, hand the
result to the Writer.

## 2. What changed, recorded precisely

`src/runtime/fedos_runtime_identity.ts` is the ONLY `src/` file this
Stage modifies. One new private method, and one rewritten statement:

```diff
+  async #performBootstrap(): Promise<FedosIdentityDescriptor | null> {
+    return this.#describeIdentity();
+  }
+
   async #bootstrapIdentity(): Promise<void> {
     if (this.#isBootstrapped()) {
       return;
     }
-    const descriptor = await this.#describeIdentity();
+    const descriptor = await this.#performBootstrap();
     this.#completeBootstrap(descriptor);
   }
```

`#performBootstrap()`'s own body is EXACTLY one statement —
`return this.#describeIdentity();` — a bare Promise pass-through with
NO `await` keyword of its own. No other line in the file changed.

## 3. #performBootstrap() — constraints confirmed

Per this Stage's own mandate, the new private `#performBootstrap()`:

- Adds **no synchronous processing** of any kind — its own body is a
  single `return` statement.
- Performs **no State update** — does not assign to `#descriptor` or
  `#bootstrapped`.
- Makes **no `#completeBootstrap()` call** — State writing remains
  entirely `#bootstrapIdentity()`'s own responsibility, after the Flow
  returns.
- Makes **no direct Provider call** — does not reference
  `this.#service`.
- Makes **no direct Registry access** — does not reference
  `this.#registry`.
- Makes **no Resolver access** — does not reference `this.#resolver`.
- Makes **no Storage access** — this class has never had a Storage
  reference, unaffected.
- Has **no `try`/`catch`** — nothing in its own single statement is
  wrapped.
- Has **no `if`** — no branching of any kind.
- Is declared `async`, returning `Promise<FedosIdentityDescriptor | null>`,
  matching `#describeIdentity()`'s own return type exactly.

## 4. Confirmation: #performBootstrap() is the sole Flow, singly reached

`#performBootstrap()` has EXACTLY ONE caller anywhere in the file:
`#bootstrapIdentity()`'s own descriptor-capturing statement,
`const descriptor = await this.#performBootstrap();`. `#describeIdentity()`
in turn now has EXACTLY ONE caller anywhere in the file:
`#performBootstrap()`'s own single statement — no longer
`#bootstrapIdentity()` directly. The full chain is now
`#bootstrapIdentity()` → `#performBootstrap()` → `#describeIdentity()`
→ `FedosIdentityService.describeIdentity()`, with each link having
exactly one caller.

## 5. Confirmation: #bootstrapIdentity() is a pure orchestrator

`#bootstrapIdentity()`'s own body remains EXACTLY the same five
statements it has had since Alpha 072 — guard-if, return,
close-brace, descriptor-capturing await, and the `#completeBootstrap()`
call — with only the awaited expression changed, from
`this.#describeIdentity()` to `this.#performBootstrap()`. It no longer
reaches `#describeIdentity()` directly; it only guards, delegates the
Flow, and hands the result to the Writer.

## 6. Confirmation: #completeBootstrap() remains the sole Writer

`#completeBootstrap()` (Alpha 069) remains the ONLY place in this file
that ever writes `#descriptor`/`#bootstrapped` — completely
unaffected by this Stage. `#performBootstrap()` performs no write of
any kind; it is a pure Flow, returning a resolved (or rejected)
Descriptor for `#bootstrapIdentity()` to hand to the Writer.

## 7. What is preserved, explicitly

- **Idempotency guard** — unchanged in position and behavior; still
  `#bootstrapIdentity()`'s own first statement, reading via
  `#isBootstrapped()` (Alpha 072).
- **Fail Closed** — a rejection from `#performBootstrap()`'s own
  underlying `#describeIdentity()` call still propagates unmodified,
  preventing `#completeBootstrap()` from ever being called — identical
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
  `#isBootstrapped()`/`#currentIdentity()`/`findIdentity()`/
  `listIdentities()`/`isBootstrapped()`/`currentIdentity()`/
  `bootstrapIdentity()` in any way.
- Does **not** change the guard's own position, body, or condition.

## 9. Summary

This Stage adds one minimal private method, `#performBootstrap(): Promise<FedosIdentityDescriptor | null>`,
whose own single-statement body is a bare `return this.#describeIdentity();`,
and rewires `#bootstrapIdentity()`'s own descriptor-capturing statement
to await it instead of `#describeIdentity()` directly. The Bootstrap
Flow now has its own named, isolated unit, reached by exactly one
caller and reaching `#describeIdentity()` as its own exactly-one
caller. `#bootstrapIdentity()` is now a pure orchestrator: guard,
delegate to the Flow, hand the result to the Writer. Every observable
behavior — idempotency, Fail Closed, Registry registration, Provider
call count, Bootstrap semantics — is completely unchanged; this is a
pure internal consolidation.

## 10. See also

- `docs/secure_runtime_alpha_068_identity_reader_boundary_consolidation.md`
- `docs/secure_runtime_alpha_069_identity_bootstrap_state_consolidation.md`
- `docs/secure_runtime_alpha_070_identity_bootstrap_entry_consolidation.md`
- `docs/secure_runtime_alpha_072_identity_bootstrap_state_reader_consolidation.md`
- `docs/secure_runtime_alpha_073_identity_descriptor_reader_consolidation.md`
