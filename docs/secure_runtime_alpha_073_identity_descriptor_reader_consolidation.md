# Secure Runtime Alpha 073 — Identity Descriptor Reader Consolidation

**Status: this Stage adds one small private method and rewires one
existing call site to use it. It changes no observable behavior —
idempotency, Fail Closed, Registry registration, Provider call count,
and Bootstrap semantics are all completely unchanged.**

## 1. Why now

Alpha 068 consolidated the Identity Service READ path to a single
private `#describeIdentity()`. Alpha 069 consolidated Bootstrap STATE
WRITES to a single private `#completeBootstrap()`. Alpha 070
consolidated the Bootstrap ENTRY point to a single private
`#bootstrapIdentity()`. Alpha 072 consolidated the Bootstrap STATE
READ (`#bootstrapped`) to a single private `#isBootstrapped()`. What
remained scattered was the Descriptor READ: `#descriptor` was read
directly, inline, by the PUBLIC `currentIdentity()`'s own body. This
Stage finishes the pattern: `#descriptor` now has a single, named read
site, matching the single-write-site (`#completeBootstrap()`) this
class has had since Alpha 069.

## 2. What changed, recorded precisely

`src/runtime/fedos_runtime_identity.ts` is the ONLY `src/` file this
Stage modifies. One new private method, and one rewritten statement:

```diff
+  #currentIdentity(): FedosIdentityDescriptor | null {
+    return this.#descriptor;
+  }
+
   async #bootstrapIdentity(): Promise<void> {
     ...
   }

   ...

   currentIdentity(): FedosIdentityDescriptor | null {
-    return this.#descriptor;
+    return this.#currentIdentity();
   }
```

`#currentIdentity()`'s own body is EXACTLY one statement —
`return this.#descriptor;` — the same read that previously happened
inline in the PUBLIC method, now performed by one dedicated method.
No other line in the file changed.

## 3. #currentIdentity() — constraints confirmed

Per this Stage's own mandate, the new private `#currentIdentity()`:

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
- Takes no parameters, returns `FedosIdentityDescriptor | null`.

## 4. Confirmation: public wrapper purity

The PUBLIC `currentIdentity(): FedosIdentityDescriptor | null` method's
own entire body, after this Stage, is:

```ts
currentIdentity(): FedosIdentityDescriptor | null {
  return this.#currentIdentity();
}
```

No branching, no I/O, no logic of any kind beyond delegating to
`#currentIdentity()`. Confirmed by literal extraction: the method
body, trimmed, equals exactly the string
`"return this.#currentIdentity();"`.

## 5. Confirmation: single read site

`#descriptor` is READ in EXACTLY ONE place in the entire file: inside
`#currentIdentity()`. Confirmed by literal extraction of the class
body: a search for `this\.#descriptor` (excluding the assignment
inside `#completeBootstrap()` and the field declaration itself) finds
exactly one read, `return this.#descriptor;`, inside
`#currentIdentity()`. `#currentIdentity()` itself has EXACTLY ONE
caller anywhere in the file: the PUBLIC `currentIdentity()`'s own
single statement.

## 6. Confirmation: #completeBootstrap() remains the sole writer

`#completeBootstrap()` (Alpha 069) remains the ONLY place in this file
that ever WRITES `#descriptor` — completely unaffected by this Stage.
`#currentIdentity()` performs no write of any kind; it is a pure read.
The single-write-site property Alpha 069 established for `#descriptor`
is unchanged; this Stage adds the matching single-read-site.

## 7. What is preserved, explicitly

- **`#describeIdentity()`/`#completeBootstrap()`/`#isBootstrapped()`/
  `#bootstrapIdentity()`** — completely unchanged; still the sole
  Reader, sole State Writer, sole Bootstrap State Reader, and sole
  Bootstrap Entry point, respectively.
- **Fail Closed** — a rejection from `#describeIdentity()`'s own
  `await` still prevents `#completeBootstrap()` from ever being
  called, leaving `#descriptor`/`#bootstrapped` exactly as they were —
  identical Fail-Closed behavior to every prior Stage.
- **Registry registration / Provider call count / Bootstrap
  semantics** — entirely unaffected; `#currentIdentity()` is a pure
  read, with zero side effects of its own.
- **`currentIdentity()`'s own observable return value** — unchanged
  for every caller; `this.#currentIdentity()` returns EXACTLY the
  same reference `this.#descriptor` held — no clone, no defensive
  copy.

## 8. What this Stage does NOT do

- Does **not** add any new public API — `currentIdentity()` keeps its
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
  `#isBootstrapped()`/`#bootstrapIdentity()`/`findIdentity()`/
  `listIdentities()`/`isBootstrapped()`/`bootstrapIdentity()` in any
  way.

## 9. Summary

This Stage adds one minimal private method, `#currentIdentity(): FedosIdentityDescriptor | null`,
whose own single-statement body performs exactly the `#descriptor`
read that previously happened inline in the PUBLIC `currentIdentity()`,
and rewires it to call the new method. `#descriptor` is now read in
exactly one place in the entire file, while `#completeBootstrap()`
remains its sole writer. Every observable behavior — idempotency, Fail
Closed, Registry registration, Provider call count, Bootstrap
semantics — is completely unchanged; this is a pure internal
consolidation, matching the single-write-site/single-reader-site/
single-entry-site/single-state-reader-site discipline Alpha 068/069/
070/072 already established.

## 10. See also

- `docs/secure_runtime_alpha_068_identity_reader_boundary_consolidation.md`
- `docs/secure_runtime_alpha_069_identity_bootstrap_state_consolidation.md`
- `docs/secure_runtime_alpha_070_identity_bootstrap_entry_consolidation.md`
- `docs/secure_runtime_alpha_072_identity_bootstrap_state_reader_consolidation.md`
