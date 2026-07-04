# Creator Governance (boundary docs — types + pure policy shipped)

**Status: this document describes FOUR shipped boundaries
(`src/creator/appeal.ts`, `src/creator/reputation.ts`,
`src/creator/subscription_policy.ts`, `src/community/treasury_policy.ts`,
Stage 123–126) plus a read-only preview UI
(`src/render/creator_governance_preview.ts`, Stage 126) — not a design
sketch. NONE of the four implements a DAO, a vote, a payment, a
settlement, or a real treasury balance — every one is a pure LABEL
boundary.**

---

## 1. Purpose

Name, as pure boundaries, four governance-adjacent concepts implied by
earlier stages but not previously built: disputing a moderation/trust
outcome (appeal), a non-numeric trust signal (reputation), whether gated
content is visible without checking a real entitlement (subscription
policy), and whether a treasury CATEGORY name is disclosable without
computing a real balance (treasury policy). All four stay strictly within
this codebase's established "types + pure review function, reject
sensitive metadata" shape.

---

## 2. `CreatorAppealDescriptor` / `reviewCreatorAppeal` (`src/creator/appeal.ts`)

An appeal is a labeled DISPUTE RECORD — `CreatorAppealKind`
(`moderation_action_`/`trust_label_`/`subscription_restriction_`/
`test_placeholder`) names WHAT is being disputed, `CreatorAppealStatus`
(`submitted_`/`under_review_`/`resolved_placeholder`/`rejected`) names its
current display status. `reviewCreatorAppeal` rejects (never throws) a
sensitive `reason`/`metadata` — including a governance-specific
`vote`/`dao`/`settlement`/`treasury` family on top of this codebase's usual
conservative markers — otherwise passes the input's own `status` through
unchanged. It never reverses, applies, or enforces any moderation/trust/
subscription outcome; it only reports whether the RECORD itself is
policy-clean.

---

## 3. `ReputationSignalDescriptor` / `reviewReputationSignal` (`src/creator/reputation.ts`)

A reputation SIGNAL is a fixed `CreatorReputationLabel`
(`new_`/`steady_`/`notable_`/`flagged_`/`test_placeholder`) — deliberately
NOT a numeric score, weight, or rank; `reviewReputationSignal` rejects any
metadata containing a `score`/`weight`/`rank` marker (on top of the usual
conservative family), enforcing that this boundary never smuggles in a
computed number. A clean signal is `accepted_placeholder` — a label
review only, never an aggregation of multiple signals into any score.

---

## 4. `SubscriptionPolicyTargetInput` / `reviewSubscriptionPolicyTarget` (`src/creator/subscription_policy.ts`)

Mirrors `src/community/moderation.ts`'s "visibility, never deletion" model,
applied to subscription tiers instead of moderation actions:
`SubscriptionPolicyKind` (`public_`/`supporter_only_`/`premium_only_`/
`test_placeholder`) names WHICH tier gates a target.
`reviewSubscriptionPolicyTarget` is STRUCTURALLY conservative — only
`public_placeholder` can ever resolve to `visible_placeholder`; every gated
kind resolves to `restricted_placeholder` UNCONDITIONALLY, regardless of
any `viewerTierRef` label supplied, because this boundary never checks a
real `EntitlementProvider`. This is the same relationship
`src/creator/membership.ts`'s `MembershipPlanDescriptor` (WHAT tier exists)
already has to payment (`docs/creator_monetization_flow.md`): a policy
LABEL layer, never a checkout or an access grant.

---

## 5. `CommunityTreasuryDisclosureRequest` / `reviewCommunityTreasuryDisclosure` (`src/community/treasury_policy.ts`)

A treasury disclosure request names a `CommunityTreasuryCategoryKind`
(`operating_`/`grants_`/`reserve_`/`test_placeholder`) — a CATEGORY label
only. `reviewCommunityTreasuryDisclosure` rejects any metadata containing a
`balance`/`amount`/`fund`/`settlement`/`vote`/`dao` marker; a clean request
is `allowed_disclosure_placeholder`, meaning the CATEGORY NAME (never an
amount) would be nameable in a future disclosure surface. No ledger, no
balance, and no settlement exists anywhere in this codebase — this function
computes nothing financial.

---

## 6. Read-only preview UI (Stage 126, `src/render/creator_governance_preview.ts`)

One fixed sample record per boundary — `SAMPLE_CREATOR_APPEALS`,
`SAMPLE_REPUTATION_SIGNALS`, `SAMPLE_SUBSCRIPTION_TARGETS`,
`SAMPLE_TREASURY_REQUESTS` — is run through its real (pure) review function
and rendered as a read-only page, gated behind
`?creatorGovernancePreview=1` in `src/worker.ts`. Every label is
HTML-escaped; there is no vote/apply/pay button, no form, and no financial
figure anywhere on the page.

---

## 7. What is explicitly NOT implemented

- No DAO, no voting mechanism, no quorum, no proposal lifecycle.
- No payment, no settlement, no treasury balance, no ledger of any kind —
  this codebase has none, and none of these four boundaries computes one.
- No real moderation reversal, no real entitlement check, no real
  reputation aggregation/scoring algorithm.
- No connection to `StorageBackend`, `PaymentProvider`,
  `EntitlementProvider`, `FederationProvider`, `ChatProvider`, or
  `MarketplaceProvider` from any of the four boundaries or the preview.

---

## 8. Conclusion

- Creator governance, at this stage, is four pure LABEL boundaries: given a
  record/signal/target/request, each reports a policy-clean decision (or
  `rejected`/`restricted_placeholder` for a policy-dirty or gated one) —
  nothing more.
- DAOs, votes, payments, settlements, and treasury balances are not
  concepts any of the four has any vocabulary for, by design.
- A read-only preview UI exists to show the model, not to apply it.
