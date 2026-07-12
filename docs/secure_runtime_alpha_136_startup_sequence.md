# Secure Runtime Alpha 136 — Startup Sequence

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`src/desktop/desktop_application.ts`, and nothing else. This is Stage
1 of the Alpha 136–140 Desktop Startup Identity Sequence Arc, following
the completed Desktop Public Identity Refresh Arc (Alpha 131–135),
which closed with the four-layer structure (Runtime Identity / Public
Identity Reader / Public Identity State / Public Identity Refresh)
complete.**

## 1. Why now

`start()` (Alpha 097/098) has always driven Bootstrap alone. With
`refreshPublicIdentity()` now available (Alpha 131), Desktop's own
formal startup sequence — the order in which Runtime Identity and
Public Identity are established when an application starts — had
never been fixed. This Stage fixes it, extending the existing
`construct → bootstrap → ready` order (Alpha 092) by one step.

## 2. What was implemented

```ts
async start(): Promise<void> {
  if (this.#started) {
    throw new Error("DesktopApplication.start() was already called.");
  }
  await this.bootstrap();
  await this.refreshPublicIdentity();
  this.#started = true;
}
```

- A single new line, `await this.refreshPublicIdentity();`, inserted
  between the existing `await this.bootstrap();` and
  `this.#started = true;` — the ONLY change this Stage makes.
- Both calls remain sequentially `await`ed, in this fixed order:
  `bootstrap()` first, `refreshPublicIdentity()` second.
- `#started` still flips to `true` only after BOTH resolve without
  throwing.

## 3. Purity confirmed

- **No processing in between:** neither call's own resolved value is
  read, transformed, or passed to the other — `bootstrap()` resolves
  `void`, and `refreshPublicIdentity()`'s own resolved
  `FedosIdentityDescriptor | null` is discarded (`start()` itself
  returns `Promise<void>`), exactly as `bootstrap()`'s own resolved
  value already was before this Stage.
- **Fixed order:** `bootstrap()` is always awaited to completion
  BEFORE `refreshPublicIdentity()` begins — confirmed by their literal
  line order in `start()`'s own body, `await`ed sequentially (not
  `Promise.all`, not fired-and-forgotten).
- **No new field, no new method:** this Stage adds exactly one
  statement to one existing method.

## 4. What this Stage does NOT do

- Does **not** modify `bootstrap()`, `refreshPublicIdentity()`,
  `readPublicIdentity()`, `currentIdentity()`, `isBootstrapped()`, or
  `currentPublicIdentity()` in any way — only `start()`'s own body
  changes.
- Does **not** add a `try`/`catch` — if `bootstrap()` rejects,
  `refreshPublicIdentity()` is never reached (JavaScript `await`
  control flow), and the rejection propagates out of `start()`
  unchanged, exactly as before this Stage.
- Does **not** change what happens on a repeat `start()` call — the
  guard (`#started` check, THROW) is untouched.
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

- `docs/secure_runtime_alpha_092_bootstrap_sequence_review.md`
- `docs/secure_runtime_alpha_098_ready_state.md`
- `docs/secure_runtime_alpha_131_desktop_refresh_api.md`
