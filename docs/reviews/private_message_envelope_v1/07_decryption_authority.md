# 07 — Decryption Authority

## Mirror of `06_encryption_authority.md`, using the real `decrypt()` chain

```ts
// Design shape only. Not implemented by this review.
interface FedosConversationDecryptionAuthority {
  /** Resolve (deriving if needed) the key handle for one conversation epoch — same primitive as encryption's own resolver. */
  resolveConversationKey(
    conversationId: FedosConversationId,
    keyEpoch: FedosConversationKeyEpoch,
  ): Promise<AeadKeyHandle | null>;

  /** Recover plaintext from an Envelope's wire ciphertext under the resolved key. */
  decrypt(
    key: AeadKeyHandle,
    algorithm: AeadAlgorithm,
    aadDomain: AeadAadDomain,
    ciphertext: AeadCiphertextWire,
  ): Promise<Uint8Array | null>;
}
```

`decrypt()` reuses `attemptDevOnlyRuntimeDecrypt()`/`decrypt()`
(`fedos_runtime_decrypt.ts`, Seam 2, real and gated) plus
`importCiphertext()` (`fedos_runtime_import_ciphertext.ts`, real,
converts `AeadCiphertextWire` back to an `AeadCiphertextHandle` before
the actual `decrypt_aead()` Rust call — confirmed by direct reading of
`fedos_runtime_import_ciphertext.ts`'s own four-layer header comment,
which mirrors `fedos_runtime_export_ciphertext.ts` exactly). No new
cryptography — this is a genuine reuse of an existing, real, working
pair of Runtime Service functions, gated exactly as `06` describes.

`resolveConversationKey()` is the **same** unresolved function named in
`06` — a Decryption Authority and an Encryption Authority both need it,
and this review recommends a single shared implementation rather than
two, to avoid two independent (and possibly divergent) derivations of
"the key for conversation X, epoch N."

## Failure modes — why `null` alone is not enough for a caller of this specific boundary

Seam 2's existing `decrypt()` already fails closed to `null` on **every**
distinguishable cause: an unmet Development-Runtime gate, a malformed
key/ciphertext/algorithm/AAD-domain argument, an absent WASM export, a
thrown exception, a wrongly-shaped return, or Rust's own genuine AEAD
authentication failure (SEC §01's own finding: tamper, wrong nonce,
wrong AAD, and wrong key all collapse to **one** undifferentiated
`AeadStatus::AuthenticationFailed` — a deliberate no-oracle design,
re-confirmed this pass by grep of `aead_internal.rs`'s own doc comments).

For a bare `AeadKeyHandle`/`AeadCiphertextHandle` pair, an undifferentiated
`null` is the *correct*, security-appropriate answer (SEC §01's own
no-oracle finding). **For a Conversation Decryption Authority
specifically, one additional failure class is not security-sensitive and
should be distinguishable**: "no key exists yet for this
`conversationId`/`keyEpoch` pair" (e.g. because the caller is not yet a
member, or the epoch has not been reached) is a **membership/epoch**
fact, not a cryptographic-tamper fact, and conflating it with
`AuthenticationFailed`-shaped `null` would make ordinary "you don't have
access to this yet" cases indistinguishable from "someone tampered with
this ciphertext" at the UI/caller layer — a usability regression, not a
security one, since `resolveConversationKey()` returning `null` happens
strictly *before* any ciphertext is even touched. See
`16_failure_vocabulary.md` for the proposed two-stage vocabulary
(key-resolution failure vs. AEAD failure) that keeps this distinction
without reintroducing an oracle into the AEAD call itself.

## Key lookup — same open question as `06`, not duplicated here

`resolveConversationKey()`'s caching/re-derivation question is identical
for both directions and is not re-litigated in this document — see `06`.
One asymmetry worth naming: a *decrypting* party may need to resolve a
key for an epoch **earlier** than their own `currentKeyEpoch` (SEC §06's
own "new member's epoch begins at join time" rule) — `resolveConversationKey()`'s
signature above accepts an explicit `keyEpoch` argument specifically so
a caller can attempt (and be correctly denied, per SEC §06, if policy
says so) resolution for a historical epoch, rather than the function
silently assuming "current epoch" always.

## See also

- `docs/reviews/private_conversation_security/06_key_epochs.md`
- `06_encryption_authority.md`, `16_failure_vocabulary.md`
