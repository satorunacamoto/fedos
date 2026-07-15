# Secure Runtime Alpha 453 — Outbox↔Relay Entry Pairing Model

Stage 3 of the Alpha 451–460 Canonical Nostr Outbound Publisher
Foundation Arc. Decision only — no code changes.

## 1. Entry shape decision

`FedosNostrBoardPublishEntry { readonly intent: FedosBoardOutboxIntent;
readonly event: FedosNostrWireEvent }` — ADOPTED. Pairs Alpha 451 §2's
two caller-supplied inputs into one value, so `publishOne`/`publishBatch`
take a single, self-contained argument shape rather than two positional
parameters that could be mismatched by a caller.

Rejected: deriving `event` from `intent.postId` by reading a Board
Repository and signing on demand INSIDE the Publisher. Rejected because
(a) it would pull `FedosNostrSigningAuthority`/Master Seed Authority
dependencies into a "Transport only" component, directly contradicting
this Arc's own scope, and (b) Alpha 451 §2 already established the
Outbox has no signed-event field to derive from — signing must already
have happened upstream of this Publisher, by a caller this Arc does not
name or constrain.

## 2. Protocol-mismatch handling decision

`entry.intent.target.protocol !== "nostr"` — **fails closed to `false`,
never throws, never publishes.** A cross-protocol pairing (e.g., an
`activitypub`-targeted intent paired with a Nostr event) is a caller
error; this Publisher refuses to transport it silently down the wrong
pipe rather than either guessing or crashing. This mirrors
`createFedosBoardOutboxIntent`'s own "fails closed to `null`, never
throws" discipline (Alpha 414) applied to a runtime routing check
instead of a construction-time validation.

## 3. Interface/implementation naming decision

Mirrors `FedosNostrSigningAuthority`/`FedosWasmNostrSigningAuthority`'s
own exact relationship (`src/nostr/sign/`, Alpha 442/445): one file
names the CONTRACT (`FedosNostrBoardPublisher`, Alpha 455 — the exact
name and file path Alpha 448 already reserved at
`src/board/publish/nostr/fedos_nostr_board_publisher.ts`), a SEPARATE
file names the ONE real implementation (`FedosRelayNostrBoardPublisher`,
Alpha 456/457, named for its transport — a `FedosRelay` — the same way
`FedosWasmNostrSigningAuthority` is named for ITS transport, WASM).

Rejected: merging interface and implementation into one file (the stray
Alpha 473 file found at Alpha 451 §4 does this) — inconsistent with the
signing-authority precedent this Arc otherwise mirrors throughout.

## 4. Directory decision

`src/board/publish/nostr/` — a protocol-specific subdirectory under a
new, protocol-neutral `src/board/publish/` parent, mirroring
`FEDOS_BOARD_OUTBOUND_PROTOCOLS`'s own four-protocol list
(`fedos_board_outbox_types.ts`, Alpha 413): a future ActivityPub/AT
Protocol/Session Publisher Arc would add `publish/activitypub/`,
`publish/atproto/`, `publish/session/` siblings, never inside this
Arc's own `publish/nostr/` directory. No such sibling is created by
this Arc — ActivityPub/AT Protocol/Session are this Arc's own explicit
prohibitions.

## 5. See also

- `docs/secure_runtime_alpha_452_publisher_scope_and_return_contract_decision.md`
- `docs/secure_runtime_alpha_448_outbox_publisher_readiness_adapter.md`
- `docs/secure_runtime_alpha_445_typescript_nostr_signing_authority_adapter.md`
