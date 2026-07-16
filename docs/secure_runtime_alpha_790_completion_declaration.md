# Secure Runtime Alpha 790 — Completion Declaration

## Achieved

- Participant model — `FedosConversationParticipantReference`, fail-closed validated (Alpha 762/763).
- Membership Record — `FedosConversationMembership`, deterministic identity, closed role/state vocabularies (Alpha 764–767).
- Membership transitions — the full six-transition contract, enforced for real (Alpha 768, 771).
- Membership Authority — `FedosConversationMembershipAuthority` + a real in-memory implementation, no fake allow-all behavior (Alpha 770/771).
- Capability descriptor/secret separation — `FedosConversationCapabilityDescriptor` (public) vs. `FedosConversationCapabilityBearerSecret` (opaque, never co-located) (Alpha 777/778).
- Issuance boundary — `FedosConversationCapabilityIssuerAuthority`, injected existence/authorization checks (Alpha 780).
- Redemption boundary — `FedosConversationCapabilityRedemptionAuthority`, coarse and stable outcomes, no secret-guessing oracle (Alpha 782/783).
- Honest local exactly-once semantics — stated without hedging, no distributed claim (Alpha 784).
- Capability-to-Membership coordination — the real four-step sequence, disclosed partial-failure mode (Alpha 785/786).
- Public-mode compatibility — zero `src/board/runtime/` changes, verified structurally and behaviorally (Alpha 772).
- No fake private support — no private-group/DM construction path, no encryption, no key delivery, verified by structural guards (Alpha 788).

## Remaining blockers

- Durable Membership persistence — `InMemoryFedosConversationMembershipAuthority` is the only implementation; no `FedosConversationMembershipPersistence` port exists.
- Durable Capability persistence — same gap, Capability side.
- Cross-process atomic redemption — Alpha 784's own honestly-stated boundary; nothing beyond one in-memory instance is guaranteed.
- Distributed redemption — not designed, not attempted.
- Private Conversation construction — `FedosConversationPolicy.mode` still accepts only `"public"`; `writeAccess: "restricted"` still rejected.
- Encryption/key delivery — zero encryption code exists anywhere in this Arc.
- Private storage — no separate storage boundary for private content exists.
- Invitation transport/URL — no URL/QR/HTTP endpoint of any kind exists; a bearer secret has no way to reach a recipient outside a test.
- GUI — none.
- Protocol mapping — Capability/Membership have no Nostr/ActivityPub/AT Protocol wire representation.

## Recommendation

**A. Durable Membership & Capability Persistence Arc.** Durability is the primary blocker: every other remaining gap (cross-process/distributed redemption, real production invitation transport) is downstream of having no persisted Membership/Capability state at all — an in-memory-only authority cannot survive a runtime restart, exactly the same gap `FedosConversationPersistence` (Alpha 749) already closed for the Conversation Record itself one Arc ago. Mirroring that precedent (a dedicated port + an in-memory default + a real append-only or equivalent backend) is the smallest safe next step, and does not require first resolving either of the two much larger blockers (B: encryption/key delivery, C: a full private-readiness gate spanning both domains at once).
