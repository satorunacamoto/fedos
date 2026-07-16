# 11 — Private Conversation Outbound Eligibility

## Required chain, extended from the prior review's own §10

```
Conversation Policy (mode + §04/§05 access policy)
    v
Encryption / Envelope readiness   <-- NEW this review: a Private-mode-specific gate
    v
Target-specific eligibility        (Alpha 621-640's own real, source-verified gate, extended)
    v
Outbox intent
```

**The new middle gate — Encryption/Envelope readiness — is required
specifically because Private modes exist at all.** The already-shipped
Public Board Runtime's own Outbound Eligibility gate
(`src/board/runtime/fedos_board_runtime_outbound_eligibility.ts`,
re-verified unmodified this pass, confirmed still public-mode-only by
direct source inspection) has no such step, correctly, because a public
post is always already in its final, sendable form the moment it's
validated. A Private message is NOT sendable until §02's own
`FedosConversationMessage.ciphertext` has actually been produced under
a real key (§01/§05) — an eligibility gate that only checked "is this
target protocol-appropriate" (the existing public-mode gate's own
entire job) would be structurally incapable of catching "this message
has no ciphertext yet" as a distinct failure, since that condition
cannot occur for a public post at all.

## Public Nostr Publisher must never receive Private content — restated as an absolute, source-grounded requirement

§01 (this review) and the prior review's own §01 both confirm:
`FedosRelayNostrBoardPublisher.publishOne()`'s only gating decision is
a bare protocol-match guard (`target.protocol !== "nostr"` → refuse) —
**no audience/visibility/confidentiality logic exists in the Publisher
layer today, and none should ever be added there** (prior review's own
§10 reasoning, reconfirmed: by the time a record reaches a Publisher,
the eligibility decision must already be final — putting a
Private-content check there would mean a leak has ALREADY been durably
recorded in the Outbox even if the Publisher itself later refuses it).

## Protocol-by-protocol status, confirmed by direct source reading (not assumed)

- **Nostr private messaging.** `src/federation/capability_matrix.ts`'s
  own `canProtocolAdapterSupport()` (re-read in full this pass, quoted
  verbatim in §01's own supporting agent findings) already,
  structurally, hard-codes `private_message_placeholder` as `rejected`
  for `nostr_placeholder` — *"private messages must never ride on a
  public Nostr relay event (NIP-17/NIP-44 out of scope)."* This is the
  strongest existing, already-committed signal this codebase carries
  about its OWN intended direction — reused here directly rather than
  re-derived. **However, this matrix is a disconnected planning table**
  (prior review's own §01 finding, reconfirmed) — it governs nothing at
  runtime; the REAL Outbound Eligibility gate (this section) must
  encode the identical policy itself, not merely cite the matrix.
- **ActivityPub private addressing.** No outbound Publisher exists for
  ActivityPub at all (confirmed this pass: `src/board/publish/` has
  only a `nostr/` subdirectory). Private-mode eligibility for
  ActivityPub is therefore moot today in the strongest possible sense —
  there is no live delivery path to leak THROUGH, only a future,
  unbuilt one. Recommended default regardless: **fail closed** —
  eligibility must never depend on "there's no Publisher anyway, so it
  doesn't matter" as an implicit safety net; the day an ActivityPub
  Publisher IS built, the gate must already have the correct policy in
  place, not retrofitted urgently at that point.
- **AT Protocol private message.** Same status as ActivityPub — no
  outbound Publisher exists; fail closed by the same reasoning.
- **Session private delivery.** No outbound Publisher exists either
  (confirmed this pass). **Additionally, and more significantly**: §01's
  own Session-adapter investigation found **no DM-vs-public distinction
  modeled anywhere in this codebase's Session code at all** — the
  existing `FedosValidatedSessionPost`/adapter assumes every inbound
  Session post is board-shaped, with "encryption/decryption, DM
  retrieval" explicitly named as already having happened BEFORE this
  codebase's own boundary. This means Session's eligibility status is
  not merely "no Publisher yet" but "this codebase does not yet even
  KNOW what a private Session delivery would structurally look like" —
  named in §18 as requiring official Session protocol research before
  any eligibility rule beyond "fail closed" can be written with
  confidence.

## Full compatibility is not assumed anywhere in this section

Every protocol above defaults to **fail closed** for Private modes,
without exception, until a specific future Arc does the protocol-
specific research (§18) and design work to open a narrow, deliberate
exception — mirroring the prior review's own §10/§13 "protocol mapping
is a loss-aware adapter, never assumed complete" discipline, applied
here with the additional, stricter default that Private modes start
from zero eligible protocols (public mode, by contrast, could
reasonably default to Nostr-eligible immediately, since Nostr events
ARE structurally public already).

## Publisher never carries privacy policy — restated

Unchanged from the prior review's own §10: `FedosBoardOutboxPublisher`
implementations (Nostr's own, and any future ActivityPub/AT-Proto/
Session one) must never grow an audience/confidentiality check of their
own. Every eligibility decision this section describes happens strictly
BEFORE `createFedosBoardOutboxIntent` is ever called — the Publisher's
only job, for Private OR Public content alike, remains "transport
exactly what it's handed, report success/failure," per the already-
shipped Public Board Runtime's own confirmed behavior (source-verified
this pass, unchanged since Alpha 621-640).

## See also

- `docs/reviews/private_conversation_security/02_private_canonical_model.md`
- `docs/reviews/private_conversation_security/18_protocol_mapping.md`
- `docs/reviews/board_runtime_application_api_10_outbound_safety.md`
