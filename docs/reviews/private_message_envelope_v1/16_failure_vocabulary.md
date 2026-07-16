# 16 — Failure Vocabulary

## The existing conventions this proposal must not fragment further

Direct reading finds this codebase already has **four separate**
closed-enum failure/state vocabularies, each scoped to its own boundary,
never merged:

```ts
// src/crypto/types.ts — Seam 1
type CryptoState = "available" | "unavailable" | "error";

// src/runtime/crypto_provider.ts — Seam 3
type RuntimeCryptoState = "Placeholder" | "NotConnected" | "Unsupported";

// src/runtime/fedos_wasm_loader.ts — Seam 2, one example of several per-operation reason unions
type FedosWasmLoaderAeadKeyGenerationExecutionReason =
  | "Succeeded" | "EntropySourceUnavailable" | "InvalidHandleShape"
  | "NotInitialized" | "KeyGenerationUnavailable" | "CallFailed" | "PrototypeStillClosed";

// src/storage/types.ts — a fourth, storage-scoped vocabulary
type StorageState = "unavailable" | "accepted_placeholder" | "rejected" | "error";
```

**Every one of these is intentionally scoped to its own boundary and
none is reused across boundaries** — `src/runtime/crypto_provider.ts`'s
own header states this explicitly (*"deliberately distinct... so the
two are never confused at a glance"*). This review's own proposed
vocabulary for the Envelope's decrypt/encrypt boundary follows the same
discipline: a **fifth, Envelope-scoped** vocabulary, not a reuse of any
existing one, and not a fifth vocabulary that tries to be universal
across all boundaries either.

## Two-stage proposal, keeping the no-oracle discipline for the AEAD stage specifically

SEC §01's own finding, reconfirmed directly this review (`07_decryption_authority.md`):
`aead_internal.rs`'s own test suite *"asserts tamper/wrong-nonce/wrong-AAD/wrong-key
all collapse to one undifferentiated `AeadStatus::AuthenticationFailed`
... no oracle."* This is a deliberate, correct security property that
**must not be broken** by a caller-facing Envelope failure vocabulary —
distinguishing "wrong key" from "tampered ciphertext" at any layer above
the raw AEAD call would reintroduce exactly the oracle the Rust core's
own design goes out of its way to avoid.

`07_decryption_authority.md` already identified that one failure class
genuinely *is* safe to distinguish, because it occurs strictly before
any ciphertext is touched: whether a key could be resolved at all for
the given `conversationId`/`keyEpoch`. This review proposes a
two-stage, closed vocabulary reflecting exactly that split:

```ts
// Design shape only. Not implemented by this review.
type FedosEnvelopeKeyResolutionFailure =
  | "no-membership"        // caller is not (or not yet) a resolvable member of this conversation
  | "epoch-not-reached"     // caller's own epoch access does not cover the requested keyEpoch
  | "authority-unavailable" // the resolution mechanism itself could not run (mirrors CFv1 §10's own "authority-unavailable" vs "not-member" distinction)
  | "runtime-gate-closed";  // Seam 2's own Development-Runtime/WASM-artifact gate is closed (13_runtime_activation_gate.md)

// Deliberately undifferentiated -- mirrors the real Rust AeadStatus::AuthenticationFailed no-oracle design exactly.
type FedosEnvelopeAeadFailure = "authentication-failed";

type FedosEnvelopeDecryptResult =
  | { readonly outcome: "decrypted"; readonly plaintext: Uint8Array }
  | { readonly outcome: "key-resolution-failed"; readonly reason: FedosEnvelopeKeyResolutionFailure }
  | { readonly outcome: "aead-failed"; readonly reason: FedosEnvelopeAeadFailure }
  | { readonly outcome: "malformed-envelope" };  // e.g. envelopeVersion not recognized -- a structural check, before any key/AEAD call
```

`"authority-unavailable"` above deliberately reuses the exact naming
convention CFv1 §10's own `FedosMembershipCheckResult` already
established (`"member" | "not-member" | "authority-unavailable"`) — this
review does not invent a new word for "the check could not run" when
CFv1 §10 already named one, for the identical distinction, in the
identical membership-authority context this vocabulary depends on.

## Why `"malformed-envelope"` is separated from both AEAD and key-resolution failure

A structurally invalid Envelope (unrecognized `envelopeVersion`, missing
required field, `algorithm` not one of Seam 2's real two values) is a
**parsing/validation** failure, occurring before any key is resolved or
any AEAD call is attempted — conflating it with either stage above would
make the vocabulary lie about which layer actually rejected the input.
This mirrors `FedosBoardPersistence`'s own established discipline
(`"failed"` vs. `"conflict"`, never conflated, SEC/CFv1 both cite this
convention) applied to a new boundary.

## What this document does not do

It does not implement `FedosEnvelopeDecryptResult` or any function
producing it — this is a proposed vocabulary only, for a future Arc
building `07_decryption_authority.md`'s own design to adopt or revise.
It does not extend this vocabulary to cover Private Group's own
eventual failure modes (e.g. "sender key revoked") — those depend on
`10_group_key_strategy.md`'s still-undecided scheme and cannot be named
honestly before that decision exists.

## See also

- `docs/reviews/conversation_foundation_v1/10_membership_boundary.md`
- `06_encryption_authority.md`, `07_decryption_authority.md`
