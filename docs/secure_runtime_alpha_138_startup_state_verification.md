# Secure Runtime Alpha 138 — Startup State Verification

**Status: this Stage is REVIEW / DESIGN ONLY. It makes NO code change
of any kind — no `src/` file is modified. This is Stage 3 of the
Alpha 136–140 Desktop Startup Identity Sequence Arc, following Alpha
137's own Bootstrap Ordering confirmation.**

## 1. Why now

Alpha 136 wired the sequence; Alpha 137 confirmed its ordering
guarantee. This Stage verifies, by real execution, the state
consequence callers actually care about: after a successful `start()`,
BOTH `isBootstrapped()` and `currentPublicIdentity()` reflect the
expected, fully-updated state — not just one or the other.

## 2. What was verified

Two independent state updates, both already guaranteed individually
by earlier Stages and composed here for the first time within a single
`start()` call:

- **`isBootstrapped()`**: after `await app.start()` resolves,
  `app.isBootstrapped()` returns `true` — inherited from
  `bootstrap()`'s own effect on `#identity` (Alpha 072/098), reached
  through `start()`'s own first `await`.
- **`currentPublicIdentity()`**: after `await app.start()` resolves,
  `app.currentPublicIdentity()` reflects the Reader's own resolved
  value, by reference — inherited from `refreshPublicIdentity()`'s own
  effect on `#currentPublicIdentity` (Alpha 127/131/133), reached
  through `start()`'s own second `await`.
- **Both together**: a single `start()` call updates BOTH pieces of
  state, in the fixed order Alpha 136 established, with neither update
  interfering with the other — confirmed by running real
  `DesktopApplication` instances with independently-observable Service
  and Reader mocks.

## 3. Decision

**A successful `start()` call leaves `isBootstrapped()` returning
`true` AND `currentPublicIdentity()` reflecting the Reader's own
freshly-resolved value — both guarantees hold simultaneously, and
neither is a NEW guarantee introduced by this Stage: this Stage
VERIFIES that Alpha 098's own Bootstrap-completion guarantee and Alpha
127/131's own Refresh-persistence guarantee compose correctly when
both are driven by the SAME `start()` invocation, in the order Alpha
136 fixed.**

## 4. What this Stage does NOT do

- Does **not** modify `desktop_application.ts` or any other `src/`
  file.
- Does **not** add any new state-consistency guarantee — both
  guarantees verified here are entirely Alpha 098's and Alpha
  127/131's own, merely exercised together through Alpha 136's own new
  sequence.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, `src/identity/*`,
  Storage, Observation, Rust, `Cargo.toml`, or `package.json`.
- Does **not** implement Relay communication, Nostr communication,
  signing, secret-key handling, or GUI of any kind.

## 5. See also

- `docs/secure_runtime_alpha_128_desktop_public_identity_reader.md`
- `docs/secure_runtime_alpha_133_refresh_state_verification.md`
- `docs/secure_runtime_alpha_137_bootstrap_ordering.md`
