# Pseudonymous Trade Reputation — Architecture Design

Status: **DESIGN ONLY — no source changed by this document.**
Parent: [COMMERCE-DECENTRALIZED-DATA-PLANE.md](./COMMERCE-DECENTRALIZED-DATA-PLANE.md)
Related: [PERSONA-EPOCH-ROTATION.md](./PERSONA-EPOCH-ROTATION.md), [COMMERCE-PRIVACY-DATA-CLASSIFICATION.md](./COMMERCE-PRIVACY-DATA-CLASSIFICATION.md)

## 1. Grounding: what exists today

- `src/os/commerce/creator/reputation.ts` (154 lines) is the **only** reputation code in the repo, and it is explicitly inert scaffolding: "NO aggregation, NO scoring algorithm, and NO real trust computation" (its own header). It defines `CreatorReputationLabel` — five fixed string labels, never a number — and `reviewReputationSignal()`, a pure policy check that **rejects** any signal whose `reason`/`metadata` contains `score`/`weight`/`rank` substrings.
- `TradeCompletion`, `Persona`, and any "Merchant Passport" artifact: **zero matches anywhere in the repo.** This is fully greenfield design, not a fix to an existing broken feature.
- The only existing signed/verifiable-credential-shaped primitives in the codebase are in `src/os/trust/`: `CapabilityGrant` (narrow, deliberately not a full authorization system) and the subscription-entitlement type (`FedosSubscriptionEntitlement`, scopes include `"signed-qr"`/`"contract-proof"`). Neither is wired to Commerce today (boundary-enforced).
- Live, implemented Nostr NIPs: 01 (base), 17 (private DMs), 44 (encryption payload), 59 (gift wrap), 20 (relay OK). NIP-99 (classified listings) and NIP-72 (communities) are mentioned only as *future* ideas / dead prototype code — not implemented.

**Design consequence:** because `reviewReputationSignal()` already institutionally rejects numeric scores, this design commits to the same philosophy rather than introducing a competing numeric-reputation concept. A future implementation phase should treat `reputation.ts`'s existing label vocabulary as the seed for the public-facing bucket vocabulary in §3, not discard it.

## 2. Model: signed attestations, not published history

**Never publish raw transaction history by default.** The reputation model is built entirely from small, individually-signed **attestations** — never a queryable ledger of a persona's trades.

```
Trade completes (off-chain, off-relay — order/payment details never touch Nostr)
   │
   ▼
Both counterparties may independently sign a TradeCompletionAttestation
   (a compact claim: "a trade with {counterparty commitment} completed in
   {epoch}", NOT the product, price, or delivery details)
   │
   ▼
Attestations are optionally published as small Nostr events (metadata-only,
size-bounded, no order/payment payload)
   │
   ▼
A ReputationAttestation aggregates a bounded window of TradeCompletionAttestations
into a coarse public claim (bucket, verified-trade count, category, epoch) —
aggregation happens locally on the persona's own device, not by any server
```

### Candidate event shapes (design-level, not final wire format)

```ts
interface TradeCompletionAttestationV1 {
  readonly kind: "trade-completion-attestation";
  readonly personaEpochId: string;          // see PERSONA-EPOCH-ROTATION.md
  readonly counterpartyCommitment: string;  // hash commitment, never the counterparty's raw pubkey
  readonly tradeCategoryCoarse: string;     // coarse category only, e.g. "digital-goods" — never product id
  readonly epoch: string;
  readonly signature: string;               // signed by the persona's current epoch key
}

interface ReputationAttestationV1 {
  readonly kind: "reputation-attestation";
  readonly personaEpochId: string;
  readonly verifiedTradeCountBucket: string; // bucketed, e.g. "1-4" | "5-19" | "20+", never an exact ledger-derived count if that count is itself sensitive
  readonly reputationBucket: CreatorReputationLabelLike; // reuse reputation.ts's label vocabulary
  readonly epoch: string;
  readonly signature: string;
}
```

**Never published in either event:** product id, price, buyer identity, payment method/status, delivery address, dispute content. See `COMMERCE-PRIVACY-DATA-CLASSIFICATION.md` for the exhaustive field table.

## 3. Public view (aggregate only)

The only data a stranger browsing a Persona page can see (see also `SEMI-PUBLIC BOARD` below):

- Persona (pseudonymous identifier, epoch-scoped — see rotation doc)
- Reputation aggregate — a coarse bucket/label, reusing `reputation.ts`'s label philosophy, never a raw number
- Verified-trade count — **bucketed**, not exact, to resist precise-history correlation (an exact count across epochs would itself be a linkability signal)
- Coarse category (e.g. "digital goods seller") — never the specific product catalog
- Epoch identifier (so a viewer knows how much history the aggregate actually covers)

## 4. Evidence is cryptographically verifiable, not just claimed

Every aggregate figure a Persona page displays must be **traceable to a bounded set of individually-signed attestations** that a verifier (or, in a dispute, an authorized party) can check — the aggregate is not a bare assertion. This does *not* mean the underlying attestations are public by default: they may be held privately by the persona and disclosed selectively (§8 in the parent arc goal / `PERSONA-EPOCH-ROTATION.md` §"CarryOverProof"), or published in minimal form as small Nostr events. Either way:

- A verifier who is shown attestations can check each one's signature independently.
- A verifier can check that the epoch key that signed them matches the epoch identifier claimed on the Persona page.
- A verifier **cannot** — by design — reconstruct the underlying trade's product, price, or counterparty identity from the attestation alone.

## 5. Sybil / spam resistance (design-level notes, not a solved problem)

- A `TradeCompletionAttestation` requires both counterparties' independent signatures (or at minimum, cryptographic evidence that a second party engaged) — a single self-signed claim of "I completed a trade" must not be sufficient to move the reputation aggregate. Exact bilateral-attestation mechanics are a follow-up design decision, not resolved here.
- Rating/attestation spam and Sybil-persona flooding are explicitly modeled as unsolved/partially-mitigated in the threat tabletop (`SERVERLESS-COMMERCE-THREAT-MODEL.md`) — this document does not claim a spam-proof design, only an architecture that keeps raw transaction data off the public plane regardless of spam volume.

## 6. Semi-public Persona page — three disclosure layers

A Persona page is not a single flat public record. It has three layers, each gated differently:

```
┌───────────────────────────────────────────────────────────────────┐
│ LAYER 1 — PUBLIC (anyone, no auth)                                  │
│   reputation aggregate, verified-trade-count bucket, coarse         │
│   category, epoch id                                                │
├───────────────────────────────────────────────────────────────────┤
│ LAYER 2 — PSEUDONYMOUS PROOF (anyone who asks; still no real-world  │
│   identity disclosed)                                               │
│   the underlying signed TradeCompletionAttestations / epoch         │
│   CarryOverProof that back the Layer-1 aggregate — lets a verifier  │
│   check the math, without granting access to Layer 3                │
├───────────────────────────────────────────────────────────────────┤
│ LAYER 3 — AUTHORIZED (capability-gated)                             │
│   encrypted transaction/dispute evidence — e.g. a specific order's  │
│   dispute record — disclosed only to a party holding a              │
│   CapabilityGrant scoped to that specific evidence                  │
└───────────────────────────────────────────────────────────────────┘
```

- **Layer 1** is what renders on the Persona page by default for any visitor — see §3.
- **Layer 2** is opt-in disclosure by the persona (e.g. "show your work" for a skeptical buyer) — reuses the attestation objects from §2/§4, never raw order data.
- **Layer 3** reuses the existing `CapabilityGrant` primitive (`src/os/trust/capabilities/fedos_trust_capability_grant_types.ts`) as the access-gating mechanism: a grant scoped narrowly to one dispute/evidence resource, issued by whichever party controls it (buyer, merchant, or a future arbitration role — not decided here), never a blanket "see all my history" grant. This is consistent with `CapabilityGrant`'s own documented design intent (deliberately narrow, no role hierarchy, no broad authorization system) and with the Trust↔Commerce boundary (constraint 2 in the parent doc: Trust never imports Commerce — the composition root wires a `CapabilityGrant` check into Commerce-side evidence access from the outside, Trust itself stays unaware Commerce exists).
- Layer 3 evidence itself is `ENCRYPTED NOSTR` or `LOCAL ONLY` per `COMMERCE-PRIVACY-DATA-CLASSIFICATION.md` — never public-plane, regardless of grant status; the grant controls *who can decrypt*, not where the ciphertext lives.

## 7. Non-goals of this design

- No storage/aggregation implementation.
- No Nostr event `kind` number is allocated (signing authority's allow-list still only permits kinds 1/private-delivery/13 today — extending it is a tracked follow-up).
- No dispute-resolution protocol (disputes are covered only at the classification level in `COMMERCE-PRIVACY-DATA-CLASSIFICATION.md` and the tabletop).
