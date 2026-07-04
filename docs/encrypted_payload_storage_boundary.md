# Encrypted Payload Storage/Send Boundary (Stage 177–180) — binding, docs only

**Status: this document adds no code and wires no connection.** It fixes,
in writing, what a future stage MAY hand to `StorageBackend`
(`src/storage/types.ts`, Stage 107) versus what it MAY hand to a
`FederationProvider` (`src/federation/types.ts`, Stage 110) once this
crate's public opaque crypto API (`docs/public_crypto_opaque_handles.md`,
Stage 171–176) produces something worth persisting or sending. **No
`StorageBackend` implementation, no `FederationProvider` implementation,
no Nostr relay connection, no Runtime/Worker wiring, and no actual data
crossing either boundary exists anywhere in this repository as of this
stage.**

This complements, and does not renegotiate, `docs/storage_metadata_policy.md`
(the existing `StoragePacket.metadata` marker policy this document extends
with a crypto-specific rule), `docs/federation_boundary.md` (the existing
`FederationProvider` role/non-role split this document extends with a
crypto-specific rule), `docs/public_crypto_opaque_handles.md` (the
`FedosCiphertextEnvelope` opaque type this document names as the ONLY
thing crossing either boundary), and
`docs/ciphertext_envelope_serialization_plan.md` (the still-undecided wire
format a serialized payload would eventually use). Where this document and
any of those disagree, the earlier binding docs win.

---

## 1. Purpose

- **Fix WHAT crosses into `StorageBackend`** once a real backend exists —
  before one does, so the shape is reviewed rather than improvised under
  pressure.
- **Fix WHAT crosses into a `FederationProvider`/Nostr event candidate**
  once a real adapter exists — same reasoning.
- **Fix what must NEVER cross either boundary**, regardless of which
  backend/adapter is eventually real.
- **Not an implementation, not a wiring.** No `StorageBackend`/
  `FederationProvider` implementation is added or modified; no Rust↔TS
  bridge, WASM binding, Runtime, or Worker connection is added.

## 2. Today's actual state (unchanged by this document)

- `StorageBackend` (`src/storage/types.ts`) is a type-only seam: every
  operation "stores nothing," per that file's own doc comment — no real
  backend exists.
- `FederationProvider` (`src/federation/types.ts`) is likewise
  read/write/reply-only in ROLE, with every current adapter a no-op
  (`src/federation/noop_federation.ts`).
- This crate's public crypto API (`fedos_encrypt`/`fedos_decrypt`/
  `fedos_generate_aead_key_32`, Stage 166–176) is Rust-only, compiled to
  an `rlib`, with **no WASM binding, no FFI, and no TypeScript-callable
  surface of any kind** (`packages/fedos-core-rust/Cargo.toml`'s `[lib]`
  section: `crate-type = ["rlib"]` only). There is today NO path by which
  a `FedosCiphertextEnvelope` produced in Rust could even REACH
  `StoragePacket`/a Nostr event candidate in TypeScript — that gap (a
  WASM/FFI boundary) is its own, separate, future, unscheduled stage, not
  named further here.
- This document is therefore boundary PREP: it fixes the shape a future
  bridging stage must satisfy, on both the Rust-conceptual side (what
  `FedosCiphertextEnvelope`/`CiphertextTransportDescriptor` are permitted
  to become) and the TypeScript-conceptual side (what `StoragePacket`/a
  federation write is permitted to carry) — without building the bridge
  itself.

## 3. What MAY cross into `StorageBackend`

A future stage MAY hand `StorageBackend.put()` a `StoragePacket`
(`src/storage/types.ts`) whose payload-carrying fields are limited to:

| Allowed | Shape | Why |
|---|---|---|
| **An encrypted payload descriptor** | The eventual serialized form of a `FedosCiphertextEnvelope` (once `docs/ciphertext_envelope_serialization_plan.md`'s encoding decision — Stage 182 candidate — is made), OR, before that decision exists, an opaque reference to one | `StoragePacket` already carries no bytes/body field (`src/storage/types.ts`'s own doc comment: "Carries NO bytes, body, or content field of any kind") — an encrypted payload descriptor must fit that same "opaque, non-secret label" shape, never a raw byte blob attached directly as a new field type. |
| **An opaque `idRef`** | `StoragePacket.idRef` (already exists) | Unchanged from today's existing type — a label a real backend resolves on its own side, never a path/URL (`docs/storage_metadata_policy.md` §1). A future encrypted payload's own reference (if it needs one distinct from a generic `idRef`) follows the same "opaque label" shape, not a new raw-address type. |
| **An algorithm label** | A NEW, narrowly-scoped metadata-adjacent field naming which algorithm sealed the payload (mirroring `crypto::ciphertext_transport::CiphertextTransportAlgorithm`'s ROLE, not its Rust type directly — see §6) | Needed so a future reader knows which algorithm to invoke to open it, exactly like `AeadCiphertextEnvelope`'s own `algorithm` field serves the same purpose in-memory. A label only — never the key, never the nonce by itself outside the encrypted payload's own envelope. |

**Explicitly NOT allowed into `StorageBackend`, ever:**

- **No raw key of any kind.** No `SecretHandle` payload, no
  `FedosAeadKeyHandle`'s wrapped bytes, no key ID resolves to a byte here
  either (`docs/ciphertext_envelope_serialization_plan.md` §2.2 already
  excludes a key-ID field from the wire format itself; this document
  additionally forbids ever placing a raw key byte in a `StoragePacket`
  under any field name).
- **No plaintext.** `StoragePacket` carries only what is already
  encrypted — a future stage must encrypt BEFORE calling `put()`, never
  rely on `StorageBackend` (or any policy layer in front of it) to encrypt
  on the way in.
- **No unencrypted nonce reused as a "value" outside its own envelope.**
  The nonce is not secret (`docs/nonce_generation_policy.md` §9) and MAY
  travel inside a serialized envelope, but must never be extracted and
  stored as a separate, bare `StoragePacket.metadata` value — that would
  fragment the envelope's own framing across two separately-addressable
  storage locations for no benefit and new correctness risk (the nonce
  and its ciphertext could then be updated independently, breaking the
  pairing an AEAD open requires).
- **Existing `src/storage/policy.ts` markers still apply, unchanged**:
  `secret`, `key`, `seed`, `token`, `payment`, `entitlement`, `dm`, `body`,
  `content`, `message` remain forbidden substrings in
  `StoragePacket.metadata` keys/values (`docs/storage_metadata_policy.md`
  §1) — an encrypted payload descriptor's own metadata fields (§3's
  table) must be named to avoid tripping these markers on the algorithm
  label itself (e.g. `"algorithm"` is fine; a key naming a secret is not).

## 4. What MAY cross into a `FederationProvider`/Nostr event candidate

A future stage MAY hand a `FederationProvider`'s write path:

| Allowed | Shape | Why |
|---|---|---|
| **A public event candidate** | Whatever a given protocol's normal public-post shape already is (unchanged by this document) | The default, unencrypted case — most federated content (board posts, replies) is intentionally public; this document does not change that default. |
| **An encrypted payload, ONLY when explicitly allowed for that specific write** | A serialized `FedosCiphertextEnvelope` (once encoded, per §3's same encoding-decision dependency), following NIP-44's OWN payload framing if the destination is specifically a NIP-44 direct message (`docs/nip44_internal_plan.md` §6 — a DIFFERENT wire shape from this crate's own envelope format) | Encryption is opt-in PER WRITE, never a blanket default — a federation adapter must be told explicitly "this specific outgoing event is encrypted," never infer it, since silently encrypting or silently failing to encrypt are both wrong in opposite directions for a federation adapter that also handles public content. |

**Explicitly NOT allowed into a `FederationProvider`, ever:**

- **No raw key, no plaintext** — identical prohibition to §3, for the
  identical reason.
- **No implicit encryption decision.** `docs/federation_boundary.md` §3
  already fixes that "an adapter never signs, encrypts, or decrypts
  anything itself... a federation adapter receives an already-signed/
  authenticated request; it does not produce one" — this document extends
  that to encryption specifically: a federation adapter receives an
  ALREADY-ENCRYPTED payload (when encryption applies) exactly as it
  already receives an already-signed event; it never decides to encrypt
  or decides not to.
- **No NIP-44/DM-specific field on a public event candidate**, and no
  public-event field leaking onto an encrypted payload's own envelope —
  the two paths in this table are separate; a future stage must not
  design one type that silently serves both.

## 5. What must NEVER cross either boundary, regardless of destination

Restating and unifying `docs/storage_metadata_policy.md` §1 and
`docs/federation_boundary.md` §3 for the crypto-specific case, since a
future implementing stage will otherwise need to independently rediscover
this list twice:

- **No buyer/payment/entitlement metadata.** Neither `StoragePacket` nor
  any federation write may carry a price, product ID,
  purchase/subscription/entitlement reference, or buyer/seller
  identifier, attached to (or derived alongside) an encrypted payload.
  This mirrors `docs/ciphertext_envelope_serialization_plan.md` §2.2's
  identical exclusion from the wire format itself — restated here because
  a future stage could otherwise reintroduce it one layer up, in the
  `StoragePacket`/federation-write wrapper, even after correctly keeping
  it out of the envelope's own bytes.
- **No chat/DM metadata beyond what NIP-44's OWN spec-defined payload
  requires** (`docs/nip44_internal_plan.md` §6) — no sender/recipient
  display name, no conversation title, no read-receipt or typing-indicator
  state, attached to an encrypted payload as it crosses either boundary.
- **No content-type hint, no plaintext-length hint beyond what ciphertext
  length already unavoidably reveals** — restating
  `docs/ciphertext_envelope_serialization_plan.md` §4's "no side-channel
  field" rule at this boundary too, since a future stage could otherwise
  add such a hint in a `StoragePacket.metadata` value even after correctly
  keeping it out of the envelope format itself.

## 6. Naming note: this document uses ROLE labels, not Rust type names

Where this document says "an algorithm label" (§3) or "an encrypted
payload descriptor" (§3), it describes a ROLE a future TypeScript-side
type would play — it does NOT mean `crypto::ciphertext_transport`'s Rust
enums (`CiphertextTransportAlgorithm`, `CiphertextTransportKind`, etc.,
Stage 177–178) are directly reused as TypeScript types. Those Rust types
are `pub(crate)`-only, unreachable from outside `fedos-core-rust`, and (per
§2) there is no bridge connecting this crate to TypeScript at all yet. A
future TypeScript-side "encrypted payload descriptor" type, if one is
ever built, would independently mirror the SAME shape (a label-only
descriptor with no raw bytes) for the SAME reasons — not literally import
or re-derive from the Rust enum.

## 7. What this stage does NOT do

- **No `StorageBackend` implementation or modification.**
  `src/storage/types.ts`/`src/storage/noop_storage.ts` are unchanged.
- **No `FederationProvider` implementation or modification.**
  `src/federation/types.ts`/`src/federation/noop_federation.ts` are
  unchanged.
- **No Rust↔TypeScript bridge, no WASM binding, no FFI.** This crate
  remains `crate-type = ["rlib"]` only.
- **No Runtime/Worker connection of any kind.**
- **No encrypted payload actually crosses either boundary** — this
  document fixes what WOULD be allowed to, once both a serialization
  format (`docs/ciphertext_envelope_serialization_plan.md`) and a
  Rust↔TypeScript bridge exist, neither of which this stage builds.
- **No `Cargo.toml` or `package.json` change.**

## 8. Conclusion

- **`StorageBackend`** may eventually carry an encrypted payload
  descriptor, an opaque `idRef`, and an algorithm label — never a raw
  key, plaintext, a bare extracted nonce, or any existing forbidden
  metadata marker.
- **`FederationProvider`** may eventually carry a public event candidate
  by default, or an encrypted payload ONLY when a specific write
  explicitly opts in — never an implicit encryption decision, never a
  raw key or plaintext.
- **Buyer/payment/entitlement metadata and chat/DM metadata beyond
  NIP-44's own spec are excluded from both boundaries, permanently.**
- **No code, no wiring, no bridge** is added or authorized by this
  document — it is boundary PREP for a future, separate, explicitly
  reviewed bridging stage.
