# 14 — Associated Data

## What already exists: a coarse, fixed-label AAD domain, not per-conversation binding

`AeadAadDomain` (`fedos_wasm_loader.ts:1384`, real, Seam 2):

```ts
export type AeadAadDomain = "RootKey" | "Identity" | "Storage" | "Conversation" | "TestOnly";
```

`"Conversation"` already exists as one of five fixed values, mapped to a
fixed numeric discriminant (`Conversation: 3`) on the Rust side
(`AeadAadDomain` in `packages/fedos-core-rust`, per the TS-side comment
naming `FedosAeadAadDomain`'s own declaration order). **This is a
coarse, closed-enum domain SEPARATOR, not a per-conversation, per-epoch,
or per-sender binding.** Calling `encrypt(key, algorithm, "Conversation",
plaintext)` cryptographically binds the ciphertext to "this key was used
in a Conversation-domain AEAD call," and nothing more specific — it does
not, by itself, bind the ciphertext to *which* conversation, *which*
epoch, or *whose* message this is. Confirmed by direct reading of
`fedos_runtime_encrypt.ts`'s own `encrypt()` signature: it accepts
`aadDomain: AeadAadDomain` as one of four fixed-vocabulary values, with
no free-form context string parameter anywhere in Seam 2's real,
existing API.

## SEC §13's own warning, directly relevant here

SEC §13 already drew a critical distinction this review reuses: `AeadAadDomain`
(AEAD's own AAD-binding vocabulary) and `HkdfDomain` (key-derivation
domain separation) are **related but distinct vocabularies that must
never be conflated**. This review's own finding above is a direct
application of that same discipline to the Envelope specifically: the
existing `"Conversation"` AAD domain value is a HINT that this
codebase's own architects already anticipated conversation-scoped AEAD
use (SEC §01's own finding, reconfirmed), but it is not itself a
mechanism for binding a *specific* conversation's identity into a
ciphertext's authentication.

## What the Envelope needs bound, reasoned from repo facts

Given `04_envelope_v1.md`'s own field list, the properties an AEAD-style
associated-data binding should protect against tampering (without being
secret, per AEAD's own definition — AAD is authenticated, not
encrypted) are exactly the fields whose *silent substitution* would be a
real attack:

- **`conversationId`** — without binding, a ciphertext sealed for
  conversation A could be relocated (replayed) as if it belonged to
  conversation B, without the AEAD tag catching it (the tag would still
  verify, since the key used may be identical or related, per SEC §17's
  own finding that a Direct pairwise key is deterministically
  re-derivable from Master Seed + counterparty public key — meaning key
  reuse across *different* conversation contexts is a real, structural
  possibility this codebase's own design must guard against, not a
  hypothetical).
- **`keyEpoch`** — without binding, a ciphertext sealed under an old
  epoch's key could be replayed as if current, if the same key material
  were ever reused across epochs (SEC §06's own epoch model assumes
  distinct keys per epoch, but does not, on its own, prevent an AEAD
  call from omitting epoch context).
- **`senderRef`** (once real, `08_membership_readiness.md`) — without
  binding, in a Direct conversation specifically (a *pairwise* key
  shared symmetrically by exactly two parties), nothing about the raw
  AEAD ciphertext itself distinguishes "Alice encrypted this" from "Bob
  encrypted this" — both parties hold the same derived key. Binding
  `senderRef` into AAD does not itself add sender authentication beyond
  "one of the two pairwise parties sent this" (a structural property of
  symmetric pairwise encryption, not a per-message signature) — but it
  does prevent a *relocated* ciphertext (originally from Alice) from
  being silently reattributed to Bob's own outgoing messages.

## What this review recommends, and what remains unresolved

**Recommendation, design-level only**: the associated data passed to
`encrypt()`/`decrypt()` should be a fixed-format, deterministic
concatenation of `conversationId`, `keyEpoch`, and `senderRef` (once
real), rather than relying on the `"Conversation"` `AeadAadDomain` label
alone.

**What is unresolved, and requires a genuine Rust-side design change,
not merely a TypeScript-side decision**: Seam 2's real, existing
`encrypt()`/`decrypt()` signatures do **not** accept a free-form
associated-data byte string today — only the closed `AeadAadDomain`
enum. Binding `conversationId`/`keyEpoch`/`senderRef` as described above
would require either (a) a Rust-side API change adding a genuine
free-form AAD parameter alongside the fixed domain label, or (b) an
application-level convention where these fields are concatenated into
the *plaintext itself* before encryption and only checked after
decryption (weaker — this does not use AEAD's own authentication
property for these fields, only its confidentiality). This review does
not choose between (a)/(b) — it names the gap as one this codebase's own
real API does not yet close, distinct from, and in addition to, the
export/build gaps named in `12_wasm_export_gap.md`.

## See also

- `docs/reviews/private_conversation_security/13_thread_local_pseudonym.md`
- `04_envelope_v1.md`, `05_encryption_suites.md`, `15_nonce_replay.md`
