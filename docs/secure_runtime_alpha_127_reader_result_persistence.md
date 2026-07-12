# Secure Runtime Alpha 127 — Reader Result Persistence

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`src/desktop/desktop_application.ts`, and nothing else. This is Stage
2 of the Alpha 126–130 Desktop Public Identity State Arc, following
Alpha 126's own inert `#currentPublicIdentity` field addition.**

## 1. Why now

Alpha 126 added `#currentPublicIdentity` but left it unwired — every
call to `readPublicIdentity()` still resolved fresh, without storing
anything. This Stage wires the ONE persistence point the field exists
for: `readPublicIdentity()` itself, on its own successful resolution.

## 2. What was implemented

```ts
async readPublicIdentity(): Promise<FedosIdentityDescriptor | null> {
  const result = await this.#reader.readPublicIdentity();
  this.#currentPublicIdentity = result;
  return result;
}
```

- `readPublicIdentity()` becomes `async` and `await`s the Reader's own
  result into a local `const result`.
- `this.#currentPublicIdentity = result;` — a direct assignment, by
  reference, of the exact resolved value.
- `return result;` — the exact same value is still returned to the
  caller, unchanged from Alpha 121's own contract.

## 3. Purity confirmed

- **Success-only persistence:** the assignment is a plain, sequential
  statement AFTER the `await`. If `this.#reader.readPublicIdentity()`
  were ever to reject, the `await` throws and the function returns
  (via the rejected `Promise`) before `this.#currentPublicIdentity =
  result;` is ever reached — `#currentPublicIdentity` is left
  unchanged on any hypothetical failure. No `try`/`catch` is added; no
  new error-handling behavior is introduced.
- **A resolved `null` DOES persist:** per Alpha 101's own interface
  contract, a resolved `null` (no identity found) is a SUCCESSFUL
  resolution, not a failure — it is assigned to
  `#currentPublicIdentity` exactly like any other resolved value.
- **No clone:** `result` is stored and returned by reference — no
  spread, no property copy, no `JSON.parse(JSON.stringify(...))`, no
  transformation of any kind.
- **No Identity Runtime access:** `#identity` is not referenced
  anywhere in the new body — confirmed directly against the method's
  own three-line body.

## 4. What this Stage does NOT do

- Does **not** add a public reader method for
  `#currentPublicIdentity` — that is Alpha 128's own deliverable
  (`currentPublicIdentity()`).
- Does **not** add caching in the sense of SKIPPING a Reader call —
  every call to `readPublicIdentity()` still invokes
  `this.#reader.readPublicIdentity()` fresh, exactly as Alpha 121 left
  it; only the STORAGE of the result is new.
- Does **not** modify `currentIdentity()`, `isBootstrapped()`,
  `bootstrap()`, or `start()` in any way.
- Does **not** add a `try`/`catch` or any other new error-handling
  behavior.
- Does **not** modify `create_desktop_application.ts`,
  `fedos_public_identity_reader.ts`, `nostr_public_identity_reader.ts`,
  or `static_nostr_public_identity_source.ts`.
- Does **not** modify any `src/identity/*` file.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, Storage,
  Observation, Rust, `Cargo.toml`, or `package.json`.
- Does **not** implement Relay communication, Nostr communication,
  signing, secret-key handling, or GUI of any kind.

## 5. See also

- `docs/secure_runtime_alpha_061_identity_bootstrap_idempotency.md`
- `docs/secure_runtime_alpha_121_desktop_reader_access.md`
- `docs/secure_runtime_alpha_126_desktop_public_identity_state.md`
