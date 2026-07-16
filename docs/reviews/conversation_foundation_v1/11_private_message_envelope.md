# Review 11 — Private Message Envelope Boundary

Not implemented. This document specifies a candidate shape at the level
of field *names and roles* only, because that much is known from the
already-converged recommendation of both prior reviews (AAR §09 Option
B + D backing; SEC §02 Option B + D backing, with a concrete
illustrative shape). No byte layout, no algorithm identifier value, no
key material, and no plaintext appear anywhere below.

## Separated fields

```ts
interface FedosConversationMessageEnvelopeV1 {
  // --- public routing metadata: must remain visible even under encryption ---
  readonly conversationId: FedosConversationId;      // from 03
  readonly senderRef: FedosConversationParticipantRef; // out of V1; placeholder type reference only
  readonly createdAt: number;

  // --- ciphertext reference: points at, does not embed, the private store ---
  readonly ciphertextRef: FedosPrivateCiphertextRef;  // BLOCKED — see below

  // --- algorithm/version ---
  readonly envelopeVersion: FedosConversationEnvelopeVersion; // BLOCKED — see below

  // --- key epoch ---
  readonly keyEpoch: FedosConversationKeyEpoch;        // SEC §03's type; BLOCKED — see below

  // --- protocol provenance, reusing the existing pattern ---
  readonly source: FedosBoardSourceReference;          // real, existing type — no change needed
}
```

**Why routing metadata stays separate and unencrypted-by-necessity:**
SEC §07's own finding applies directly here — encrypting a `body`-like
field alone does not hide `conversationId`/`senderRef`/`createdAt`
unless those are *also* specifically addressed, and this spec makes no
claim that they will be hidden. Listing them as plain (non-ciphertext)
fields on the envelope is the honest reflection of that finding, not an
oversight: a future Arc that wants routing-metadata confidentiality has
to solve that as its own, separate, harder problem (onion-routing-
adjacent, out of scope here), not assume the envelope shape above
grants it for free.

**Why `source` needs no new type:** `FedosBoardSourceReference`
(`{protocol, reference}`, `fedos_board_source.ts`) already expresses
"which protocol this content arrived via" for public posts; a private
message's protocol provenance is the same kind of fact and reuses the
same type rather than inventing a parallel one.

## Fields blocked by official protocol/crypto review

- **`ciphertextRef`** — blocked on `08`'s private storage backend not
  existing yet (SEC §07's dedicated-backend recommendation, not yet
  designed in detail) and on the encryption authority export (`07`).
  Its concrete shape (an opaque handle vs. a storage-key string) cannot
  be decided before the backend it references exists.
- **`envelopeVersion`** — blocked on choosing a concrete encryption
  scheme. SEC §05 is explicit that this must not be hand-invented; the
  real Rust-side primitive is NIP-44-*compatible* (vector-verified
  against `test-vectors/nip44/nip44-v2.json`) but is not yet exported,
  and group-mode key distribution has no chosen scheme at all (Sender
  Key/MLS are named as the standards-track direction, not yet adopted).
  A version tag cannot be minted responsibly before at least one real
  scheme is wired end-to-end.
- **`keyEpoch`** — the type (`FedosConversationKeyEpoch`, a branded
  `number`) is a safe placeholder to name, but its semantics (when it
  increments, who is authorized to rotate it, what a removed member
  retains access to under it) are governed entirely by
  `10_membership_boundary.md`'s and SEC §06's still-undecided epoch
  rules. Naming the type here does not resolve those rules.
- **`senderRef`** — depends on `10`'s `FedosConversationParticipantRef`
  choice, out of V1.

## What this document does not do

It does not choose an AEAD mode, a nonce scheme, a KDF salt, a wire
encoding, or a compiled artifact target. It does not claim the shape
above is final — only that these seven fields are the right
*categories* to keep separate, based on what both prior reviews already
converged on. Any concrete byte-level design remains a separate,
dedicated crypto/protocol Arc's responsibility.
