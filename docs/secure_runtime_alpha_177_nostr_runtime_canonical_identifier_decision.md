# Secure Runtime Alpha 177 — Nostr Runtime Canonical Identifier Decision

**Status: this Stage is DESIGN / DECISION ONLY. It makes NO code
change of any kind — no `src/` file, no `packages/` file, is modified.
This is Stage 2 of the Alpha 176–180 Nostr Public Identifier Runtime
Boundary Arc, following Alpha 176's own confirmation that the Source
Boundary (Alpha 039) remains the correct, and only, origin seam.**

## 1. Why now

Alpha 172 §4 already adopted Option C — BOTH `hex` and `npub` exist as
separate Rust types, `FedosNostrPublicKeyHex`/`FedosNostrNpub` — a
REPRESENTATION decision, not a canonicality decision: it deliberately
kept both forms available rather than choosing between them. Alpha 171
§3 Q4 separately observed, in passing, that "hex is the more suitable
form for any FUTURE internal/protocol-level use" — but that was an
Inventory Stage's own preliminary note, not a formal ADOPT decision.
This Stage closes that gap: it formally decides, for the Runtime
layer specifically, which ONE of the two string forms is canonical —
the value a future Runtime/protocol-level consumer should reach for
by default when it needs "the" identifier and does not have a
display-specific reason to prefer the other.

## 2. Scope — what "Runtime canonical" means, and does not mean, here

- **In scope**: if/when a future, separately-reviewed Stage ever
  exposes an identifier value through `AppRuntime`, threads it into
  `NostrEvent.pubkey`, or uses it in a relay-filter `authors` array,
  this Stage decides which of `FedosNostrPublicKeyHex`/`FedosNostrNpub`
  that future Stage should reach for BY DEFAULT.
- **NOT in scope, and NOT changed**: Alpha 172's own Option C decision
  to keep BOTH types in the Rust Encoder Boundary. This Stage does not
  remove, deprecate, or discourage `FedosNostrNpub` — it exists
  precisely for the non-Runtime, display use case Alpha 178 reviews
  next. "Canonical for Runtime purposes" and "the only form that may
  ever exist" are different claims; this Stage makes only the first.
- **NOT in scope**: `FedosIdentityDescriptor.publicIdentifier`'s own
  future value — Alpha 176 §6 confirmed that field's origin is the
  Source Boundary, entirely independent of which Rust type this Stage
  names canonical. A future Source implementation remains free to
  supply either string shape (or something else entirely, e.g. a
  linked-account's own external format) — this Stage does not
  constrain it.

## 3. Comparison — hex vs. `npub`, for Runtime-internal purposes only

| Criterion | hex (`FedosNostrPublicKeyHex`) | `npub` (`FedosNostrNpub`) |
|---|---|---|
| `NostrEvent.pubkey` shape (Alpha 171 §2.1, unchanged) | Exact match — zero conversion | Wrong shape — would require a Decoder (explicitly out of scope, Alpha 171 §7/Alpha 175 §6) before use |
| NIP-01 relay `authors` filter | Exact match | Wrong shape, same Decoder problem |
| NIP-19's own stated purpose (Alpha 171 §2.6) | Not a NIP-19 form — hex is simply "the" pubkey field's own native shape | Human-shareable DISPLAY — this is what `npub` exists for, not protocol plumbing |
| Byte-length stability | Fixed 64 ASCII chars, one-to-one with the 32 raw bytes | Fixed 63 ASCII chars, but Bech32-encoded — not a 1:1 byte view, requires decoding to recover bytes |
| Precedent inside this crate | `NostrEvent.pubkey` (Alpha 166 §2.4) already establishes hex as the crate's own pre-existing protocol convention | No existing protocol-level Nostr code in this crate uses `npub` anywhere — it is new as of Alpha 173, purely for the future display path |
| Decoder need if chosen | None — Runtime/protocol code can use the Encoder's hex output directly | Would eventually need a Decoder to go back to bytes for ANY protocol operation — pure round-trip waste this Arc's own Alpha 175 §3 item 2 already flagged |
| Cross-protocol precedent (Alpha 175 §4) | Consistent with "Identifier FORMAT is separated per Protocol Adapter" — hex is Nostr's own native wire form, not borrowed from elsewhere | `npub` is a NIP-19-specific ENCODING CHOICE layered on top of the same bytes — an extra step with no protocol-level payoff |

## 4. Decision: hex is the Runtime-internal canonical representation

**`FedosNostrPublicKeyHex` (lowercase, 64-character hex) is ADOPTED as
the Runtime-internal canonical representation of a Nostr public
identifier.** This reconfirms, and now formally ADOPTS as a Stage
decision rather than an inventory-stage observation, what Alpha 171
§3 Q4 and Alpha 175 §3 item 2 already both pointed toward. The
deciding factor is singular and structural, not stylistic: hex is the
ONLY one of the two string forms that matches a shape any future
Runtime/protocol-level consumer (`NostrEvent.pubkey`, a relay
`authors` filter) already requires with zero conversion step —
choosing `npub` as canonical would mean every such future consumer
decodes it back to bytes first, reintroducing exactly the "unnecessary
decode step" Alpha 175 §3 item 2 already named as the reason NOT to
recommend `npub` for protocol-internal use.

**`npub` remains fully available, unchanged, unreduced in status — it
is simply not the Runtime-internal canonical form.** Its own purpose,
per NIP-19 and per Alpha 175 §3 item 1/3, is DISPLAY — a question
Alpha 178 reviews next, entirely separately from this Stage's own
Runtime-internal question.

## 5. Desktop formatting may differ — restated as this Stage's own
   explicit boundary, not merely inherited

This Stage's own canonical choice binds ONLY the Runtime-internal
layer (Rust protocol-level code, if/when it is ever built, per §2's
own scope). It does NOT bind Desktop presentation, which Alpha 178
reviews as its own, separate question — a Runtime-internal canonical
choice and a Desktop-facing display choice have always been allowed to
differ in this architecture (exactly the same separation Alpha 172 §5
already drew between "internal value types" and "not yet exposed"),
and this Stage does not collapse that separation. Concretely: nothing
in this Decision requires, or even suggests, that Desktop must ever
show hex — Alpha 178 decides that independently, unconstrained by
which form Runtime treats as canonical.

## 6. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** remove, deprecate, or reduce `FedosNostrNpub`'s own
  existing status (Alpha 172 §4, Option C) — both types remain, one
  Runtime-canonical, one display-purposed.
- Does **not** decide Desktop presentation — that is Alpha 178's own
  deliverable.
- Does **not** wire `publicIdentifier`, `AppRuntime`, `create_runtime.ts`,
  `types.ts`, or `worker.ts` to either form — no Public Runtime API
  exists yet for either (Alpha 175 §5, Alpha 176 §5, both unchanged).
- Does **not** implement a Decoder, `nsec`, Schnorr signing, or any
  Event/Relay code.
- Does **not** modify `src/desktop/*`, `src/identity/*`, `src/nostr/*`,
  Storage, Observation, any Protocol Adapter, `Cargo.toml`, or
  `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_176_nostr_public_identifier_origin_review.md`
- `docs/secure_runtime_alpha_175_nostr_public_identifier_completion.md`
- `docs/secure_runtime_alpha_172_nostr_identifier_representation_decision.md`
- `docs/secure_runtime_alpha_171_existing_nostr_identifier_inventory.md`
