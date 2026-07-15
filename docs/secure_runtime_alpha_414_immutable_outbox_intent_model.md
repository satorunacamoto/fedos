# Secure Runtime Alpha 414 — Immutable Outbox Intent Model

Stage 4 of the Alpha 411–420 Canonical Board Durable Outbox Foundation
Arc. Implements `createFedosBoardOutboxIntent` in
`src/board/outbox/fedos_board_outbox_types.ts`.

## 1. Shape

```ts
export interface FedosBoardOutboxIntent {
  readonly id: FedosBoardOutboxId;
  readonly postId: FedosBoardPostId;
  readonly target: FedosBoardOutboxTarget;
  readonly createdAt: number;
}
```

Every field is `readonly`; `createFedosBoardOutboxIntent` is the ONLY
constructor (mirroring `validateFedosBoardPost`'s own sole-constructor
discipline, Alpha 257) and `Object.freeze`s its result.

## 2. Required decision: provenance never determines outbound targets

**Decided, per this Arc's own required instruction: inbound provenance
NEVER automatically determines outbound publication.** Concretely:

- a Nostr-imported post (`source.protocol === "nostr"`) is never
  automatically republished to ActivityPub, AT Protocol, or Session;
- an ActivityPub-imported post is never automatically echoed to Nostr;
- Session-imported content — private by the product's own nature — is
  NEVER automatically published anywhere.

Enforced structurally, not just by convention: `createFedosBoardOutboxIntent(postId, target, createdAt)`
takes `target` as an explicit, required, caller-supplied parameter.
Nothing in `fedos_board_outbox_types.ts` reads `FedosBoardPost.source`,
imports `FedosBoardSourceReference`, or has any code path from a post's
own provenance to a target. The only caller of this function this Arc
(`FedosDesktopHost.submitPostWithOutbox`, Alpha 419) receives `targets`
as its own explicit second argument from ITS OWN caller — there is no
default-targets computation anywhere in this Arc.

## 3. What this record is NOT

- **Not a Board-body duplicate** — carries `postId` only, never `body`,
  `author`, `threadId`, or any other `FedosBoardPost` field.
- **Not author-secret data** — carries nothing key- or credential-shaped.
- **Not a protocol-native payload** — no Nostr `Event`, ActivityPub
  `Activity`, AT Protocol record, or Session message object.
- **Not a delivery result** — no status, no retry count, no attempt
  timestamp, no scheduling policy, no free-form attributes field.

## 4. See also

- `docs/secure_runtime_alpha_413_outbox_identifier_target_model.md`
- `docs/secure_runtime_alpha_257_board_validation_boundary.md`
- `docs/secure_runtime_alpha_415_outbox_state_observation_separation.md`
