# 13 — Thread-Local Pseudonym Boundary

## Requirements, restated from the prior review's own §07 and this review's own instruction

Conversation-local, display-only, separate from the signing identity,
separate from authorization (§04's own "pseudonym never used for
authorization" finding, reconfirmed), no cross-conversation
correlation, re-assignable on private-room move, a named dictionary-
collision policy, and separated from whatever internal reference
moderation/abuse tooling uses to track a participant (§16's own
moderation-vs-encryption tension makes this separation load-bearing: a
moderator's own internal abuse-tracking reference must key off
`memberId`/`participantRef`, §04, never off the pseudonym a bad actor
could simply get re-assigned by leaving and rejoining under §06's own
lost-device-recovery-shaped flow).

## Random assignment vs. deterministic derivation — re-compared with §01's real crypto findings now in hand

The prior review's own §07 already recommended random assignment over
deterministic HMAC derivation, reasoning from a HYPOTHETICAL server
secret's own compromise risk. **This review can now state that risk
concretely, using §01's own real, confirmed finding (Alpha 144):**

> "A Master Seed leak compromises all derived identities with no
> containment; a single Protocol Root or Account Key leak IS contained"
> by HKDF's one-way domain separation.

If a future deterministic-pseudonym scheme were built as "just another
HKDF domain off the Master Seed" (the natural, lowest-effort
implementation choice, given §01's own real, working
`derive_secret_handle_internal`/`HkdfDomain` machinery is RIGHT THERE
and trivial to extend with a new domain value), **the domain-separation
containment property Alpha 144 describes would NOT save it**: HKDF
domain separation contains a leak of ONE domain's own OUTPUT key
(e.g. the Nostr Protocol Root leaking doesn't reveal the Storage Root),
but it does nothing to contain a leak of the INPUT (the Master Seed
itself, or any single upstream node in the chain a pseudonym domain
would necessarily derive from). **Recomputing every pseudonym, for
every conversation, for every participant, the instant the Master Seed
(or whichever single node the pseudonym domain derives from) leaks, is
therefore the REAL, concrete failure mode the prior review's own
§07 could previously only describe abstractly** — this review confirms
it is not a hypothetical concern but a direct, mechanical consequence
of this codebase's own already-real derivation architecture, IF a
future Arc were to wire pseudonym derivation into it carelessly.

**This strengthens, rather than merely restates, the prior review's own
random-assignment recommendation**: a randomly-assigned pseudonym,
persisted per-`FedosConversationMembership` (§04, unchanged from the
prior review's own §07 shape), has NO relationship to the Master Seed
or any HKDF domain at all — its own compromise (a leaked storage
backup) reveals only assignments that already happened, never a formula
capable of recomputing every OTHER pseudonym across every OTHER
conversation. Confirmed, concretely, rather than merely argued.

## If deterministic derivation is ever chosen anyway — the one mitigation this review names

Should a future Arc still prefer deterministic derivation (e.g. for the
storage-cost argument the prior review's own §07 already named), the
correct implementation, informed by §01's real HKDF chain, would be to
derive the pseudonym key from a NEW, DEDICATED, LEAF-LEVEL node of the
existing hierarchy (a hypothetical `HkdfDomain::Pseudonym`, sibling to
the existing `Conversation`/`Storage`/`Identity` domains already
enumerated in `src/runtime/fedos_wasm_loader.ts:1384`'s own
`AeadAadDomain` union — noting that domain is for AEAD's own AAD
binding, a related but distinct vocabulary from `HkdfDomain`, and the
two should not be conflated), so that its own compromise is contained
by the SAME one-way domain-separation property Alpha 144 already
guarantees for every OTHER leaf domain — never derived directly from
the Master Seed itself, and never sharing a domain with any
security-critical key (Nostr signing, conversation-message encryption).
This review does not choose deterministic derivation; it names the
ONE way to make it survivable if a future Arc does, having now
confirmed §01's own architecture makes the naive version genuinely
dangerous, not merely theoretically imperfect.

## Dictionary collision policy

Restated, unchanged: the adjective+animal word dictionary is cosmetic
only; every actual guarantee in this section (no cross-conversation
correlation, no signing-identity leak) must hold even if the dictionary
is fully public. A collision (two members in the same conversation
independently assigned the same pseudonym) is handled at ASSIGNMENT
time — a per-conversation uniqueness check against already-assigned
`displayPseudonym` values on other current `FedosConversationMembership`
rows for the same `conversationId` (§04), re-rolling on collision —
not a security property, purely a display-quality one; a rare
collision that slipped through would be a minor UX confusion, never a
confidentiality or authorization failure, precisely because the
pseudonym is never load-bearing for either (§04's own separation).

## See also

- `docs/reviews/private_conversation_security/01_existing_crypto_inventory.md`
- `docs/reviews/private_conversation_security/04_membership_authorization.md`
- `docs/reviews/board_runtime_application_api_07_thread_local_pseudonym.md`
