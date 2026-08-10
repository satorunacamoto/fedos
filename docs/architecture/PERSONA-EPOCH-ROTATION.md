# Persona Epoch Rotation — Architecture Design

Status: **DESIGN ONLY — no source changed by this document.**
Parent: [COMMERCE-DECENTRALIZED-DATA-PLANE.md](./COMMERCE-DECENTRALIZED-DATA-PLANE.md)
Related: [PSEUDONYMOUS-REPUTATION.md](./PSEUDONYMOUS-REPUTATION.md)

## 1. Grounding: what exists today

- **Double Ratchet is out of scope for this design, on purpose.** `src/os/messenger/conversations/ratchet/` (`fedos_direct_ratchet_conversation_runtime.ts` et al.) is confirmed, by its own file header, to be scoped to "session/message key evolution only" for pairwise Direct conversations delivered over NIP-17. It explicitly exposes no raw session/root/chain keys and performs no automatic session creation. **It has no relationship to reputation and must not be reused as the reputation data model.** This is a direct, explicit instruction from the arc goal (§9) and this design honors it structurally: `PersonaEpoch` keys are a wholly separate keyspace from ratchet session keys, with a different lifecycle (persona-controlled rotation vs. per-message forward secrecy).
- **No generic "epoch identity" type exists anywhere in the codebase today.** `keyEpoch` on the conversation envelope is a plain, non-negative `number` (confirmed explicitly by `fedos_conversation_envelope_id.ts:18-22`'s own comment: "no real epoch-identity type exists anywhere in this codebase"). `PersonaEpoch` is new.
- **The closest real precedent is the Identity Transition arc**, not the ratchet. `docs/reviews/fedos_account_nostr_identity_rotation_v1/20_normative_recommendation.md` established, for account/Nostr identity as a whole:
  - Identity **replaces**, never rotates in place (new Master Seed + new profile).
  - An optional continuity/carry-over claim uses **Model H**: three closed evidence levels — `"unlinked-replacement"`, `"old-identity-signed"`, `"old-identity-and-device-evidence"` — **never a boolean "verified" flag**.
  - A compromised old key alone never proves a carry-over claim legitimate.
  - Identity replacement terminates every active Double Ratchet session; new sessions require fresh authenticated device-pairing.

  This design reuses that exact discipline (closed evidence-level vocabulary, never a bare boolean) for `PersonaEpoch` carry-over, because it is the only place in the codebase that has already made — and had reviewed — the equivalent decision for a harder version of this same problem (whole-identity replacement vs. persona-level epoch rotation).

## 2. `PersonaEpoch`

```ts
interface PersonaEpoch {
  readonly epochId: string;                 // opaque, unique per epoch
  readonly personaKeyPublic: string;         // epoch-scoped signing key, distinct from the account's messaging identity key and from any ratchet session key
  readonly createdAt: string;                // ISO timestamp, coarse (day-resolution acceptable) to limit timing correlation
  readonly supersedesEpochId?: string;       // set only if this epoch carries over from a prior one
  readonly carryOverProof?: CarryOverProof;  // see §3 — absent means a clean, unlinked new persona
}
```

- A `PersonaEpoch` key is **not** the account's Nostr identity key and **not** a ratchet session key. It is a third, purpose-specific keyspace, scoped only to signing `TradeCompletionAttestation`/`ReputationAttestation`/Persona-page claims (see `PSEUDONYMOUS-REPUTATION.md`).
- Rotating to a new epoch is a **user-controlled, explicit action** (mirroring the Identity Transition arc's "no automatic migration, no automatic session creation" discipline for the ratchet) — never automatic, never silent.

## 3. `CarryOverProof` — closed evidence levels, never a boolean

```ts
type CarryOverEvidenceLevel =
  | "none"                       // fresh persona, explicitly unlinked from any prior epoch
  | "self-attested-only"         // new epoch key signs a claim referencing the old epoch id, unverifiable by a third party beyond "the new key says so"
  | "old-epoch-key-signed";      // the OLD epoch's key co-signs the transition, giving a verifiable (but still pseudonymous — see §5) link

interface CarryOverProof {
  readonly evidenceLevel: CarryOverEvidenceLevel;
  readonly priorEpochId: string;
  readonly claims: readonly CarryOverClaim[];   // see §4 — what is actually being carried over
  readonly priorEpochSignature?: string;         // present only when evidenceLevel === "old-epoch-key-signed"
}
```

This intentionally mirrors Model H's three-level structure rather than inventing a fourth or collapsing it to a boolean. **A compromised old epoch key alone never proves a carry-over claim legitimate** — same rule as the Identity Transition arc, ported directly.

## 4. What can be carried over — selective claims, not full history

`CarryOverClaim` is a bounded, closed set of claim *types* — never an arbitrary claim, and never the underlying attestations themselves by default:

```ts
type CarryOverClaim =
  | { readonly type: "verified-trade-count-at-least"; readonly threshold: string /* bucket, e.g. "20+" */ }
  | { readonly type: "reputation-bucket-at-least"; readonly bucket: string }
  | { readonly type: "merchant-since"; readonly rangeCoarse: string /* e.g. "6-12 months" — never an exact date */ };
```

A rotating persona can choose to carry forward, e.g., "verifiedTradeCount >= 20" and "merchant for 6-12 months" **without** re-exposing every individual historical `TradeCompletionAttestation` from the prior epoch. A verifier checking a `CarryOverClaim` needs: the claim itself, the `evidenceLevel`, and (for `"old-epoch-key-signed"`) the prior epoch's public key to check the co-signature — never the full prior-epoch event history.

**Explicit non-claim:** this design does **not** claim zero-knowledge proof capability. `verified-trade-count >= threshold` here is a *disclosed, signed assertion backed by the old epoch key's co-signature*, not a cryptographic range-proof. If the codebase ever adopts real ZK primitives, this claim type could be upgraded to an actual ZK range proof — but that is future work, not implemented or assumed here. Calling this "zero-knowledge" today would be inaccurate and this document deliberately does not do so, per the arc's own explicit instruction.

## 5. Rotation flow

```
Persona Epoch N
   (personaKeyPublic_N, accumulated TradeCompletionAttestations signed by key_N)
        │
        │  user decides to rotate (e.g. wants a fresh pseudonymous start,
        │  or suspects key_N compromise)
        ▼
   optional: build CarryOverProof
     - choose evidenceLevel (none / self-attested-only / old-epoch-key-signed)
     - choose which CarryOverClaims to disclose (§4)
     - if evidenceLevel = old-epoch-key-signed: sign the transition with key_N
        │
        ▼
Persona Epoch N+1
   (personaKeyPublic_N+1, supersedesEpochId = epochId_N, carryOverProof = above)
```

## 6. Decay / expiry

- `CarryOverClaim`s and `ReputationAttestation`s SHOULD carry an implicit or explicit validity window tied to their `epoch` — an old epoch's aggregate does not remain indefinitely authoritative as-is; a viewer comparing personas should weight recency.
- Exact decay function (linear, step-bucket, hard-expiry) is left as a follow-up implementation decision — this document establishes only that decay/expiry is a first-class part of the model (attestations are epoch-scoped, not eternal), not an afterthought.

## 7. Linkability summary (what this design does and does not prevent)

| Scenario | Linkable? |
|---|---|
| Two attestations signed by the *same* epoch key | Yes — trivially, by signature reuse. This is intentional; it is what makes the aggregate verifiable within one epoch. |
| Two epochs with `evidenceLevel: "old-epoch-key-signed"` | Linkable by anyone who sees both epochs' public records (the co-signature is verifiable by design — this is a disclosed link, not a leak). |
| Two epochs with `evidenceLevel: "none"` or `"self-attested-only"` | Not cryptographically linkable by a third party without the persona's own disclosure. `"self-attested-only"` gives no stronger link than the new persona's own unverifiable claim. |
| A user who never rotates | Full history under one key remains permanently linkable — rotation is opt-in, not automatic, so choosing not to rotate is a user choice with the expected consequence. |

## 8. Non-goals of this design

- No key-derivation scheme for `personaKeyPublic` is specified (reuse an existing repo HKDF/keypair-derivation primitive in implementation — not decided here).
- No revocation registry for a compromised epoch key (flagged as an open threat-model item, see tabletop scenario "old Persona key compromised").
- No ZK implementation, as stated in §4.
