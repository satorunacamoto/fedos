# SecretHandle API Shape (binding, docs only — no code)

**Status: this document adds no code.** It is Stage 142 of the
**SecretHandle real-byte implementation preparation** docs-only batch. It
fixes the concrete TYPE and METHOD shape a future stage MUST implement
`SecretHandle` against — one level more concrete than
`docs/secret_lifecycle_implementation_plan.md`'s policy, but still not an
implementation. Nothing under `src/`, `packages/`, `Cargo.toml`, or
`test/` is changed by this document, and `SecretHandle`
(`packages/fedos-core-rust/src/lib.rs`, Stage 79) still holds only a fixed
placeholder byte today — no real secret byte is introduced by this
document.

This complements, and does not renegotiate,
`docs/secret_lifecycle_implementation_plan.md` (the binding policy this
document gives a concrete shape to), `docs/fedos_core_rust_safety.md` §6
(memory safety), `docs/crypto_test_vectors.md` §8 (Rust implementation
prerequisites), and `docs/fedos_core_architecture_freeze_v1.md` §3–§4
(the current `secret_handle` module). Where this document and any of
those disagree, the earlier binding docs win — this is a shape record,
not a new rule source.

---

## 1. Purpose

- **Fix the concrete API shape before real bytes land.** Name the exact
  types and methods a future `SecretHandle` real-byte implementation
  would add, so that stage has a reviewed shape to build against instead
  of inventing one under implementation pressure — the same "fix the
  shape before the byte" approach `docs/public_random_boundary.md` and
  `docs/fedos_core_public_api_design.md` already used for `randomBytes`
  and the AEAD nonce helper before Stage 137/138 implemented them.
- **Not an implementation.** No field, method, or trait impl is added to
  `SecretHandle` by this document. No `Cargo.toml` change.
- **Binding on whichever future stage implements real bytes.** Per
  `docs/secret_lifecycle_implementation_plan.md` §1, that stage must
  satisfy the policy in full, in one commit/PR — this document is the
  concrete checklist for what "in full" means at the type level.

## 2. `SecretHandle`'s responsibilities

A real-byte `SecretHandle` has exactly four jobs, no more:

- **Hold secret bytes.** Own a fixed-size buffer of real secret material
  (key, seed, or similar — see §5 for the starting input shape), wrapped
  per `docs/secret_lifecycle_implementation_plan.md` §3
  (`secrecy`/`zeroize`).
- **Expose status only.** A caller can observe a non-sensitive state
  snapshot (`SecretHandleStatus`, §4) — never the bytes themselves through
  this path.
- **Clear on drop.** Zeroize the buffer when the handle's scope ends
  (`docs/secret_lifecycle_implementation_plan.md` §6), and also offer an
  explicit `clear()` for a caller that wants to zeroize before the
  handle's natural scope ends.
- **No public raw access.** The crate's PUBLIC API surface never returns
  or accepts these bytes directly (`docs/secret_lifecycle_implementation_plan.md`
  §8) — `SecretHandle` and its methods stay `pub(crate)`-at-most, exactly
  as the Stage 79 skeleton already is.

## 3. `SecretHandle`'s non-responsibilities

`SecretHandle` is a container, not an operation. It does NOT:

- **Generate randomness.** It never calls `fedos_random_bytes_32` (Stage
  137) or any CSPRNG itself — a caller that wants to provision a
  CSPRNG-drawn secret draws the bytes first (e.g. via `randomBytes`) and
  then hands them to `SecretHandle`'s constructor; `SecretHandle` never
  reaches for `getrandom` on its own.
- **Generate a nonce.** It never calls `fedos_aead_nonce_96` (Stage 138)
  or holds a nonce — a nonce is not a secret
  (`docs/nonce_generation_policy.md` §9) and has no reason to be wrapped
  in a secret-handling type at all.
- **Execute HKDF.** It does not derive a key from itself or from any
  other input — that is a future, separate stage's job (§10,
  `docs/secret_lifecycle_implementation_plan.md` §9).
- **Execute AEAD.** It does not seal or open a ciphertext — same
  reasoning, same deferral.
- **Log anything.** It never writes to any audit/logging mechanism
  (`docs/secret_lifecycle_implementation_plan.md` §5), and holds no field
  that could be logged meaningfully — see §7's forbidden-trait list.

Keeping these five non-responsibilities out of `SecretHandle` itself is
what lets `docs/implementation_phase_roadmap.md` §1's ordering (item 3:
`SecretHandle` real bytes, independent of items 4–5: HKDF, then AEAD)
stay a real independence, not just a naming convention — `SecretHandle`
must be reviewable, and testable, entirely on its own.

## 4. Candidate types

Five types, extending (not replacing) the Stage 79 skeleton's existing
`SecretHandleState`/`SecretHandleStatus`/`SecretHandle`:

| Type | Status | Role |
|---|---|---|
| `SecretHandleState` | Already exists (Stage 79) | Coarse lifecycle: `Empty` / `Placeholder` → (future) `Holding` / `Cleared`. A future stage extends this enum's variants (e.g. replacing `Placeholder` with `Holding` once real bytes exist) rather than inventing a parallel enum. |
| `SecretHandleKind` | NEW | What KIND of secret this handle holds — a label only (e.g. `NostrSecretKeyPlaceholder`-style candidates mirroring `FedosKeyFormatLabel`'s Stage 105 vocabulary), never a byte. Exists so a future audit/error path can say "a key-shaped secret failed" without naming or exposing its value. |
| `SecretHandle` | Already exists (Stage 79), gains real bytes | The container itself — see §5 for its accepted input and §7 for what it must never derive. |
| `SecretHandleStatus` | Already exists (Stage 79) | A non-sensitive snapshot — carries `state` today; a future stage MAY add `kind: SecretHandleKind` to it (still no byte). |
| `SecretInputLength` | NEW | The fixed, label-selected input length `SecretHandle` accepts — mirrors `FedosRandomBytesLength` (Stage 137) and `FedosAeadNonceKind` (Stage 138)'s "exactly one variant, no open count" shape. Starts with exactly one variant (§5). |

No type in this table is a public (`pub`) item on the crate's boundary —
all five stay `pub(crate)`-at-most, exactly like Stage 79's existing
three.

## 5. Accepted input

- **Start with a fixed-size `[u8; 32]` input, and nothing else.** The
  first real-byte `SecretHandle` constructor accepts exactly 32 bytes —
  the same fixed-size-array discipline `fedos_random_bytes_32` (Stage
  137, `[u8; 32]` output) and `fedos_aead_nonce_96` (Stage 138, `[u8; 12]`
  output) already established for this crate's other real
  implementations. `SecretInputLength` (§4) has exactly one variant for
  this — call it `ThirtyTwo`, matching `FedosRandomBytesLength`'s own
  naming — so a zero-length, variable-length, or caller-chosen-length
  input is unrepresentable, not merely undocumented.
- **`Vec<u8>` remains FORBIDDEN as an input type.** A growable,
  heap-reallocating buffer cannot be zeroized reliably the way a
  fixed-size array can (reallocation can leave stale copies behind); it
  is out of scope for this first real-byte stage regardless of caller
  convenience. If a future need for variable-length secrets arises, it is
  its own explicitly-reviewed stage — not an incidental relaxation here.
- **`String`/password input remains FORBIDDEN.** A password or passphrase
  is not raw key material — it must go through a password KDF (Argon2id,
  already adopted Stage 84) with a salt, per
  `docs/vault_crypto_identity.md` §3 and `docs/crypto_test_vectors.md` §9
  ("password used directly as a key" is forbidden). `SecretHandle`'s
  32-byte constructor is for already-uniform, already-high-entropy
  material (e.g. `fedos_random_bytes_32`'s own output), never a
  caller-typed string.

## 6. Candidate methods

Five methods, mirroring the Stage 79 skeleton's existing four plus one
new constructor:

- **`new_from_32_bytes_for_internal_use(bytes: [u8; 32]) -> Self`** — the
  one new constructor. Takes ownership of a fixed-size 32-byte array
  (never a slice, never a `Vec<u8>`), immediately wraps it in
  `secrecy::SecretBox` (or its then-current equivalent), and returns a
  handle in a `Holding`-style state (§4). The `_for_internal_use` suffix
  signals, in the name itself, that this stays `pub(crate)` — never a
  crate-public provisioning entry point (that is a separate, future,
  narrowly-scoped decision, per
  `docs/secret_lifecycle_implementation_plan.md` §8).
- **`status(&self) -> SecretHandleStatus`** — unchanged in spirit from
  Stage 79: a non-sensitive snapshot, never a byte.
- **`kind(&self) -> SecretHandleKind`** — NEW. Returns the label fixed at
  construction time (§4) — never a byte, never a length beyond what the
  label itself already implies.
- **`clear(&mut self)`** — unchanged in spirit from Stage 79: zeroizes the
  real buffer (not a fake marker) and transitions to `Cleared`.
- **`is_cleared(&self) -> bool`** — unchanged from Stage 79.

No sixth method exposes the raw bytes. If a future HKDF/AEAD connection
stage (§10) needs the bytes, it adds its OWN narrowly-scoped accessor
(e.g. consumed immediately by an internal AEAD/KDF call, never returned
to a general caller) as part of THAT stage's own review — not as a
generic `expose()`/`as_bytes()` added here "for later."

## 7. Forbidden

`SecretHandle` (and `SecretHandleState`/`SecretHandleKind`/
`SecretHandleStatus`/`SecretInputLength` insofar as they touch it) must
NEVER derive or implement:

- **`Clone`** — per `docs/secret_lifecycle_implementation_plan.md` §4;
  doubling a secret's memory footprint defeats zeroize-on-drop tracking.
- **`Debug` over raw bytes** — per
  `docs/secret_lifecycle_implementation_plan.md` §5; a `Debug` impl, if
  one exists at all, prints only a type name and state label, never a
  byte or its length in a way that narrows down the secret.
- **`AsRef<[u8]>` as a PUBLIC exposure** — `AsRef<[u8]>` is exactly the
  kind of implicit, casual conversion §2/§8 forbid; if an internal
  equivalent is ever needed, it is a `pub(crate)` method with a
  deliberately unergonomic name (mirroring §6's
  `_for_internal_use`-suffix convention), never a trait impl a generic
  caller could reach through ordinary trait-bound code.
- **`Display`** — same reasoning as `Debug`; a human-readable secret
  rendering has no legitimate use here.
- **`Serialize`** (`serde` or otherwise) — serialization is exactly the
  kind of "the bytes escape through an indirect path" risk
  `docs/secret_lifecycle_implementation_plan.md` §8 is written to close;
  no derive, no manual impl.
- **`Eq`/`PartialEq` OVER THE RAW SECRET** — comparing two handles by
  their secret bytes directly (rather than by, say, `kind`/`state`) both
  risks a non-constant-time comparison (the `subtle` dependency, adopted
  Stage 78 and still unused, exists for exactly this eventual need) and
  creates a code path that must touch the raw bytes to answer a
  boolean — unnecessary for a container whose job is holding, not
  comparing. If a future stage genuinely needs equality, it is deliberate,
  reviewed use of `subtle`'s constant-time comparison, not a derived
  `PartialEq`.

## 8. `zeroize`/`secrecy` policy

Restates `docs/secret_lifecycle_implementation_plan.md` §3 and §6 as
this shape's concrete application:

- The 32-byte buffer is wrapped in `secrecy::SecretBox<[u8; 32]>` (or the
  crate's then-current equivalent type), continuing the exact pattern
  Stage 79 already established against its `PlaceholderMarker` — only the
  wrapped value changes from a fake marker to real bytes, not the wrapping
  mechanism.
- `SecretHandle` implements `ZeroizeOnDrop` (or a manual `Drop` impl that
  calls `zeroize`), so the buffer is overwritten the moment `Drop` runs.
- Exposing the raw bytes (for the future HKDF/AEAD connection, §10) is
  confined to a `pub(crate)` internal accessor called immediately at the
  point of use — never stored in a second variable, never returned across
  the crate's public boundary, and never logged.

## 9. Panic / core-dump limitations

Restates `docs/secret_lifecycle_implementation_plan.md` §7 and §10 as a
binding constraint on this shape specifically:

- This shape does **not** claim panic-time zeroization — a panic while a
  `SecretHandle` is live is a **named, open limitation**, not a solved
  problem `new_from_32_bytes_for_internal_use` secretly fixes.
- No `unsafe`, panic hook, or process-level hardening is introduced by
  this shape to paper over that gap — closing it (if ever) is its own
  separate, explicitly-reviewed future stage.
- Core dumps, debuggers, and OS paging can still observe live secret
  memory before `Drop` runs, exactly as
  `docs/secret_lifecycle_implementation_plan.md` §10 already states — this
  shape narrows the exposure window, it does not eliminate it.

## 10. Future HKDF/AEAD connection

- **Not designed by this document.** This document fixes ONLY the
  container's own shape (§2–§7); the future stage that wires
  `SecretHandle` into `kdf_core` (HKDF) is its own separate, later,
  explicitly-reviewed stage, and the stage after that which wires the
  derived key into `aead_core` (AEAD) is later still — per
  `docs/secret_lifecycle_implementation_plan.md` §9 and
  `docs/implementation_phase_roadmap.md` §1's fixed item 3 → 4 → 5 order.
- **Expected shape of that future connection** (naming it, not building
  it): an HKDF stage would add its own `pub(crate)` function taking a
  `SecretHandle` (by reference or by consuming it) and a `domain_label`
  (Stage 88) context, returning a NEW `SecretHandle` wrapping the derived
  output — never mutating the input in place, never returning raw bytes.
  An AEAD stage, later still, would do the same shape of thing consuming
  a (by then real) nonce from `fedos_aead_nonce_96` (Stage 138) and a
  `SecretHandle`-derived key.
- **Until both of those stages land, `SecretHandle` stays exactly as
  disconnected from `kdf_core`/`aead_core` as the Stage 79 skeleton is
  today** — this document does not narrow that gap.

## 11. Conclusion

- **`SecretHandle`'s job is narrow and stays narrow**: hold bytes, report
  status, clear on drop, never expose raw bytes publicly — nothing about
  random generation, nonce generation, HKDF, AEAD, or logging belongs to
  it.
- **Five candidate types** (`SecretHandleState`, `SecretHandleKind`,
  `SecretHandle`, `SecretHandleStatus`, `SecretInputLength`) and **five
  candidate methods** (`new_from_32_bytes_for_internal_use`, `status`,
  `kind`, `clear`, `is_cleared`) are now fixed as the shape a future
  implementation stage builds against.
- **A fixed fed 32-byte input only, no `Vec<u8>`, no `String`/password** —
  matching the fixed-size-array discipline `fedos_random_bytes_32` and
  `fedos_aead_nonce_96` already established.
- **`Clone`, raw-byte `Debug`, public `AsRef<[u8]>`, `Display`,
  `Serialize`, and raw-secret `Eq`/`PartialEq` are all forbidden** —
  six independent, binding constraints.
- **HKDF and AEAD connections remain future, separate, later stages** —
  this document does not implement, schedule, or narrow either.
- No code, test, or `Cargo.toml` change is authorized or made by this
  document.

## 12. Stage 144–146 update — this shape is now IMPLEMENTED

- **`SecretHandle` real bytes landed** in
  `packages/fedos-core-rust/src/lib.rs`, matching this shape with one
  deliberate, documented deviation from §6's exact five-method list:
  `new_placeholder()` (Stage 79) was KEPT rather than replaced, so
  `SecretHandle`'s method set is SIX, not five —
  `new_placeholder`/`new_from_32_bytes_for_internal_use`/`status`/`kind`/
  `clear`/`is_cleared`. This was a deliberate choice (not breaking the
  Stage 79 placeholder path callers/tests may still rely on) rather than an
  oversight; no method beyond these six exists, so the spirit of §6 — no
  "just this once" raw-byte accessor — still holds, verified by
  [`test/fedos_core_rust_secret_handle_real_bytes.test.ts`](../test/fedos_core_rust_secret_handle_real_bytes.test.ts)'s
  exact-method-set assertion.
- **All five candidate types exist**, with `SecretHandleKind` gaining a
  sixth label (`Placeholder`, for the Stage 79 path) beyond the "five real
  labels" this document's §4 sketch implied, plus two additional
  real-secret labels (`HkdfOutputMaterial`, `NostrKeyMaterial`) beyond the
  minimal set §4 named — all still non-sensitive labels, still
  `pub(crate)`-only.
- **§5's input shape is unchanged**: exactly `[u8; 32]`, no `Vec<u8>`, no
  `String`/password.
- **§7's forbidden list holds in full**: no `Clone`, no `Debug` over raw
  bytes, no public `AsRef<[u8]>`, no `Display`, no `Serialize`, no
  raw-secret `Eq`/`PartialEq` — verified by dedicated guard-test assertions
  scanning the actual implementation, not merely asserted in prose.
- **§10's future HKDF/AEAD connection remains exactly as undesigned as
  this document left it** — Stage 144–146 did not narrow that gap.
- See `docs/secret_lifecycle_implementation_plan.md` §15 and
  `packages/fedos-core-rust/README.md`'s Stage 144–146 section for the full
  implementation writeup.
