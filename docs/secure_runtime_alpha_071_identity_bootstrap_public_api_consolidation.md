# Secure Runtime Alpha 071 — Identity Bootstrap Public API Consolidation

**Status: this Stage is a REVIEW / FORMAL CONFIRMATION only. It makes
NO functional code change — it adds a single header-comment paragraph
to `fedos_runtime_identity.ts` recording the confirmation, and nothing
else. Every property this Stage confirms was already established by
Alpha 070; nothing here alters behavior.**

## 1. Why now

Alpha 068 consolidated the Identity Service READ path to a single
private `#describeIdentity()`. Alpha 069 consolidated Bootstrap STATE
writes to a single private `#completeBootstrap()`. Alpha 070
consolidated the Bootstrap ENTRY point itself into a single private
`#bootstrapIdentity()`, reducing the PUBLIC `bootstrapIdentity()` to a
one-line wrapper. What remained unexamined, formally, was the PUBLIC
API surface itself: is there now exactly ONE public Bootstrap entry
point, with ZERO Bootstrap logic of its own? This Stage answers that
question directly, from the actual source, and records the answer.

## 2. What is confirmed, recorded precisely

Reading `src/runtime/fedos_runtime_identity.ts` as it exists today:

```ts
async bootstrapIdentity(): Promise<void> {
  return this.#bootstrapIdentity();
}
```

The PUBLIC `bootstrapIdentity()`'s own entire body is exactly one
statement. It contains:

- **No `if`** — no guard of its own; the idempotency guard lives
  exclusively inside `#bootstrapIdentity()`.
- **No `await`** — the delegation is a direct `return` of the
  `Promise` `#bootstrapIdentity()` produces; the public method never
  itself suspends.
- **No `try`/`catch`** — no error handling of its own; a rejection
  from `#bootstrapIdentity()` propagates through the returned
  `Promise` unmodified.
- **No reference to `#service`, `#registry`, or `#resolver`** — no
  Provider, Registry, or Storage access of any kind.

## 3. #bootstrapIdentity() — sole holder, confirmed

The following five elements exist in EXACTLY ONE place anywhere in
the class body — private `#bootstrapIdentity()` — confirmed by literal
extraction and cross-checked against every other method:

1. **The guard** — `if (this.#bootstrapped) { return; }`.
2. **The `#describeIdentity()` call** — the sole path to
   `FedosIdentityService.describeIdentity()`.
3. **The `#completeBootstrap()` call** — the sole writer of
   `#descriptor`/`#bootstrapped`.
4. **The `await`** — the only suspension point in the entire Bootstrap
   sequence.
5. **The Descriptor capture** — `const descriptor = await
   this.#describeIdentity();`, the only place a resolved Descriptor is
   ever bound to a local before being handed to `#completeBootstrap()`.

## 4. Public API surface — confirmed minimal

`FedosRuntimeIdentity` exposes exactly FIVE public methods:
`findIdentity()`, `listIdentities()`, `bootstrapIdentity()`,
`isBootstrapped()`, `currentIdentity()`. Of these, `bootstrapIdentity()`
is the ONLY one that can trigger a Provider read or a Registry write,
and it does so through EXACTLY ONE internal path —
`#bootstrapIdentity()` → `#describeIdentity()` →
`FedosIdentityService.describeIdentity()` — with EXACTLY ONE writer of
the resulting state, `#completeBootstrap()`. There is no second public
entry point, no second private entry point, and no code path that
reaches the Service, the Registry, or either private state field
without passing through this exact chain.

## 5. What this Stage does NOT do

- Does **not** change `bootstrapIdentity()`'s own body — it was
  already the pure wrapper this Stage confirms.
- Does **not** change `#bootstrapIdentity()`, `#describeIdentity()`,
  or `#completeBootstrap()` in any way.
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

## 6. Summary

This Stage is a formal review, not an implementation. It confirms,
against the actual current source, that the Public Bootstrap API is
now consolidated to exactly one place — the PUBLIC `bootstrapIdentity()`
wrapper — with zero Bootstrap logic of its own, and that every element
of the Bootstrap sequence (guard, Reader call, State Writer call,
`await`, Descriptor capture) exists in exactly one place, private
`#bootstrapIdentity()`. No behavior changes; this Stage records, in a
single header-comment paragraph, a property Alpha 070 already
established.

## 7. See also

- `docs/secure_runtime_alpha_067_identity_reader_boundary_review.md`
- `docs/secure_runtime_alpha_068_identity_reader_boundary_consolidation.md`
- `docs/secure_runtime_alpha_069_identity_bootstrap_state_consolidation.md`
- `docs/secure_runtime_alpha_070_identity_bootstrap_entry_consolidation.md`
