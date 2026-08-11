# Reputation / Persona Epoch / Trust-QR Integration — Design (Agent R)

**STATUS UPDATE (FedOS Commerce FINAL Closure Mega-Arc, Agent R):** the five
files below are still exactly what they were — the DESIGN layer (payload
shapes, validity/allowlist checks, the `disclosure_layers.ts` projection
function) — and remain accurate as written. What was "DESIGN + TYPE-ONLY
SCAFFOLDING" at the bottom of this document is now backed by REAL runtime
code in the same directory: `persona_epoch_signing_keypair.ts` (real
signing keys), `trade_ref_digest.ts` (real salted digests),
`attestation_canonical_bytes.ts` + `attestation_sign_verify.ts` (real
canonical-bytes + Schnorr sign/verify, including tamper/wrong-signer
detection), `persona_epoch_registry.ts` (real epoch creation, rollover, and
signed carry-over), `trade_completion_attestation_store.ts` (real
duplicate/trade-reuse rejection), `reputation_issuance.ts` (the real gate:
an attestation can only be minted for an `Order` that a real
`OrderRepository` reports as `"completed"`, reached only through
`order_state_machine.ts`'s own guarded transitions — never a bare claim),
`persona_board_query.ts` + `ui/persona_board_controller.ts` (a real,
renderer-safe read-only Persona Board query/controller). Still **NOT**
wired into `createCommerce()`, `loadRootModules()`, or any shipping
Electron UI — that remains the coordinator's central-integration job (see
each new file's own header for its specific TODO). Sybil resistance is
still explicitly NOT claimed anywhere (an attestation proves "a configured
counterparty signed this," never "this is a unique real trading partner");
epoch carry-over is still explicitly LINKABLE, never claimed unlinkable.
See `test/commerce_reputation_signing.test.ts` and
`test/commerce_reputation_issuance.test.ts` for the real, passing test
evidence (tamper/wrong-signer/duplicate/self-rating/expired-epoch/rollover/
Sybil-documentation cases).

**Original status at design time: DESIGN + TYPE-ONLY SCAFFOLDING. Nothing described here is wired into `createCommerce()`, `loadRootModules()`, or any shipping UI.** Every claim below about "what exists today" was verified by direct code inspection at this design's own base commit, `13a8852b` ("Merge Commerce Reachable Catalog Phase 1 (+ E2E audit) into Commerce E2E Completion arc base"), on `arc/fedos-commerce-e2e-completion-agent-r`. See [FEDOS-COMMERCE-END-TO-END.md](FEDOS-COMMERCE-END-TO-END.md) and [COMMERCE-GAP-CLASSIFICATION.md](COMMERCE-GAP-CLASSIFICATION.md) for the audit this design responds to (Gap #8 "Commerce↔Trust zero wiring" and Gap #13 "QR unused in commerce").

## What this design produces

Five new files under `src/os/commerce/reputation/` (a new directory — nothing existing under `src/os/commerce/` was modified):

| File | Lines | Purpose |
|---|---|---|
| `persona_epoch.ts` | 188 | `PersonaEpoch` type + validity-check logic (§1 below) |
| `attestation_types.ts` | 360 | `TradeCompletionAttestationPayload` / `ReputationAttestationPayload` schemas (§2) |
| `trust_issuance_port.ts` | 235 | `CommerceTrustIssuancePort` design + `NoopCommerceTrustIssuancePort` (§3) |
| `carry_over.ts` | 223 | `EpochCarryOverStatementPayload` design, bounded/linkable only (§4) |
| `disclosure_layers.ts` | 221 | Persona Board disclosure-layer types + projection function (§5) |

Plus two new test files (`test/commerce_reputation_persona_epoch.test.ts`, 286 lines / 36 tests; `test/commerce_reputation_disclosure_layers.test.ts`, 134 lines / 12 tests — 48 tests total, all passing) and this document.

## 1. PersonaEpoch — a reputation identity distinct from messaging identity

`persona_epoch.ts` defines:

```ts
interface PersonaEpoch {
  readonly epochId: string;
  readonly epochKeyPublicHex: string;
  readonly validFrom: number;
  readonly validUntil: number;
  readonly predecessorEpochId?: string;
}
```

### Why `epochKeyPublicHex` must not be the messaging identity key or Double Ratchet material

Three independent reasons, all grounded in this repo's own prior work:

1. **Linkability.** The Nostr identity keypair a Messenger Account uses is the same key visible on every conversation that account has (`docs/architecture/ACTOR-MAP.md` §1: "KEY MATERIAL OWNED: Nostr identity keypair"). Reusing it as a reputation-attestation key would let anyone who ever correlates one signed trade attestation with one Nostr event immediately deanonymize the account's entire messaging history — the opposite of the "pseudonymous" property `src/os/trust/credentials/fedos_trust_pseudonymous_credential_types.ts` is built around.
2. **Lifecycle mismatch with Double Ratchet.** This repo's own prior review record establishes that Double Ratchet exists to provide per-conversation forward secrecy for private messaging and must never be reused for reputation/persona aging — a persona epoch is designed to be *reused across many trades for a bounded period*, which is structurally the opposite of a ratchet chain's continuous-rotation design.
3. **Precedent already exists in this repo for exactly this kind of independent key**, twice:
   - `src/os/messenger/device/crypto/fedos_device_signing_keypair.ts` — `FedosDeviceSigningKeypair.generate()`. Its own header records an explicit option comparison: *"Option A: independent random Device key via reviewed CSPRNG — ADOPTED... Option B: deterministic Device key derived from the Master Seed — REJECTED... a Master-Seed-derived 'device' key is not independent (compromise or export of one derives the other)."*
   - `src/os/trust/envelope/fedos_trust_signing_keypair.ts` — `FedosTrustSigningKeypair.generate()`, the exact same `@noble/curves` `schnorr.utils.randomSecretKey()` call shape, deliberately duplicated rather than imported from the Messenger file above because `os/trust` must not depend on `os/messenger` (architecture boundary; see that file's own header).

A future `PersonaEpochSigningKeypair.generate()` should follow the identical shape: fresh, independent, CSPRNG-random secp256k1 keypair, never derived from the Master Seed / Nostr identity key / Double Ratchet chain, opaque handle with no raw-secret getter. **This design does not implement that generator** — it only reserves the `epochKeyPublicHex` hex-string slot its public key would fill, and documents the precedent. Where that generator should live (a new `src/os/commerce/reputation/adapters/` file? a new shared key-material module outside both `os/commerce` and `os/trust`?) is an open question for whichever wave implements it — this design deliberately does not force that decision, since it depends on the same cross-boundary question `trust_issuance_port.ts` (§3) addresses.

### Real logic in this file (not just types)

- `isWellFormedPersonaEpoch(value)` — structural validator, fails closed.
- `isPersonaEpochCurrentlyValid(epoch, atTimeUnixSeconds, clockSkewToleranceSeconds?)` — the actual validity-window check, with a default 120-second clock-skew tolerance matching `FEDOS_TRUST_CLOCK_SKEW_TOLERANCE_SECONDS` in `src/os/trust/fedos_trust_limits.ts` (restated locally, not imported — see §6's cross-import discussion). Tested at both tolerance edges and with a caller-supplied `0` tolerance.

## 2. TradeCompletionAttestation / ReputationAttestation

`attestation_types.ts` defines two payload shapes, both designed to be carried inside `ReputationLocalSignedEnvelopeShape<TPayload>` — a **local, independent mirror** of `src/os/trust/envelope/fedos_trust_envelope_types.ts`'s `FedosTrustSignedEnvelope<TPayload>` (same field set: `version`, `type`, `issuer`, `subject`, `audience`, `issuedAt`, `expiresAt`, `nonce`, `payload`, `signatureAlgorithm`, `keyId`, `signature`).

- **`TradeCompletionAttestationPayload`** — one counterparty's signed statement that one trade completed: `attestorEpochKeyPublicHex`, `subjectEpochId`, `tradeRefDigestHex`, `category` (`"digital_good" | "physical_good" | "service" | "other"`), `outcome` (`"completed_as_agreed" | "completed_with_dispute" | "not_completed"`), `completedAt`, `formatVersion`.
- **`ReputationAttestationPayload`** — a derived, aggregated summary: `subjectEpochId`, `subjectEpochKeyPublicHex`, `verifiedTradeCount`, `attestationRefs` (opaque ids only), `asOf`, `formatVersion`.

### What is deliberately excluded, and why

Neither payload has, or may ever gain, a field for: the real Commerce order id (`../catalog/types.ts`'s `PurchaseGrant`/`Product.id`), the exact price/amount, the counterparty's real-world identity, exact payment metadata (rail/transaction id/invoice reference), or **any free-text comment/note field**. The comment exclusion is not a guess — it is grounded in this repo's own prior finding (Merchant Passport tracks L/M/N review) that a free-text `comment` field is the one practically unbounded, hard-to-canonicalize, privacy-risky field in an otherwise bounded signed-record design. Neither payload here defines one, ever, and `isWellFormedTradeCompletionAttestationPayload`/`isWellFormedReputationAttestationPayload` **reject any object carrying a key outside a fixed allowlist** — verified by tests that construct a payload with an injected `rawOrderId`, `comment`, or `exactPriceCents` field and assert rejection.

`tradeRefDigestHex` is the one place a trade is referenced at all — a **one-way digest** the completing parties compute locally (never the raw order id). The design explicitly requires salting the pre-image (order id + a per-trade random value) before hashing; an unsalted digest of a small order-id space is brute-forceable. The doc comment points at this repo's own existing SHA-256 content-hash convention (`docs/commerce/FEDOS-COMMERCE-END-TO-END.md` §10's `ProductMedia.checksum` recommendation, itself pointing at `computeFedosConversationArchiveContentHash()`) as the primitive to reuse rather than inventing a new hash scheme — but does not itself implement the digest function.

### Stricter-than-precedent key validation

This repo has a documented gap (Merchant Passport tracks S/T/U/V review) that Trust's own envelope verifier silently tolerates unknown envelope keys. Both `isWellFormed*` functions in `attestation_types.ts` deliberately do the opposite — reject any unrecognized key outright — specifically to prevent an accidentally-added sensitive field (e.g. a debug field carrying a real order id) from silently passing through to a verifier or UI. This is called out explicitly in the file's own header as a conscious divergence from that known gap, not an oversight.

## 3. Commerce→Trust Port (Gap #8)

`trust_issuance_port.ts` defines `CommerceTrustIssuancePort` (`requestTradeCompletionIssuance(request): Promise<result>`) with fully local placeholder types mirroring `FedosSubscriptionEntitlement` and the QR text output shape — and ships one real implementation, `NoopCommerceTrustIssuancePort`, which never issues anything (mirrors the existing `NoopEntitlementProvider`/`NoopMarketplaceProvider` pattern already used elsewhere in `src/os/commerce/`).

### The precise cross-import finding (read this before wiring)

Both required-reading tests were read in full for this design. The result narrows the coordinator's framing ("zero cross-imports... enforced by `test/architecture_boundary_trust.test.ts`") to what the code actually checks:

- **`test/architecture_boundary_trust.test.ts`** (`FORBIDDEN_RELATIVE_PREFIXES`, lines 28–36, includes `"src/os/commerce/"`) blocks exactly ONE direction: a relative import **inside `src/os/trust`** resolving into `src/os/commerce`. That direction is never needed for this Port (Trust must stay commerce-agnostic) and **this design does not ask the coordinator to modify this test.**
- **`test/architecture_boundary_commerce.test.ts`** (`FORBIDDEN_PREFIXES`, lines 40–47) lists `conversation/board/desktop/device/nostr/messenger` — **it does not mention `src/os/trust` at all.** So the direction this Port actually needs (a future Commerce-side adapter importing `src/os/trust/entitlement/index.ts` and `src/os/trust/qr/index.ts`) is, on direct reading, **not currently forbidden by either automated boundary test.**

**Recommended coordinator action** (not because a test currently fails without it, but because leaving this undocumented means any future file anywhere under `src/os/commerce/` could import `src/os/trust` with nothing ever flagging it):

1. In `test/architecture_boundary_commerce.test.ts`, add a reserved adapter directory constant mirroring the file's own existing `NOSTR_ADAPTER_DIR` exception pattern (lines 51–64 of that file):
   ```ts
   const TRUST_ADAPTER_DIR = "src/os/commerce/reputation/adapters/trust/";
   ```
   and extend the violation check so an import resolving into `src/os/trust/` is allowed **only** from a file under that one directory — the same `isNostrAdapterFile`/`isNostrTarget` gating shape already used for the existing Nostr exception.
2. Create exactly one new adapter file there (e.g. `src/os/commerce/reputation/adapters/trust/commerce_trust_issuance_adapter.ts` — **not created by this wave**) implementing `CommerceTrustIssuancePort` for real, and importing:
   - `src/os/trust/entitlement/index.ts` → `issueFedosSubscriptionEntitlement`, `verifyFedosSubscriptionEntitlement`, `FedosSubscriptionEntitlement` — **justification:** this is the exact primitive `FEDOS-COMMERCE-END-TO-END.md` §6 names as "AVAILABLE WITH EXISTING PRIMITIVES" for a purchase receipt, and its `scopes` field already includes `"signed-qr"`/`"contract-proof"`.
   - `src/os/trust/qr/index.ts` → `encodeFedosTrustEnvelopeToQrText` — **justification:** turns the issued entitlement into the QR payload `CommerceTrustIssuanceResult.qrText` reserves a slot for; closes Gap #13.
3. `test/architecture_boundary_trust.test.ts` needs **no change** under this plan.

## 4. Reputation carry-over (§25) — bounded/linkable design only

`carry_over.ts` implements the "old epoch signs → new epoch, plus an optional coarse threshold claim" minimal design the arc brief names as acceptable, and **explicitly does not attempt anything stronger.**

### Why a privacy-preserving (unlinkable) carry-over is marked NOT SAFELY IMPLEMENTABLE this arc

A carry-over that lets a verifier confirm "this new epoch legitimately continues *some* prior epoch's standing" **without learning which one** requires a selective-disclosure or blind-signature primitive (e.g. a ZK proof of set membership, or a blind signature scheme). Direct inspection of every file under `src/os/trust/` for this design (the required reading) confirms the only cryptography anywhere in that capability is Schnorr/secp256k1 signing and SHA-256 hashing via `@noble/curves`/`@noble/hashes` — no ZK, no blind-signature library exists anywhere in this repository. Building one from scratch would violate this wave's own instruction not to invent new cryptographic schemes. **This design states plainly: unlinkable carry-over is not designed here and should not be claimed as a future "easy addition" without first adding a new cryptographic dependency and a full separate design/security review.**

### What is designed: `EpochCarryOverStatementPayload`

```ts
interface EpochCarryOverStatementPayload {
  predecessorEpochId: string;
  predecessorEpochKeyPublicHex: string;
  successorEpochId: string;
  successorEpochKeyPublicHex: string;
  thresholdClaim?: { verifiedTradeCountAtLeast: number };  // lower bound only, never exact
  issuedAt: number;
  formatVersion: 1;
}
```

Signed (conceptually) by the **predecessor** epoch's key only — no successor counter-signature is required by this minimal design (a hardened future version requiring successor proof-of-possession, reusing `src/os/trust/possession/`'s challenge/response *shape* conceptually, is flagged as a recommended future hardening, not built here).

### The privacy warning (must ship with any future UI)

```
EPOCH_CARRY_OVER_LINKABILITY_WARNING =
  "Carrying reputation over to a new persona epoch cryptographically links
  the new epoch to the old one for anyone who sees this statement. This is
  not hidden or anonymized in any way — a fresh epoch with no carry-over is
  the only way to fully separate your new persona from your old one."
```

This mirrors this repo's own precedent for a canonical, verbatim-surfaced statement — `FEDOS_OFFICIAL_ENTITLEMENT_MEANING_STATEMENT` in `src/os/trust/policy/fedos_trust_official_issuer_profile.ts`, which `src/os/trust/README.md` documents as something to "surface it verbatim in any UI/CLI output rather than paraphrasing." The same discipline applies here: any future UI offering carry-over must show this warning (or a faithful translation) before a user opts in, never bury or paraphrase it. A carry-over is a **deliberate, opt-in linkability trade a persona makes for continuity** — never a default or silent behavior. The only real unlinkability this design can offer is by omission: a persona that wants a clean break simply never produces a carry-over statement.

## 5. Semi-public Persona Board disclosure layers (§26)

`disclosure_layers.ts` defines three layers — **PUBLIC**, **PSEUDONYMOUS_PROOF**, **AUTHORIZED** — and a real projection function, `projectPersonaRecordToDisclosureLayer(record, layer)`, that enforces exactly what each layer may see.

| Layer | Fields exposed |
|---|---|
| PUBLIC | `epochId`, `verifiedTradeCountBucket` (coarse, e.g. `"20-49"`), `primaryCategory?` (single coarse label), `attestationRefs` (opaque ids) |
| PSEUDONYMOUS_PROOF | **Identical field set to PUBLIC** — see rationale below |
| AUTHORIZED | `epochId`, `epochKeyPublicHex`, exact `verifiedTradeCount`, full `categoryBreakdown`, `attestationRefs`, `asOf` |

### Why PSEUDONYMOUS_PROOF is not wider than PUBLIC in this design

The arc brief's own allowlist — *"Public/semi-public reputation representation may expose ONLY: persona identifier/epoch, aggregate/bucket, verified trade count, coarse category, attestation references"* — is stated once, covering both terms together. This design reads that as one allowlist applying uniformly to both PUBLIC and PSEUDONYMOUS_PROOF, rather than inventing an unspecified intermediate field set. A future iteration may decide PSEUDONYMOUS_PROOF should unlock something PUBLIC doesn't (e.g. a finer bucket); this design does not guess at that.

### The hard exclusion list applies to AUTHORIZED too

Real identity, a full order record, exact payment metadata, and another party's private counterparty history are never exposed at **any** layer — not even AUTHORIZED. This is enforced structurally, not just at display time: `PersonaBoardInternalRecord`, the hypothetical backing record this file assumes, has no field for any of those categories in the first place (verified by grep across this directory), consistent with the fact that no real-world PII is collected anywhere upstream either (`src/os/trust/credentials/`'s pseudonymous-only credential design; `../creator/entitlement.ts`'s "never a payment/receipt reference"). AUTHORIZED in this design means "exact figures instead of coarse buckets," never "an additional data category."

`bucketVerifiedTradeCount(count)` — the real bucketing function — is tested at every boundary (`0`, `1-4`, `5-19`, `20-49`, `50+`) and fails closed to the widest bucket on malformed input (negative, non-integer, `NaN`, wrong type), matching this repo's "a display helper must never crash a render path" convention seen throughout `os/trust`'s own `isWellFormed*` functions.

## 6. Sybil resistance and zero-knowledge — explicit non-claims

Stated once here, and repeated in the source headers of `attestation_types.ts` and `carry_over.ts` so it cannot be missed by a future reader of just one file:

- **No Sybil resistance.** Generating a `PersonaEpoch` keypair is a free, local, unauthenticated CSPRNG call (by design — see `persona_epoch.ts`'s header on why it must be independent and locally generated). Any actor can generate unlimited counterparties to attest trades with itself. A `TradeCompletionAttestationPayload`'s valid signature proves "a configured counterparty signed this," never "this is a unique real human" or "this represents a unique real trading partner." Any future UI surfacing a trade-completion count MUST NOT imply otherwise.
- **No zero-knowledge properties.** No ZK primitive (range proof, membership proof, hiding+binding commitment, blind signature) exists anywhere in this repository today — confirmed by inspecting every file under `src/os/trust/` for this design. The only cryptography available is Schnorr/secp256k1 signing and SHA-256 hashing. Every "coarse" or "bucketed" view in this design (§5) is plain information reduction, not a cryptographic privacy guarantee — the aggregator that computed a `ReputationAttestationPayload` always saw every underlying trade, and an AUTHORIZED-layer viewer always sees the exact number.

## 7. Cross-import inventory for the coordinator

| From (future file) | To (existing file) | Justification |
|---|---|---|
| `src/os/commerce/reputation/adapters/trust/commerce_trust_issuance_adapter.ts` (not yet created) | `src/os/trust/entitlement/index.ts` | Issue/verify a `FedosSubscriptionEntitlement` as the purchase-receipt entitlement (`FEDOS-COMMERCE-END-TO-END.md` §6's named reuse target) |
| same | `src/os/trust/qr/index.ts` | Encode the issued entitlement to QR text (`encodeFedosTrustEnvelopeToQrText`), closing Gap #13 |
| `test/architecture_boundary_commerce.test.ts` (existing file, coordinator edits) | — | Add a `TRUST_ADAPTER_DIR` allowlist exception, narrowly scoped to the one adapter file above, mirroring the file's own existing `NOSTR_ADAPTER_DIR` pattern |

**No change to `test/architecture_boundary_trust.test.ts` is required** — see §3's precise finding.

## 8. Test evidence

```
npx vitest run test/commerce_reputation_persona_epoch.test.ts test/commerce_reputation_disclosure_layers.test.ts test/architecture_boundary_trust.test.ts test/architecture_boundary_commerce.test.ts
```

```
✓ test/commerce_reputation_disclosure_layers.test.ts (12 tests)
✓ test/architecture_boundary_commerce.test.ts (2 tests)
✓ test/commerce_reputation_persona_epoch.test.ts (36 tests)
✓ test/architecture_boundary_trust.test.ts (2 tests)

Test Files  4 passed (4)
     Tests  52 passed (52)
```

`npm run typecheck:core` (root `tsc --noEmit`): zero errors attributable to any file in this design (confirmed by diffing full output before/after — two real errors this design introduced, both `noUncheckedIndexedAccess` array-index issues in `disclosure_layers.ts`, were found and fixed in the same pass). The remaining ~841 `TS2578: Unused '@ts-expect-error' directive` errors across unrelated `test/secure_runtime_alpha_*` files are pre-existing environmental noise (this repo's own documented `@types/node`-install-flips-`@ts-expect-error` artifact class), not touched or caused by this design — none of the flagged files were created or modified by this design.
