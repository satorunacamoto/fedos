# Secure Runtime Alpha 200 — Nostr Event Foundation Completion

**Status: this Stage is REVIEW ONLY — it makes NO further code change
of any kind. This is Stage 10, the closing Stage, of the Alpha
191–200 Nostr Event Foundation Arc.**

## 1. Why now

Alpha 191 inventoried NIP-01 and decided the minimal canonical
representation; Alpha 192–195 implemented the Handle, canonical
serialization, Event ID generation, and the connection to Schnorr
signing; Alpha 196 verified the whole pipeline by real execution;
Alpha 197–199 reviewed the Event Boundary, Runtime exposure, and
Protocol extensibility, in that order. This Stage issues the Arc's
own closing Completion Declaration and recommends exactly one next
Arc.

## 2. The Foundation, confirmed complete

```rust
FedosNostrPublicKeyHandle (Alpha 168/169, UNCHANGED this Arc)
        │  encode_nostr_public_key_hex_internal      (Alpha 173, REUSED)
        ↓
new_nostr_event_internal(pubkey, created_at, kind, tags, content)   (Alpha 192)
        ↓
FedosNostrEventHandle                                (Alpha 192)
        — Opaque: no Clone, no Debug, no Serialize,
          no wasm_bindgen, no raw JSON export, zero &mut self method
        │  nostr_event_encoding::serialize_nostr_event_canonical_internal  (Alpha 193)
        ↓
NIP-01 canonical text: [0,pubkey,created_at,kind,tags,content]
        │  Sha256::digest                              (Alpha 194)
        ↓
Event ID: [u8; 32]
        │  sign_nostr_event_internal                    (Alpha 195)
        │      via derive_nostr_signature_internal (Alpha 183, UNCHANGED)
        ↓
FedosNostrSignatureHandle                              (Alpha 182, UNCHANGED)

-- proven correct end to end (Alpha 196) --
k256::schnorr::VerifyingKey::verify_prehash(event_id, signature) == Ok
```

Zero new cryptographic algorithm: `sha256` (Alpha 194) is the SAME
`sha2` dependency already production-adopted since Alpha 164; BIP-340
Schnorr signing (Alpha 195) is the SAME, UNCHANGED foundation Alpha
183 already built. Zero new Cargo dependency: `serde_json` remains
`[dev-dependencies]`-only (Alpha 191 §4, reconfirmed unchanged
throughout this Arc). Zero new npm dependency.

## 3. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE. A deterministic
Nostr Event can now be constructed, canonically serialized per NIP-01
exactly, given a deterministic Event ID, and signed via the existing
Schnorr Signature foundation — entirely `pub(crate)`, via a dedicated
Opaque Handle (`FedosNostrEventHandle`) and four purpose-built
functions, with ZERO new Cargo dependency, ZERO new npm dependency,
ZERO new cryptographic algorithm, ZERO custom serialization rule
beyond NIP-01's own, ZERO new `#[wasm_bindgen]` export (fixed at 13),
ZERO new `pub fn` (fixed at 36), ZERO Desktop access, and ZERO
Runtime/Worker/Storage/Observation exposure, verified by real
execution (Alpha 196, seventeen tests) rather than assumed from
reading source alone.**

**The following do NOT exist yet, exactly as this Arc's own Objective
requires:**

- **Relay networking, WebSocket, Subscription, Filters** — no
  connection, no wire protocol, no query mechanism of any kind exists
  anywhere in this crate.
- **Event publishing** — `sign_nostr_event_internal`'s own output
  (`FedosNostrSignatureHandle`) never leaves
  `packages/fedos-core-rust/src/` (Alpha 198, confirmed by direct
  inspection of all five candidate Runtime/Desktop files).
- **A hex/JSON export of a complete signed event** — `FedosNostrEventHandle`
  carries no raw JSON export accessor (Alpha 192 §3); nothing in this
  Arc assembles `id`/`sig` back onto the original seven-field NIP-01
  shape for external consumption.
- **A public Runtime API for events** — `FedosNostrEventHandle` and
  all four of this Arc's own functions are `pub(crate)` only,
  unreachable from `AppRuntime`/`types.ts`/Desktop (Alpha 198).
- **Session/ATProto/Wallet event or record support of any kind** —
  `HkdfDomain`/`SecretHandleKind` gained zero new variant; no CBOR,
  IPLD, or CID library exists; `FedosNostrEventHandle`'s own code
  carries zero reference to any of the three (Alpha 199).

**Next Arc recommendation — ONE candidate, chosen from this Arc's own
scope boundary:** **Nostr Event Runtime Exposure & Desktop
Integration Review.** This Arc's own Alpha 198/199 confirm the Event
Foundation is complete, correct (Alpha 196's own real BIP-340
end-to-end verification), and entirely isolated from Runtime/Desktop —
the NEXT natural, lower-risk step is reviewing (not yet building)
whether/how a Public Runtime API should expose event construction and
signing to Desktop, mirroring exactly how Alpha 176–180 reviewed the
Identifier Runtime Boundary before any wiring occurred. Relay
networking, WebSocket, Subscription, and Filters remain explicitly OUT
of scope for that next Arc too, exactly as they were out of scope
here — those require their own, later, separately-reviewed Arc once a
Runtime Boundary exists to carry them.

## 4. What this Stage does NOT do

- Does **not** modify `packages/fedos-core-rust/src/lib.rs` beyond
  what Alpha 192/193/194/195/196 already landed in the same file edit
  — no further production code change.
- Does **not** wire a Public Runtime API, Event Builder JSON export,
  or Desktop integration of any kind — §3's own "does NOT exist yet"
  list is a finding, not an implementation.
- Does **not** implement Relay communication, WebSocket, Subscription,
  or Filters.
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `src/nostr/*`, `create_runtime.ts`, `types.ts`, `worker.ts`, Storage,
  Observation, any Protocol Adapter, `Cargo.toml`, or `package.json`.

## 5. See also

- `docs/secure_runtime_alpha_199_event_protocol_extensibility_review.md`
- `docs/secure_runtime_alpha_198_event_runtime_boundary_review.md`
- `docs/secure_runtime_alpha_197_event_boundary_review.md`
- `docs/secure_runtime_alpha_196_event_foundation_verification.md`
- `docs/secure_runtime_alpha_195_connect_event_id_to_schnorr_signing.md`
- `docs/secure_runtime_alpha_194_deterministic_event_id_generation.md`
- `docs/secure_runtime_alpha_193_canonical_event_serialization.md`
- `docs/secure_runtime_alpha_192_nostr_event_handle.md`
- `docs/secure_runtime_alpha_191_nostr_event_model_inventory.md`
- `docs/secure_runtime_alpha_190_schnorr_signing_foundation_completion.md`
