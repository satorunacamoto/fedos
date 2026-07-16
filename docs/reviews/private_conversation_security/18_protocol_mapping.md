# 18 — Protocol Mapping Matrix

No web search performed, per this review's own instruction — every row
below is either a direct fact from this repository's own source, or
explicitly marked **要公式仕様調査 (requires official spec research)**
where this repository's own source is silent or insufficient to
conclude anything.

## Matrix

| Protocol | Direct (1:1) | Group | Membership | Encryption | Deletion | Offline delivery | Identity | Bridge feasibility |
|---|---|---|---|---|---|---|---|---|
| **Nostr** | No real NIP-04/17/44/59 code exists anywhere in `src/` — confirmed exhaustively (every hit is a guardrail comment or `_placeholder` label, §01). §01's own Rust core HAS a real, vector-verified NIP-44-compatible conversation-key/wire pipeline, but it is `pub(crate)`-only, unexported. **要公式仕様調査**: exact NIP-17 gift-wrap envelope semantics beyond what the Rust code already implements for NIP-44's own conversation-key layer. | No native Nostr group-DM primitive is referenced anywhere in `src/` (relay/client conventions for group-shaped Nostr use exist in the wild but are not modeled in this codebase). **要公式仕様調査**. | Nostr has no protocol-enforced membership primitive comparable to `FedosConversationMembership` (§04) — any group-shaped Nostr convention is relay/client-convention-based, never protocol-guaranteed. | `capability_matrix.ts`'s own `canProtocolAdapterSupport()` already hard-codes `private_message_placeholder` → `rejected` for `nostr_placeholder`, reason quoted verbatim: *"private messages must never ride on a public Nostr relay event (NIP-17/NIP-44 out of scope)."* This is a disconnected planning table (§11), not runtime-enforced, but is the strongest existing directional signal in the codebase. | `FedosBoardModerationRecord`'s own `reasonCode` already distinguishes `source_protocol_deletion_placeholder` from `local_only_deletion_placeholder` (prior review's own §13 finding, reconfirmed) — direct evidence this codebase already recognizes source-protocol deletion and local hiding as different facts for Nostr specifically. | **要公式仕様調査** — no offline-delivery/relay-queue behavior for DM-shaped events is modeled in this codebase. | Real, working: Master Seed → Protocol Root → Nostr signing key (§01), deterministic, already implemented. | Only Nostr has a real OUTBOUND Publisher today (`FedosRelayNostrBoardPublisher`, confirmed §01/§11) — the only protocol where a private-mode bridge is even structurally possible to reach, once NIP-44 is exported (§01) and eligibility is extended (§11). |
| **ActivityPub** | Only an INBOUND adapter exists (`src/board/activitypub/`) — confirmed no outbound Publisher anywhere in `src/board/publish/` (only a `nostr/` subdirectory exists). Addressing model (public collection vs. addressed-only) is a protocol convention this codebase's own adapter does not currently distinguish for private delivery. **要公式仕様調査**: ActivityPub's own addressed-only delivery guarantee level (confidentiality vs. mere non-public-collection addressing). | **要公式仕様調査** — ActivityPub Group actor semantics not modeled in this codebase. | ActivityPub's own Group actor type differs structurally from `FedosConversationMembership` (§04); not evaluated in depth — **要公式仕様調査**. | No encryption concept modeled for ActivityPub anywhere in `src/`; addressed-only delivery is NOT the same guarantee as encryption (per §11's own explicit warning against assuming so). | Not modeled — `capability_matrix.ts` has no ActivityPub row distinguishing this. | **要公式仕様調査**. | No ActivityPub identity resolution exists anywhere in this codebase (confirmed, prior review's own §01: only Nostr has a real, wired identity provider). | **Fail closed today, absolute** — no outbound path exists at all (§11). |
| **AT Protocol** | Only an inbound adapter exists (`src/board/atproto/`); no outbound Publisher. No private-message concept modeled anywhere in this codebase. **要公式仕様調査** entirely — this repository's own source is silent on AT Protocol's private-messaging story beyond the public post adapter. | **要公式仕様調査**. | **要公式仕様調査**. | **要公式仕様調査**. | Not modeled. | **要公式仕様調査**. | No AT Protocol identity resolution exists anywhere in this codebase. | **Fail closed today, absolute** — no outbound path exists at all (§11). |
| **Session** | **The most significant finding of this row**: confirmed by direct source reading (§01/§11), the existing Session adapter (`src/board/session/`) explicitly assumes DM-vs-public disambiguation, encryption, and DM retrieval have ALL already happened BEFORE reaching this codebase's own boundary — quoted verbatim: *"This Arc's own boundary is the narrowest of the four: it has NO responsibility before the Gateway (Session network, Oxen connection, private keys, encryption/decryption, DM retrieval... are all explicitly out of scope and absolutely prohibited)."* **There is no DM-vs-group distinction modeled anywhere in this codebase's Session code** — not even as a comment naming the concept. **要公式仕様調査** entirely for Session's own private-delivery protocol. | Same finding — no group concept modeled at all. | Same finding. | Session's OWN protocol is understood (outside this codebase) to be privacy/onion-routing-oriented by design, but nothing in this repository's own source confirms or characterizes that — **要公式仕様調査**, explicitly flagged rather than assumed from the protocol's reputation. | Not modeled. | **要公式仕様調査**. | No Session identity resolution exists anywhere in this codebase beyond the inbound adapter's own opaque `sessionId`/`authorId` fields (never carried onto the canonical post, per §01's own confirmed finding). | **Fail closed today, absolute** — no outbound path exists at all (§11), and this codebase does not yet even know what "private Session delivery" would structurally look like (§11's own escalated finding for this protocol specifically). |

## No complete-compatibility assumption anywhere

Every cell above is either a direct, cited fact or an explicit
**要公式仕様調査** flag — this review makes no inference about any
protocol's own real-world capability from its name, reputation, or
general Internet knowledge. Per this review's own instruction, no web
search was performed; where this repository's own source is silent,
the cell says so rather than guessing.

## Items requiring official protocol research before any further design (consolidated)

1. NIP-17 gift-wrap envelope semantics beyond the already-implemented
   NIP-44 conversation-key layer (§01).
2. Nostr group-DM conventions in real-world client/relay practice (no
   protocol-level primitive exists to research instead).
3. ActivityPub addressed-only delivery's actual confidentiality
   guarantee (if any) vs. mere non-public-collection addressing.
4. ActivityPub Group actor semantics for membership mapping.
5. AT Protocol's entire private-messaging story — this repository's own
   source has essentially zero signal to build from.
6. Session's entire private-delivery protocol — the single largest gap,
   since even the DM-vs-group DISTINCTION is unmodeled here, not merely
   the encryption mechanics.

## See also

- `docs/reviews/private_conversation_security/01_existing_crypto_inventory.md`
- `docs/reviews/private_conversation_security/11_outbound_eligibility.md`
- `docs/reviews/board_runtime_application_api_13_protocol_mapping.md`
