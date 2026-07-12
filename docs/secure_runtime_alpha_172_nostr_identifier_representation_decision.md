# Secure Runtime Alpha 172 — Nostr Public Identifier Representation Decision

**Status: this Stage is DESIGN / DECISION ONLY. It makes NO code
change of any kind — no `src/` file, no `packages/` file, is modified.
This is Stage 2 of the Alpha 171–175 Nostr Public Identifier Encoding
Arc, following Alpha 171's own Inventory.**

## 1. Why now

Alpha 171 confirmed both `hex` and Bech32 (`npub`) are implementable
with zero new dependency, that Rust must own the Encoder boundary, and
that NIP-19's own encoding rule is fully specified. This Stage decides
HOW the two resulting values are REPRESENTED, comparing five options
and adopting exactly one.

## 2. Options compared

| # | Option | Description |
|---|---|---|
| A | hex only | Generate only the lowercase hex form; never produce `npub`. |
| B | npub only | Generate only the Bech32 `npub` form; never produce hex. |
| C | hex and npub, separate dedicated types | Generate BOTH, each in its own purpose-named Rust type. |
| D | Single `String`-typed value, mixed by convention | One generic `String`-returning function, caller decides by naming/comment convention which form it holds. |
| E | Treat the Public Key Handle itself as the Identifier | No new type at all — callers reach for `FedosNostrPublicKeyHandle` wherever an "identifier" is needed. |

## 3. Evaluation

| Criterion | A (hex only) | B (npub only) | C (hex + npub, separate types) | D (single `String`) | E (Handle as Identifier) |
|---|---|---|---|---|---|
| Nostr protocol canonical form | Correct for `NostrEvent.pubkey` (Alpha 171 §2.1), but a caller needing `npub` for display has no path | Correct for user-facing display, but `NostrEvent.pubkey`/relay filters need hex, unreachable | BOTH canonical forms available, each exactly where the protocol itself expects it | Both reachable, but nothing in the TYPE tells a caller which shape a given `String` actually holds | The Handle holds neither string form — every caller would need its OWN ad hoc conversion, defeating the point of a shared Encoder Boundary |
| NIP-19 user-facing form | Missing entirely | Present | Present | Present, but unverifiable by type alone | Missing entirely |
| Type safety | High within its own narrow scope, but incomplete | High within its own narrow scope, but incomplete | **Highest** — `FedosNostrPublicKeyHex` and `FedosNostrNpub` can never be confused with each other or with an arbitrary `String` | **Lowest** — nothing stops a hex value from being passed where `npub` was expected, or vice versa | N/A — no string type exists to misuse, but also none to use correctly |
| Misuse prevention | N/A (only one form exists) | N/A (only one form exists) | A function requiring "the npub form" can name `FedosNostrNpub` in its own signature and the compiler enforces it — impossible with either A or B alone once a second form is eventually needed | Directly enables misuse — any `String` satisfies any parameter | N/A |
| Desktop display | Would need `npub` for the SAME reason B exists, but A cannot provide it | Directly usable once wired (a FUTURE, separate Stage — Alpha 171 §2.9) | Directly usable once wired, via `FedosNostrNpub` specifically | Usable, but the wiring Stage would need external documentation (not the type system) to know which `String` value is safe to display | N/A — Desktop cannot reach a Handle's own bytes at all (Alpha 168's own Opaque design), so this option provides nothing displayable |
| Event construction | `NostrEvent.pubkey` needs EXACTLY this form (Alpha 171 §2.1) — A alone would suffice for this ONE future need | Wrong form — a future Event-construction Stage would need to convert `npub` back to hex, an unnecessary decode step | `FedosNostrPublicKeyHex` is directly the right shape for a FUTURE Event-construction Stage, with zero conversion | Usable, with the SAME "which shape is this `String`" ambiguity as above | N/A |
| Relay query (NIP-01 `authors` filter, hex) | Directly usable | Wrong form, would need decoding first | `FedosNostrPublicKeyHex` directly usable, `FedosNostrNpub` correctly NOT offered for this purpose | Usable but ambiguous, same as above | N/A |
| Identity Descriptor alignment | `FedosIdentityDescriptor.publicIdentifier` is a `string` today (Alpha 171 §2.9) — a future wiring Stage could take EITHER form from Option C and adapt it; A alone forecloses using `npub` there without a second Arc | Same, foreclosing hex use without a second Arc | Both remain available for whichever the FUTURE wiring Stage (Alpha 175 §5's own recommendation) picks — no foreclosure either way | Same availability as C, but without the type-level guarantee about which value was actually produced | N/A |
| Decoder symmetry | A future Decoder (explicitly out of scope, Alpha 171 §7) would need to know it is decoding hex — trivial either way | Same, for `npub` | A future Decoder's own return type can symmetrically be `FedosNostrPublicKeyHex`/`FedosNostrNpub` — the encode/decode type pair stays self-documenting | A future Decoder returning `String` reintroduces the SAME shape-ambiguity this whole Stage exists to avoid | N/A — no Decoder is meaningful without a string form to decode into in the first place |
| Dependency addition | None | None | None | None | None |
| Rust Boundary | Simple — one function | Simple — one function | Two small functions, still `pub(crate)`-only, still inside the SAME Encoder Boundary (Alpha 171 §3) | One function, but the boundary itself provides no shape guarantee once it returns | No Encoder Boundary exists at all under this option — directly contradicts this Arc's own "専用の内部Encoder Boundaryへ限定する" instruction |
| TypeScript Boundary | Untouched (correct — Alpha 171 §3) | Untouched (correct) | Untouched (correct) | Untouched (correct) | Untouched (correct) |
| Future Session/ATProto separation | A hex-shaped type is ALREADY named for Nostr specifically (`FedosNostrPublicKeyHex`, not `FedosPublicKeyHex`) — no generic-naming temptation | Same, `FedosNostrNpub` is Nostr-specific by name | Both are Nostr-specific by name — a future Session/ATProto identifier gets its OWN types, never these two reused (this Arc's own Protocol Extensibility Review, §7) | A bare `String` return type invites a FUTURE maintainer to reuse the SAME encoder function signature shape for an unrelated protocol's own identifier, EXACTLY the confusion Alpha 170 §4 and this Arc's own Protocol Extensibility Review forbid | N/A |
| Backward compatibility | N/A — this is a new Arc, no prior identifier encoder exists to be compatible with | N/A | N/A | N/A | N/A |
| Testability | Straightforward, but only covers one form | Straightforward, but only covers one form | Both forms directly, independently testable (Alpha 174) — determinism/separation proven once per form | Testable, but tests cannot lean on the type system to catch a "wrong form passed" bug — must inspect string CONTENT/prefix defensively every time | N/A |

## 4. Decision: Option C

**Option C — generate BOTH `hex` and `npub`, each in its own dedicated
type (`FedosNostrPublicKeyHex`, `FedosNostrNpub`) — is adopted,
exactly as this Arc's own instruction named as the first candidate to
consider.** Options A and B are each individually insufficient: this
Arc's own Objective explicitly names BOTH forms as targets ("対象:
lowercase 64-character hexadecimal public key / npub Bech32 public
identifier"), and Alpha 171 §2.1/§2.6 confirm the two forms serve
genuinely different, both-real future purposes (protocol-level
`NostrEvent.pubkey`/relay-query use for hex; NIP-19 user-facing
display for `npub`) — picking only one would foreclose the other
without a second Arc. Option D is REJECTED outright: a single
`String`-typed return value provides NO type-level guarantee about
which form it holds, directly enabling the exact cross-protocol/
cross-form misuse this Arc's own Protocol Extensibility Review
forbids ("自由なstring混在は禁止する"). Option E is REJECTED outright:
it provides no Encoder Boundary at all, directly contradicting this
Arc's own explicit instruction to concentrate identifier-encoding
responsibility in one dedicated boundary.

## 5. Scope: internal value types only, not yet exposed

Per this Arc's own instruction — "公開IdentifierがPublic Runtime API
へまだ出ない以上、Rust内部型または内部値型に留めること" —
`FedosNostrPublicKeyHex` and `FedosNostrNpub` are `pub(crate)` Rust
types, reachable ONLY from within `packages/fedos-core-rust/src/`.
Neither type, nor either encoder function, is `#[wasm_bindgen]`-
annotated, exported from `create_runtime.ts`/`types.ts`/`AppRuntime`,
or reachable from Desktop/Worker — this Stage's own decision does not
change that boundary, and Alpha 173/174 implement within it, not
around it.

## 6. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** implement `FedosNostrPublicKeyHex`/`FedosNostrNpub` or
  either encoder function — that is Alpha 173's own deliverable.
- Does **not** decide the FINAL `FedosIdentityDescriptor.publicIdentifier`
  wiring — Alpha 175 §5 names a recommendation, still unwired.
- Does **not** implement a Decoder, `nsec`, Schnorr signing, or any
  Event/Relay code.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/nostr/*`, Storage, Observation,
  Rust, `Cargo.toml`, or `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_171_existing_nostr_identifier_inventory.md`
- `docs/secure_runtime_alpha_167_nostr_public_key_representation_decision.md`
- `docs/secure_runtime_alpha_162_nostr_account_derivation_decision.md`
