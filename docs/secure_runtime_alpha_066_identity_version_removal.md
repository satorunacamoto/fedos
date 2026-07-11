# Secure Runtime Alpha 066 — Identity Version Removal

**Status: this Stage implements the Alpha 065 Decision, and ONLY that
Decision. It is a simplification of an existing internal API — removing
a redundant method — not a new feature.**

## 1. Why now

`docs/secure_runtime_alpha_065_identity_runtime_internal_contract_review.md`
formally proved, as a structural property of the actual source, that
`identityVersion()` (Alpha 064) was informationally IDENTICAL to
`isBootstrapped()` (Alpha 060) for every reachable state —
`identityVersion() === (isBootstrapped() ? 1 : 0)`, always — and
adopted Option D: consolidate onto `isBootstrapped()` as the sole
Bootstrap-state reader, deleting `identityVersion()`/`#identityVersion`.
That Stage's own §11 named this removal as the SINGLE recommended
change for the next Stage. This Stage carries it out.

## 2. What changed, recorded precisely

`src/runtime/fedos_runtime_identity.ts` is the ONLY `src/` file this
Stage modifies. Three removals, and nothing else:

```diff
   #bootstrapped: boolean = false;
   #descriptor: FedosIdentityDescriptor | null = null;
-  #identityVersion: number = 0;
```

```diff
     this.#descriptor = await this.#service.describeIdentity();
     this.#bootstrapped = true;
-    this.#identityVersion += 1;
   }
```

```diff
   currentIdentity(): FedosIdentityDescriptor | null {
     return this.#descriptor;
   }
-
-  identityVersion(): number {
-    return this.#identityVersion;
-  }
 }
```

`bootstrapIdentity()`'s own body is now, again, exactly the shape it
had between Alpha 063 and Alpha 064 — the Alpha 061 guard, the
descriptor-capturing `await` (Alpha 063), and the
`this.#bootstrapped = true;` assignment (Alpha 060), in that order,
with no fourth statement. `describeIdentity()`/`findIdentity()`/
`listIdentities()`/`isBootstrapped()`/`currentIdentity()` — the SIX
remaining public methods — are all byte-for-byte unchanged; not one
character inside any of their own bodies was touched.

## 3. Confirmation against the Alpha 065 review

- **`identityVersion() === isBootstrapped() ? 1 : 0` is completely
  gone.** Confirmed: no identifier `identityVersion` (method, field, or
  otherwise) exists anywhere in `fedos_runtime_identity.ts`'s own class
  body. The invariant Alpha 065 proved cannot be re-derived from code
  that no longer exists — it is now simply true by vacuous absence.
- **Bootstrap state has exactly ONE reader: `isBootstrapped()`.**
  Confirmed: `#bootstrapped` is the ONLY private field this class holds
  that answers "has Bootstrap ever succeeded," and `isBootstrapped()`
  is the ONLY public method that reads it. No second boolean-shaped or
  number-shaped accessor of the same fact remains.
- **`currentIdentity()` unaffected.** Byte-for-byte identical to Alpha
  063 — still `return this.#descriptor;`, still reads a field
  `bootstrapIdentity()`'s own guarded body assigns exactly once.
- **`describeIdentity()`/`findIdentity()`/`listIdentities()`
  unaffected.** Byte-for-byte identical to their own original Alpha
  050/053/054 shapes — pure pass-throughs to `#service`/`#resolver`,
  touching none of the fields this Stage removes.
- **`bootstrapIdentity()` remains idempotent, exactly per Alpha 061.**
  The guard (`if (this.#bootstrapped) { return; }`) is untouched and
  remains the method's own first statement; removing the fourth
  statement does not change WHEN the guard fires or what it protects —
  `#bootstrapped`/`#descriptor` are assigned in the identical guarded
  branch as before, one statement shorter.
- **Alpha 065's own §7 `describeIdentity()` bypass finding is
  unaffected by this Stage.** That finding concerned
  `describeIdentity()` writing the Registry while bypassing
  `#bootstrapped`/`#descriptor` tracking — a concern about TWO fields
  that both still exist after this Stage's removal of a THIRD,
  unrelated field. Resolving that finding remains its own,
  separately-scoped future review (Alpha 065 §11, explicitly deferred,
  unaffected by this Stage).

## 4. What this Stage does NOT do

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
- Does **not** change the ORDER of `bootstrapIdentity()`'s own
  remaining three statements (guard, `await`, `#bootstrapped`
  assignment) — only removes the fourth.
- Does **not** touch `describeIdentity()`/`findIdentity()`/
  `listIdentities()`/`isBootstrapped()`/`currentIdentity()` in any way
  — all five remain byte-for-byte unchanged.
- Does **not** act on Alpha 065's own separately-deferred
  `describeIdentity()` bypass finding — that remains a distinct,
  future-scoped review.

## 5. Summary

This Stage implements Alpha 065's own Decision, and only that Decision:
`#identityVersion` and `identityVersion()` are removed from
`FedosRuntimeIdentity`, and `bootstrapIdentity()`'s own guarded body
loses its trailing `this.#identityVersion += 1;` statement. The class
now defines SIX public methods, not seven — the exact shape it had
between Alpha 063 and Alpha 064 — with `isBootstrapped()` remaining the
sole Bootstrap-state reader, exactly as Alpha 065 §9 specified. Every
other method, and every other file in this repository, is completely
unaffected.

## 6. See also

- `docs/secure_runtime_alpha_060_identity_bootstrap_status.md`
- `docs/secure_runtime_alpha_061_identity_bootstrap_idempotency.md`
- `docs/secure_runtime_alpha_063_runtime_identity_descriptor_cache.md`
- `docs/secure_runtime_alpha_064_identity_change_detection.md`
- `docs/secure_runtime_alpha_065_identity_runtime_internal_contract_review.md`
