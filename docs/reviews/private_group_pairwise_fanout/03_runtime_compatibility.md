# Review 03 — Current FedOS Conversation Runtime Compatibility

## The single most important fact this review is built on

As of this review's own base commit (`d8f01cf`, Alpha 1111–1180,
"Private Conversation Activation and Direct Messaging Runtime Arc"),
**Direct-mode private messaging is genuinely real, end to end**:
`FedosConversationRuntime.activateDirectConversation()` →
`sendDirectMessage()`/`readDirectMessage()`/`listDirectMessages()`
verified through the real `startFedosDesktopRuntime()` entry point,
surviving a full restart, with tamper-evidence and retention
enforcement (`docs/secure_runtime_alpha_1111_1180_completion_declaration.md`,
§8). Production crypto (a compiled WASM artifact) remains unbuilt —
every test uses injected Fake Encryption/Decryption Authorities — but
the **architecture** is proven, not aspirational, for exactly one
shape: two participants, pairwise ECDH, Nostr-keyed counterparty.

## Private-group is explicitly, permanently rejected at activation — the load-bearing constraint for this entire review

`FedosConversationDirectActivationCoordinator.activateDirectConversation()`
(`src/conversation/activation/fedos_conversation_direct_activation_coordinator.ts:99-102`),
quoted verbatim:

```ts
// Step 2 -- verify direct mode. Alpha 1123's own Private-Group Gate:
// never activate, never invent a group/shared key, no message API
// ever becomes reachable for a private-group draft.
if (draft.mode !== "direct") return { outcome: "unsupported-mode" };
```

This is not an oversight or a gap awaiting a future patch — it is a
named, deliberate gate ("Alpha 1123's own Private-Group Gate"). A
`private-group` Conversation can be constructed as a draft today
(Alpha 891–930, unchanged), can hold Membership/Capability/Invitation
state (Alpha 761–1050, unchanged), but **can never reach `"active"`,
and therefore can never send or read a message through
`FedosConversationRuntime`'s own message API** — confirmed
independently by the completion declaration's own §9: "a private-group
draft never activates (`"unsupported-mode"`) and never gains a message
API."

## What this review's own recommendation (`04`) must therefore respect

Any pairwise-fanout design for `private-group` Conversations **cannot**
be "widen the existing Activation Coordinator's mode check" — this
review's own instruction ("do not redesign Conversation Runtime")
independently forbids exactly that, and the codebase's own naming
("Private-Group Gate," singular, deliberate) signals it is a reviewed
boundary, not an accident. The only compatible shape is **additive**:
a NEW orchestration layer that composes the EXISTING, unmodified
Direct-mode pipeline (Activation Coordinator, Encryption/Decryption
Coordinators, Messaging Coordinator) multiple times — once per member
pair — never a change to any of those files, and never a private-group
draft that itself activates. `04` specifies this precisely.

## What is real and directly reusable, restated as an inventory for `04`–`10`

| Component | Status | File |
|---|---|---|
| Direct draft construction | Real, unchanged | `src/conversation/construction/fedos_private_conversation_construction_coordinator.ts` |
| Membership (admit/revoke/leave) | Real, unchanged | `src/conversation/membership/` |
| Direct activation | Real (Fake-crypto-verified) | `fedos_conversation_direct_activation_coordinator.ts` |
| Encryption/Decryption Coordinators | Real, unchanged since the prior review | `src/conversation/encryption/fedos_conversation_{en,de}cryption_coordinator.ts` |
| Send/Read/List message API | Real (Fake-crypto-verified) | `src/conversation/messaging/fedos_conversation_direct_messaging_coordinator.ts` |
| Retention-on-read | Real, newly wired at the application layer this Arc | Same file, `readDirectMessage()` |
| Protocol delivery (any transport) | **Still does not exist** | Confirmed unchanged, `11`/`13` |

## See also

- `04_pairwise_fanout_architecture.md`
- `docs/secure_runtime_alpha_1111_1180_completion_declaration.md`,
  `docs/secure_runtime_alpha_1111_1180_integrated_inventory.md`
- `docs/reviews/private_protocol_delivery_group_v1/14_group_crypto_inventory.md`
  (this review's own direct predecessor's finding, now reconfirmed
  against a materially more advanced base)
