# Secure Runtime Alpha 133 — Refresh State Verification

**Status: this Stage is REVIEW / DESIGN ONLY. It makes NO code change
of any kind — no `src/` file is modified. This is Stage 3 of the
Alpha 131–135 Desktop Public Identity Refresh Arc, following Alpha
132's own Refresh Delegation confirmation.**

## 1. Why now

Alpha 132 confirmed `refreshPublicIdentity()` calls
`readPublicIdentity()` and nothing else. This Stage verifies, by
running the actual code (not just reading it), that the state
consequence callers actually care about — `currentPublicIdentity()`
reflecting the fresh value after a successful refresh, and staying
unchanged after a failed one — genuinely holds, inherited entirely
from `readPublicIdentity()`'s own Alpha 127 persistence contract.

## 2. What was verified

Two behaviors, both already guaranteed by Alpha 127's own
`readPublicIdentity()` contract and inherited automatically by
`refreshPublicIdentity()`, since Alpha 132 already confirmed it adds
no code of its own:

- **On success:** after `await app.refreshPublicIdentity()` resolves,
  `app.currentPublicIdentity()` reflects the exact resolved value, by
  reference — the SAME persistence `readPublicIdentity()` itself
  performs (Alpha 127), reached through Alpha 131's own delegation.
- **On failure:** if the underlying Reader call rejects,
  `refreshPublicIdentity()`'s own returned `Promise` rejects too (it
  performs no `try`/`catch` of its own — Alpha 131), and
  `#currentPublicIdentity` is left completely unchanged — the
  assignment in `readPublicIdentity()`'s own body is never reached,
  exactly as Alpha 127 already established for `readPublicIdentity()`
  directly.

## 3. Decision

**`refreshPublicIdentity()`'s own effect on `currentPublicIdentity()`
is IDENTICAL to `readPublicIdentity()`'s own effect — success updates
the State, failure leaves it untouched — because `refreshPublicIdentity()`
performs the update via the EXACT SAME code path (Alpha 132), not a
duplicate or parallel one. No new state-consistency guarantee is
introduced by this Stage; this Stage VERIFIES the inherited one
genuinely holds under real Reader success and real Reader failure.**

## 4. What this Stage does NOT do

- Does **not** modify `desktop_application.ts` or any other `src/`
  file.
- Does **not** add any new persistence logic — the guarantee verified
  here is entirely Alpha 127's own, merely exercised through Alpha
  131's own new entry point.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, `src/identity/*`,
  Storage, Observation, Rust, `Cargo.toml`, or `package.json`.
- Does **not** implement Relay communication, Nostr communication,
  signing, secret-key handling, or GUI of any kind.

## 5. See also

- `docs/secure_runtime_alpha_127_reader_result_persistence.md`
- `docs/secure_runtime_alpha_128_desktop_public_identity_reader.md`
- `docs/secure_runtime_alpha_132_refresh_delegation.md`
