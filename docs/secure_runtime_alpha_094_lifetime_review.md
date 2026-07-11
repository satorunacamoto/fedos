# Secure Runtime Alpha 094 — Lifetime Review

**Status: this Stage is DESIGN REVIEW ONLY. Implementation is
absolutely forbidden. `src/` is untouched by this Stage — no code, no
comment, no field, no method, nothing. This document, its own guard
test, and a `README.md` entry are the entire deliverable. This is
Stage 4 of the Alpha 091–095 Desktop Shell Integration Design Arc.**

## 1. Why now

Alpha 088 already confirmed Desktop holds its own `FedosRuntimeIdentity`
instance for its entire process lifetime (Application Lifetime), and
Alpha 087 already confirmed no explicit destruction API exists or is
needed. This Stage closes the Lifetime question completely, as the
Arc's own final word on it: fixing the full lifecycle diagram
end-to-end and re-confirming, one more time and permanently, that no
disposal method is ever added.

## 2. Review target

What is Identity's own complete lifecycle, from Desktop startup to
Desktop termination, and what must never be added to it?

## 3. The lifecycle

```
Desktop startup
  ↓
Bootstrap
  ↓
use
  ↓
Desktop termination
```

Four phases, and only four. No phase is ever skipped, reordered, or
interrupted by an explicit teardown step: `use` (the entire span
during which Desktop calls `findIdentity()`/`listIdentities()`/
`isBootstrapped()`/`currentIdentity()` as needed) continues
uninterrupted until Desktop termination itself ends the process — not
until a `dispose()`/`destroy()`/`close()`/`shutdown()` call ends it,
because per Alpha 087 and this Stage, none such exists or is ever
added.

## 4. Grounding in the actual source

- No `dispose()`, `destroy()`, `close()`, or `shutdown()` method
  exists anywhere on `FedosRuntimeIdentity` today — confirmed directly
  against the actual class body (five public methods: `findIdentity`,
  `listIdentities`, `bootstrapIdentity`, `isBootstrapped`,
  `currentIdentity`; none of the five tears anything down).
- Alpha 062 (review only, no code change) already formally rejected an
  in-place `resetIdentityBootstrap()`/`Registry.clear()`/`shutdown()`
  of any kind and adopted instead: "treat `FedosRuntimeIdentity` as a
  short-lived object; Identity switching means constructing a new
  instance." This Stage re-confirms that Decision applies unchanged to
  the FULL lifecycle diagram above — the ONLY way Identity's own state
  is ever reset is by replacing the ENTIRE instance with a fresh
  `new FedosRuntimeIdentity()`, never by calling a method that tears
  down or resets the existing one in place.
- Alpha 087 already confirmed this same "never explicit destruction"
  principle for the specific question of WHEN an instance is
  destroyed. This Stage confirms it again as part of the complete
  four-phase lifecycle, closing the topic for the whole Arc.

## 5. Decision

**Identity's own lifecycle is permanently fixed to the four phases in
§3, with NO explicit teardown step ever added between `use` and
Desktop termination. `dispose()`, `destroy()`, `close()`, and
`shutdown()` are PERMANENTLY forbidden as methods on
`FedosRuntimeIdentity`, in any future implementation, for any purpose.
The ONLY way Identity's own state is ever reset — per the pre-existing
Alpha 062 Decision, reconfirmed here as the Arc's own final word on
Lifetime — is constructing an entirely new instance; there is
permanently no in-place reset, teardown, or disposal method of any
kind.**

## 6. What this Stage does NOT do

- Does **not** implement `bootstrap()` or any Desktop Shell construct
  of any kind.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, any `src/identity/*`
  file, Storage, Rust, `Cargo.toml`, or `package.json`.
- Does **not** modify the Public Runtime API in any way.
- Does **not** implement Bootstrap or Observation of any kind.
- Does **not** alter the Alpha 062 Identity-switching Decision — it
  reconfirms it as this Arc's own closing statement on Lifetime.

## 7. See also

- `docs/secure_runtime_alpha_062_identity_bootstrap_reset_review.md`
- `docs/secure_runtime_alpha_087_desktop_bootstrap_ownership_review.md`
- `docs/secure_runtime_alpha_088_desktop_lifetime_review.md`
- `docs/secure_runtime_alpha_091_desktop_entry_point_review.md`
- `docs/secure_runtime_alpha_092_bootstrap_sequence_review.md`
- `docs/secure_runtime_alpha_093_ownership_review.md`
