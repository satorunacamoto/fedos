# Secure Runtime Alpha 304 — Board Source Provenance Deduplication Index

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/repository/fedos_board_source_index.ts`.** Stage 4 of the
Alpha 301–310 Canonical Board Repository, Index & Feed Foundation Arc.

## 1. Why now

Alpha 301 §3.8 confirmed the identity RULE (`fedosBoardSourceKey`,
Alpha 253) already exists but nothing INDEXES by it yet. A Relay,
Gateway, or upstream normalizer may redeliver the same upstream object
more than once (a Nostr relay re-broadcasting an event it already sent;
a Session Gateway replaying a message); this Stage recognizes that case
BEFORE it ever reaches the `FedosBoardPostId`-keyed Repository (Alpha
303), which has no visibility into provenance at all.

## 2. The shape

```ts
export type FedosBoardSourceIndexWriteResult = "inserted" | "already-present" | "conflict";

export class FedosBoardSourceIndex {
  register(post: FedosBoardPost): FedosBoardSourceIndexWriteResult;
  findBySource(source: FedosBoardSourceReference): FedosBoardPostId | null;
}
```

Keyed internally by `fedosBoardSourceKey(post.source)`
(`../fedos_board_source.js`, Alpha 253) — REUSED directly, unmodified,
exactly as this Arc's own instruction requires ("Reuse the existing
`fedosBoardSourceKey()` helper if present and honest" — Alpha 301 §3.8
already confirmed it is both).

## 3. Required behavior, confirmed field by field

- **Same source → same post ID: idempotent.** Registering a post whose
  `source` already maps to that SAME `post.id` returns
  `"already-present"` — no mutation.
- **Same source → different post ID: conflict.** Registering a
  DIFFERENT post whose `source` maps to an ALREADY-INDEXED but
  DIFFERENT `post.id` returns `"conflict"` — the original mapping is
  preserved, fail closed.
- **Different source → independent.** Two posts with different
  `source` values never interact with each other's entries.
- **No automatic merge** — a conflict is reported, never silently
  resolved by picking one side.
- **No post mutation** — this index stores only `FedosBoardPostId`
  values, never a `FedosBoardPost` reference; there is nothing here TO
  mutate a post through.
- **No protocol parsing** — `fedosBoardSourceKey` itself performs none
  (Alpha 253, unmodified); this file adds no parsing of its own.
- **No network, no storage** — confirmed structurally: no `import` from
  `src/storage/`, no `fetch`, no async function anywhere in this file.

## 4. Repository ID conflict and Source provenance conflict are
SEPARATE facts — not collapsed into one boolean

Per this Arc's own instruction, verbatim. `FedosBoardRepositoryWriteResult`
(Alpha 302) and `FedosBoardSourceIndexWriteResult` are two INDEPENDENT
three-way unions, checked at two INDEPENDENT points by the coordinating
service (`FedosBoardService`, Alpha 307): a post can conflict on ID
without conflicting on source (two different posts happening to share
an accidental id collision, from different upstream objects), or
conflict on source without conflicting on ID (the same upstream object
mistakenly mapped to two different `FedosBoardPostId` values by a buggy
adapter invocation) — Alpha 307's own discriminated
`FedosBoardRegistrationResult` names these as `"post-id-conflict"` and
`"source-conflict"` respectively, never merged into a single
`"conflict"` boolean at the service layer either.

## 5. See also

- `docs/secure_runtime_alpha_301_existing_board_repository_inventory.md`
- `docs/secure_runtime_alpha_253_board_source_provenance.md`
- `docs/secure_runtime_alpha_302_board_repository_contract.md`
- `docs/secure_runtime_alpha_307_board_application_service.md`
