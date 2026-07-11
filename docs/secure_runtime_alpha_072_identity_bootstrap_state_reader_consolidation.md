# Secure Runtime Alpha 072 — Identity Bootstrap State Reader Consolidation

**Status: this Stage adds one small private method and rewires two
existing call sites to use it. It changes no observable behavior —
idempotency, Fail Closed, Registry registration, Provider call count,
and Bootstrap semantics are all completely unchanged.**

## 1. Why now

Alpha 068 consolidated the Identity Service READ path to a single
private `#describeIdentity()`. Alpha 069 consolidated Bootstrap STATE
WRITES to a single private `#completeBootstrap()`. Alpha 070
consolidated the Bootstrap ENTRY point to a single private
`#bootstrapIdentity()`. Alpha 071 formally confirmed the resulting
Public API surface. What remained scattered was the Bootstrap STATE
READ: `#bootstrapped` was read directly, in two separate places — the
PUBLIC `isBootstrapped()`'s own body, and `#bootstrapIdentity()`'s own
guard condition. This Stage finishes the pattern: `#bootstrapped` now
has a single, named read site, matching the single-write-site
(`#completeBootstrap()`) this class has had since Alpha 069.

## 2. What changed, recorded precisely

`src/runtime/fedos_runtime_identity.ts` is the ONLY `src/` file this
Stage modifies. One new private method, and two rewritten statements:

```diff
+  #isBootstrapped(): boolean {
+    return this.#bootstrapped;
+  }
+
   async #bootstrapIdentity(): Promise<void> {
-    if (this.#bootstrapped) {
+    if (this.#isBootstrapped()) {
       return;
     }
     const descriptor = await this.#describeIdentity();
     this.#completeBootstrap(descriptor);
   }

   ...

   isBootstrapped(): boolean {
-    return this.#bootstrapped;
+    return this.#isBootstrapped();
   }
```

`#isBootstrapped()`'s own body is EXACTLY one statement —
`return this.#bootstrapped;` — the same read that previously happened
inline in two places, now performed by one dedicated method. No other
line in the file changed.

## 3. #isBootstrapped() — constraints confirmed

Per this Stage's own mandate, the new private `#isBootstrapped()`:

- Is **synchronous** — no `async` keyword, no `await` anywhere in its
  own body.
- Has **no conditional branching** of any kind — no `if`, no ternary,
  no `switch`.
- Has **no `try`/`catch`** — nothing in its own single statement can
  throw.
- Makes **no Provider call** — does not reference `this.#service`.
- Makes **no Registry access** — does not reference `this.#registry`.
- Makes **no Resolver access** — does not reference `this.#resolver`.
- Makes **no Storage access** — this class has never had a Storage
  reference, unaffected.
- Takes no parameters, returns `boolean`.

## 4. Confirmation: public wrapper purity

The PUBLIC `isBootstrapped(): boolean` method's own entire body, after
this Stage, is:

```ts
isBootstrapped(): boolean {
  return this.#isBootstrapped();
}
```

No branching, no I/O, no logic of any kind beyond delegating to
`#isBootstrapped()`. Confirmed by literal extraction: the method body,
trimmed, equals exactly the string
`"return this.#isBootstrapped();"`.

## 5. Confirmation: single read site

`#bootstrapped` is READ in EXACTLY ONE place in the entire file:
inside `#isBootstrapped()`. Confirmed by literal extraction of the
class body: a search for `this\.#bootstrapped` (excluding the
assignment inside `#completeBootstrap()` and the field declaration
itself) finds exactly one read, `return this.#bootstrapped;`, inside
`#isBootstrapped()`. `#isBootstrapped()` itself has exactly TWO
callers anywhere in the file: the PUBLIC `isBootstrapped()`'s own
single statement, and `#bootstrapIdentity()`'s own guard condition.
`bootstrapIdentity()`'s own guard no longer reads `#bootstrapped`
directly — it reads it exclusively through `#isBootstrapped()`.

## 6. What is preserved, explicitly

- **Idempotency guard** — the guard remains
  `#bootstrapIdentity()`'s own first statement, in the same position;
  only its condition's own expression changed, from a direct field
  read to a method call that reads the identical field.
- **`#describeIdentity()`/`#completeBootstrap()`** — completely
  unchanged; still the sole Reader and sole State Writer,
  respectively.
- **Fail Closed** — a rejection from `#describeIdentity()`'s own
  `await` still prevents `#completeBootstrap()` from ever being
  called, leaving `#descriptor`/`#bootstrapped` exactly as they were —
  identical Fail-Closed behavior to every prior Stage.
- **Registry registration / Provider call count / Bootstrap
  semantics** — entirely unaffected; `#isBootstrapped()` is a pure
  read, with zero side effects of its own.
- **`isBootstrapped()`'s own observable return value** — unchanged for
  every caller; `this.#isBootstrapped()` returns EXACTLY what
  `this.#bootstrapped` held, for every possible state.

## 7. What this Stage does NOT do

- Does **not** add any new public API — `isBootstrapped()` keeps its
  existing name and signature; only its own body changed.
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
  `findIdentity()`/`listIdentities()`/`currentIdentity()` in any way.
- Does **not** change `#bootstrapIdentity()`'s own guard POSITION, its
  own `return;` body, or any statement after the guard — only the
  guard's own condition expression.

## 8. Summary

This Stage adds one minimal private method, `#isBootstrapped(): boolean`,
whose own single-statement body performs exactly the `#bootstrapped`
read that previously happened inline in two places — the PUBLIC
`isBootstrapped()` and `#bootstrapIdentity()`'s own guard — and rewires
both to call it. `#bootstrapped` is now read in exactly one place in
the entire file. Every observable behavior — idempotency, Fail Closed,
Registry registration, Provider call count, Bootstrap semantics — is
completely unchanged; this is a pure internal consolidation, matching
the single-write-site/single-reader-site/single-entry-site discipline
Alpha 068/069/070 already established.

## 9. See also

- `docs/secure_runtime_alpha_068_identity_reader_boundary_consolidation.md`
- `docs/secure_runtime_alpha_069_identity_bootstrap_state_consolidation.md`
- `docs/secure_runtime_alpha_070_identity_bootstrap_entry_consolidation.md`
- `docs/secure_runtime_alpha_071_identity_bootstrap_public_api_consolidation.md`
