# Review 02 — Readiness Axes

Construction readiness is not one boolean. Mirrors
`FedosConversationPolicy`'s own "distinct axes, never collapsed into
one enum" discipline (`src/board/runtime/policy/fedos_conversation_policy.ts`,
Alpha 653) and `01`'s own finding that each prerequisite area is
independently real, independently gated, or independently absent. Nine
axes, each independently checkable against real source found in `01`:

1. **Conversation metadata persistence readiness** — can a
   `FedosConversationRecord` be durably written for this specific
   Conversation id? Backed by `FedosConversationPersistence`
   (`src/conversation/persistence/`), which is real and working for
   `mode: "public"`. For `private-group`/`direct`, this axis resolves
   `false` even though the PORT is ready, because
   `validateFedosConversationRecord()` itself rejects the record before
   the port is ever reached (`01`). This axis therefore measures the
   VALIDATOR + PORT pair together, not the port alone — a future Arc
   that widens the validator changes this axis's answer without
   touching the port.

2. **Creator identity readiness** — does a real, resolvable
   `FedosConversationParticipantReference` exist for whoever is
   requesting construction? Distinct from "some `FedosIdentityRecord`
   exists somewhere in `FedosIdentityRegistry`" — construction needs
   the SPECIFIC caller's own identity, resolved at command time, the
   same distinction `FedosPublicAuthorAuthority.resolvePublicAuthor()`
   already draws between `"resolved"` and `"anonymous-local"`
   (`src/board/runtime/identity/fedos_public_author_authority.ts`).
   An `"anonymous-local"` creator is a real, valid identity for a
   PUBLIC post; whether it is an acceptable creator identity for a
   PRIVATE conversation is a product decision this axis surfaces
   explicitly rather than silently assuming (see `06`).

3. **Creator Membership readiness** — can
   `FedosConversationMembershipAuthority.admit()` durably succeed for
   this creator, this Conversation id, role `"owner"`? Backed by
   `PersistedFedosConversationMembershipAuthority`
   (`src/conversation/membership/persistence/`), real and working,
   independent of axis 1 — Membership's own `admit()` never checks
   that a `FedosConversationRecord` exists for the `conversationId` it
   is given (`01`). This independence is exactly why axis 1 and axis 3
   must be checked SEPARATELY: a system that checks only axis 3 could
   durably admit an owner into a Conversation that was never
   constructed.

4. **Policy readiness** — can a well-formed
   `FedosConversationPolicy` be resolved for the requested mode?
   `StaticFedosConversationPolicyAuthority` resolves ONLY `"public"`
   today (`01`); a `private-group`/`direct` request finds no
   authority capable of resolving one. This axis is deliberately
   separate from axis 1 — a future Arc could widen the Policy
   Authority before widening the Conversation Record validator, or
   vice versa, and this axis lets each be tracked on its own timeline.

5. **Capability authority readiness** — can
   `FedosConversationCapabilityIssuerAuthority.issueJoinCapability()`
   durably succeed for this Conversation, IF construction chooses to
   issue an initial Capability (`11`)? Backed by
   `PersistedFedosConversationCapabilityAuthority`, real and working,
   but this Arc's own header names its injected
   `FedosConversationCapabilityIssuanceAuthorizationCheck` as carrying
   "NO default production implementation... anywhere in this Arc" — so
   this axis resolves `"unavailable"` for any caller that has not
   itself supplied a real authorization check, distinct from the
   authority object simply not existing.

6. **Encryption authority readiness** — per `08`'s own finer-grained
   breakdown (suite support, creator key-ready, epoch creatable,
   future-participant key delivery, artifact/runtime activation), this
   axis resolves `"unavailable"` unconditionally in this checked-out
   tree (`01`). Listed here as ONE axis at this level because every one
   of `08`'s sub-checks currently fails for the identical structural
   reason (`FEDOS_RUNTIME_PROVIDER_IMPLEMENTED = false`, no WASM
   artifact) — `08` exists to keep the sub-checks separately NAMED for
   when that stops being true.

7. **Payload storage readiness** — can
   `FedosConversationPayloadStorage.putPayload()` durably succeed for
   this Conversation? Backed by `AppendOnlyFedosConversationPayloadStorage`
   / `InMemoryFedosConversationPayloadStorage`, real and working,
   mode-agnostic (`01`). Construction itself never calls `putPayload()`
   (Conversation construction produces no payload — `07`'s own
   "not a message" framing) but a caller must be able to answer "will
   the FIRST message be storable" before honestly presenting a
   Conversation as usable, which is why this axis exists at
   construction time rather than only at first-send time.

8. **Retention contract readiness** — is
   `FedosPayloadRetentionAuthority` constructible with the SAME
   `payloadStorage` instance the Conversation's future messages will
   use? Kept separate from axis 7 because retention is a wrapping
   Authority over storage, not storage itself (`src/conversation/retention/fedos_payload_retention_authority.ts`'s
   own header) — a storage backend can be ready while no retention
   authority has been constructed to wrap it yet, which would make
   axis 7 `true` and axis 8 `false` simultaneously; construction must
   be able to observe that combination rather than conflating the two.

9. **Protocol delivery support readiness** — is there any real
   Publisher capable of delivering a private message for the protocols
   this Conversation's participants use? Per the prior Security
   review's own confirmed finding (still true, unmodified by Alpha
   761–850): no outbound Publisher exists for ActivityPub/AT
   Protocol/Session at all, and Nostr's own real Publisher fails
   closed on unproven key control
   (`src/board/runtime/eligibility/fedos_outbound_eligibility_evaluator.ts`,
   confirmed by `test/reviews/conversation_foundation_v1/decision_consistency.test.ts`
   item 8's `"identity-not-controlled"` grounding). This axis is
   explicitly NOT a construction blocker (`18`) — a Conversation may be
   honestly constructed local-only, exactly as `FedosBoardRuntime`'s
   own `"local-only"` first-class behavior already establishes for
   public posts (Alpha 634) — but it must be OBSERVABLE at construction
   time so a caller is never told delivery works when it structurally
   cannot.

## Why nine, not fewer

Collapsing any two of these into one boolean would hide a real,
independently-occurring failure mode `01` already found in source: axis
1 and axis 3 are independent because Membership never checks
Conversation existence; axis 4 and axis 1 are independent because the
Policy Authority and the Record validator are two different pieces of
code with two different fixed literals (`"public"` in each, but
enforced by unrelated functions); axis 6 and axis 5 are independent
because a Capability can be issued (a plain data record with a bearer
secret) with zero encryption involvement — Capability issuance never
touches `src/crypto`/`src/runtime` at all (confirmed by import
inspection in `01`); axis 7 and axis 8 are independent per the
Retention Authority's own header, quoted above.

## Why nine, not more

A tenth axis, "outbound eligibility per specific target protocol," is
deliberately NOT added at this granularity — `09`'s own axis
resolves it as one coarse "protocol delivery support" fact at
construction time; the PER-TARGET, per-message eligibility evaluation
(`evaluateFedosOutboundEligibility()`) is a send-time concern this
review's own scope boundary (readiness of the Conversation record
itself, not of any individual message) correctly excludes, matching
`18`'s own "construction stays independent of protocol publishing"
finding.
