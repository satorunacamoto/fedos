# Secure Runtime Alpha 171 — Existing Nostr Identifier / Bech32 Inventory

**Status: this Stage is DESIGN / DECISION ONLY. It makes NO code
change of any kind — no `src/` file, no `packages/` file, is modified.
This is Stage 1 of the Alpha 171–175 Nostr Public Identifier Encoding
Arc, following the completed Deterministic Nostr Public Key Derivation
Arc (Alpha 166–170), which confirmed `FedosNostrPublicKeyHandle`/
`derive_nostr_public_key_internal` already provide a real,
deterministic, Account-indexed Nostr public key.**

## 1. Why now

Before encoding a public Nostr identifier FROM the Public Key Handle,
this Stage inventories what ALREADY EXISTS — no assumption, no guess.
Every claim below is grounded in a concrete file path, `grep` result,
or `package.json`/`Cargo.toml` line, verified directly against the
current repository state.

## 2. Inventory

### 2.1 `src/nostr/types.ts` — no identifier codec

Defines `NostrEvent.pubkey` as "32-byte lowercase hex secp256k1 x-only
public key of the author" (Alpha 166 §2.4, unchanged) — a TYPE
annotation and doc comment only, no encode/decode function.

### 2.2 `src/nostr/crypto.ts` / `src/nostr/noble_signature.ts` — no
identifier codec

Both remain hashing/verification-only (Alpha 161 §2.4/§2.5, Alpha 166
§2.5, reconfirmed here): `webCryptoSha256Hex`, `constantTimeHexEqual`,
`NobleSignatureVerifier`. Neither imports, defines, or calls a
bech32/npub/nsec function of any kind.

### 2.3 `npub`/`nsec`/Bech32 in `src/` — denylist mentions only, never
an implementation

`grep -rniE "bech32|npub|nsec" src/` finds ONLY: security-conscious
DENYLIST string arrays (`src/federation/outbound_queue.ts:97`,
`src/federation/publish_intent.ts:101`, `src/notification/policy.ts:26`,
`src/payment/noop_payment.ts:42`, all listing `"nsec"` as a forbidden
substring to screen OUT of outbound content) and explicit prohibition
doc comments (`src/identity/fedos_nostr_identity_provider.ts:56-57`:
"NO secret key, `nsec`, seed, mnemonic, or `npub` ENCODE/DECODE
handling of any kind (no `src/nostr/crypto.ts` import, no bech32...)").
Zero implementation exists anywhere.

### 2.4 `hex` encoder — no reusable production implementation

No hex-encoding FUNCTION exists in `src/` (TypeScript has no need — JS
already has trivial `.toString(16)`/`Buffer` idioms it has never
needed to formalize here, since no code produces a hex Nostr key
today). On the Rust side: `hex` (the crate) remains
`[dev-dependencies]`-only (`packages/fedos-core-rust/Cargo.toml:267`);
`hex::decode` is called only inside four `#[cfg(test)]`-scoped
`decode_hex` test-vector helpers (`lib.rs:8295` region and three
siblings) — there is NO production `hex::encode` call anywhere, and no
production hex-ENCODING function of any kind exists in this crate
today, confirmed by `grep`.

### 2.5 npm dependencies — no bech32/scure package

`package.json`'s own `dependencies` block lists EXACTLY two packages:
`@noble/curves` and `@noble/hashes`. `node_modules` contains no
`bech32`/`@scure/base`-named package. `@noble/curves`'s own installed
file listing (`node_modules/@noble/curves/`) contains no
`bech32`/`nip19`-named module — noble's own bech32/NIP-19 helpers (used
by some other projects, e.g. `nostr-tools`) are NOT part of this
repository's installed `@noble/curves` surface.

### 2.6 NIP-19 encoding rule — confirmed from first principles, no
guess

NIP-19 (the Nostr spec defining `npub`/`nsec`/`note`/`nprofile`/etc.)
specifies Bech32 (BIP-173) — explicitly NOT Bech32m (BIP-350) — for
every one of its own simple prefixes, `npub` included. The `npub`
payload is the SAME 32-byte x-only public key `NostrEvent.pubkey`
itself uses (Alpha 166 §2.4) — no TLV wrapping (TLV wrapping is
`nprofile`/`nevent`'s own concern, a DIFFERENT NIP-19 prefix this Arc
does not implement). Canonical Bech32 output is lowercase-only; mixed
case is invalid per BIP-173 itself.

### 2.7 Rust `Cargo.toml` — no Bech32 dependency, confirmed unchanged
since Alpha 170

`grep -ni bech32 Cargo.toml` finds zero matches. No new dependency
exists to reuse.

### 2.8 Existing hand-rolled-codec precedent in this crate

`crypto::ciphertext_serialization` (Stage 186) already hand-writes
base64url "against the STANDARD LIBRARY ONLY," explicitly because its
own input shape is CLOSED and simple enough to make hand-writing
"genuinely safe, not just expedient" — its own doc comment's exact
words. `crypto::nip44_wire_encoding` (Stage 234) hand-writes STANDARD
base64, separately. `crypto::nip44_hmac` (Stage 231) hand-writes
HMAC-SHA256 against this crate's own already-adopted `sha2`. Every one
of these is a fixed, well-specified, publicly documented encoding/MAC
algorithm, implemented without adding a new crate — the SAME shape a
hand-rolled Bech32 encoder would take.

### 2.9 `FedosIdentityDescriptor.publicIdentifier` — externally sourced,
untouched by this crate

`src/identity/fedos_identity_descriptor.ts`/`fedos_identity_record.ts`
both declare `readonly publicIdentifier: string`. The Nostr Identity
Provider (`src/identity/fedos_nostr_identity_provider.ts`) populates it
by DELEGATING to an injected `FedosNostrPublicIdentitySource` snapshot
— an EXTERNAL value, never computed by this crate's own Rust code
today (Alpha 161 §2.10/Alpha 166's own inventory precedent). This
Arc's own "絶対禁止" list forbids touching `src/identity/*` — this
Stage confirms that boundary is ALREADY untouched, not something this
Arc changes.

### 2.10 Known offline Bech32 test vector — the ONLY one available
without network access

No `test-vectors/nip19` or `test-vectors/bech32` file exists in this
repository (`Glob` confirms). This Arc's own instruction forbids
external network access. The one Bech32 vector this Stage can cite
with full confidence, without guessing and without network access, is
BIP-173's own published canonical example: encoding HRP `"a"` with an
EMPTY data payload produces exactly `"a12uel5l"` — the first example
in BIP-173's own "Test vectors" section, a stable, widely-cited
constant independent of any Nostr-specific key material. Alpha 174
uses this to verify the checksum/charset implementation itself, plus
an independent, test-only reversal of this Arc's own bech32 output
(§7's own answer) as a self-consistency cross-check.

## 3. Answers to the seven required questions

1. **Implementable in Rust with no new dependency?** Yes — hex is
   trivial at any size (§2.4), and Bech32 is a closed, well-specified,
   non-cryptographic checksum/bit-regrouping algorithm this crate
   already has direct, reviewed precedent for hand-implementing
   (§2.8). No dependency addition is required or proposed.
2. **Is there a reusable TypeScript codec?** No (§2.2/§2.3/§2.5) —
   confirmed by direct inspection, not assumed.
3. **Should Rust or TypeScript own the Encoder responsibility?**
   Rust. `FedosNostrPublicKeyHandle`'s own bytes never leave the Rust
   boundary (Alpha 168's own Opaque design) — encoding must happen
   where the bytes already live, and this Arc's own "変更可能範囲"
   explicitly discourages `src/nostr/*` changes ("原則禁止") unless a
   need is found and reported; none was found.
4. **Canonical internal identifier: hex or npub?** Neither raw string
   form is this crate's own TRUE canonical value — the 32-byte x-only
   bytes `FedosNostrPublicKeyHandle` already holds remain that. Of the
   two STRING forms, hex is the more suitable form for any FUTURE
   internal/protocol-level use (it is what `NostrEvent.pubkey` itself
   already requires, §2.1) — `npub` is reserved for user-facing
   display, per NIP-19's own stated purpose. Alpha 175 §5 restates
   this as a formal, still-unwired recommendation.
5. **What value ultimately belongs in `publicIdentifier`?** Not
   decided by this Arc — `FedosIdentityDescriptor.publicIdentifier`
   remains externally sourced and untouched (§2.9); Alpha 175 names a
   RECOMMENDATION (`npub`, first-candidate) for a future, separate,
   explicitly-reviewed wiring Stage — this Arc does not perform that
   wiring.
6. **Exact NIP-19 encoding rule?** Bech32 (BIP-173), NEVER Bech32m,
   HRP `"npub"`, payload the 32-byte x-only public key with no TLV
   wrapping, lowercase canonical output (§2.6).
7. **Should a Decoder be implemented in this same Arc?** No — this
   Arc's own Objective explicitly scopes to ENCODING only; a Decoder
   is out of scope, matching the Arc's own instruction (`nsec`/Secret
   Key handling of any kind, which a general NIP-19 decoder would
   need to at least classify, is explicitly forbidden this Arc).

No new Cargo or npm dependency is needed — this Stage does NOT halt
implementation.

## 4. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** decide the Nostr Public Identifier Representation
  approach — that is Alpha 172's own deliverable.
- Does **not** implement hex/npub encoding, a Decoder, `nsec`, or any
  Schnorr/Event/Relay code.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/nostr/*`, Storage, Observation,
  Rust, `Cargo.toml`, or `package.json`.

## 5. See also

- `docs/secure_runtime_alpha_166_existing_nostr_public_key_inventory.md`
- `docs/secure_runtime_alpha_170_nostr_public_key_derivation_completion.md`
- `docs/ciphertext_serialization_format_decision.md`
