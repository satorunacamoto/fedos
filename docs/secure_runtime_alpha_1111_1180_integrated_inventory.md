# Secure Runtime Alpha 1111–1180 — Integrated Reality Inventory (Alpha 1111)

Produced in the dedicated integration worktree `C:\wt\private-direct-messaging`,
branch `arc/private-conversation-activation-direct-messaging`, built from
`master` (`8b65609`) plus two sibling Arcs that had not yet reached master:

- `arc/conversation-identity-resolution-encryption-coordinator` (`f36c334`,
  Alpha 931–990) — merged clean, two mechanical additive conflicts resolved
  in `fedos_conversation_runtime.ts`/`fedos_conversation_runtime_assembly.ts`
  (both sides added disjoint fields/branches to the same class; no logic
  changed).
- `arc/conversation-invitation-draft-management` (`50082bc`, Alpha 991–1050)
  — merged into the same two files, same nature of conflict.

Both merges are pure unions of independent work; nothing here re-derives or
overrides an existing decision. Baseline: `npm run typecheck` has exactly one
pre-existing failure (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`),
confirmed identical on plain `master` — unrelated to this Arc.

## 1. Exact Conversation lifecycle types

`FedosConversationLifecycleState = "draft" | "active" | "closed" | "tombstoned"`
(`src/conversation/construction/fedos_conversation_lifecycle_state.ts`).
`FEDOS_CONVERSATION_CONSTRUCTIBLE_LIFECYCLE_STATE = "draft"` — the ONLY value
any constructor may produce. `FedosConversationDraftRecord.lifecycleState` is
part of a record that `FedosConversationDraftPersistence` only ever
*inserts* (`putDraft`/`getDraft`/`listDrafts` — no update method at all); the
record is immutable once written by design (its own header: "no `draft →
active` transition exists here").

## 2. Why `active` is currently unreachable

`FedosConversationEncryptionCoordinator.encrypt()` and
`FedosConversationDecryptionCoordinator.decrypt()` both gate on
`persistedDraft.lifecycleState !== "active"` — and nothing in the merged tree
can ever produce that value, because the draft persistence port has no write
path that could change it. The existing Alpha 949 test
(`test/secure_runtime_alpha_949_runtime_wiring.test.ts`, case 4) proves this
literally: it writes a hand-built `"active"` record directly into the
persistence Map to reach past the gate. **This is exactly the gap this Arc
closes** — not by rewriting the immutable draft record, but by adding a
separate, durable Activation fact that the two Coordinators consult
alongside it.

## 3. Current draft construction flow

`FedosPrivateConversationConstructionCoordinator` (Alpha 915) —
`createPrivateGroupDraft()`/`createDirectDraft()` — resolves creator
identity, persists a `"prepared"` coordination fact, persists the draft
record (always `lifecycleState: "draft"`), admits creator Membership, issues
the initial Capability (private-group: optional; direct: required, bound to
one intended recipient), records `"draft-completed"`. Fully idempotent/crash
recoverable via `FedosConversationConstructionCoordinationPersistence`. Never
touched by this Arc.

## 4. Current readiness axes

Nine axes (`readiness/fedos_conversation_readiness_axis.ts`): `identity`,
`conversationPersistence`, `policy`, `creatorMembership`, `capability`,
`encryption`, `payloadStorage`, `retention`, `protocolDelivery`. Six are
draft-required; `capability` is draft-optional; `encryption` never blocks a
draft, only gates the `"activation-ready"` overall outcome. This construction
-time readiness answers "could this draft ever activate", not "activate it
now" — it has no counterparty-Membership check, no pairwise-key-resolution
check, and is never re-evaluated as part of activation itself. This Arc adds
a **separate**, narrower Alpha 1117 readiness gate purpose-built for
activation, rather than overloading this one.

## 5. Current encryption-readiness adapter

`FedosConversationEncryptionReadinessAuthority` — one method,
`evaluateEncryptionReadiness(id) -> "ready"|"unavailable"|"unsupported"|"failed"`.
Default (and only shipped) implementation:
`UnavailableFedosConversationEncryptionReadinessAuthority`, always
`"unavailable"` — no WASM artifact exists in this checked-out tree
(`packages/fedos-core-rust/pkg/` absent; confirmed by direct filesystem
check), matching this file's own header ("no fallback crypto of any kind").
`cargo`/`wasm-bindgen` ARE present on this machine, but building the Rust/WASM
artifact changes no TypeScript behavior this Arc needs and is out of this
Arc's scope (no Rust file changes) — real crypto stays wired through the SAME
injection seam (`FedosConversationEncryptionAuthority`/`DecryptionAuthority`)
this codebase already established; `FedosWasmConversationEncryptionAuthority`/
`FedosWasmConversationDecryptionAuthority` already exist as the real
implementations, uninstantiated in the desktop runtime because
`FedosDesktopRuntimeConfig` never threads them through (see §9).

## 6. Current coordinator constructors

`FedosConversationEncryptionCoordinator`/`DecryptionCoordinator` (Alpha
943/946) are fully built, fully wired to real
`FedosConversationKeyResolver` (Alpha 935 — composes identity resolution,
counterparty resolution, account-index, counterparty-public-key resolution,
and Nostr-binding verification, all real, all reused unmodified) and real
`evaluateFedosConversationCryptoReadiness()` (Alpha 866, unmodified). The
encryption coordinator has a full crash-recoverable coordination log
(`prepared -> payload-persisted -> envelope-persisted`) already satisfying
Alpha 1131/1132/1166's "no duplicate send on retry" requirement with zero new
code. The decryption coordinator deliberately has no coordination log (no
durable write to recover). **Neither coordinator currently performs a
retention check** — `FedosPayloadRetentionAuthority` (Alpha 796) exists but
is wired into nothing in the Conversation Runtime; this Arc closes that gap
in the new read path, not by editing the frozen decryption coordinator.

## 7. Current runtime config fields

`FedosConversationRuntimeDependencies` already carries every Alpha 949 field
(`encryptionAuthority`, `decryptionAuthority`, `envelopePersistence`,
`payloadStorage`, `encryptionCoordinationPersistence`, `identityResolver`,
`accountIndexAuthority`, `nostrAuthorBindingAuthority`, id generators) as
optional fields with safe fail-closed defaults — but
`FedosDesktopRuntimeConfig`/`startFedosDesktopRuntime()` (the Local/Desktop
Runtime) **never thread any of them through**: the
`assembleFedosConversationRuntimeDependencies()` call in
`fedos_desktop_runtime.ts` only supplies the pre-existing Alpha 923/996/1003
fields. This is exactly Alpha 1113's stated gap, confirmed against real
source rather than assumed.

## 8. Current Envelope/payload persistence ownership

`FedosConversationMessageEnvelopePersistence` (metadata only) and
`FedosConversationPayloadStorage` (opaque ciphertext bytes, defensive-copy
reads) are separate ports, both already real, both already wired into
`FedosConversationRuntimeDependencies` with in-memory defaults. Both already
support `listConversationEnvelopes(id)`/`listConversationPayloads(id)` —
exactly what Alpha 1139's safe list-read-model needs, no new port method
required.

## 9. Current invitation/direct participant facts

`FedosConversationInvitationTransport` (Alpha 991–1050, freshly merged) gives
a real create/redeem/revoke path over the existing Capability boundary,
already wired into `FedosConversationRuntime`. A redeemed invitation admits
real, durable Membership via the existing Alpha 761–790 Membership Authority
— this Arc's activation coordinator consumes that Membership fact directly
(`findMembership`/`listMemberships`), inventing no parallel admission
concept.

## 10. Exact expected ripple scope

New, additive-only:
`src/conversation/activation/` (6 files),
`src/conversation/messaging/` (5 files).
Extended (narrow, mechanical, no signature removed/renamed):
`fedos_conversation_encryption_coordinator.ts` and
`fedos_conversation_decryption_coordinator.ts` (swap the `lifecycleState`
literal check for a shared `resolveFedosConversationActiveConversation()`
helper consulting the new Activation persistence — same outcome vocabulary,
same fail-closed default for every unmodified call path),
`fedos_conversation_runtime.ts` (four new methods:
`activateDirectConversation`/`sendDirectMessage`/`readDirectMessage`/
`listDirectMessages`, delegating to two new Coordinators exactly like every
existing method already does),
`fedos_conversation_runtime_assembly.ts` (new optional config fields +
backend construction, mirroring every existing field's own
append-only-or-in-memory pattern),
`fedos_desktop_runtime_config.ts`/`fedos_desktop_runtime.ts` (Alpha 1113 —
thread the encryption/activation/messaging config through, reuse the SAME
`nostrAuthorBindingAuthority` instance already on the config rather than a
second one). No public method signature is renamed or removed anywhere.
