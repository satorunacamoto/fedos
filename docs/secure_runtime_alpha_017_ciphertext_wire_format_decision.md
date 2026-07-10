# FedOS Secure Runtime Alpha 017 — Public Runtime Ciphertext Wire Format Decision

**Status: REVIEW / DESIGN DECISION ONLY. No Runtime, Rust,
`FedosWasmLoader`, `create_runtime.ts`, `types.ts`, Worker, Production,
`Cargo.toml`, or `package.json` change of any kind. No `#[wasm_bindgen]`
wrapper is added, `exportCiphertext()`/`importCiphertext()` are NOT
implemented, `encrypt()`/`decrypt()`/`AeadCiphertextHandle` are
untouched, and no Secure Storage/Network/Worker/Production connection is
made. This document and its guard test are the entire deliverable.**

## 0. Where this picks up

Alpha 016 reviewed six candidates for crossing `AeadCiphertextHandle`'s
current opaque-only boundary and found the deciding fact: this crate
**already has** a fully-implemented, `cargo test`-verified ciphertext
wire codec —
`packages/fedos-core-rust/src/crypto/ciphertext_serialization.rs`
(Stage 186), implementing `docs/ciphertext_serialization_format_decision.md`'s
(Stage 182) binding canonical JSON + base64url format
(`v`/`alg`/`aad`/`n`/`ct`/`tag`) — sitting `pub(crate)`-only, wired to
nothing. Alpha 016 recommended a dedicated decision Stage, mirroring
Alpha 012's own role after Alpha 011, to formally adopt reusing that
codec and fix the remaining concrete choices before any code is written.
**This is that Stage.** It decides ten items, each with exactly one
conclusion, and authorizes zero implementation.

## 1. Wire Format — DECIDED: reuse Stage 182/186, no new format

**Formally adopted: the existing canonical JSON + base64url format
(`docs/ciphertext_serialization_format_decision.md`, Stage 182,
implemented Stage 186) is Secure Runtime's own Public Ciphertext Wire
Format. No new, independent wire format is created by this Stage or
authorized for any future Stage to create without its own dedicated
review.** The fixed field list and order (`v`, `alg`, `aad`, `n`, `ct`,
`tag`) and every one of Stage 182 §4's standing exclusions (no `kid`, no
secret/key/seed byte, no plaintext/content-type hint, no
payment/entitlement/chat metadata) apply unchanged to this Public
boundary. This is not a fresh choice — it is the direct execution of
Alpha 016 §4's own conclusion ("Adopt it. Do not build a new one.").

## 2. Public Runtime API — DECIDED

```ts
exportCiphertext(
  ciphertext: AeadCiphertextHandle,
): Promise<AeadCiphertextWire | null>;

importCiphertext(
  serialized: AeadCiphertextWire,
): Promise<AeadCiphertextHandle | null>;
```

Naming mirrors `encrypt()`/`decrypt()`'s own established shape (a verb
naming the direction, one primary argument, a `Promise<... | null>`
return — Fail Closed to `null` on any non-success outcome, never an
exception). `AeadCiphertextWire` is decided in §3/§4 below.

## 3. JS-side Wire type — DECIDED: `string` (not `Uint8Array`, not a dedicated object)

| Candidate | Verdict | Why |
|---|---|---|
| `string` | **Adopted (as a branded string — see §4)** | `encode_envelope_internal` already produces a Rust `String`; `wasm-bindgen` already converts `Option<String>` to a JS `string \| undefined` with zero extra Rust-side or JS-side transformation. This is also the type that preserves Stage 182 §2 criterion 5's own DECIDING factor — text-safety for eventual embedding in a Nostr `content` field, an HTTP JSON body, or a log line — with no additional encode/decode step. A plain `string` is already structured-clone-safe across `postMessage` (§10). |
| `Uint8Array` | Rejected | Would require encoding the JSON string to UTF-8 bytes on the Rust or JS side and decoding it back before any text-based use — a real, unreviewed transformation step that buys nothing: the wire payload IS text by construction (Stage 182's whole point), and forcing it through bytes only to decode it back on the next hop re-introduces the very "extra wrapping layer" Stage 182 §2 criterion 5 named JSON+base64url to AVOID. |
| Dedicated object (e.g. `{ version, algorithm, aadDomain, nonce, ciphertext, tag }` parsed JS-side) | Rejected | Would mean re-implementing a JSON parser and field-level accessors in TypeScript, duplicating — and risking silent divergence from — the ALREADY-REVIEWED Rust Deserializer's own Fail-Closed validation (Stage 186). A JS object exposing `.algorithm`/`.nonce`/`.ciphertext` fields directly is functionally equivalent to exposing the internal envelope's shape via JSON instead of via a `#[wasm_bindgen]` struct — the exact thing Alpha 016 §3.5 already forbade. **Rejected on the same grounds as exposing the Rust envelope directly.** |

**Conclusion: the wire value is an opaque `string` — never parsed,
inspected, or field-accessed on the JS side. It is produced by
`exportCiphertext()` and consumed by `importCiphertext()` only.**

## 4. Branding — DECIDED: yes, a TypeScript-only brand

```ts
export type AeadCiphertextWire = string & {
  readonly __brand: "AeadCiphertextWire";
};
```

**Adopted.** A bare `string` return/parameter type would let ANY string
(a plaintext debug dump, a URL, an unrelated JSON blob) be passed to
`importCiphertext()` or assigned from `exportCiphertext()`'s result
without the type checker ever objecting — exactly the kind of accidental
API misuse a brand exists to catch at compile time. This mirrors
`AeadAlgorithm`/`AeadAadDomain`'s own existing precedent in this crate:
hand-declared TypeScript types that constrain what a caller may WRITE in
source, with no claim of runtime enforcement.

**Explicitly, and this must not be misread: the brand is a compile-time
API-misuse boundary, NOT a runtime security boundary.** `__brand` is a
phantom field that exists only in the type system — it is erased at
compile time, present in no actual runtime value, and trivially
bypassable via `"anything" as AeadCiphertextWire`. **All real Fail-Closed
security enforcement for this boundary happens entirely inside Rust's
`decode_envelope_internal`**, which validates the ACTUAL string content
(version/algorithm/AAD-domain labels, base64url text, field
completeness) regardless of whether the caller obtained the brand
honestly or via a cast — a forged brand assignment gains a caller
NOTHING beyond silencing the type checker; `importCiphertext()` still
Fails Closed to `null` for any string, branded or not, that does not
satisfy the real Rust-side decoder. This is the same relationship
`AeadKeyHandle`/`AeadCiphertextHandle`'s own opaque-shape TypeScript
interfaces already have to their Rust-side `#[wasm_bindgen]` validity —
the TS layer signals INTENT and catches accidents; Rust enforces
correctness.

## 5. Rust `wasm-bindgen` wrapper — DECIDED (contract only, not implemented)

```rust
#[wasm_bindgen]
pub fn serialize_aead_ciphertext(
    ciphertext: &AeadCiphertextHandle,
) -> Option<String> {
    encode_envelope_internal(ciphertext.inner().inner())
}

#[wasm_bindgen]
pub fn deserialize_aead_ciphertext(
    serialized: &str,
) -> Option<AeadCiphertextHandle> {
    let decision = decode_envelope_internal(serialized);
    match decision.status {
        CiphertextSerializationStatus::Valid => decision
            .envelope
            .map(|envelope| AeadCiphertextHandle {
                inner: FedosCiphertextEnvelope::from_inner(envelope),
            }),
        _ => None,
    }
}
```

Both are confirmed, by inspection of the existing crate, to be
buildable as genuinely THIN wrappers calling their one existing codec
function EXACTLY ONCE each:

- `serialize_aead_ciphertext` reaches the real, permanently-opaque
  `AeadCiphertextEnvelope` via the SAME two-hop `inner()` chain
  `decrypt_aead()` (Alpha 015) already established
  (`ciphertext.inner()` → `FedosCiphertextEnvelope`, then `.inner()` →
  `AeadCiphertextEnvelope`), then calls `encode_envelope_internal` once
  and returns its `Option<String>` UNCHANGED.
- `deserialize_aead_ciphertext` calls `decode_envelope_internal` once;
  on `CiphertextSerializationStatus::Valid` (the ONLY status carrying
  `Some` in `decision.envelope`), it constructs a NEW
  `AeadCiphertextHandle` the SAME way `encrypt_aead()` already does today
  (a plain struct literal, `AeadCiphertextHandle { inner: ... }`,
  reachable because both are defined in the same crate) — no new public
  constructor, no new accessor, nothing beyond what `encrypt_aead()`'s
  own existing precedent already permits. Every OTHER status folds to
  `None`.

**No new Rust logic is introduced beyond the wrapper and construction
call itself** — no new validation, no new comparison helper, no new
dependency. This is confirmed feasible by inspection; Alpha 018 still
must write and review the actual diff.

**One pre-existing doc comment this decision satisfies, noted for
Alpha 018:** `FedosCiphertextEnvelope::from_inner`'s own doc comment
(`lib.rs`) currently reads "Never constructs one from untrusted/candidate
bytes — that remains a future, separate, explicitly-reviewed stage." This
Stage IS that future stage's decision — `deserialize_aead_ciphertext`
constructing a `FedosCiphertextEnvelope` from `decode_envelope_internal`'s
validated output is exactly the case that comment reserved, not a
violation of it, because the bytes are no longer "untrusted/candidate" by
the time `from_inner` is called — they have already passed the full
Stage 186 structural validation. Alpha 018 should update that comment's
wording (not its behavior) to reflect that this reservation has now been
exercised, deliberately, by a reviewed Stage.

## 6. Fail-Closed reason model — DECIDED

Mirroring `FedosWasmLoaderEncryptExecution`/`FedosWasmLoaderDecryptExecution`'s
own established shape (Alpha 014/015) exactly, including their PROVEN
two-stage early-gate split (`PrototypeStillClosed` — the six-condition
chain never ran at all — vs. `NotInitialized` — it ran but one condition
failed) and their uniform `"Succeeded"` success tag:

```ts
export interface FedosWasmLoaderExportCiphertextExecution {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly wire: AeadCiphertextWire | null;
  readonly reason:
    | "Succeeded"
    | "InvalidCiphertextHandle"
    | "SerializationFailed"
    | "InvalidWireOutputShape"
    | "NotInitialized"
    | "ExportUnavailable"
    | "CallFailed"
    | "PrototypeStillClosed";
}

export interface FedosWasmLoaderImportCiphertextExecution {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly ciphertextHandle: AeadCiphertextHandle | null;
  readonly reason:
    | "Succeeded"
    | "InvalidWireInputShape"
    | "DeserializationFailed"
    | "InvalidHandleOutputShape"
    | "NotInitialized"
    | "ImportUnavailable"
    | "CallFailed"
    | "PrototypeStillClosed";
}
```

**Refinements made to the candidates this Stage was given, and why:**

- `"Exported"`/`"Imported"` → **`"Succeeded"`**. Both existing execution
  interfaces (`FedosWasmLoaderEncryptExecution`/`DecryptExecution`) use
  the SAME uniform `"Succeeded"` tag for their success case, not a
  verb-specific one (`"Encrypted"`/`"Decrypted"`) — this Stage keeps that
  uniformity rather than introducing a new precedent.
- `"NotReady"` → split into **`"PrototypeStillClosed"`/`"NotInitialized"`**,
  matching BOTH existing execution interfaces' own two-stage early-gate
  split exactly (one reason for "the six-condition chain never ran," a
  distinct one for "it ran but failed") rather than collapsing them into
  a single new tag.
- Import direction's pre-Rust-call structural check is named
  **`"InvalidWireInputShape"`**, not `"InvalidHandleShape"` — the INPUT
  being checked before Rust is ever called is a candidate WIRE value
  (is it even a `string`?), not a handle; the OUTPUT shape check after a
  successful Rust call (is the returned value a genuine
  `AeadCiphertextHandle`, per `isAeadCiphertextHandleShape()`) is a
  SEPARATE, later check, named **`"InvalidHandleOutputShape"`** — mirroring
  `decrypt()`'s own pre-call (`InvalidKeyHandle`/`InvalidCiphertextHandle`)
  vs. post-call (`InvalidPlaintextShape`) distinction exactly, applied to
  the reverse direction.
- `"DeserializationFailed"` is a genuine, in-bounds `None` return from
  `deserialize_aead_ciphertext` — covering ALL SEVEN of
  `decode_envelope_internal`'s own internal rejection causes
  (`InvalidVersion`/`InvalidAlgorithm`/`InvalidAadDomain`/
  `InvalidBase64Url`/`MissingField`/`UnknownField`/`MalformedJson`),
  collapsed into ONE outcome at the Loader boundary — mirroring
  `decrypt()`'s own `DecryptionFailed` collapsing multiple Rust-internal
  causes into one Loader-level reason (Alpha 015).

**The Public Runtime API surfaces NONE of these reasons.**
`exportCiphertext()`/`importCiphertext()` resolve ONLY
`AeadCiphertextWire | null` / `AeadCiphertextHandle | null` respectively
— the eleven-plus distinct Loader-level reasons above exist for
diagnostics/testing at the Loader layer exactly as
`FedosWasmLoaderEncryptExecution`/`DecryptExecution`'s own reasons
already do, never surfaced to a Public API caller, never surfaced in
Runtime/Worker diagnostics.

## 7. Export / Import implementation unit — DECIDED

**Formally decided: `exportCiphertext()` and `importCiphertext()` are
designed AND implemented together, in the same Stage (Alpha 018) — not
split across two Stages, and not split as "Rust wrapper pair now, Public
API later."** This directly executes Alpha 016 §3.1/§3.2's own
conclusion: export-without-import produces bytes (a wire string) nobody
can ever reverse, which is not an independently shippable feature the
way `encrypt()`-without-`decrypt()` was (Alpha 016 §3.1 explains why the
`encrypt()`/`decrypt()` staged-Alpha precedent does not transfer to a
serialization pair). Rejecting "Rust wrapper pair only, Public API
later" too: a wrapper pair sitting unconnected to any Public API, per
Alpha 016 §4's own reasoning about Stage 186 itself, is exactly the
state THIS Stage exists to move past, not reproduce one layer up.

**This does NOT mean Alpha 018 must land as one physical commit.**
Whether the Rust wrapper pair, the `FedosWasmLoader` methods, and the
Runtime Service layer land as one commit or several sequential commits
WITHIN Alpha 018 is a separate, purely engineering-granularity question
this Stage does not fix — the constraint is that no INTERMEDIATE state
of Alpha 018 may ship with one direction implemented as a stable, usable
Public API while the other remains entirely absent. A Stage is free to
build and review incrementally; it may not SHIP incrementally.

## 8. Trust Boundary — DECIDED

**Export direction:**

- Accepts ONLY a genuine `AeadCiphertextHandle`, verified structurally
  via `isAeadCiphertextHandleShape()` (the SAME existing validator
  Alpha 014/015 already use) BEFORE `serialize_aead_ciphertext` is ever
  called — an obviously-forged value never reaches Rust.
- Never returns, and the Rust wrapper never touches, a raw ciphertext
  byte outside the reviewed wire encoding — `serialize_aead_ciphertext`
  reaches the envelope ONLY via the existing `inner()`/`inner()` chain,
  identical to `decrypt_aead()`'s own established access pattern.
- The Serializer (`encode_envelope_internal`) never panics — confirmed
  by Stage 186's own doc comment and test suite; its ONE edge case (a
  Stage 157–158 SKELETON placeholder shorter than the fixed tag length)
  returns `None`, never panics.
- Only a ROUND-TRIP-CAPABLE output is ever returned — `Some(String)` is
  returned ONLY for a real, already-sealed envelope; `None` propagates to
  `null` at every layer above it.

**Import direction:**

- Input is COMPLETELY untrusted by construction — it may be a value read
  back from a future Secure Storage layer, received over a future
  network transport, or an arbitrary string an adversarial caller
  constructs by hand.
- Unknown `version` → rejected (`InvalidVersion`, folded into
  `DeserializationFailed` at the Loader boundary).
- Unknown `algorithm` label → rejected (`InvalidAlgorithm`).
- Unknown `aad` domain label → rejected (`InvalidAadDomain`).
- Malformed base64url text → rejected (`InvalidBase64Url`).
- Wrong `nonce`/`tag`/`ciphertext` length → rejected — `decode_envelope_internal`
  already enforces exact fixed lengths for `n`/`tag` and a valid
  base64url decode for `ct`, per Stage 186's own implementation, unchanged.
- Unknown/missing field handling defers ENTIRELY to the existing codec's
  own already-decided behavior (`MissingField`/`UnknownField`, STRICT
  canonical order, per Stage 182 §3/§4 and Stage 186's own
  implementation choice) — this Stage introduces no new leniency and no
  new strictness beyond what already exists.
- No exception ever escapes `importCiphertext()` — `CallFailed` catches
  any thrown error at the Loader boundary exactly as every prior Crypto
  API's Loader method already does; the Public API's own `try`/`catch`
  (mirroring `encrypt()`/`decrypt()`'s own Runtime Service shape) is the
  final backstop.

## 9. Distinguishing wire-structure failure from cryptographic failure — DECIDED

**`importCiphertext()` validates ONLY wire structure — never
cryptographic validity.** `decode_envelope_internal` performs NO AEAD
operation and holds no key; it cannot, and must not, attempt to guess or
verify whether the decoded ciphertext will ever successfully
authenticate against any key. This is confirmed by inspection: none of
`CiphertextSerializationStatus`'s eight variants (`Valid` plus seven
rejection causes) references key material, authentication, or tag
verification in any way — every one of them is a STRUCTURAL judgment
(is this byte sequence a recognized version/algorithm/domain label; is
this text valid base64url; is this field present, absent, or
out-of-order).

**A direct, important consequence, stated explicitly so no future Stage
misreads this boundary: `importCiphertext()` CAN and WILL succeed
(returning a genuine, usable `AeadCiphertextHandle`) for a wire string
that decodes structurally but will later fail `decrypt()`'s own
authentication check** — e.g. a ciphertext produced under a different
key, a tampered ciphertext with an otherwise well-formed wire envelope,
or a ciphertext whose AAD domain no longer matches what
`decrypt()`'s caller supplies. **This is BY DESIGN, not a gap.** The two
checks belong to two entirely separate, already-reviewed layers:

- `importCiphertext()` — Wire STRUCTURE only. "Is this a well-formed
  envelope."
- `decrypt()` — Cryptographic VALIDITY only, per Alpha 015's own
  established no-oracle discipline: key mismatch, AAD mismatch, and
  ciphertext tampering are ALL folded into the SAME undistinguishable
  `null` (`FedosDecryptStatus::AuthenticationFailed`, never subdivided).

This Stage does not change, weaken, or attempt to duplicate `decrypt()`'s
own cryptographic check inside `importCiphertext()` — doing so would
mean `importCiphertext()` needing a key it has no business holding, and
would risk becoming exactly the kind of oracle Alpha 015 already
eliminated. **`importCiphertext()` succeeding is a necessary, but never
sufficient, precondition for a subsequent `decrypt()` call to
succeed.**

## 10. Storage / Network / Worker / future consumers — surveyed, none connected

This Stage confirms — without connecting to any of them — that a
`string`-shaped, text-safe, versioned wire value is the correct
PREREQUISITE shape for every consumer Alpha 016 §0 named as currently
impossible:

- **Secure Storage** — a plain string is directly persistable in any
  string-shaped store (structured-clone-based, IndexedDB, a JSON column,
  a flat file) with no additional wrapping; no Secure Storage design is
  authorized or begun by this Stage.
- **Network transport** — text-safe by construction (Stage 182 §2
  criterion 5); no network connection exists or is authorized.
- **Worker boundary** — a plain `string` is structured-clone-safe across
  `postMessage` with zero special handling; no Worker connection exists
  or is authorized (`src/worker.ts` remains untouched).
- **Runtime restart recovery** — a value that outlives the WASM instance
  that produced it is the entire point of this boundary; no persistence
  mechanism is built here.
- **Marketplace content delivery / DM / BBS-style content posting** —
  all three are named as EVENTUAL, plausible consumers of a portable
  ciphertext value; none is designed, scoped, or connected by this
  Stage, and no assumption about their own future wire needs is baked
  into this decision beyond what Stage 182 already fixed for the general
  envelope.

## 11. Consistency check against prior binding docs

- **Stage 182 (`ciphertext_serialization_format_decision.md`)** — this
  Stage adopts its format decision outright (§1) and its field-list
  exclusions (§1) without modification; introduces no new field.
- **Stage 186 (`ciphertext_serialization.rs` implementation)** — this
  Stage's Rust wrapper contract (§5) calls `encode_envelope_internal`/
  `decode_envelope_internal` exactly as they exist today, with no
  modification to either function authorized or needed.
- **Alpha 013 (Opaque `AeadKeyHandle`)** — unaffected; this Stage
  concerns only the ciphertext boundary.
- **Alpha 014 (`encrypt()`)** — `AeadCiphertextHandle`'s existing
  `isAeadCiphertextHandleShape()` validator and `kind` getter are reused
  unmodified (§8); `encrypt()` itself is untouched.
- **Alpha 015 (`decrypt()`)** — the no-oracle Fail-Closed discipline
  (§6, §9) is extended, not altered; `decrypt()` itself is untouched.
- **Alpha 016 (boundary review)** — every one of its recommendations is
  executed: reuse the existing codec (§1), export/import as a pair (§7),
  version byte from the start (§1, inherited from Stage 182), the full
  field list (§1), forbidding raw envelope exposure (§3, §8), and the
  Serializer/Deserializer Fail-Closed split (§8, §9).
- **`docs/ciphertext_envelope_plan.md`** — the six in-memory envelope
  fields this decision's wire shape (inherited from Stage 182) already
  serializes are unchanged; this Stage adds no new in-memory field.
- **`docs/public_crypto_opaque_handles.md`** — §2's opaque-wrapper
  discipline is reaffirmed, not modified: `AeadCiphertextHandle` gains no
  new public method, no `Clone`/`Debug`/`Serialize` derive, and the ONLY
  way to obtain a NEW instance from wire data remains the single
  reviewed `deserialize_aead_ciphertext` seam (§5) — never a general
  deserialization shortcut.

## 12. Recommendation for Alpha 018

> **Alpha 018 should implement the Rust `wasm-bindgen` wrapper pair AND
> the full Public Runtime API — `exportCiphertext()`/`importCiphertext()`
> end to end through `FedosWasmLoader` and two new Runtime Service files
> — together, in one Stage, exactly per §5/§6/§7 above.**

**Why not "Rust wrappers only, Public API later":** §7 already rejects
this — it reproduces, one layer up, the exact "codec exists but is wired
to nothing" state Alpha 016 identified as the problem to move past, and
still leaves export/import unshippable as a pair until a second Stage
lands.

**Why not "export side only":** rejected on the same grounds as
building `exportCiphertext()` alone at all (Alpha 016 §3.1, restated in
§7 above) — an export-only Stage produces wire strings nobody can
recover, failing Stage 182 §2 criterion 2's own "round-trip correctness
provable before shipping" bar outright, since a round trip cannot even
be ATTEMPTED with only one direction built.

**Why not another preparatory/review Stage:** rejected because this
Stage (Alpha 017) has now fixed every concrete decision an implementing
Stage needs — the wire format (§1), the exact Public API signature (§2),
the JS wire type and its branding (§3, §4), the exact Rust wrapper
contract (§5), the complete Fail-Closed reason model (§6), the
implementation-unit rule (§7), the Trust Boundary (§8), and the
crypto/wire failure separation (§9). Nothing consequential remains
undecided that would justify a further review-only Stage before code is
written — doing so would repeat Alpha 011→012's already-completed
decision discipline a second time for no new open question.

## 13. What this Stage does NOT do

- No `exportCiphertext()`/`importCiphertext()` implementation, anywhere.
- No new `#[wasm_bindgen]` item, no new Rust function of any kind —
  `serialize_aead_ciphertext`/`deserialize_aead_ciphertext` (§5) are a
  DECIDED CONTRACT, not code; neither exists in
  `packages/fedos-core-rust/src/lib.rs` after this Stage.
- No `FedosWasmLoader` method, field, or execution-result interface —
  `FedosWasmLoaderExportCiphertextExecution`/`ImportCiphertextExecution`
  (§6) are DECIDED SHAPES, not code.
- No Runtime Service file, no `create_runtime.ts`/`types.ts` change.
- No Worker connection, no Production connection, no Secure Storage, no
  Network connection.
- No `Cargo.toml`/`package.json` change — no dependency adopted or
  promoted.
- No change to `encrypt()`, `decrypt()`, `generateAeadKey()`,
  `randomBytes()`, `initializeCrypto()`, `runtimeCapabilities()`, or
  `AeadCiphertextHandle` itself.

## 14. Fail Closed — reconfirmed

This Stage changes no Fail-Closed guarantee anywhere in the shipped
Runtime. `initializeCrypto()`, `runtimeCapabilities()`, `randomBytes()`,
`generateAeadKey()`, `encrypt()`, and `decrypt()`'s CURRENT (Alpha
010/013/014/015) behavior are all confirmed unchanged by this Stage's
own guard test, via actual calls — this Stage decides a FUTURE public
boundary; it implements nothing.

## 15. Confirmed unchanged

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

## 16. See also

- `docs/secure_runtime_alpha_016_ciphertext_wire_format_boundary_review.md` —
  the review this Stage's ten decisions directly execute.
- `docs/ciphertext_serialization_format_decision.md` (Stage 182/186) —
  the binding format decision and implementation this Stage's §1/§5
  reuse.
- `docs/ciphertext_envelope_plan.md` — the in-memory field list this
  decision's wire shape (inherited unchanged) serializes.
- `docs/public_crypto_opaque_handles.md` — the opaque-wrapper discipline
  §4/§8 reaffirm.
- `docs/secure_runtime_alpha_012_key_boundary_decision.md` — the
  review→decision→implementation precedent this Stage's own role (and
  §12's "why not another review Stage") is modeled on.
- `docs/secure_runtime_alpha_014_encrypt_opaque_handle_api.md` /
  `docs/secure_runtime_alpha_015_decrypt_opaque_handle_api.md` — the
  `AeadCiphertextHandle`/no-oracle precedents §5/§6/§9 extend.
