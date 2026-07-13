# Secure Runtime Alpha 261 — Nostr Board Field Inventory

**Status: this Stage is REVIEW ONLY — it makes NO production code
change.** Stage 1 of the Alpha 261–270 Nostr Canonical Board Adapter
Arc. Reviews every field of `FedosValidatedNostrEvent`, `FedosBoardPost`,
`FedosBoardAuthorReference`, and `FedosBoardSourceReference`, and
produces the complete field mapping table this Arc's later Stages
implement against.

## 1. Why now

Alpha 251–260 froze the Canonical Board Model as the Single Source of
Truth and recommended exactly this Arc next: the Nostr Canonical Board
Adapter, because Nostr is "the first implemented and validated protocol
path" (Alpha 260 §5). This Stage inspects both sides of the mapping in
full before any adapter code is written.

## 2. The four types, reviewed in full

- `FedosValidatedNostrEvent` (`src/desktop/fedos_validated_nostr_event.ts`,
  Alpha 242) — seven fields, verbatim NIP-01 wire names: `id`, `pubkey`,
  `created_at`, `kind`, `tags`, `content`, `sig`.
- `FedosBoardPost` (`src/board/fedos_board_post.ts`, Alpha 255) — eight
  fields: `id`, `boardId`, `threadId`, `replyTo`, `author`, `body`,
  `createdAt`, `source`.
- `FedosBoardAuthorReference` (`src/board/fedos_board_author.ts`, Alpha
  254) — three fields: `identityId`, `protocol`, `publicIdentifier`.
- `FedosBoardSourceReference` (`src/board/fedos_board_source.ts`, Alpha
  253) — two fields: `protocol`, `reference`.

## 3. Complete field mapping table

| `FedosValidatedNostrEvent` field | Maps to | Classification | Notes |
| --- | --- | --- | --- |
| `id` | `FedosBoardPost.id`, `FedosBoardSourceReference.reference` | Renamed + reused | Same hex string used twice: as the FedOS-side application id (Alpha 252's "Option C" permits an adapter to choose the source reference itself as the application id, given no independent ID-minting facility exists) AND as the provenance reference. See Alpha 265. |
| `pubkey` | `FedosBoardAuthorReference.publicIdentifier` | Renamed, exact value | Verbatim hex passthrough — no npub/bech32 re-encoding. See Alpha 262. |
| `created_at` | `FedosBoardPost.createdAt` | Renamed field, exact value | Both already Unix seconds (Alpha 251 §3.7 confirmed this convention) — a pure field-name rename, `snake_case` → `camelCase`, no unit conversion. |
| `kind` | *(not carried forward)* | Protocol-specific, gate-only | Used ONLY to accept/reject the event (kind `1` only — see Alpha 264 §1); never appears on `FedosBoardPost`, matching Alpha 255's "no transport object embedded" guardrail. |
| `tags` | `FedosBoardPost.threadId` / `.replyTo` (derived) | Protocol-specific, interpreted not embedded | NIP-10 `e`-tag root/reply markers are RESOLVED into two plain identifiers; the raw tag array itself never crosses into the Canonical Board Model (Alpha 259 §3 already confirmed this same rule for the fixture mapping this Arc now makes real). See Alpha 264. |
| `content` | `FedosBoardPost.body` | Renamed, exact value | Verbatim string passthrough, no transformation. See Alpha 263. |
| `sig` | *(not carried forward)* | Protocol-specific, consumed upstream | The cryptographic signature already did its job — `FedosValidatedNostrEvent`'s very existence proves it verified (Alpha 242/244/245). It is public, not secret, but carries no Board-model meaning; forwarding it would violate "no transport object embedded" for no benefit. |
| *(none — Nostr has no concept of this)* | `FedosBoardPost.boardId` | **Field requiring explicit policy** | Nostr events carry no "which local board" concept. `boardId` is supplied by the CALLER (whatever code decided a subscription's incoming events belong to a given board), never derived from `event`. See Alpha 265 §3. |
| *(none — Nostr has no local identity concept)* | `FedosBoardAuthorReference.identityId` | **Field requiring explicit policy, resolved to a fixed value** | Always `null` this Arc — no local-identity-linking logic exists or is built here. See Alpha 262 §3. |
| *(fixed constant)* | `FedosBoardAuthorReference.protocol`, `FedosBoardSourceReference.protocol` | Fixed | Always the literal `"nostr"` — this adapter's own protocol identity, never read from `event`. |

## 4. Classification summary

- **Exact matches** (same meaning, same value, field renamed only):
  `created_at` → `createdAt`, `content` → `body`, `pubkey` →
  `publicIdentifier`.
- **Reused as two different Board-model fields**: `id` → both
  `FedosBoardPost.id` and `FedosBoardSourceReference.reference`.
- **Protocol-specific, interpreted not embedded**: `tags` (consumed to
  derive `threadId`/`replyTo`, never stored raw).
- **Protocol-specific, gate-only, not carried forward**: `kind`.
- **Protocol-specific, consumed upstream, not carried forward**: `sig`.
- **Fields requiring explicit policy** (no Nostr-side source at all):
  `boardId` (caller-supplied), `identityId` (fixed `null` this Arc).
- **Fixed constants, not read from `event`**: `author.protocol`,
  `source.protocol` (both always `"nostr"`).

## 5. What this Stage does NOT do

No code is added or modified. This table is the fixed reference every
later Stage (262–266) implements against; a later Stage that deviates
from this table without a documented reason would be a regression, not a
refinement.

## 6. See also

- `docs/secure_runtime_alpha_260_canonical_board_model_completion.md`
- `docs/secure_runtime_alpha_259_protocol_neutrality_verification.md`
- `docs/secure_runtime_alpha_255_canonical_board_post_model.md`
- `docs/secure_runtime_alpha_242_validated_nostr_event_model.md`
