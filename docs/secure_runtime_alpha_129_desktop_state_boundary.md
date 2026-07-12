# Secure Runtime Alpha 129 — Desktop State Boundary

**Status: this Stage is REVIEW / DESIGN ONLY. It makes NO code change
of any kind — no `src/` file is modified. This is Stage 4 of the
Alpha 126–130 Desktop Public Identity State Arc, following Alpha
128's own `currentPublicIdentity()` addition.**

## 1. Why now

Alpha 116/117 already gave Desktop a Runtime Identity read surface;
Alpha 126–128 gave Desktop a second, independent piece of state —
`#currentPublicIdentity`, read via `currentPublicIdentity()`. Before
Alpha 130's own closing Completion Declaration, this Stage formally
confirms — grounded in the actual, current source — that these two
read surfaces remain completely independent, exactly as Alpha 123
already confirmed for the Reader path as a whole.

## 2. The two, confirmed independent

```
currentIdentity()       ↓  Runtime Identity        (via #identity)
currentPublicIdentity() ↓  Desktop Public State     (via #currentPublicIdentity)
```

- **`currentIdentity()`** (Alpha 116): entire body is
  `return this.#identity.currentIdentity();`. No reference to
  `#currentPublicIdentity`.
- **`currentPublicIdentity()`** (Alpha 128): entire body is
  `return this.#currentPublicIdentity;`. No reference to `#identity`.
- **`#currentPublicIdentity`'s own only writer**: `readPublicIdentity()`
  (Alpha 127), which reads `#reader`, never `#identity`.
- **`#identity`'s own only writers**: `bootstrap()`/`start()`, which
  read/write `#identity` exclusively, never `#currentPublicIdentity`.

No method, field initializer, or constructor statement anywhere in
`DesktopApplication` connects `#identity` and `#currentPublicIdentity`
in either direction.

## 3. Decision

**`currentIdentity()` (Runtime Identity) and `currentPublicIdentity()`
(Desktop Public State) are, and remain, COMPLETELY INDEPENDENT.
Neither reads, writes, triggers, or otherwise influences the other. A
call to `readPublicIdentity()`/`currentPublicIdentity()` produces no
observable effect on `currentIdentity()`/`isBootstrapped()`'s own next
result, and vice versa.** This extends, rather than revises, Alpha
123's own Reader/Authority Boundary Decision: Alpha 123 confirmed the
READ methods (`readPublicIdentity()` vs. `currentIdentity()`/
`isBootstrapped()`) never cross; this Stage confirms the same holds
for the newly-added STATE (`#currentPublicIdentity` vs. `#identity`)
those read methods are now, respectively, backed by.

## 4. What this Stage does NOT do

- Does **not** modify `desktop_application.ts` or any other `src/`
  file.
- Does **not** connect the two states in any way — they remain
  deliberately, permanently separate.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `src/worker.ts`, `src/identity/*`,
  Storage, Observation, Rust, `Cargo.toml`, or `package.json`.
- Does **not** implement Relay communication, Nostr communication,
  signing, secret-key handling, or GUI of any kind.

## 5. See also

- `docs/secure_runtime_alpha_118_desktop_authority_consumption.md`
- `docs/secure_runtime_alpha_123_desktop_public_identity_boundary.md`
- `docs/secure_runtime_alpha_126_desktop_public_identity_state.md`
- `docs/secure_runtime_alpha_128_desktop_public_identity_reader.md`
