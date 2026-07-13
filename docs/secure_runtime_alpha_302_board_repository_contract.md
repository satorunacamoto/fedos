# Secure Runtime Alpha 302 — Board Repository Contract

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/repository/fedos_board_repository.ts`.** Stage 2 of the
Alpha 301–310 Canonical Board Repository, Index & Feed Foundation Arc.

## 1. Why now

Alpha 301's own inventory confirmed no Board Repository exists anywhere
in this repository. This Stage fixes the smallest protocol-independent
repository contract the in-memory implementation (Alpha 303) and every
future implementation (including a future persistent one, Alpha 310 §5)
must satisfy.

## 2. The contract

```ts
export type FedosBoardRepositoryWriteResult =
  | "inserted"
  | "already-present"
  | "conflict";

export interface FedosBoardRepository {
  register(post: FedosBoardPost): FedosBoardRepositoryWriteResult;
  findPost(id: FedosBoardPostId): FedosBoardPost | null;
  listPosts(): readonly FedosBoardPost[];
}
```

## 3. `removePost` — reviewed and excluded from the first contract

This Arc's own instruction asks explicitly whether `removePost` belongs
in the first contract. **Excluded**, matching the instruction's own
preferred minimal contract (`register`/`findPost`/`listPosts` only).
Reasoning: `FedosBoardPost` is IMMUTABLE (Alpha 255) and a Canonical
Board Post's removal is not a simple container operation — it is a
MODERATION or FEDERATED-DELETION concern, and this repository's own
prior Arcs already fixed where that concern lives: `FedosBoardModerationRecord`
(Alpha 258), `FedosActivityPubMutationObservation` (Alpha 278), and
`FedosAtprotoRecordObservation` (Alpha 288) all deliberately keep
deletion/moderation SEPARATE from the canonical post container, never a
mutation of the post itself. Adding `removePost` to the Repository
CONTRACT now would either (a) do nothing useful (a bare container-level
delete, disconnected from any moderation/source-deletion reasoning,
inviting silent misuse) or (b) require designing the full
moderation-aware deletion semantics THIS Arc's own instruction places
out of scope ("moderation execution" is an Absolute Prohibition). The
contract stays minimal; a future Arc may add a SEPARATE,
moderation-aware removal boundary once that responsibility is actually
designed.

## 4. `FedosBoardRepositoryWriteResult` — no boolean that hides the reason

Per this Arc's own instruction, verbatim: "No boolean that hides the
reason." Three explicit, named outcomes:

- `"inserted"` — a genuinely new `id` was accepted.
- `"already-present"` — the same `id` was registered again with a
  STRUCTURALLY IDENTICAL post (idempotent re-registration — e.g. the
  same upstream content re-delivered by a Relay/Gateway).
- `"conflict"` — the same `id` was registered again with a DIFFERENT
  post. The ORIGINAL is preserved; the new one is rejected, fail closed.

This mirrors the discriminated-outcome discipline this whole series
already established for adapter mapping (`FedosBoardPost | null`) and
extends it to a THREE-way outcome, since a container write has a THIRD
meaningful case (idempotent re-write) a simple accept/reject boolean
cannot distinguish from a genuine conflict.

## 5. Structural equality — the rule `"already-present"` depends on

`fedosBoardPostsAreStructurallyEqual(a, b)` is exported alongside the
contract (not left implicit) because it is part of the CONTRACT's own
semantics — what `"already-present"` MEANS — not an implementation
detail of any one `FedosBoardRepository`. It compares all eight
`FedosBoardPost` fields directly (`id`, `boardId`, `threadId`,
`replyTo`, `body`, `createdAt`, and the `author`/`source` sub-objects
field-by-field) — a plain, explicit field comparison, not a generic
deep-equality utility, matching this repository's own preference for
minimal, direct logic over general-purpose helpers.

## 6. Requirements, confirmed by construction

- **Synchronous in-memory contract for this Arc** — no method returns a
  `Promise`.
- **No protocol-specific input** — every method's own parameter/return
  type is `FedosBoardPost`/`FedosBoardPostId`, never a Nostr/ActivityPub/
  AT Protocol/Session-shaped value.
- **No Storage dependency** — no import from `src/storage/`.
- **No network, no Desktop ownership, no Runtime ownership, no `p2p`
  dependency** — this file has zero imports beyond the Canonical Board
  Model's own types.
- **No mutable internal collection exposure** — the contract's own
  `listPosts` return type is `readonly FedosBoardPost[]`; no
  implementation may return a live, mutable reference to its own
  internal storage (enforced by convention here, verified for the
  concrete implementation at Alpha 303).
- **The repository never edits a `FedosBoardPost` in place** — there is
  no update/edit method of any kind in this contract; only
  `register`/`findPost`/`listPosts` exist.

## 7. See also

- `docs/secure_runtime_alpha_301_existing_board_repository_inventory.md`
- `docs/secure_runtime_alpha_255_canonical_board_post_model.md`
- `docs/secure_runtime_alpha_258_moderation_deletion_boundary.md`
- `docs/secure_runtime_alpha_303_in_memory_board_repository.md`
