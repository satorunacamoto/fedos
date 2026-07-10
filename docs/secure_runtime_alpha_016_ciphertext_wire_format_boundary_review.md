# FedOS Secure Runtime Alpha 016 — Ciphertext Wire Format Boundary Review

**Status: REVIEW / DESIGN ONLY. No Runtime, Rust, `FedosWasmLoader`,
Worker, Production, `Cargo.toml`, or `package.json` change of any kind.
`encrypt()`, `decrypt()`, `generateAeadKey()`, and `randomBytes()` are
all untouched. No `exportCiphertext()`/`importCiphertext()`, no new
`#[wasm_bindgen]` item, no serializer, no deserializer, and no Secure
Storage of any kind is implemented. This document and its guard test are
the entire deliverable.**

## 0. Where this picks up

Alpha 013 migrated `generateAeadKey()` to an Opaque `AeadKeyHandle`.
Alpha 014 built `encrypt()` against it, wrapping its ciphertext output in
a second Opaque class, `AeadCiphertextHandle`, explicitly choosing NOT to
serialize the envelope yet (`docs/secure_runtime_alpha_014_encrypt_opaque_handle_api.md`
§"Deliberately Alpha-limited Ciphertext boundary choice"). Alpha 015
built `decrypt()` against both opaque types, completing a working,
end-to-end, opaque-handle-only `encrypt()`/`decrypt()` round trip.

**Today's `AeadCiphertextHandle` only carries meaning within ONE Runtime
Service call chain, backed by ONE WASM instance, for as long as that
instance stays alive.** It cannot survive being written to Secure
Storage, sent across `postMessage` to/from a Worker, sent over any
network transport, or read back after the Runtime restarts — a
`#[wasm_bindgen]`-exported class instance is only ever a live handle into
that ONE WASM module's own linear memory; it has no meaning once that
memory is gone or once the value crosses into a context backed by a
*different* WASM instance (a different Worker, a different tab, a
different process). This Stage reviews how — and whether — that boundary
should be crossed, without crossing it.

## 1. The six things compared

- **① Opaque Handle のみ維持 (keep opaque-handle-only, forever)** — no
  wire format is ever built; `AeadCiphertextHandle` stays exactly as
  Alpha 014 left it.
- **② `exportCiphertext()` → `Uint8Array` → `importCiphertext()`** — a
  *naming* choice: a symmetric Public API pair, mirroring
  `encrypt()`/`decrypt()`'s own shape, that turns a handle into bytes and
  back. This candidate does not, by itself, fix what is INSIDE those
  bytes — see ③/④/⑤ for that.
- **③ JSON** — a self-describing, text-safe, field-named encoding.
- **④ CBOR** — a compact, binary, still-somewhat-self-describing
  encoding.
- **⑤ 固定 Binary Envelope** — a fixed-layout binary format:
  `version | algorithm | aadDomain | nonce | ciphertext | tag`, with no
  field names on the wire at all.
- **⑥ Rust 既存 Wire Format との一致** — not a seventh candidate but a
  cross-cutting question: whichever of ③/④/⑤ is chosen, should it be a
  BRAND NEW format, or should it reuse a format this crate has *already
  decided and already implemented*?

**⑥ is answered first, because it changes what ③/④/⑤ actually mean
here.** `docs/ciphertext_serialization_format_decision.md` (Stage 182,
implemented Stage 186) already picked **canonical JSON + base64url
fields**, in a fixed key order `v`/`alg`/`aad`/`n`/`ct`/`tag`, as this
crate's own MVP ciphertext wire encoding — and
`packages/fedos-core-rust/src/crypto/ciphertext_serialization.rs`
(Stage 186) already IMPLEMENTS `encode_envelope_internal`/
`decode_envelope_internal` against that exact decision, hand-written
against the standard library with **no new dependency** (`serde_json`/
`hex` remain `[dev-dependencies]`-only), fully `cargo test`-verified for
round-trip correctness and every rejection case (`InvalidVersion`/
`InvalidAlgorithm`/`InvalidAadDomain`/`InvalidBase64Url`/`MissingField`/
`UnknownField`/`MalformedJson`). **Both functions are `pub(crate)`-only
today and are wired to nothing** — not `fedos_encrypt`/`fedos_decrypt`,
not `aead_envelope_bridge`, not `ciphertext_transport`, not any
`#[wasm_bindgen]` boundary. Stage 186's own doc comment names connecting
this codec to a public boundary as "its own, future, separate,
explicitly-reviewed stage" — **this Stage is the review that begins
answering that question**, without yet doing the connecting.

This means ③ ("JSON") is not a fresh choice this Stage makes — it is
already this crate's binding decision. The live question is not "JSON or
something else," it is **"reuse the already-decided-and-implemented
JSON+base64url codec, or build something new instead."**

## 2. Comparison across the eleven fixed criteria

| Criterion | ① Opaque only | ② `exportCiphertext()`/`importCiphertext()` (naming) | ③ JSON (= Stage 182/186's existing decision) | ④ CBOR | ⑤ Fixed Binary Envelope |
|---|---|---|---|---|---|
| **Forward Compatibility** | Perfect — nothing is ever committed to a wire shape, so nothing can ever go stale. But this is the compatibility of a feature that does not exist, not evidence of good design. | Depends entirely on ③/④/⑤ for its actual payload shape; the name itself carries no compatibility properties. | Strong — Stage 182 already fixed a version-first (`v` before any other field), forward-checkable field order; a future `v: 2` document is rejected cleanly by an unmodified `V1`-only decoder rather than silently misparsed. | Comparable to JSON if map/field-tagged CBOR is used; WORSE if array/positional CBOR is used (a common CBOR-for-size optimization) — positional encoding has no `v`-first, name-independent forward-compat story without extra convention on top. | Weakest by construction unless a version byte is placed FIRST and fixed at a known offset — any competent fixed-binary design can match ③'s forward-compat property for a version check specifically, but every OTHER field (algorithm, aadDomain, nonce/ciphertext boundary) is only as forward-compatible as the offset table an implementer manually maintains; there is no self-describing fallback if that table is wrong. |
| **Versioning** | N/A — no version exists because no wire artifact exists. | N/A on its own; inherits from the chosen payload format. | Already solved: `AeadEnvelopeVersion::V1`/`as_tag()`/`from_tag()` exist today, and Stage 182 §3 already fixes `v` as the FIRST wire key, checked before any other field is even attempted. | Solvable the same way, but requires re-deciding/re-implementing the SAME version-first discipline Stage 182/186 already built for JSON — duplicated design work for no new benefit. | Same as CBOR: solvable, but re-derives a decision this crate has already made once. |
| **Storage** | Not possible — an opaque `#[wasm_bindgen]` class instance is not structured-clone-safe across a persisted store; there is nothing to persist. | Only as good as the underlying bytes; `Uint8Array` itself IS trivially storable (IndexedDB, on-disk, etc.) once produced. | Good — text-safe means a JSON string can go directly into ANY store that accepts strings (localStorage-shaped stores, JSON columns, log lines) with zero additional wrapping; a `Uint8Array` version (UTF-8 bytes of the JSON string) is equally storable in binary stores. | Good for binary-only stores; needs an EXTRA base64/hex wrapping step if the store is text-only (e.g. embedding in a JSON document itself) — CBOR is not text-safe by construction. | Same caveat as CBOR — good for binary-only stores, needs an extra wrapping step for any text-only store. Smallest on-disk footprint of the three encodings if storage size is the dominant concern. |
| **Network** | Not possible. | Depends on payload; `Uint8Array` itself is directly usable with `fetch`/WebSocket binary frames. | Text-safe by construction — Stage 182 §2 criterion 5 named this the DECIDING factor specifically because a Nostr event's `content` field is itself a JSON string; this crate's own envelope, if ever embedded in Nostr `content`, an HTTP JSON body, or a log line, needs no extra wrapping layer. | Efficient for a dedicated binary channel (raw WebSocket frames, gRPC-like transports); needs the SAME extra wrapping step as storage if the transport is text-only. | Smallest wire size of the three, best suited to a bandwidth-constrained binary channel that is never embedded inside a text/JSON envelope; worst fit if Nostr `content` (or any other text transport) is ever a destination, exactly as Stage 182 §2 already reasoned. |
| **Worker (`postMessage`)** | Not possible — an opaque class instance backed by one Worker's own WASM instance has no meaning to a different Worker (or the main thread) even via structured clone; `postMessage` would either throw or silently produce garbage. This is the CONCRETE mechanism behind "cannot survive Worker communication" in this Stage's own charter. | A `Uint8Array` IS structured-clone-safe (and Transferable) across `postMessage` directly — this is precisely the property `AeadCiphertextHandle` lacks and any of ③/④/⑤ restores, regardless of which is chosen. | Same as any `Uint8Array`-shaped payload — a UTF-8-encoded JSON string crosses `postMessage` with zero issues, either as a `Uint8Array` or as a plain `string` (both structured-clone-safe). | Same. | Same. |
| **Production** | Unaffected either way — Production is currently unconnected to ANY Crypto API; this Stage does not change that, and neither candidate below does either, since none of them is implemented here. | Unaffected. | Unaffected. | Unaffected. | Unaffected. |
| **Fail Closed** | Trivially total — an operation that does not exist cannot fail open. Not a design virtue by itself (see §5). | Depends entirely on how the eventual Serializer/Deserializer pair is built — see §5's dedicated analysis; the NAME "export/import" implies nothing about Fail-Closed behavior on its own. | Strong precedent already exists: Stage 186's `decode_envelope_internal` already enumerates and rejects seven distinct malformed-input classes without ever panicking, and is already `cargo test`-verified against adversarial cases (unknown field, missing field, invalid base64url, wrong version, wrong algorithm, wrong AAD, reordered fields). Reusing it inherits an ALREADY-PROVEN Fail-Closed decoder rather than building a new one from zero. | Achievable with equal rigor, but requires REBUILDING the same seven-class rejection discipline from scratch for a new decoder, with a NEW opportunity to introduce a bug Stage 186's own review cycle already found and fixed once for JSON. | Same as CBOR — achievable, but re-derives Fail-Closed decoder discipline this crate has already built and tested once. |
| **Serializer 責務 (Serializer's own responsibility)** | N/A. | Whichever payload format is picked, the Serializer's job is narrow (§5): never panic, never emit a document its OWN paired Deserializer cannot read back, never encode from anything but an already-Rust-validated in-memory value. | Already scoped and implemented (`encode_envelope_internal`): returns `None` only for a structurally-impossible internal state (an under-length skeleton placeholder), never panics, always emits canonical key order. | Would need the same scoping done again for a CBOR encoder. | Would need the same scoping done again, PLUS a hand-specified byte-offset table with no name-based self-description to lean on. |
| **Deserializer 責務 (Deserializer's own responsibility)** | N/A. | This is where MOST of the Fail-Closed burden belongs, because its input is untrusted by construction (§5) — regardless of which payload format is chosen. | Already scoped and implemented (`decode_envelope_internal`): rejects `InvalidVersion`/`InvalidAlgorithm`/`InvalidAadDomain`/`InvalidBase64Url`/`MissingField`/`UnknownField`/`MalformedJson`, strict field order, never panics — REUSABLE as-is if this Stage's conclusion (§6) is adopted. | Would need a comparable seven-class (at least) rejection surface built and reviewed from zero for CBOR's own decoding rules. | Would need a comparable rejection surface built from zero, PLUS explicit bounds-checking on every fixed offset/length (a class of bug JSON's self-delimiting strings avoid by construction, per Stage 182 §2 criterion 4). |
| **Rust Boundary** | No new surface — `AeadCiphertextHandle`'s existing zero-method, `kind`-getter-only shape is untouched. | Would need exactly ONE new pair of `#[wasm_bindgen]` functions (an `export_ciphertext(&AeadCiphertextHandle) -> Uint8Array`-shaped wrapper and an `import_ciphertext(&[u8]) -> Option<AeadCiphertextHandle>`-shaped wrapper), mirroring `encrypt_aead`/`decrypt_aead`'s own established thin-wrapper shape (Alpha 014/015) — regardless of which payload format backs them. | If Stage 186's codec is reused (§6's recommendation): the new wrapper pair calls `encode_envelope_internal`/`decode_envelope_internal` directly — no NEW Rust logic beyond the wrapper itself and the `AeadCiphertextEnvelope ⇄ AeadCiphertextHandle` construction/extraction already established by `inner()` (Alpha 014/015). | Would require a NEW Rust module (a CBOR encoder/decoder) and, per `docs/rust_dependency_adoption.md`'s own adoption-review discipline, almost certainly a new `[dependencies]` crate (a hand-rolled CBOR encoder is a substantially larger, riskier undertaking than base64url was for JSON, since CBOR's type/length-prefix grammar is not a closed few-string-label schema the way this crate's JSON payload is). | Would require a NEW Rust module (a fixed-offset binary codec) — buildable with NO new dependency (Stage 186's own "closed schema, hand-written" precedent applies equally well here), but is STILL new code solving a problem Stage 186 already solved once for JSON. |
| **JS Boundary** | No new surface. | `FedosWasmLoader` would need exactly ONE new pair of methods (`attemptDevOnlyExportCiphertextCall`/`attemptDevOnlyImportCiphertextCall`), gated on the SAME six-condition Loader gate every prior Crypto API uses, PLUS the SAME opaque-shape pre-validation `isAeadCiphertextHandleShape()` already provides for the export direction — regardless of payload format. | Same shape as ②'s row; the RETURNED/ACCEPTED byte value itself would be a plain `Uint8Array` either way (this crate's own established "opaque handles in, plain bytes for genuinely-portable output" pattern from `decrypt()`'s own plaintext return, Alpha 015). | No difference from ③'s row at the JS Boundary layer — CBOR bytes are still just a `Uint8Array` crossing the WASM boundary. | No difference from ③'s row. |
| **Runtime Boundary** | No new surface. | A new Runtime Service file (`fedos_runtime_ciphertext_export.ts`/`fedos_runtime_ciphertext_import.ts`, or one file for both — an implementing Stage's own choice) constructing its OWN fresh `FedosWasmLoader` instance per the established one-file-one-fresh-loader convention (Alpha 013/014/015). | Same. | Same. | Same. |

## 3. Specific questions this Stage was asked to resolve

### 3.1 — Is it acceptable to build `exportCiphertext()` alone first?

**No.** Export-without-import is not an independently useful primitive
the way `encrypt()`-without-`decrypt()` was. Alpha 009 §6 / Alpha 011 §6
deliberately staged `encrypt()` and `decrypt()` as **separate** Alphas —
but that was sound specifically because `encrypt()` alone is already a
complete, independently valuable operation: a caller can seal data and
hold the resulting opaque handle in memory for the remainder of that
same Runtime session with `encrypt()` alone, `decrypt()` unbuilt. The
same is not true of a serialization pair: bytes produced by
`exportCiphertext()` with no matching `importCiphertext()` are useless
byte soup nobody can ever turn back into anything — the ONLY reason to
call `exportCiphertext()` at all is to eventually reverse it. Building
one half first also directly undermines Stage 182 §2 criterion 2's own
selection bar ("round-trip correctness provable before shipping") — a
round trip cannot be proven, or even attempted, with only one direction
implemented. **`exportCiphertext()`/`importCiphertext()` must be
designed, reviewed, and implemented together, in the same Stage.**

### 3.2 — Should export/import always be designed as a pair?

**Yes**, for the reason above, generalized: a serialization boundary
(as opposed to an operation boundary like encrypt/decrypt) only has
meaning as a round trip. This Stage recommends treating "export/import
must ship together" as a standing rule for any FUTURE serialization
boundary this arc ever adds (e.g. if `exportKey()`/`importKey()` is ever
built for `AeadKeyHandle`, per Alpha 007 §9/Alpha 012 §4's still-open
`importKey()` question) — not a one-off rule invented for ciphertext
specifically.

### 3.3 — Is a version byte necessary from the very first shipped format?

**Yes.** This is already this crate's own standing discipline, not a new
opinion: Stage 182 §2 criterion 3 already requires "version checked
first, clean rejection," `AeadEnvelopeVersion` already exists with
exactly one variant (`V1`) reserved for exactly this purpose, and
`decode_envelope_internal` already validates it before any other field.
Retrofitting a version discriminator into an already-shipped, unversioned
wire format later would be a strictly harder, strictly riskier change
than including one from the start — precisely the "breakage deferred is
breakage compounded" pattern Alpha 012 §2's "future breakage cost" row
already established for the key-boundary migration, applying here
identically to the ciphertext boundary.

### 3.4 — How much of AAD / Algorithm / Nonce / Tag / Ciphertext belongs on the wire?

**All five belong on the wire, exactly as Stage 182 §3 already fixed —
with one standing exclusion that does not change:**

| Field | On the wire? | As what |
|---|---|---|
| Version | Yes | Fixed wire tag (`v`), checked first. |
| Algorithm | Yes | A fixed short LABEL (`alg`) — never the raw Rust enum's debug form. |
| AAD | **Only the DOMAIN LABEL (`aad`), never the raw AAD bytes.** | The actual AAD bytes are derived internally from the domain label plus context at open/seal time (`crypto::aead_internal`'s own responsibility) — carrying raw AAD bytes on the wire would be redundant with what the label already reconstructs, and Stage 182 §3 already fixed this distinction explicitly. |
| Nonce | Yes | `n`, base64url — not secret, per `docs/nonce_generation_policy.md` §9, so wire exposure is already an accepted, reviewed fact, not a new one this Stage introduces. |
| Ciphertext | Yes | `ct`, base64url. |
| Tag | Yes | `tag`, base64url — a separate wire key from `ct` in Stage 186's actual implementation (the in-memory type still keeps them concatenated; only the wire format splits them). |

**Reaffirmed, unchanged, still excluded** (Stage 182 §4, restated because
a "should we widen the wire format" review is exactly the moment a
future author might be tempted to add "just one more field"): no
`kid`/key-id, no secret/key/seed/password byte of any kind, no plaintext
or content-type hint beyond what `ct`'s own length already unavoidably
reveals, no buyer/payment/entitlement metadata, no chat/DM metadata.

### 3.5 — Should exposing Rust's internal Envelope type directly be forbidden?

**Yes, absolutely, and this is not a new rule — it is the same rule
Alpha 014 already applied to `AeadCiphertextHandle` itself.**
`docs/public_crypto_opaque_handles.md` §2's "opaque public wrapper
types" discipline, and Alpha 014's own explicit forbid-list (no raw
bytes, no `serialize`/`toJSON`, no leaking `toString`, no field beyond
`kind`), both already establish that `FedosCiphertextEnvelope`/
`AeadCiphertextEnvelope` may NEVER be handed to JS directly — not as a
`#[derive(Debug)]` dump, not as a raw struct-to-object mapping, not as an
un-reviewed serialization shortcut. Any future `exportCiphertext()` MUST
go through a single, explicitly reviewed codec (this Stage recommends
the ALREADY-REVIEWED Stage 182/186 one, §6 below) — never a shortcut
that exposes the envelope's Rust-side shape as a side effect of being
convenient to implement.

## 4. Rust existing Wire Format — should Alpha adopt it, or build a new one?

**Adopt it. Do not build a new one.** Stage 182 already ran the exact
comparison this Stage was asked to re-run (§2 above largely restates its
own reasoning, extended to the additional criteria this Stage's charter
adds: Worker, Production, Runtime Boundary, Serializer/Deserializer
responsibility split), Stage 186 already implemented it with **zero new
dependencies**, and its Deserializer is already `cargo test`-verified
against seven distinct adversarial input classes. Building a competing
format now (CBOR or a hand-rolled fixed binary envelope as the FIRST and
ONLY format) would mean:

1. Re-litigating a decision this crate already made, with no new
   information this Stage has surfaced that Stage 182 did not already
   weigh (this Stage's own §2 table shows CBOR/Fixed-Binary lose or tie
   on every criterion except raw wire size).
2. Re-implementing, from zero, a Fail-Closed decoder discipline Stage
   186 already built, tested, and fixed once.
3. For CBOR specifically: very likely requiring a genuinely new
   `[dependencies]` crate, triggering `docs/rust_dependency_adoption.md`'s
   own adoption-review bar — a cost this Stage's charter explicitly
   forbids paying (`Cargo.toml` must not change).
4. Losing text-safety (CBOR, Fixed Binary) for no offsetting benefit
   this Stage can identify — Stage 182 §2 criterion 5 already named
   text-safety (specifically for eventual Nostr `content` embedding) as
   the DECIDING factor for the MVP, and nothing about the ciphertext
   boundary specifically (as opposed to the general envelope question
   Stage 182 already answered) changes that calculus.

**This does not foreclose a future, SEPARATE, size-optimized format**
(CBOR or fixed binary) for a context that never needs text-safety (e.g.
a dedicated binary storage backend) — Stage 182 §2 criterion 7 already
reserved exactly this possibility ("two formats only if explicitly
justified"), and this Stage does not lower that bar. It simply confirms
that bar is not yet met: no such need has been identified, named, or
justified anywhere in this arc as of Alpha 016.

## 5. Fail Closed — where does it live: Serializer or Deserializer?

**Overwhelmingly the Deserializer's job, with a narrow but real
Serializer-side obligation too — restating and generalizing Stage 186's
own already-implemented split:**

- **Serializer (`encode`/`export` direction) — narrow obligation.** Its
  input is always an already-validated, already-Rust-internal value (an
  `AeadCiphertextEnvelope` that can only have been constructed via
  `encrypt_aead()`'s own reviewed path, or reconstructed by the
  Deserializer itself). Its ENTIRE Fail-Closed job is: never panic on any
  reachable internal state, and never produce a byte string its own
  paired Deserializer cannot read back. Stage 186's
  `encode_envelope_internal` already demonstrates the ONE real edge
  case in this crate (a Stage 157–158 SKELETON placeholder shorter than
  the fixed tag length) returning `None` rather than panicking — there is
  no adversarial INPUT to defend against here, because the Serializer's
  caller is this crate's own trusted internals, never external data.
- **Deserializer (`decode`/`import` direction) — the primary Fail-Closed
  surface.** Its input is untrusted BY CONSTRUCTION — it may originate
  from Secure Storage, a network peer, or a forged JS value calling
  `importCiphertext()` with an arbitrary `Uint8Array`. It must reject,
  never partially construct, and never panic on: an unrecognized version,
  an unrecognized algorithm label, an unrecognized AAD-domain label,
  invalid base64url text, a missing field, an unknown/extra field, an
  out-of-canonical-order field, a truncated ciphertext/tag split, or
  malformed JSON at any level. `decode_envelope_internal` already
  implements exactly this, today, `pub(crate)`-only.
- **Where this connects to the crate's own no-oracle discipline
  (Alpha 015 §"Fail-Closed"):** a STRUCTURAL rejection (bad wire shape —
  wrong version, unknown label, invalid base64url) reveals NOTHING about
  any key material and is therefore SAFE to distinguish from a
  cryptographic rejection, exactly the same way `decrypt()`'s
  `InvalidKeyHandle`/`InvalidCiphertextHandle` are already safely
  distinguished from the undistinguishable `DecryptionFailed` outcome
  today. A future `importCiphertext()` implementation should follow the
  SAME split: distinct Fail-Closed reasons for malformed WIRE shape
  (checked, and rejected, entirely before any cryptographic operation is
  ever attempted) are fine; a decoded-but-cryptographically-wrong
  ciphertext must still collapse into the SAME undistinguishable outcome
  `decrypt()` already uses — this Stage does not change that outcome, it
  only confirms where in the export/import pipeline the split should sit.

## 6. Recommendation for Alpha 017

> **Alpha 017 should be a dedicated Ciphertext Wire Format DECISION —
> mirroring Alpha 012's own role after Alpha 011 — that formally ADOPTS
> "reuse Stage 182/186's existing canonical JSON + base64url codec as the
> payload for a NEW `exportCiphertext()`/`importCiphertext()` Public API
> pair, built together in one Stage, with the version byte and full
> `v`/`alg`/`aad`/`n`/`ct`/`tag` field list this review confirms (§3.3,
> §3.4), and the Serializer/Deserializer Fail-Closed split this review
> lays out (§5)" as Secure Runtime's own binding policy, before any code
> is written.**

**Why a decision stage, not implementation directly:** this arc's own
established discipline — Alpha 007 (review) → Alpha 009 (review) →
Alpha 011 (review) → Alpha 012 (**decision**) → Alpha 013
(implementation) — never skips from a comparison stage straight to code.
This Stage narrows the field to one clear direction (§4, §6 above) but
several concrete decisions remain to be FORMALLY FIXED, not merely
"leaned toward," before an implementing stage should be authorized to
write anything: the exact new `#[wasm_bindgen]` wrapper names and
signatures, whether the JS-side return/accept type is a `Uint8Array` of
UTF-8-encoded JSON bytes or a plain `string` (both are structured-clone-
and-Worker-safe; this Stage's own §2 table does not adjudicate between
them), and the exact new `FedosWasmLoaderCiphertextExport`/`Import`-
shaped execution-result interfaces and their own Fail-Closed reason
enumerations (mirroring `FedosWasmLoaderEncryptExecution`/
`DecryptExecution`'s own precedent). Fixing these without a dedicated
decision stage would mean an implementing Stage making several
consequential, hard-to-reverse API-shape choices inline, exactly the
risk Alpha 011→012 was created to avoid for the key boundary.

**Why not recommend jumping straight to `exportCiphertext()`
implementation instead:** rejected per §3.1/§3.2 above on its own terms
(export alone is not shippable), and even a paired
export-AND-import-together implementation Stage would still be making
the JS-side type-shape and wrapper-naming decisions above without a
dedicated review, repeating the exact process risk Alpha 011→012 already
demonstrated is worth avoiding.

**Why not recommend "keep Opaque Handle forever" as the Alpha 017
outcome:** this would foreclose Secure Storage, Worker cross-instance
communication, and any network transport for ciphertext PERMANENTLY —
directly contradicting this Stage's own charter (§0) to review, not
extend indefinitely, a boundary the arc has already identified as
needing to be crossed eventually. Nothing in this Stage's own comparison
(§2) favors ① except "zero implementation cost," which is the same
non-argument Alpha 012 §2 already rejected for freezing raw key bytes
permanently.

## 7. What this Stage does NOT do

- No `exportCiphertext()`/`importCiphertext()` Public API, anywhere.
- No new `#[wasm_bindgen]` item, no new Rust function of any kind (Stage
  186's `encode_envelope_internal`/`decode_envelope_internal` are
  discussed, not touched — `pub(crate)`-only, wired to nothing, exactly
  as before this Stage).
- No `FedosWasmLoader` method, Plan interface, or execution-result
  interface.
- No Runtime Service file.
- No Worker connection, no Production connection.
- No `Cargo.toml`/`package.json` change — no dependency adopted or
  promoted.
- No change to `encrypt()`, `decrypt()`, `generateAeadKey()`,
  `randomBytes()`, `initializeCrypto()`, or `runtimeCapabilities()`.

## 8. Fail Closed — reconfirmed

This Stage changes no Fail-Closed guarantee anywhere in the shipped
Runtime. `initializeCrypto()`, `runtimeCapabilities()`, `randomBytes()`,
`generateAeadKey()`, `encrypt()`, and `decrypt()`'s CURRENT (Alpha
010/014/015) behavior are all confirmed unchanged by this Stage's own
guard test, via actual calls — this Stage reviews a FUTURE boundary; it
implements nothing.

## 9. Confirmed unchanged

- `AppRuntime.initializeCrypto()` — `{ allowed: false, initialized:
  false, reason: "PrototypeDisabled" }`, confirmed by an actual call.
- `AppRuntime.runtimeCapabilities()`/`randomBytes()`/`generateAeadKey()`/
  `encrypt()`/`decrypt()` — all confirmed by actual calls, Fail Closed as
  established.
- `FedosWasmLoader`'s seven Plan interfaces and `planLoad()` — untouched.
- `src/worker.ts` — no reference to anything named in this document.
- `packages/fedos-core-rust/src/lib.rs` — still 34 `pub fn`, still
  exactly eleven `#[wasm_bindgen]` occurrences.
- `packages/fedos-core-rust/src/crypto/ciphertext_serialization.rs` —
  `encode_envelope_internal`/`decode_envelope_internal` remain
  `pub(crate)`-only, wired to nothing, byte-for-byte unchanged.
- `Cargo.toml`/`package.json` — no new dependency, no count change.
- `exportCiphertext()`/`importCiphertext()`/`importKey()`/`exportKey()` —
  none implemented anywhere.
- No Secure Storage of any kind exists anywhere in this Stage's own new
  files.

## 10. See also

- `docs/ciphertext_envelope_plan.md` — the six in-memory envelope fields
  this Stage's wire-field comparison (§3.4) is measured against.
- `docs/ciphertext_envelope_serialization_plan.md` (Stage 177, updated
  Stage 182) — the original four-way encoding comparison (JSON/CBOR/raw
  binary/protobuf-like) and seven selection criteria Stage 182's decision
  — and by extension this Stage's own §2/§4 — is built on top of.
- `docs/ciphertext_serialization_format_decision.md` (Stage 182/186) —
  the binding MVP format decision and its Stage 186 implementation this
  Stage recommends reusing rather than replacing.
- `docs/public_crypto_opaque_handles.md` — the permanent opaque-wrapper
  discipline this Stage's §3.5 answer reaffirms.
- `docs/secure_runtime_alpha_012_key_boundary_decision.md` — the
  precedent this Stage's own §6 recommendation (review → decision →
  implementation, never skipping the decision stage) is modeled on.
- `docs/secure_runtime_alpha_014_encrypt_opaque_handle_api.md` — the
  "Deliberately Alpha-limited Ciphertext boundary choice" this Stage
  picks up and extends.
- `docs/secure_runtime_alpha_015_decrypt_opaque_handle_api.md` — the
  no-oracle Fail-Closed discipline this Stage's §5 extends to the
  export/import boundary.
