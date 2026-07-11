# Secure Runtime Alpha 070 — Identity Bootstrap Entry Consolidation

**Status: this Stage relocates `bootstrapIdentity()`'s own entire
guarded body, byte-for-byte unchanged, into a new private
`#bootstrapIdentity()` method, and reduces the PUBLIC
`bootstrapIdentity()` to a pure one-line wrapper. It changes no
observable behavior — idempotency, Fail Closed, Registry registration,
Provider call count, and Bootstrap semantics are all completely
unchanged.**

## 1. Why now

Alpha 068 consolidated the Identity Service access path to a single
private `#describeIdentity()` method (the sole Reader). Alpha 069
consolidated the `#descriptor`/`#bootstrapped` field writes to a
single private `#completeBootstrap()` method (the sole State Writer).
What remained was the Bootstrap Entry point itself: the guard,
`#describeIdentity()` call, and `#completeBootstrap()` call still all
lived directly inside the PUBLIC `bootstrapIdentity()`. This Stage
finishes the consolidation by giving the Bootstrap Entry sequence its
own private home, `#bootstrapIdentity()`, leaving the public method as
a pure wrapper with no logic of its own.

## 2. What changed, recorded precisely

`src/runtime/fedos_runtime_identity.ts` is the ONLY `src/` file this
Stage modifies. One new private method, and the public method reduced
to a single statement:

```diff
   #completeBootstrap(descriptor: FedosIdentityDescriptor | null): void {
     this.#descriptor = descriptor;
     this.#bootstrapped = true;
   }

+  async #bootstrapIdentity(): Promise<void> {
+    if (this.#bootstrapped) {
+      return;
+    }
+    const descriptor = await this.#describeIdentity();
+    this.#completeBootstrap(descriptor);
+  }
+
   findIdentity(id: string): FedosIdentityRecord | null {
     return this.#resolver.findIdentity(id);
   }

   listIdentities(): readonly FedosIdentityRecord[] {
     return this.#resolver.listIdentities();
   }

   async bootstrapIdentity(): Promise<void> {
-    if (this.#bootstrapped) {
-      return;
-    }
-    const descriptor = await this.#describeIdentity();
-    this.#completeBootstrap(descriptor);
+    return this.#bootstrapIdentity();
   }
```

`#bootstrapIdentity()`'s own body is the EXACT same four statements
(guard-if, return, await-into-local, completeBootstrap call) that
`bootstrapIdentity()`'s own body was immediately before this Stage —
transplanted with no change of any kind. The PUBLIC
`bootstrapIdentity()`'s own entire body is now exactly one statement:
`return this.#bootstrapIdentity();`.

## 3. #bootstrapIdentity() — constraints confirmed

Per this Stage's own mandate, the new private `#bootstrapIdentity()`:

- Holds the **entire** Bootstrap body — the guard (Alpha 061), the
  `#describeIdentity()` call (Alpha 068), and the `#completeBootstrap()`
  call (Alpha 069) — in that exact order, unchanged.
- Is **async**, returning `Promise<void>`, identical to the public
  method's own prior signature.
- Has **exactly one caller** anywhere in the file: the PUBLIC
  `bootstrapIdentity()`'s own single statement.
- Introduces **no new field, no new public API, no branching beyond
  the pre-existing guard, no I/O beyond the pre-existing
  `#describeIdentity()` call**.

## 4. Confirmation: public wrapper purity

The PUBLIC `bootstrapIdentity(): Promise<void>` method's own entire
body, after this Stage, is:

```ts
async bootstrapIdentity(): Promise<void> {
  return this.#bootstrapIdentity();
}
```

No guard, no state read or write, no error handling, no logic of any
kind beyond delegating to `#bootstrapIdentity()`. Confirmed by literal
extraction of the method body from the class source: trimmed, it
equals exactly the string `"return this.#bootstrapIdentity();"`.

## 5. What is preserved, explicitly

- **Idempotency guard** — `if (this.#bootstrapped) { return; }`
  remains the first statement of the Bootstrap body, now inside
  `#bootstrapIdentity()`, completely unchanged in position or
  behavior.
- **`#describeIdentity()`** — completely unchanged; still the sole
  path to `FedosIdentityService.describeIdentity()`, still called
  exactly once from the Bootstrap body's own second statement.
- **`#completeBootstrap()`** — completely unchanged; still the sole
  writer of `#descriptor`/`#bootstrapped`, still called exactly once
  from the Bootstrap body's own final statement.
- **Fail Closed** — a rejection from `#describeIdentity()`'s own
  `await` still prevents `#completeBootstrap()` from ever being
  called, leaving `#descriptor`/`#bootstrapped` exactly as they were —
  identical Fail-Closed behavior to every prior Stage.
- **Order** — guard → `#describeIdentity()` → `#completeBootstrap()`
  is preserved exactly; only the enclosing method changed.
- **Registry registration / Provider call count / Bootstrap
  semantics** — entirely unaffected; the relocated body performs the
  identical sequence of calls it always did.

## 6. What this Stage does NOT do

- Does **not** add any new public API — `bootstrapIdentity()` keeps
  its existing name and signature; only its own body changed.
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
  `isBootstrapped()`/`currentIdentity()`/`#describeIdentity()`/
  `#completeBootstrap()` in any way.
- Does **not** change the ORDER of the guard/`#describeIdentity()`/
  `#completeBootstrap()` sequence — only its enclosing method.

## 7. Summary

This Stage adds one new private method, `#bootstrapIdentity()`, that
holds the entire Bootstrap body — the guard, the `#describeIdentity()`
call, and the `#completeBootstrap()` call, unchanged and in the same
order — and reduces the PUBLIC `bootstrapIdentity()` to a pure
one-line wrapper. The Bootstrap Entry point now has a single, named
private home, matching the single-write-site (`#completeBootstrap()`,
Alpha 069) and single-reader-site (`#describeIdentity()`, Alpha 068)
discipline already established for Bootstrap STATE and the Identity
Service READ path. Every observable behavior is completely unchanged;
this is a pure internal consolidation.

## 8. See also

- `docs/secure_runtime_alpha_060_identity_bootstrap_status.md`
- `docs/secure_runtime_alpha_061_identity_bootstrap_idempotency.md`
- `docs/secure_runtime_alpha_063_runtime_identity_descriptor_cache.md`
- `docs/secure_runtime_alpha_067_identity_reader_boundary_review.md`
- `docs/secure_runtime_alpha_068_identity_reader_boundary_consolidation.md`
- `docs/secure_runtime_alpha_069_identity_bootstrap_state_consolidation.md`
