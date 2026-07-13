# Secure Runtime Alpha 187 — Future Event Builder Compatibility Review

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `src/` file, no `packages/` file, is modified. This is
Stage 7 of the Alpha 181–190 Nostr Schnorr Signing Foundation Arc,
following Alpha 186's own Interoperability Review.**

## 1. Why now

This Arc's own instruction explicitly forbids Event construction this
Stage — but also names "Review future Event Builder compatibility" as
its own Objective. This Stage answers that narrower question: IF a
future, separate, explicitly-reviewed Stage builds a Nostr Event
Builder, does anything this Arc shipped (Alpha 182/183) need to change
to support it, or does the current shape already fit?

## 2. What a future Event Builder would need, per NIP-01

`src/nostr/types.ts`'s own `NostrEvent` interface (Alpha 1, read-only
ingest scope, UNCHANGED — confirmed by this Stage's own inspection,
§4 below) documents `sig` as "64-byte lowercase hex schnorr
signature" — a 128-character lowercase hex STRING representing 64 raw
bytes, the SAME shape `NostrEvent.pubkey` already takes for its own
32 raw bytes (Alpha 166 §2.4). NIP-01 itself defines
`sig = schnorr_sign(sha256(serialized_event), private_key)` — the
serialized event's own sha256 hash IS `id` (Alpha 161 §2.5's own
`computeEventId`, TypeScript-side, unrelated and unchanged), so a
future Event Builder's own call shape would be, precisely:

```
id: [u8; 32]  =  computeEventId(event)          (already exists, TS-side)
sig: FedosNostrSignatureHandle | None
    = derive_nostr_signature_internal(secret_key, &id)   (this Arc)
```

## 3. Fit confirmed — no shape mismatch, nothing to change

- **Input shape**: `derive_nostr_signature_internal`'s own `message:
  &[u8; 32]` parameter is EXACTLY the shape `computeEventId`'s own
  output already takes — no adapter, no reformatting, no additional
  hashing step would be needed between the two.
- **Output shape**: `FedosNostrSignatureHandle`'s own internal 64
  bytes are EXACTLY the raw byte count `NostrEvent.sig`'s own
  128-hex-character string would need to encode — the SAME
  "raw-bytes-in, hex-string-out" relationship
  `FedosNostrPublicKeyHandle`/`nostr_identifier_encoding` (Alpha 173)
  already established one level up this same chain for `pubkey`.
- **Determinism**: a future Event Builder calling
  `derive_nostr_signature_internal` twice for the SAME event (e.g. a
  retry after a network failure, never re-hashing) would get the
  IDENTICAL signature both times (Alpha 184 §2.1) — no accidental
  signature-malleability surface for a future Stage to worry about.

**No change to Alpha 182/183's own shipped shape is needed or
recommended.** This Stage's own review finds the fit already correct,
not merely "adequate with modification."

## 4. What is explicitly still MISSING — named, not built

This Stage confirms these gaps exist and names them, without closing
any of them (this Arc's own "No Event publishing" rule, honored):

1. **A hex Encoder for the 64-byte signature.** The SAME kind of
   `pub(crate)`-only, dedicated Encoder Boundary
   `nostr_identifier_encoding` (Alpha 173) already built for the
   32-byte public key does not yet exist for a 64-byte signature — a
   future Event Builder Stage would need one before `sig` could ever
   be populated as a string. Confirmed absent by direct inspection:
   `FedosNostrSignatureHandle` (Alpha 182) exposes no accessor of any
   kind (Alpha 182 §3's own explicit "no raw byte export" requirement
   — deliberately, ahead of this exact future need).
2. **Event serialization.** NIP-01's own canonical JSON serialization
   (the exact byte sequence `sha256` hashes to produce `id`) has no
   Rust-side implementation in this crate — `computeEventId` remains
   TypeScript-only (Alpha 161 §2.5, unchanged).
3. **A `kind`/`tags`/`content`/`created_at` assembly API.** No type or
   function anywhere in this crate accepts or produces these NIP-01
   event fields — `NostrEvent` itself (`src/nostr/types.ts`) remains a
   read-only ingest type, never a construction target (its own
   original Stage-1 scope, confirmed unchanged, §4/§5 below).
4. **A public, `wasm_bindgen`-exported entry point.** `derive_nostr_signature_internal`
   remains `pub(crate)` — unreachable from `AppRuntime`, `types.ts`,
   or Desktop (Alpha 189 reviews this specific gap next).

## 5. Structural confirmation (real inspection, this Stage)

- `src/nostr/types.ts`'s own `NostrEvent.sig` doc comment: "64-byte
  lowercase hex schnorr signature" — unchanged.
- `src/nostr/event.ts` (if present) and every other `src/nostr/*` file
  remain untouched by this Arc — confirmed by this Stage's own
  Regression check (§7).
- No `fn build_nostr_event` / `fn sign_nostr_event` / `fn create_event`
  function of any name or shape exists anywhere in `lib.rs`.

## 6. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** implement a signature Encoder, Event serialization, or
  an Event Builder of any kind.
- Does **not** change `FedosNostrSignatureHandle`'s own shape (Alpha
  182) or `derive_nostr_signature_internal`'s own signature (Alpha
  183) — this Stage's own finding is that neither needs to change.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/*`, `src/nostr/*`,
  Storage, Observation, `Cargo.toml`, or `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_186_public_key_interoperability_review.md`
- `docs/secure_runtime_alpha_182_nostr_signature_handle.md`
- `docs/secure_runtime_alpha_173_nostr_public_identifier_encoder.md`
- `docs/nostr_adapter_planning.md`
