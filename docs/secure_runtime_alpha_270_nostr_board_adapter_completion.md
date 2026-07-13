# Secure Runtime Alpha 270 — Nostr Canonical Board Adapter Completion

**Status: this Stage is REVIEW ONLY — it makes NO further code change
of any kind. This is Stage 10, the closing Stage, of the Alpha 261–270
Nostr Canonical Board Adapter Arc.**

## 1. Why now

Alpha 261 inventoried and tabulated every field; Alpha 262–265 fixed the
author/body/thread/source mapping decisions; Alpha 266 implemented
`fedos_board_nostr_adapter.ts`; Alpha 267–269 verified determinism,
boundary purity, and protocol neutrality by real execution. This Stage
issues the Arc's own closing Completion Declaration and freezes the
mapping.

## 2. The mapping, frozen

```
FedosValidatedNostrEvent                    FedosBoardPost
  id           ────────────────────────►    id
  id           ────────────────────────►    source.reference
  pubkey       ────────────────────────►    author.publicIdentifier
  created_at   ────────────────────────►    createdAt
  content      ────────────────────────►    body
  kind (== 1 only, else reject)             (not carried forward -- gate only)
  sig                                       (not carried forward -- consumed upstream)
  tags (NIP-10 e-tag resolution)  ────────► threadId, replyTo
  (caller-supplied)               ────────► boardId
  "nostr" (fixed)                 ────────► author.protocol, source.protocol
  null (fixed, this Arc)          ────────► author.identityId

        mapValidatedNostrEventToBoardPostInput()  ->  FedosBoardPostInput | null
                              |
                    validateFedosBoardPost()  (Alpha 257, unmodified)
                              |
                              v
                validateNostrBoardPost()  ->  FedosBoardPost | null

-- verified deterministic (Alpha 267), verified to touch no Relay/
   Runtime/Storage/GUI/Worker/Desktop state (Alpha 268), verified to
   produce a BoardPost indistinguishable in shape from what ActivityPub/
   AT Protocol/Session would produce (Alpha 269) --
```

Zero new Rust code, zero new Cargo dependency, zero new npm dependency —
`package.json`'s own `dependencies` count stays fixed at 2, unchanged
across this whole Arc.

## 3. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE. The first Protocol
Adapter now exists: `validateNostrBoardPost`
(`src/board/fedos_board_nostr_adapter.ts`) converts an already-verified
`FedosValidatedNostrEvent` into a `FedosBoardPost`, one-way only, using
exclusively the decisions this Arc's own Alpha 261–265 fixed — fail
closed, deterministic, and touching no Relay, Runtime, Storage, GUI,
Worker, or Desktop state.**

The following are now declared complete, exactly as this Arc's own
instruction requires:

- **Field mapping table** — Alpha 261, every field of all four reviewed
  types classified (exact match / renamed / protocol-specific /
  requires-explicit-policy).
- **Author mapping** — Alpha 262, `pubkey` → `publicIdentifier`
  verbatim hex, `identityId` fixed `null`, no display name derivation,
  no profile resolution, no relay access.
- **Body mapping** — Alpha 263, `content` → `body` verbatim, no
  Markdown/HTML/rendering/formatting, an honest named limitation for the
  10,000-character ceiling.
- **Thread mapping** — Alpha 264, NIP-10 resolution mirrored from
  `src/thread/thread.ts`'s own established precedent, scoped to kind `1`
  only, two deferred-boundary cases named explicitly rather than
  invented around.
- **Source reference** — Alpha 265, `event.id` as `source.reference`, no
  relay URL/connection state/transport metadata, `boardId` named as the
  one field with no Nostr-side source at all.
- **Adapter implementation** — Alpha 266, `validateNostrBoardPost` +
  `mapValidatedNostrEventToBoardPostInput`, fail-closed, one-way only,
  no mutation/storage/network.
- **Determinism** — Alpha 267, verified by real repeated calls: same
  input always produces a deeply-equal output; different event ids
  always produce different outputs.
- **Boundary purity** — Alpha 268, verified by import-list inspection:
  the adapter's only non-type-only dependency is the Board model's own
  validation boundary.
- **Protocol neutrality** — Alpha 269, verified by real construction:
  the resulting `FedosBoardPost` carries no Nostr-specific key, only the
  expected `"nostr"` data value in two provenance fields.

## 4. Still out of scope (verbatim from this Arc's own instruction,
confirmed by direct inspection)

- ActivityPub, AT Protocol, and Session adapters — no file in
  `src/board/` maps any of those three; Alpha 269 §4 only confirms they
  REMAIN producible, not that they now exist.
- Relay Pool, Relay changes of any kind — `src/desktop/fedos_relay.ts`/
  `websocket_relay.ts` carry zero reference to `src/board/`.
- Runtime/AppRuntime changes — `src/runtime/*` is byte-for-byte
  unchanged; the adapter is never wired into `createRuntime()`.
- Storage — no `src/board/` file imports `src/storage/`.
- GUI — `src/render/*` is untouched.
- Worker — `src/worker.ts` is byte-for-byte unchanged.
- Subscription-to-board wiring (deciding which `boardId` a live
  subscription's events should map to) — `boardId` remains a required,
  caller-supplied parameter (Alpha 265 §4); no subscription/Relay code
  calls `validateNostrBoardPost` anywhere in this repository.

## 5. Next Arc recommendation

**Secure Runtime Alpha 271–280: ActivityPub Canonical Board Adapter
Arc.**

Reason: this Arc's own required recommendation, verbatim. With Nostr now
serving as the REFERENCE adapter (Alpha 266–269 fixed the two-step
`map<Protocol>EventToBoardPostInput` → `validateFedosBoardPost` pattern
and confirmed it generalizes, Alpha 269 §4), the next protocol in this
Arc's own original four-entry-path list (Alpha 251–260 §"Core
Direction") is ActivityPub — the same order Alpha 259's prior fixture
work already established (Nostr, then ActivityPub, then AT Protocol,
then Session).

## 6. What this Stage does NOT do

- Does **not** modify `fedos_board_nostr_adapter.ts` or any other
  `src/board/` file beyond what Alpha 266 already landed — no further
  production code change.
- Does **not** implement an ActivityPub/AT Protocol/Session adapter, a
  Relay Pool, storage, or a GUI.
- Does **not** modify `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`,
  `src/runtime/*`, `src/desktop/*`, `src/identity/*`, `src/worker.ts`,
  Storage, Observation, Relay transport, or Nostr validation.

## 7. See also

- `docs/secure_runtime_alpha_269_nostr_adapter_protocol_neutrality_review.md`
- `docs/secure_runtime_alpha_268_nostr_adapter_boundary_review.md`
- `docs/secure_runtime_alpha_267_nostr_adapter_determinism.md`
- `docs/secure_runtime_alpha_266_nostr_board_adapter_implementation.md`
- `docs/secure_runtime_alpha_265_nostr_source_reference.md`
- `docs/secure_runtime_alpha_264_nostr_thread_mapping.md`
- `docs/secure_runtime_alpha_263_nostr_body_mapping.md`
- `docs/secure_runtime_alpha_262_nostr_author_mapping.md`
- `docs/secure_runtime_alpha_261_nostr_board_field_inventory.md`
- `docs/secure_runtime_alpha_260_canonical_board_model_completion.md`
