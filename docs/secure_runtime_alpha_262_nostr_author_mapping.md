# Secure Runtime Alpha 262 — Nostr Author Mapping

**Status: this Stage is a DESIGN DECISION Stage — it adds NO new
production file this Stage; the decision is implemented by
`mapValidatedNostrEventToBoardPostInput` at Alpha 266.** Stage 2 of the
Alpha 261–270 Nostr Canonical Board Adapter Arc.

## 1. Why now

Alpha 261's own field mapping table named `pubkey` → `publicIdentifier`
as a renamed, exact-value field, but left the surrounding policy
(encoding, identity linking, profile data) undecided. This Stage fixes
that policy before Alpha 266 implements it.

## 2. The mapping

```
event.pubkey  ->  FedosBoardAuthorReference.publicIdentifier   (verbatim hex)
"nostr"       ->  FedosBoardAuthorReference.protocol            (fixed constant)
null          ->  FedosBoardAuthorReference.identityId          (fixed, this Arc)
```

## 3. `publicIdentifier` — verbatim hex, no npub re-encoding

`event.pubkey` is copied VERBATIM (the same lowercase-hex string BIP-340
verification already checked, Alpha 244) — it is NOT re-encoded to
`npub1...` bech32 form. Rationale:

- `FedosBoardAuthorReference.publicIdentifier` is documented as "an
  already-public identifier in the author's own protocol namespace"
  (Alpha 254) — it does not mandate any particular Nostr text encoding,
  and hex is the SAME representation `FedosValidatedNostrEvent.pubkey`
  itself already carries.
- Re-encoding would require importing a bech32/npub encoder. This
  repository already has one (`src/identity/`'s NIP-19 encoding path,
  Alpha 173), but it lives in the Identity layer — pulling it into
  `src/board/` would couple a protocol-neutral-by-day model to an
  Identity-layer utility for a purely cosmetic transformation, and this
  Arc's own instruction lists "No Runtime changes" / keeps the adapter a
  pure translation layer (Alpha 268). Deterministic correctness does not
  require it: hex and `npub1...` name the exact same public key.
- A future presentation layer (out of scope here, same as
  `displayName`/`avatar` resolution, Alpha 254 §3) may re-encode
  `publicIdentifier` to `npub1...` for DISPLAY purposes without needing
  the underlying `FedosBoardPost` to change shape.

## 4. `identityId` — always `null` this Arc

No local-identity-linking logic exists anywhere in this repository yet
(`FedosBoardAuthorReference.identityId` was designed in Alpha 254
specifically to allow one to be added later without a schema change).
This Arc's own instruction is explicit: "Do NOT resolve profiles. Do NOT
access relays." Resolving `pubkey` to a local `FedosIdentityRecord.id`
would require exactly that kind of lookup — deferred, not built here.
Every `FedosBoardPost` this adapter produces therefore carries
`author.identityId === null`, unconditionally.

## 5. `protocol` — the fixed constant `"nostr"`

Never read from `event` (nothing on `FedosValidatedNostrEvent` names a
protocol — it is implicitly Nostr by the caller's own choice of adapter).
The adapter itself supplies the literal `"nostr"`, matching
`FedosBoardSourceProtocol`'s closed union (Alpha 253).

## 6. Explicitly excluded — no display name, no profile resolution

Per this Arc's own instruction, verbatim:

- **"Do NOT derive display names."** No kind-0 (metadata) event is read,
  fetched, or referenced anywhere in this adapter. `FedosBoardAuthorReference`
  itself carries no `displayName` field to derive into (Alpha 254 §3
  already excluded it from the Canonical Board Model for exactly this
  reason — no immutable post should snapshot a mutable profile).
- **"Do NOT resolve profiles."** No `FedosIdentityRecord`/
  `FedosIdentityDescriptor` lookup of any kind occurs in this mapping.
- **"Do NOT access relays."** Confirmed structurally (Alpha 268): the
  adapter file contains no Relay/WebSocket/fetch reference of any kind.
- **"Pure deterministic mapping only."** `mapValidatedNostrEventToBoardPostInput`'s
  author-mapping branch is a straight, three-line field copy with no
  branching on external state — the same `pubkey` always produces the
  same `publicIdentifier`, verified by Alpha 267.

## 7. See also

- `docs/secure_runtime_alpha_261_nostr_board_field_inventory.md`
- `docs/secure_runtime_alpha_254_canonical_board_author.md`
- `docs/secure_runtime_alpha_266_nostr_board_adapter_implementation.md`
