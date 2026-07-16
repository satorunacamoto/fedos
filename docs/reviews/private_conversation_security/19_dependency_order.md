# 19 — Safe Implementation Dependency Order

This review authorizes none of the following — named, scoped, and
sequenced for whichever future session picks up implementation,
consistent with this review's own no-src-change mandate.

## Candidates

1. **Conversation Identity/Policy** — `FedosConversationId` and
   sibling id types (§03), the private-mode extension of
   `FedosConversationMode`'s own access-policy fields (prior review's
   own §04/§05, unchanged), never reusing `FedosBoardId`/`FedosThreadId`.
2. **Private Message Envelope** — `FedosConversationMessage` (§02
   Option B), no encryption wired yet — a structurally-typed but
   still-plaintext-carrying record, to validate the type shape before
   committing to a crypto scheme.
3. **Encryption Authority Boundary** — exposing §01's own real, already-
   implemented but `pub(crate)`-only conversation-key derivation across
   the WASM boundary (the SAME `#[wasm_bindgen]` pattern
   `AeadKeyHandle`/`generate_aead_key_handle` already use), wiring
   `FedosConversationMessage.ciphertext` to real AEAD (§01/§02) for the
   `direct` (pairwise) case specifically.
4. **Membership Record** — `FedosConversationMembership` (§04), role/
   authority fields, the device-identity participant-ref addition (§04).
5. **Capability Invitation** — `FedosConversationInvitationCapability`
   (§09), including the `intendedRecipient`/`keyEpochReference`/
   `redemptionAuthority` fields this review adds.
6. **Durable Redemption** — the single-Authority atomic redemption
   mechanism (§10 Option A), plus the key-delivery-after-membership
   ordering guarantee (§06).
7. **Private Storage** — the dedicated append-only-shaped backend (§07
   Option B), including the file-permission hardening this review flags
   as a real prerequisite, not optional polish.
8. **Outbound Eligibility (extended)** — the new Encryption/Envelope-
   readiness gate (§11), inserted into the existing chain ahead of the
   already-shipped Public Board Runtime's own target-eligibility check.
9. **DM** — `direct`-mode end-to-end wiring: Conversation Identity (1) +
   Private Message Envelope (2) + Encryption Authority Boundary's own
   pairwise case (3) + Membership (4, degenerate two-participant case)
   + Outbound Eligibility extension (8).
10. **Private Group** — everything DM (9) needs, PLUS full Membership
    (4, N-participant case) + Capability Invitation (5) + Durable
    Redemption (6) + the group-distribution half of Key Distribution
    (§05 Option D, or the Sender-Key standards-track upgrade).
11. **Pseudonym Presentation** — §13's own random-assignment design,
    layered onto Membership (4) once it exists; genuinely independent
    of everything else in this list except needing (4) as a place to
    persist `displayPseudonym`.
12. **Abuse controls** — §15's own layering, added last, deliberately —
    per the prior review's own §11 finding (reapplied here), abuse
    controls belong OUTSIDE the Conversation Core and should never gate
    the Core's own foundational buildout.

## Dependency order

```
        (1) Conversation Identity/Policy
                      |
                      v
        (2) Private Message Envelope
         (needs (1)'s own id types only)
                      |
                      v
        (3) Encryption Authority Boundary
         (needs (2)'s own ciphertext field to exist as
          a real target; needs NOTHING from 4-12)
                 /            \
                v              v
        (4) Membership      (7) Private Storage
       Record              (needs (2)'s own record
    (needs (1); indep.      shape to know what it's
     of 3/5-12)             storing; indep. of 3-6,8-12)
           |                        |
           v                        |
        (5) Capability               |
        Invitation                   |
    (needs (4)'s own                 |
     participantRef                  |
     shape)                          |
           |                        |
           v                        |
        (6) Durable Redemption       |
    (needs (5); needs (3)'s          |
     own key-delivery step           |
     to exist for the ordering       |
     guarantee, §06)                 |
           \                        /
            \                      /
             v                    v
        (8) Outbound Eligibility (extended)
    (needs (2)+(3) -- an envelope-readiness
     check needs BOTH the envelope type AND
     a real encryption path to check readiness of)
                      |
              --------+--------
              |                |
              v                v
          (9) DM            (11) Pseudonym Presentation
    (needs 1,2,3,4,8;    (needs (4) only -- can start
     the smallest         in PARALLEL with 5-10, the
     complete slice)      ONE candidate with almost no
              |            real dependency chain at all)
              v
        (10) Private Group
    (needs 9's own foundation PLUS 5,6,7 fully,
     plus the group half of Key Distribution)
                      |
                      v
        (12) Abuse controls
    (added last, deliberately -- needs the
     Conversation Core (1-10) to exist as
     something worth defending, per the
     prior review's own §11/§15 "outside
     the Core, never gating it" finding)
```

**Recommended sequencing for a single implementer:** (1) → (2) → (3)
and (7) in either order (both depend only on (2)) → (4) → (5) → (6) →
(8) → (9) [DM ships here — a real, working, minimal private-mode
slice] → (10) [Private Group] → (12), with (11) startable any time
after (4), genuinely independent of the rest of the chain.

## Largest safe single-Arc unit

**(1) + (2) + (3) + (4) + (8) + (9) together** is the largest unit
safely implementable in one Arc without leaving a half-built,
misleadingly-labeled foundation exposed: this slice ships a REAL,
working, minimal DM — Conversation identity, a real private message
type, real (pairwise) encryption wired end-to-end via the WASM
boundary, minimal two-participant membership, the extended eligibility
gate, and the DM command surface itself. Stopping at (1)+(2) alone
would ship a typed-but-unencrypted message record that could be
mistaken for "private" by a careless caller (a real risk this review
flags explicitly — an unencrypted `FedosConversationMessage` sitting in
Storage looks identical in TYPE to an encrypted one unless the crypto
wiring (3) is also complete). Bundling (5)/(6)/(7)/(10) into the SAME
Arc as (1)-(4)+(8)+(9) would repeat the "too much justification budget
spent at once" risk both prior reviews already named for their own
respective largest-safe-unit findings — Capability Invitation (5)'s own
distributed-redemption problem (§10) and Private Group's own
group-key-distribution problem (§05/§10) are each independently
substantial enough to warrant their own Arc.

## See also

- `docs/reviews/private_conversation_security/20_blockers_recommendation.md`
- `docs/reviews/board_runtime_application_api_15_implementation_dependency_order.md`
