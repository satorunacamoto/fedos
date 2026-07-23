# Secure Runtime Alpha 7081–7160 — Deep Production Gap Report

**FedOS Conversation Invitation and Shared Conversation Foundation Arc.**
Per the mission's own explicit instruction ("If a production blocker is
discovered, stop immediately, document it honestly, and commit as Honest
Partial"), this report names, in full, three genuine, pre-existing,
cross-cutting production gaps discovered by this Arc's own real testing —
none of which this Arc created, and none of which this Arc's own narrow
mandate authorizes fixing (each is a foundational crypto/identity-wiring
gap comparable in scope to the Direct Ratchet production capability Arc
itself). One narrower, fourth gap (Draft persistence path) WAS fixed —
see the execution specification.

## Gap 1 — the real NIP-17 wire adapter is gated behind the never-populated legacy crypto graph

`startFedosDesktopRuntime()` constructs `nip17WireAdapter` (`NostrNip17V1WireAdapter`
— the ONE component that wraps ANY control/message plaintext into a real
NIP-17 Gift Wrap for Relay transport) ONLY when
`config.conversationDirectMessageDeliveryRoute === "nostr-nip17-v1" && productionCryptoGraph !== null`
(`src/desktop/runtime/fedos_desktop_runtime.ts:1212-1219`, confirmed by
direct source read). `productionCryptoGraph` is populated EXCLUSIVELY by
the legacy, `NODE_ENV`-gated `assembleFedosConversationProductionCryptoGraph()`
path (`if (config.conversationProductionCrypto !== undefined) { productionCryptoGraph = await assembleFedosConversationProductionCryptoGraph(...) }`).

Confirmed by direct grep: neither `fedos_electron_beta_main.cts` (the
canonical packaged entry point) nor `FedosProfileInitializationCoordinator`
EVER sets `conversationProductionCrypto` or
`conversationDirectMessageDeliveryRoute` anywhere. **This means
`sendMailboxNip17`/`sendMailboxNip17Control` return `"route-unavailable"`
for EVERY subsystem that depends on them — Peer Capability advertisements,
Direct Ratchet's own control messages (session-reset, etc.), Identity
Transition notifications, Signed Deletion requests, and this Arc's own
Conversation Invitations — through the REAL packaged/Coordinator-driven
production chain, TODAY.** Reproduced live: this Arc's own real vertical
slice test observed `sendOutcome.relayOutcome === "route-unavailable"`
from a real, correctly-configured, real-relay-connected production
Coordinator.

This is NOT specific to Conversation Invitation. It is a foundational gap
in the entire production control/message transport stack, seemingly
never previously exercised end-to-end through the REAL Coordinator path
(every prior real vertical slice test that proved NIP-17 delivery —
including Alpha 5561-5640's own real crypto test — did so over a SHARED
in-memory backend with manually-constructed dependencies, never through
`startFedosDesktopRuntime()`/`FedosProfileInitializationCoordinator`
end to end). Closing it requires building a real, non-`NODE_ENV`-gated
population path for `productionCryptoGraph` (or an equivalent), which is
a foundational crypto-wiring Arc of its own — out of this Arc's narrow
scope.

## Gap 2 — `FedosConversationIdentityResolver` resolves to a generic, non-per-account placeholder in production

`assembleFedosConversationRuntimeDependencies()` defaults
`creatorIdentityAuthority` to `new AnonymousLocalFedosConversationCreatorIdentityAuthority()`
(`src/conversation/runtime/fedos_conversation_runtime_assembly.ts:380`)
whenever `config.creatorIdentityAuthority` is not supplied — and, exactly
like Gap 1, NOTHING in the real packaged/Coordinator path ever supplies
it. Reproduced live: `identityResolver.resolveLocalParticipant()`
resolved to the literal, GENERIC `{authority:"fedos", publicIdentifier:
"anonymous-local", identityId:null}` for both Alice's and Bob's real,
independent, correctly-activated production profiles in this Arc's own
testing — the SAME value for every account, never distinguishing users.

This affects `activateDirectConversation()`, `reactivateRestoredConversation()`,
and anything else that asks "who is the local Conversation participant"
through the real production Coordinator path — not specific to
Conversation Invitation. This Arc's own design works around it (see the
execution specification's "two distinct local identity sources" section)
by using the real, per-account, cryptographically-verifiable pubkey
(`signingAuthority.publicIdentityForAccount()`) for its own invitation
content and addressee verification, while still accommodating
`reactivateRestoredConversation()`'s own frozen internal use of the
degraded resolver for Membership self-admission. Closing this gap for
real (a genuine production `FedosConversationCreatorIdentityAuthority`
deriving real per-account identity from the Master Seed Authority) is,
again, a foundational Arc of its own.

## Gap 3 — `FedosConversationDirectActivationCoordinator` requires a real static-route encryption authority that has never been built

`activateDirectConversation()` fails closed to `"encryption-unavailable"`
whenever `encryptionAuthority`/`decryptionAuthority` are the
`Unavailable*` placeholder (`src/conversation/activation/fedos_conversation_direct_activation_coordinator.ts:163-169`).
Confirmed: only two classes implement `FedosConversationEncryptionAuthority`
in this codebase — `FedosUnavailableConversationEncryptionAuthority`
(placeholder) and `FedosWasmConversationEncryptionAuthority` (the SAME
legacy, `NODE_ENV`-gated path as Gap 1). No production-safe implementation
has ever been built. This is why this Arc's own real outbound coordinator
reports `activated: false` even after a fully successful Draft+Membership
bootstrap — `#ensureDraft()` (inside `reactivateRestoredConversation()`)
durably writes the Draft and both Memberships BEFORE
`activateDirectConversation()` is ever attempted, so this Arc's own
actual scope is provably unaffected, but "activation" in the
`FedosConversationDirectActivationCoordinator` sense never completes
through the real production path today.

## Common root cause

All three gaps trace to the SAME underlying fact: the real production
Coordinator/packaged-Electron path (`FedosProfileInitializationCoordinator`
→ `startFedosDesktopRuntime()`) only ever wires the NARROW, Ratchet-
specific `conversationDirectRatchetMasterSeedAuthority` field (Alpha
6841-6920/6921-7000's own real fix) — it never wires the BROADER,
Conversation-level `conversationProductionCrypto`/`conversationCreatorIdentityAuthority`/
`conversationEncryptionAuthority`/`conversationDecryptionAuthority`/
`conversationDirectMessageDeliveryRoute` fields that predate Direct
Ratchet and were apparently never revisited once Direct Ratchet's own
narrower, parallel production path was built. Closing all three
coherently (rather than piecemeal) is itself likely the right shape for
a future Arc: **FedOS Conversation-Level Production Crypto and Identity
Authority Wiring Arc**.

## What remains real and unaffected by these three gaps

This Arc's own actual, literal mission requirements — real signed
invitation creation, real signature verification, real optimistic
Membership bootstrap on independently-provisioned real profiles, real
Draft persistence, identical conversationId on both sides, real restart
safety — are ALL proven, for real, in
`test/secure_runtime_alpha_7081_7160_real_vertical_slice.test.ts`, using
two genuinely independent real production profiles connected to a real
local relay. The ONE substitution made, clearly disclosed in that test's
own header before a single assertion runs, is Gap 1: the real, signed
invitation record is handed directly to Bob's real inbound coordinator
rather than delivered through the (confirmed-blocked) live relay
transport leg — never a fabricated record, never a bypassed identity or
signature check.
