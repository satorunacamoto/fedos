# 04 — Envelope V1 Shape

Not implemented. This document refines CFv1 §11's field-name-and-role
sketch by substituting, wherever possible, the **real, already-existing
wire types** `01_crypto_inventory.md` found in `src/runtime/fedos_wasm_loader.ts`,
in place of CFv1 §11's own placeholder brands. No byte layout beyond
what those real types already fix, no new algorithm, and no key
material appears below.

## CFv1 §11's sketch, field by field, against real types

CFv1 §11 deliberately left `ciphertextRef`, `envelopeVersion`, and
`keyEpoch` typed as forward-looking placeholders because, at the time it
was written, no real wire type had been confirmed to exist. This review
confirms one now exists for two of the three:

| CFv1 §11 field | CFv1 §11's placeholder type | Real type found (this review) | Still blocked? |
|---|---|---|---|
| `ciphertextRef` | `FedosPrivateCiphertextRef` (undefined) | `AeadCiphertextWire` (`fedos_wasm_loader.ts:1417`) — a real, branded, already-serialized `string` produced by the existing `exportCiphertext()` (Seam 2) | **Partially unblocked.** The wire *type* is real; the *storage location* `ciphertextRef` addresses is still blocked on `02_storage_alignment.md`'s dedicated private backend not existing. |
| `envelopeVersion` | `FedosConversationEnvelopeVersion` (undefined) | No real algorithm-negotiation type exists; `AeadAlgorithm = "ChaCha20Poly1305" \| "Aes256Gcm"` (real) names *which cipher*, not *which envelope layout*. | **Still blocked**, per CFv1 §11's own reasoning: a version tag cannot be minted responsibly before a scheme is wired end-to-end (`12_wasm_export_gap.md`, `13_runtime_activation_gate.md`). |
| `keyEpoch` | `FedosConversationKeyEpoch` (SEC §03, branded `number`) | No change — still a safe type to *name*, semantics still ungoverned. | **Still blocked** on membership (`08_membership_readiness.md`) and epoch rules (`11_key_epochs.md`). |
| `senderRef` | `FedosConversationParticipantRef` (out of V1) | No change. | **Still blocked** on `08_membership_readiness.md`. |
| `source` | — | `FedosBoardSourceReference` (real, `src/board/fedos_board_source.ts`) | Not blocked — reused unchanged, per CFv1 §11. |

## Proposed V1 shape

```ts
// Design shape only. Not implemented by this review.
interface FedosConversationMessageEnvelopeV1 {
  // --- public routing metadata: visible even under encryption (SEC §07) ---
  readonly conversationId: FedosConversationId;          // CFv1 §03 — real type, not yet implemented
  readonly senderRef: FedosConversationParticipantRef;    // SEC §04 union — out of V1, placeholder reference only
  readonly createdAt: number;                             // Unix seconds, matches FedosBoardPost.createdAt convention

  // --- ciphertext: opaque, already-serialized wire text ---
  readonly ciphertext: AeadCiphertextWire;                // REAL type (fedos_wasm_loader.ts) — reused, not invented
  readonly algorithm: AeadAlgorithm;                       // REAL type: "ChaCha20Poly1305" | "Aes256Gcm" only
  readonly aadDomain: AeadAadDomain;                       // REAL type — "Conversation" already exists as a value

  // --- key epoch reference: names WHICH key sealed this, not the key itself ---
  readonly keyEpoch: FedosConversationKeyEpoch;            // SEC §03 branded number — semantics blocked, §11

  // --- envelope format version: a closed literal, not open-ended ---
  readonly envelopeVersion: "v1";                          // fixed for THIS shape only — see note below

  // --- protocol provenance: reused unchanged, no new type ---
  readonly source: FedosBoardSourceReference;              // real, existing type
}
```

## What changed from CFv1 §11, and why

- **`ciphertextRef` renamed `ciphertext`, typed `AeadCiphertextWire`
  directly, not a separately-invented reference type.** CFv1 §11 left
  this an undefined "opaque handle vs. a storage-key string" choice
  because no real wire type had been confirmed. This review confirms
  `AeadCiphertextWire` (a real, branded, JSON+base64url `string` per
  `fedos_wasm_loader.ts:1401-1419`'s own doc comment) is exactly the
  value `exportCiphertext()` already produces and `importCiphertext()`
  already consumes (Seam 2, unchanged, real, existing code). The
  Envelope's own field should carry that value directly, not invent a
  second indirection layer — mirroring how `FedosConversationMessage`
  (SEC §02's own illustrative shape) already used the same discipline.
  **This does not resolve `02_storage_alignment.md`'s open question**
  of where the envelope record itself, and this ciphertext string
  specifically, are durably persisted — only what type the field is
  once persisted somewhere.
- **`algorithm`/`aadDomain` added, both real types, not invented.**
  Neither CFv1 §11 nor SEC §02's illustrative shape named these — this
  review adds them because `encrypt()`/`decrypt()` (Seam 2) require both
  as explicit call parameters, and an envelope that omits them cannot be
  decrypted without the caller separately reconstructing which algorithm
  and AAD domain were used, defeating the point of a self-describing
  envelope. `AeadAadDomain` already names `"Conversation"` as one of its
  five real values (`RootKey | Identity | Storage | Conversation | TestOnly`,
  `fedos_wasm_loader.ts:1384`) — the only one of the five that plausibly
  applies to this envelope. See `14_associated_data.md` for why this
  alone is not sufficient AAD binding.
- **`envelopeVersion` kept as CFv1 §11 left it: named, fixed, not
  widened.** This review does not resolve CFv1 §11's own stated blocker
  (a version tag cannot be minted responsibly before a scheme is wired
  end-to-end) — `"v1"` above is this *document's own* shape identifier,
  not a claim that a negotiated wire-format version scheme exists. A
  future Arc choosing to support multiple envelope layouts must design
  real version negotiation; this review does not.
- **No field renamed or removed beyond what CFv1 §11 already specified.**
  `conversationId`/`senderRef`/`createdAt`/`keyEpoch`/`source` are
  unchanged from CFv1 §11's own sketch, field name and role both.

## What this document still does not do

Per CFv1 §11's own scope discipline, restated: it does not choose a
nonce scheme (see `15_nonce_replay.md`), a KDF salt, a compiled artifact
target, or claim this shape is final. It adds concreteness only where a
real type already exists in `src/` to ground it — every field that
remains a named-but-ungoverned placeholder in CFv1 §11 remains exactly
that here, cross-referenced to the document that owns resolving it.

## See also

- `docs/reviews/conversation_foundation_v1/11_private_message_envelope.md`
- `01_crypto_inventory.md`, `03_envelope_boundary.md`, `14_associated_data.md`
