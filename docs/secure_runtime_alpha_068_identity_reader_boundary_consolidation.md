# Secure Runtime Alpha 068 — Identity Reader Boundary Consolidation

**Status: this Stage implements the Alpha 067 Decision (Option D), and
ONLY that Decision. It is a visibility change to an existing internal
API — closing a confirmed Bootstrap-lifecycle bypass — not a new
feature.**

## 1. Why now

`docs/secure_runtime_alpha_067_identity_reader_boundary_review.md`
confirmed, from the actual code, that public `describeIdentity()` was a
genuine Bootstrap-lifecycle bypass: it reached the same
`FedosIdentityService.describeIdentity()` `bootstrapIdentity()` reaches
— including the same conditional `registry.register()` write — but
updated NEITHER `#descriptor` NOR `#bootstrapped`, and carried NO
idempotency guard of its own. That Stage also confirmed
`bootstrapIdentity()` itself never called `this.describeIdentity()` —
the two reached the Service through two independent code paths. That
Stage's own §9 adopted Option D: make `describeIdentity()` a true
private method, and rewire `bootstrapIdentity()` to call it, so the
class has exactly ONE internal path to the Service. This Stage
implements that Decision.

## 2. What changed, recorded precisely

`src/runtime/fedos_runtime_identity.ts` is the ONLY `src/` file this
Stage modifies. Two changes, and nothing else:

```diff
-  async describeIdentity(): Promise<FedosIdentityDescriptor | null> {
+  async #describeIdentity(): Promise<FedosIdentityDescriptor | null> {
     return this.#service.describeIdentity();
   }
```

```diff
     if (this.#bootstrapped) {
       return;
     }
-    this.#descriptor = await this.#service.describeIdentity();
+    this.#descriptor = await this.#describeIdentity();
     this.#bootstrapped = true;
   }
```

`#describeIdentity()`'s own body is BYTE-FOR-BYTE the same single
statement the former public `describeIdentity()` had — only the
leading keyword changed (`async describeIdentity(` →
`async #describeIdentity(`), a private-field method name, not a
different implementation. `findIdentity()`/`listIdentities()`/
`isBootstrapped()`/`currentIdentity()` — the four other public methods
— are completely untouched; not one character inside any of their own
bodies was modified. `bootstrapIdentity()`'s own guard, its own
`this.#bootstrapped = true;` assignment, and the ORDER of its three
statements are all unchanged — only the call target of the middle
statement moved from `this.#service.describeIdentity()` to
`this.#describeIdentity()`.

## 3. #describeIdentity() — the resulting structure

```
bootstrapIdentity()
  ↓ (the ONLY caller, anywhere in this file)
#describeIdentity()
  ↓
FedosIdentityService.describeIdentity()
  ↓
FedosIdentityProvider.describeIdentity()
```

`#describeIdentity()` is a true JavaScript private method (`#`-prefixed)
— unreachable from outside `FedosRuntimeIdentity` by any means the
language provides, including from `test/*.test.ts` files, reflection,
or bracket-notation property access. It has EXACTLY ONE caller
anywhere in this file: `bootstrapIdentity()`'s own second statement.
`bootstrapIdentity()` is now the ONLY public method on this class that
ever reaches `this.#service` — directly or indirectly.

## 4. What is preserved, explicitly

Every behavior this Stage's own mandate required to survive unchanged,
confirmed preserved:

- **`#descriptor` update** — `bootstrapIdentity()`'s own
  `this.#descriptor = await this.#describeIdentity();` statement is
  reached in the identical guarded position as before; `#descriptor`
  is assigned to EXACTLY what `#describeIdentity()` resolves, same as
  it was previously assigned to exactly what
  `this.#service.describeIdentity()` resolved (the two are the same
  value — `#describeIdentity()`'s own body is that exact call).
- **`#bootstrapped` update** — `this.#bootstrapped = true;` remains
  the method's own third and final statement, unchanged.
- **Idempotency guard** — `if (this.#bootstrapped) { return; }`
  remains `bootstrapIdentity()`'s own first statement, unchanged and
  unaffected by which call target its own second statement uses.
- **Registry registration** — still entirely
  `FedosIdentityService.describeIdentity()`'s own responsibility (Alpha
  042); `#describeIdentity()` performs no Registry access of its own,
  matching the former public `describeIdentity()`'s own contract
  exactly.
- **Descriptor Cache** — `currentIdentity()` remains
  `return this.#descriptor;`, byte-for-byte unchanged.
- **Fail Closed** — a rejection from `#describeIdentity()` still
  propagates unmodified through `bootstrapIdentity()`'s own `await`,
  leaving `#descriptor`/`#bootstrapped` untouched on failure, exactly
  as the former public `describeIdentity()`'s own rejection did.

## 5. Review confirmation

- **Public Reader removal confirmed.** `describeIdentity` no longer
  appears as an own or prototype property on any `FedosRuntimeIdentity`
  instance — `"describeIdentity" in identity` is `false`, and
  `identity.describeIdentity` is `undefined`, for any `identity = new
  FedosRuntimeIdentity()`.
- **External call sites confirmed zero.** `npm run typecheck` passes
  with zero errors — every one of the 31 test files that previously
  referenced `.describeIdentity()` on some object was audited; the
  subset that called it on a `FedosRuntimeIdentity` instance
  specifically (14 files, 63 individual call sites) was updated to
  route through `bootstrapIdentity()`/`currentIdentity()` instead, or
  RIPPLE-relabeled to confirm the bypass is now closed. No `src/` file
  outside `fedos_runtime_identity.ts` references `describeIdentity` on
  a `FedosRuntimeIdentity` instance — `create_runtime.ts` and
  `src/worker.ts` never did.
- **Sole-reacher confirmed.** `bootstrapIdentity()` is the only public
  method whose own body references `this.#describeIdentity()` or
  `this.#service`; `findIdentity()`/`listIdentities()` route through
  `this.#resolver` only, and `isBootstrapped()`/`currentIdentity()`
  read private fields only, touching neither.

## 6. What this Stage does NOT do

- Does **not** modify `src/runtime/create_runtime.ts`.
- Does **not** modify `src/runtime/types.ts` or any `AppRuntime` field.
- Does **not** modify any `src/identity/*` file (Provider, Registry,
  Resolver, Service, Descriptor, or Record).
- Does **not** modify `src/worker.ts`.
- Does **not** modify any Storage file.
- Does **not** modify `packages/fedos-core-rust`, `Cargo.toml`, or
  `package.json`.
- Does **not** add any Public Runtime API.
- Does **not** implement Desktop, Nostr, Relay, or Authentication
  behavior of any kind.
- Does **not** change `findIdentity()`/`listIdentities()`/
  `isBootstrapped()`/`currentIdentity()` in any way.
- Does **not** change the ORDER of `bootstrapIdentity()`'s own three
  statements — only the call target of the middle one.

## 7. Summary

This Stage implements the Alpha 067 Decision, and only that Decision:
public `describeIdentity()` on `FedosRuntimeIdentity` is removed and
replaced by a true private `#describeIdentity()` with the identical
one-line body, and `bootstrapIdentity()`'s own second statement is
rewired to call it instead of reaching `this.#service` directly. The
class now has exactly ONE internal path to the Identity Service —
`bootstrapIdentity()` → `#describeIdentity()` → `FedosIdentityService.describeIdentity()`
→ `FedosIdentityProvider` — closing the confirmed Bootstrap-lifecycle
bypass Alpha 065/067 identified, with zero change to any observable
behavior of `bootstrapIdentity()`, `isBootstrapped()`,
`currentIdentity()`, `findIdentity()`, or `listIdentities()`.

## 8. See also

- `docs/secure_runtime_alpha_060_identity_bootstrap_status.md`
- `docs/secure_runtime_alpha_061_identity_bootstrap_idempotency.md`
- `docs/secure_runtime_alpha_063_runtime_identity_descriptor_cache.md`
- `docs/secure_runtime_alpha_065_identity_runtime_internal_contract_review.md`
- `docs/secure_runtime_alpha_066_identity_version_removal.md`
- `docs/secure_runtime_alpha_067_identity_reader_boundary_review.md`
