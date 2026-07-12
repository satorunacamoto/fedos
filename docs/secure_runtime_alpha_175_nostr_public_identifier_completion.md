# Secure Runtime Alpha 175 — Nostr Public Identifier Completion & Boundary Review

**Status: this Stage is REVIEW ONLY — it makes NO further
production-code change beyond what Alpha 173/174 already landed. This
is Stage 5, the closing Stage, of the Alpha 171–175 Nostr Public
Identifier Encoding Arc.**

## 1. Why now

Alpha 171 inventoried, Alpha 172 decided the representation, Alpha 173
implemented the Encoder, Alpha 174 verified it by real execution. This
Stage issues three formal (still-unwired) recommendations, reviews
Protocol Extensibility for Bluesky/Session, and issues the Arc's own
closing Completion Declaration.

## 2. The Foundation, confirmed complete

```rust
FedosMasterSeedHandle → ... → FedosNostrSecretKeyHandle (Alpha 163/164)
        │  derive_nostr_public_key_internal            (Alpha 169)
        ↓
FedosNostrPublicKeyHandle                                (Alpha 168/169)
        │  nostr_identifier_encoding::encode_nostr_public_key_hex_internal   (Alpha 173)
        │  nostr_identifier_encoding::encode_nostr_npub_internal            (Alpha 173)
        ↓                                                ↓
FedosNostrPublicKeyHex (64-char lowercase hex)     FedosNostrNpub (npub1...)
```

Zero new cryptographic algorithm: hex is a trivial byte↔nibble
mapping; Bech32 is a fixed, public, non-cryptographic checksum/bit-
regrouping algorithm (Alpha 173 §6). Zero new Cargo dependency, zero
new npm dependency (Alpha 171 §3, confirmed by direct inspection, not
merely asserted).

## 3. Three formal recommendations — still UNWIRED this Arc

Per this Arc's own instruction, these are DECISIONS to record, NOT
implementations to wire — `src/identity/*` and Desktop remain
untouched by this Stage, confirmed in §6/§7 below.

1. **`FedosIdentityDescriptor.publicIdentifier` — future value:**
   `npub`. NIP-19's own stated purpose is exactly this — a
   human-shareable, user-facing identifier — and `publicIdentifier` is
   read by Desktop-facing code (`fedos_identity_service.ts`,
   `fedos_nostr_identity_provider.ts`), a user-facing context. Hex
   remains available internally but is not the recommended
   DISPLAY-FACING value.
2. **Protocol-internal canonical key:** lowercase hex, OR the raw
   32-byte x-only bytes `FedosNostrPublicKeyHandle` already holds,
   whichever a future Event-construction Stage finds more direct to
   thread through (`NostrEvent.pubkey` itself is hex-shaped, Alpha 171
   §2.1) — `npub` is explicitly NOT recommended for protocol-internal
   use (it exists solely for human display, per NIP-19's own stated
   purpose; decoding it back to bytes for every protocol operation
   would be pure waste).
3. **Desktop display:** `npub` — the same reasoning as recommendation
   1, restated for the specific Desktop-display use case named in this
   Arc's own Objective.

**These three recommendations are NOT binding on any future Stage** —
they are this Arc's own best-available judgment, to be reconfirmed or
revised by whichever future, separate, explicitly-reviewed Stage
actually performs the wiring (Alpha 171 §5/§7).

## 4. Protocol Extensibility Review

Per this Arc's own instruction, common vs. Nostr-specific parts are
reviewed explicitly, with FOUR concrete prohibitions:

**Common across any future protocol** (Bluesky/ATProto, Session):
Master Seed, Root hierarchy, Protocol domain separation, Account
Index, the deterministic Secret-Handle-wrapping pattern, the Public
Key derivation PATTERN (Alpha 170 §4, unchanged), and the Recovery
contract (Alpha 144) — none of these are Nostr-specific, and none of
them changed shape in this Arc.

**Nostr-specific, NOT reusable as-is:** secp256k1, the 32-byte x-only
public key shape, lowercase 64-char hex AS THIS crate defines it for
Nostr specifically, and `npub`/NIP-19/Bech32 AS PARAMETERIZED for
Nostr (HRP `"npub"`, no TLV).

**Explicit prohibitions, restated from this Arc's own instruction and
reconfirmed as an Arc-closing design commitment:**

- **`FedosNostrNpub` must NEVER be repurposed for an ATProto DID.** A
  DID is a completely different identifier scheme (method-dependent
  URI, not a secp256k1-keyed Bech32 string) — no shared shape exists
  to justify reuse.
- **This crate's own Nostr hex rule (lowercase, 64 chars, no `0x`)
  must NEVER be assumed as a generic "Session ID" rule.** A future
  Session identifier's own byte length, encoding, and case convention
  are THAT protocol's own decision, not inherited from Nostr's.
- **The NIP-19 codec (`bech32_encoding`, `hex_encoding`) must NEVER be
  generalized into a cross-protocol codec.** Bech32 itself is a
  general algorithm, but this crate's OWN wrapper types
  (`FedosNostrPublicKeyHex`/`FedosNostrNpub`) and their fixed HRP are
  Nostr-specific by construction — a future protocol needing Bech32
  for its OWN purpose defines its OWN types, even if it happens to
  reuse the underlying `bech32_encode` PRIMITIVE (an open question for
  that future Stage, not decided here).
- **"It's a PublicIdentifier" is NEVER sufficient reason to unify
  codecs across protocols.** The word "Identifier" names a ROLE, not a
  SHAPE — Nostr's, a future Session's, and a future ATProto DID's own
  identifiers may all fill that role while remaining structurally
  incompatible, exactly as Alpha 170 §4 already established for the
  Public Key TYPE one level down this same hierarchy.

**What generalizes is the PROCESS and BOUNDARY DISCIPLINE only**
(Root → Account Index → deterministic derivation → a dedicated,
narrowly-accessed Encoder Boundary) — **Identifier FORMAT is separated
per Protocol Adapter, without exception.**

## 5. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE. A Nostr Public Key
now deterministically encodes to BOTH its canonical lowercase hex form
and its NIP-19 `npub` Bech32 form, entirely `pub(crate)`, via a
dedicated, minimally-accessed Encoder Boundary
(`nostr_identifier_encoding::encode_nostr_public_key_hex_internal`/
`encode_nostr_npub_internal`), with ZERO new Cargo dependency, ZERO
new npm dependency, ZERO new cryptographic algorithm, ZERO WASM
exposure (`#[wasm_bindgen]` count fixed at 13), ZERO Desktop access,
and ZERO Runtime/Worker/Storage/Observation/Identity-Layer exposure.**

**The following do NOT exist yet, exactly as this Arc's own Objective
requires:**

- **`nsec`** — no bech32 secret-key encoding exists.
- **Secret Key export/import** — no path exists to export or import a
  raw secret byte anywhere in this crate.
- **Schnorr signature** — no BIP-340 signing function exists.
- **Nostr Event** — no event construction/signing exists.
- **Event ID** — no event-id computation exists in Rust (the
  TypeScript-side `computeEventId`/`verifyEventId`, Alpha 161 §2.5,
  remain unrelated and unchanged).
- **Relay communication** — no WebSocket/Relay connection exists.
- **WebSocket** — confirmed absent, same as every prior Arc.
- **DM** — no NIP-04/NIP-44-based direct-message send path exists.
- **Public Runtime API** — `FedosNostrPublicKeyHex`/`FedosNostrNpub`
  are `pub(crate)` only, unreachable from `AppRuntime`/`types.ts`.
- **Desktop Identity wiring** — `FedosIdentityDescriptor.publicIdentifier`
  remains externally sourced (Alpha 171 §2.9), untouched by this Arc.

**Next Arc recommendation — ONE candidate, chosen from this Arc's own
Inventory:** **Nostr Public Identifier Runtime Boundary Review.**
Alpha 171's own inventory found no evidence that Schnorr signing
infrastructure is urgently blocking anything — the public identifier
chain (Master Seed through `npub`) is now fully built and verified,
entirely internal, and the NEXT natural, LOWER-RISK question is
whether/how that already-complete chain should become reachable
through a reviewed boundary (Public Runtime API shape, Desktop
wiring policy — still NOT the wiring itself) BEFORE any signing
capability is added on top of it. Signing (Nostr Schnorr Signing
Boundary Review) remains a live FUTURE candidate but is not
recommended NEXT, absent a concrete blocking need this Stage's own
Inventory did not find.

## 6. What this Stage does NOT do

- Does **not** modify `packages/fedos-core-rust/src/lib.rs` beyond
  what Alpha 173/174 already landed in the same file edit — no further
  production code change.
- Does **not** wire `FedosIdentityDescriptor.publicIdentifier`,
  Desktop display, or any Protocol-internal canonical-key usage — §3's
  own three items are recommendations, not implementations.
- Does **not** implement `nsec`, Schnorr signing, Events, Relay
  communication, or a Decoder.
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `src/nostr/*`, `create_runtime.ts`, `types.ts`, `worker.ts`, Storage,
  Observation, any Protocol Adapter, `Cargo.toml`, or `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_174_nostr_public_identifier_encoding_verification.md`
- `docs/secure_runtime_alpha_173_nostr_public_identifier_encoder.md`
- `docs/secure_runtime_alpha_172_nostr_identifier_representation_decision.md`
- `docs/secure_runtime_alpha_171_existing_nostr_identifier_inventory.md`
- `docs/secure_runtime_alpha_170_nostr_public_key_derivation_completion.md`
