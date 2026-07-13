# Secure Runtime Alpha 204 — Event Ownership Review

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `src/` file, no `packages/` file, is modified. This is
Stage 4 of the Alpha 201–210 Nostr Event Runtime Exposure Arc,
following Alpha 203's own Null Event Reader & Desktop Wiring
Decision.**

## 1. Why now

This Arc's own Alpha 204 instruction states plainly: "Verify Event
ownership. Desktop consumes Events. Desktop never owns cryptographic
state." Three real files now exist
(`fedos_event_descriptor.ts`/`fedos_event_reader.ts`/`null_event_reader.ts`,
Alpha 202/203). Before Alpha 205 reviews immutability, this Stage
confirms none of the three grants Desktop any cryptographic
capability or ownership — by direct inspection, the SAME discipline
Alpha 197 already applied to the Rust-side Event Foundation, now
applied to the three new Desktop-side files.

## 2. What "ownership" means here, and who holds what

- **The Rust Event Foundation OWNS Event construction and signing.**
  `FedosNostrEventHandle`, `new_nostr_event_internal`,
  `sign_nostr_event_internal` (Alpha 192/195) are the ONLY code in
  this repository that can build or sign an Event, and they remain
  entirely inside `packages/fedos-core-rust/src/`, `pub(crate)` only,
  unreachable from Desktop (Alpha 198, reconfirmed unchanged — §4
  below).
- **Desktop, via `FedosEventReader`, only ever CONSUMES.** The
  interface's single method, `readEvents()`, returns already-finalized
  `FedosEventDescriptor` values — it accepts no argument that could
  construct or influence an Event, and returns no handle, key, or
  capability that could sign one. `NullEventReader` (Alpha 203), the
  only implementation, makes this concrete: it holds no cryptographic
  material of any kind, not even a reference to one.
- **`FedosEventDescriptor` carries no cryptographic STATE, only
  cryptographic OUTPUT.** `signature` is a public, already-computed
  string — output data, not a key, not a signing capability, exactly
  as a NIP-01 event's own broadcast `sig` field already is public once
  published. Holding a `FedosEventDescriptor` grants no ability to
  produce another one.

## 3. Confirmed: no secret key, seed, or signing capability anywhere in
   the three new files

Direct inspection of `fedos_event_descriptor.ts`, `fedos_event_reader.ts`,
and `null_event_reader.ts` (Alpha 202/203, unchanged since):

- Zero reference to `nsec`, `seed`, `mnemonic`, `secretKey`,
  `privateKey`, `SecretHandleKind`, or `FedosNostrSecretKeyHandle` in
  any of the three files' own code.
- Zero method that accepts a key, a seed, or any signing-capable
  parameter — `readEvents()` takes no argument at all.
- Zero method that returns a key, a seed, or a signing-capable value —
  `readEvents()` returns `FedosEventDescriptor[]`, whose own eight
  fields (Alpha 202 §2) are all public, non-secret, already-computed
  data.

## 4. Confirmed: no reference to the Rust Event Foundation of any kind

`fedos_event_descriptor.ts`/`fedos_event_reader.ts`/`null_event_reader.ts`
carry zero reference to `FedosNostrEventHandle`,
`new_nostr_event_internal`, `serialize_nostr_event_canonical_internal`,
`derive_nostr_event_id_internal`, or `sign_nostr_event_internal` —
this Arc's own three new files are entirely independent TypeScript
constructs, never a wrapper or re-export of any `pub(crate)` Rust
symbol (Alpha 201 §5, reconfirmed here by direct inspection rather
than assumed from the design decision alone).

## 5. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** add a signing method, key-acceptance parameter, or
  cryptographic-state field to `FedosEventReader`,
  `FedosEventDescriptor`, or `NullEventReader`.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/*`, `src/nostr/*`,
  Storage, Observation, `Cargo.toml`, or `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_203_null_event_reader_and_desktop_wiring_decision.md`
- `docs/secure_runtime_alpha_202_desktop_facing_event_reader_abstraction.md`
- `docs/secure_runtime_alpha_197_event_boundary_review.md`
- `docs/secure_runtime_alpha_198_event_runtime_boundary_review.md`
