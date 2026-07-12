# Secure Runtime Alpha 179 — Nostr Identifier Protocol Extensibility Review

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `src/` file, no `packages/` file, is modified. This is
Stage 4 of the Alpha 176–180 Nostr Public Identifier Runtime Boundary
Arc, following Alpha 178's own Desktop presentation decision.**

## 1. Why now

Alpha 175 §4 already ran a Protocol Extensibility Review, covering
Bluesky/ATProto and Session, at the close of the Encoding Arc. This
Arc's own Objective (Alpha 179) asks a narrower, Boundary-specific
question this Stage answers directly rather than by re-citing Alpha
175 §4: does the Identifier ABSTRACTION this Boundary Arc has now
reviewed and partly frozen (Alpha 176's Source Boundary confirmation,
Alpha 177's Runtime-canonical decision, Alpha 178's Desktop-latitude
decision) remain compatible with Session, ATProto, AND Wallet — a
third protocol Alpha 175 §4 did not name — without any of those three
requiring protocol-specific logic inside Runtime?

## 2. What "the Identifier abstraction" names, precisely

Three layers, reviewed together for the first time in one Stage:

1. **The Descriptor shape** — `FedosIdentityDescriptor` (`id`,
   `provider`, `publicIdentifier`, `displayName`, `avatar`). `provider`
   is, by original design (Alpha 028's own doc comment, unchanged
   through Alpha 045), "a plain, unconstrained value... deliberately
   NOT a fixed set of named values" — no `"nostr"` | `"session"` |
   `"atproto"` | `"wallet"` union, no enum, no protocol-specific
   vocabulary anywhere in this file.
2. **The Source Boundary pattern** — Interface + N swappable
   implementations + one injection point (Alpha 039 §2), reconfirmed
   by Alpha 176 §6 as the correct, protocol-agnostic seam for ANY
   future public-identity origin, Nostr or otherwise.
3. **The Rust-side domain-separated derivation pattern** — Master Seed
   → Identity Root → Application Root → Protocol Root → protocol-
   specific secret material, each step domain-separated by a fixed
   `HkdfDomain` label (Alpha 152–165), confirmed below (§4) to already
   include `Session`, `ATProto`, AND `Wallet` labels, independent of
   this Arc.

## 3. `provider` as evidence, not assertion

Confirmed by direct inspection of `src/identity/fedos_identity_descriptor.ts`:
`provider: string` carries no Nostr-specific type constraint of any
kind — the SAME field a `SessionIdentityProvider`, an
`ATProtoIdentityProvider`, or a `WalletIdentityProvider` (none of which
exist yet) could populate with `"session"`/`"atproto"`/`"wallet"`
TODAY, at the TYPE level, with zero change to this file. This is not
a new finding this Stage invents — it is Alpha 028's own seven-Arc-old
design choice, cited here as directly-verified EVIDENCE that the
Descriptor layer already satisfies this Stage's own compatibility
question, rather than merely asserting it does.

## 4. Rust-side domain separation — confirmed already extensible,
   independent of this Arc

`packages/fedos-core-rust/src/lib.rs`'s `HkdfDomain` enum (Alpha
152–165) already lists TEN variants: `RootKey`, `Identity`, `Storage`,
`Conversation`, `Application`, `Nostr`, `Session`, `ATProto`, `Wallet`,
`TestOnly` — confirmed unchanged by direct inspection, the SAME ten
Alpha 175 §9 already fixed. `Session`, `ATProto`, and `Wallet` all
THREE already exist as domain-separation labels, despite THIS Arc
being Nostr-specific and despite no Session/ATProto/Wallet Root or
Secret Key derivation function existing yet — confirmed by
`SecretHandleKind`'s own thirteen variants (also unchanged, Alpha 175
§9) containing zero `Session`/`ATProto`/`Wallet`-named variant (only
`NostrKeyMaterial`/`NostrSecretKeyMaterial` are protocol-concrete
today). **This is the architecture working exactly as designed**: the
domain-separation SCAFFOLD (which future protocol gets its own
cryptographically-separated key derivation namespace) was already
built generically, three protocols ahead of concrete need, while the
actual per-protocol secret-material types remain added ONE AT A TIME,
only when a real Arc for that protocol needs one — Nostr's own
`NostrKeyMaterial`/`NostrSecretKeyMaterial` pair is the only concrete
instance built so far, and this Arc adds no second one.

## 5. Four prohibitions, restated and extended to Wallet

Alpha 175 §4 already stated four explicit prohibitions covering
`FedosNostrNpub`/hex/the NIP-19 codec against ATProto and a generic
"Session ID." This Stage restates all four, EXTENDED to explicitly
also name Wallet — the one protocol Alpha 175 §4 did not yet cover —
and reconfirms them as unchanged, still-binding Arc-closing
commitments, not first proposed here:

- **`FedosNostrNpub`/`FedosNostrPublicKeyHex` must NEVER be repurposed
  for a Wallet address, an ATProto DID, or a Session identifier.** A
  Wallet address (chain-dependent: a Bitcoin/Ethereum/Lightning
  address each has its OWN shape, none of them secp256k1-x-only-key
  Bech32) is no more compatible with these two Nostr-specific types
  than an ATProto DID already was (Alpha 175 §4) — no shared shape
  exists to justify reuse for either.
- **This crate's own Nostr hex rule (lowercase, 64 chars, no `0x`)
  must NEVER be assumed as a generic "Wallet address" or "Session ID"
  rule.** A future Wallet address's own byte length, encoding, and
  case convention (e.g., Ethereum's own mixed-case EIP-55 checksum
  encoding, itself INCOMPATIBLE with this crate's own "lowercase-only"
  Nostr hex rule) is that protocol's own decision, not inherited from
  Nostr's — restated from Alpha 175 §4, now with a concrete
  counter-example (EIP-55) showing WHY the assumption would be
  actively wrong, not merely unproven.
- **The NIP-19 codec (`bech32_encoding`, `hex_encoding`) must NEVER be
  generalized into a cross-protocol codec** — unchanged from Alpha 175
  §4. (Bech32 the ALGORITHM is reused by other protocols in the wild,
  e.g. Bitcoin's own Bech32/Bech32m addresses — but this crate's own
  `FedosNostrPublicKeyHex`/`FedosNostrNpub` TYPES and their fixed
  `"npub"` HRP remain Nostr-specific by construction, exactly as Alpha
  175 §4 already drew that line.)
- **"It's a PublicIdentifier" is NEVER sufficient reason to unify
  codecs across protocols** — unchanged from Alpha 175 §4, now
  reconfirmed against a THIRD protocol family (Wallet) in addition to
  the original two (Session, ATProto): the word "Identifier" names a
  ROLE `FedosIdentityDescriptor.publicIdentifier`/`provider` already
  handles generically (§3 above) — it does not, and must never, imply
  a shared SHAPE for what any given `provider` value's own identifier
  string looks like.

## 6. What generalizes vs. what must not — reconfirmed for all three
   layers together

**Generalizes, confirmed compatible with Session/ATProto/Wallet,
without modification:** the Descriptor shape and its unconstrained
`provider` field (§3); the Source Boundary Interface+implementation+
injection pattern (§2 item 2, Alpha 039 §2); the Root→Account Index→
deterministic-derivation PROCESS and the `HkdfDomain` separation
SCAFFOLD (§4) — all four already exist in a form no Session/ATProto/
Wallet Arc would need to modify to add its own concrete types.

**Must never generalize, restated with Wallet now explicitly included
(§5):** any concrete Nostr-shaped TYPE (`FedosNostrPublicKeyHex`,
`FedosNostrNpub`), this crate's OWN fixed Nostr hex/Bech32 PARAMETERS
(case rule, HRP), and the specific NIP-19 wrapper types themselves.

**No protocol-specific logic was found inside Runtime for this
reason**: `src/runtime/*`, `create_runtime.ts`, `types.ts`, and
`worker.ts` contain zero reference to `Nostr`/`npub`/`bech32`/`hex`
encoding of any kind (confirmed again, directly, §8 below) — the
Runtime layer proper has never been where any of this lives; it lives
entirely inside `packages/fedos-core-rust/src/lib.rs`'s own
`master_root`/`nostr_identifier_encoding` modules, `pub(crate)`-scoped,
exactly where Alpha 171 §3 Q3 originally placed it.

## 7. Answer to this Stage's own question

**Yes — the Identifier abstraction, across all three layers reviewed
in §2, remains compatible with future Session/ATProto/Wallet work
without requiring any protocol-specific Runtime logic.** No
modification is needed, or proposed, to any of the three layers to
achieve this — the finding is that the compatibility ALREADY EXISTS,
by construction, across seven Arcs' worth of prior, independent design
choices (Alpha 028, Alpha 039, Alpha 152–165) that this Stage confirms
rather than creates.

## 8. Structural confirmation (real inspection, this Stage)

- `HkdfDomain` variant list: `RootKey`, `Identity`, `Storage`,
  `Conversation`, `Application`, `Nostr`, `Session`, `ATProto`,
  `Wallet`, `TestOnly` — ten, unchanged.
- `SecretHandleKind` variant list: thirteen, unchanged, zero
  `Session`/`ATProto`/`Wallet`-named variant.
- `#[wasm_bindgen]` count in `lib.rs`: fixed at 13, unchanged.
- `pub fn` count in `lib.rs`: fixed at 36, unchanged.
- `grep -rniE "bech32|npub|nsec" src/runtime/ src/worker.ts create_runtime.ts types.ts`
  (case-insensitive): zero matches.

## 9. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** add a `Session`/`ATProto`/`Wallet` Root, Secret Key
  Handle, Public Key Handle, or Encoder of any kind — no
  `SecretHandleKind` variant is added.
- Does **not** implement a Wallet address format, an ATProto DID
  format, or a Session identifier format of any kind.
- Does **not** change `FedosIdentityDescriptor`'s own field set or
  `provider`'s own unconstrained-string type.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/*`, `src/nostr/*`,
  Storage, Observation, `Cargo.toml`, or `package.json`.

## 10. See also

- `docs/secure_runtime_alpha_178_nostr_desktop_presentation_review.md`
- `docs/secure_runtime_alpha_177_nostr_runtime_canonical_identifier_decision.md`
- `docs/secure_runtime_alpha_176_nostr_public_identifier_origin_review.md`
- `docs/secure_runtime_alpha_175_nostr_public_identifier_completion.md`
- `docs/secure_runtime_alpha_152_nostr_root_derivation.md`
