# 06 — Encryption Authority

## The proven pattern to mirror: `FedosMasterSeedAuthority`/`FedosWasmMasterSeedAuthority`

`01_crypto_inventory.md` confirms this is the **one** fully real,
end-to-end-wired crypto boundary in this codebase, and its shape is
directly reusable as a template:

```ts
// src/runtime/master_seed/fedos_master_seed_authority.ts — real, current source
export interface FedosMasterSeedAuthority {
  isAvailable(): Promise<boolean>;
  isCleared(): Promise<boolean>;
  generate(): Promise<boolean>;
  restoreSealed(envelope: FedosSealedMasterSeedEnvelopeV1, passphrase: Uint8Array): Promise<boolean>;
  seal(passphrase: Uint8Array): Promise<FedosSealedMasterSeedEnvelopeV1 | null>;
  clear(): Promise<void>;
}
```

Its implementation (`FedosWasmMasterSeedAuthority`) establishes three
design decisions worth reusing verbatim for a future Encryption
Authority:

1. **Lazy, once-only construction, retained across calls**
   (`#ensureConstructed()`), because the underlying WASM handle owns its
   own lifecycle and multiple operations must observe the same instance
   — directly analogous to a conversation-key handle needing to persist
   across an `encrypt()` then a later `decrypt()` call for the *same*
   conversation/epoch.
2. **A narrow, structurally-typed loader-boundary dependency**
   (`FedosMasterSeedWasmLoaderBoundary`, six methods only) injectable in
   the constructor, purely for testability — every real call site omits
   it and gets the real `FedosWasmLoaderSkeleton`. This is the same
   pattern `fedos_runtime_encrypt.ts`/`fedos_runtime_decrypt.ts` already
   use (optional `loader` parameter defaulting to `createFedosWasmLoader()`).
3. **No raw-byte getter anywhere, ever, on the public interface** — the
   file's own header states this as a Permanent Security Invariant.

## Proposed shape for a Conversation Encryption Authority (design-level only, not implemented)

```ts
// Design shape only. Not implemented by this review.
interface FedosConversationEncryptionAuthority {
  /** Resolve (deriving if needed) the pairwise/group key handle for one conversation epoch. Never returns raw bytes. */
  resolveConversationKey(
    conversationId: FedosConversationId,
    keyEpoch: FedosConversationKeyEpoch,
  ): Promise<AeadKeyHandle | null>;

  /** Seal plaintext into a wire ciphertext under the resolved key. */
  encrypt(
    key: AeadKeyHandle,
    algorithm: AeadAlgorithm,
    aadDomain: AeadAadDomain,
    plaintext: Uint8Array,
  ): Promise<AeadCiphertextWire | null>;
}
```

`encrypt()` above is not new plumbing — it is a direct, unmodified reuse
of the already-real `attemptDevOnlyRuntimeEncrypt()`/`encrypt()` chain
in `fedos_runtime_encrypt.ts` (Seam 2, confirmed real and gated in
`01_crypto_inventory.md`), reshaped to return `AeadCiphertextWire`
(post-`exportCiphertext()`, per `fedos_runtime_export_ciphertext.ts`)
rather than a raw `AeadCiphertextHandle`, since the Envelope's own
`ciphertext` field (`04_envelope_v1.md`) needs the wire-serialized
string, not an in-process-only opaque handle.

## What is genuinely new work vs. what is pure reuse

- **Pure reuse, zero new cryptography**: the `encrypt()` call itself
  (Seam 2's existing four-layer chain), the wire serialization
  (`exportCiphertext()`, already real), and the Master-Seed-Authority
  construction pattern above.
- **Genuinely new**: `resolveConversationKey()` has **no real
  counterpart today**. Seam 2 today only offers `generateAeadKey()` — a
  *fresh random key*, with no notion of "the key for conversation X,
  epoch N," and no persistence or lookup of a previously-derived key at
  all. Building `resolveConversationKey()` requires: (a) the
  conversation-key ECDH primitive exported past `pub(crate)`
  (`12_wasm_export_gap.md`), and (b) a decision on where a derived
  conversation key is cached/looked up between calls — a `AeadKeyHandle`
  is an opaque WASM-side value; whether it is re-derived on every
  `encrypt()`/`decrypt()` call (cheap, since it is deterministic ECDH
  per SEC §17's own "recoverable from Master Seed + counterparty public
  key" finding) or cached in-process is an implementation choice this
  review does not make, only names.

## Authority boundary, restated

Per `08_membership_readiness.md` and SEC §04, the Encryption Authority
**must not** itself decide who is a legitimate conversation participant
— it accepts a `conversationId`/`keyEpoch` and, separately, trusts that
whatever called it has already confirmed write/read authority via a real
`FedosConversationMembershipAuthority` (CFv1 §10). Conflating the two —
letting the Encryption Authority silently succeed for a non-member's
`conversationId` — would recreate exactly the "fake allow-all
membership" trap CFv1 §10 names explicitly. This review does not design
that check; it names the boundary so a future Arc does not fold it into
this Authority by convenience.

## See also

- `docs/reviews/conversation_foundation_v1/10_membership_boundary.md`
- `01_crypto_inventory.md`, `07_decryption_authority.md`, `13_runtime_activation_gate.md`
