# Secure Runtime Alpha 7081–7160 — Execution Specification

**FedOS Conversation Invitation and Shared Conversation Foundation Arc.**

## Files added (new subsystem, `src/conversation/invitation_bootstrap/`)

- `fedos_conversation_invitation_advertisement.ts` — the signed invitation
  record ("Invitation record"): `conversationId`, `inviter`, `invitee`,
  `issuedAt`, `expiresAt`, `nonce`, `accountAuthorization`. Fixed-order
  canonical array serialization; exact-field-set structural validation;
  fail-closed decode. Mirrors `fedos_ratchet_peer_capability_advertisement.ts`'s
  own established discipline, narrowed to a one-time invitation (no
  `revision`, no capability list).
- `fedos_conversation_invitation_authentication.ts` — real account-level
  BIP-340 Schnorr signing/verification (`FedosNostrSigningAuthority.signEvent()`
  / `NobleSignatureVerifier.verify()`, both real, both unmodified), domain-
  separated (`fedos-conversation-invitation-v1`) so a signature can never
  be replayed as authenticating a different record kind.
- `fedos_conversation_invitation_control_payload.ts` — the wire wrapper
  ("Invitation token" carrier) sent through the EXISTING
  `sendMailboxNip17Control()` seam, a distinct `kind: "conversation-invitation"`
  discriminator, never folded into the Ratchet or Peer Capability codecs.
- `fedos_conversation_invitation_outbound_coordinator.ts` — creates a new
  conversationId (`toFedosPrivateConversationId("direct", <real CSPRNG
  request id>)`), admits both parties' Memberships locally (breaking the
  real circular route-resolution dependency the reconciliation report
  documents), bootstraps the local Draft via the EXISTING, unmodified
  `reactivateRestoredConversation()`, then signs and sends.
- `fedos_conversation_invitation_inbound_coordinator.ts` — the mission's
  own "Acceptance Coordinator." Verifies the real signature and real
  addressee identity, checks expiry, checks for a duplicate via the
  durable received-invitation log, admits both Memberships locally, and
  bootstraps the local Draft the same way.
- `fedos_conversation_invitation_runtime.ts` — the narrow safe facade
  composing both coordinators, mirroring `FedosRatchetPeerCapabilityRuntime`.
- `fedos_conversation_invitation_received_record.ts` +
  `persistence/fedos_conversation_invitation_received_persistence.ts` +
  `persistence/append_only_fedos_conversation_invitation_received_persistence.ts`
  + `persistence/in_memory_fedos_conversation_invitation_received_persistence.ts`
  + `persistence/fedos_conversation_invitation_received_codec.ts` — the
  durable, restart-safe, idempotent record of one inbound invitation this
  local Device has processed. Mirrors
  `AppendOnlyFedosRatchetPeerCapabilityObservationPersistence`'s own
  NDJSON convention exactly.
- `fedos_secure_random_conversation_invitation_id_generator.ts` — real
  CSPRNG id/nonce generator, mirrors `FedosSecureRandomConstructionIdGenerator`'s
  own exact idiom.

## Files changed (narrow Runtime wiring)

- `src/conversation/runtime/fedos_conversation_runtime.ts` — new optional
  `conversationInvitation` deps bundle (mirrors `peerCapability`'s own
  pattern exactly), `#invitationRuntime` field, construction (reusing the
  SAME `membershipAuthority`/`identityResolver` this Runtime already
  builds), a fifth dispatch attempt in `receiveNip17Rumor()` (before the
  legacy chat fallback, mirroring every prior control-payload attempt),
  and a `conversationInvitation()` public accessor.
- `src/desktop/runtime/fedos_desktop_runtime_config.ts` — three new
  optional fields (`conversationInvitationEnabled`,
  `conversationInvitationReceivedLogPath`, `conversationInvitation`
  manual override), mirroring `peerCapability`'s own field triad exactly.
- `src/desktop/runtime/fedos_desktop_runtime.ts` — auto-construction of
  `conversationInvitationDeps`, mirroring `conversationPeerCapabilityDeps`'s
  own construction exactly; threaded into `createFedosConversationRuntime()`.
- `src/desktop/onboarding/fedos_local_profile_paths.ts` — two new durable
  path fields: `conversationInvitationReceivedLogFile` (new) and
  `conversationDraftLogFile` (real bug fix, see below).
- `src/desktop/onboarding/fedos_profile_initialization_coordinator.ts` —
  pass-through for `conversationInvitationEnabled`/
  `conversationInvitationReceivedLogPath`, plus the real
  `conversationDraftLogPath` bug fix.
- `src/desktop/shell/fedos_desktop_application_shell.ts` — one new,
  narrow, additive wrapper method: `createConversationInvitation()`.

## Real, narrow production bug fixed (in scope, unlike the deeper gaps —
see the companion deep-gap report)

`FedosProfileInitializationCoordinator#buildRuntimeConfig()` wires
`conversationMembershipLogPath` (durable) but had never wired
`conversationDraftLogPath` — a field that already existed on
`FedosDesktopRuntimeConfig` and was already consumed correctly by
`assembleFedosConversationRuntimeDependencies()`, just never supplied.
Net effect, confirmed by direct testing: Draft persistence silently
defaulted to in-memory-only through the REAL production Coordinator path,
lost on every restart — for EVERY Direct/Group conversation, not specific
to invitations. Fixed with one new path field + one new config line,
mirroring the sibling `conversationMembershipLogPath` line exactly.

## Real, narrow test bug fixed (in this Arc's own new persistence code)

`fedosConversationInvitationReceivedRecordsAreEqual()` originally included
`acceptedAt` in its equality comparison. Since `acceptedAt` is re-derived
fresh on every import attempt (including a genuinely idempotent
redelivery received after a real time gap, e.g. after a restart), this
misclassified a true duplicate as a `"conflict"`. Fixed by excluding
`acceptedAt` from the comparison — the record's own real identity is
already fully captured by `(localDeviceRef, conversationId, nonce,
inviter, invitee)`.

## Design decision: two distinct "local identity" sources, deliberately

Both coordinators use TWO different sources for "who am I" — documented
in full in the deep-gap report, restated briefly here: the REAL,
per-account pubkey (`signingAuthority.publicIdentityForAccount()`) is used
for the invitation's own `inviter`/`invitee` fields and for the inbound
"is this genuinely addressed to me" check, because it is real,
cryptographically verifiable, and per-account-distinct. The
`identityResolver`-derived identity (which resolves to a generic,
non-per-account `"anonymous-local"` placeholder in the current production
wiring — a disclosed, pre-existing, out-of-scope gap) is used ONLY for
the LOCAL "owner"/"member" Membership admission, because
`reactivateRestoredConversation()`'s own frozen, internal logic looks up
the local participant via that SAME resolver, and the bootstrap step
would fail otherwise. This is not a design this Arc invented for its own
sake — it is the minimum accommodation required to make its own new code
interoperate correctly with existing, frozen, unmodified machinery whose
own identity-resolution default is degraded.
