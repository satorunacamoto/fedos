# Secure Runtime Alpha 5561–5640 — Phase A Reconciliation Report
## FedOS Direct Double Ratchet Conversation Runtime and NIP-17 Integration Arc

Run in a dedicated worktree (`C:\wt\direct-ratchet-nip17-integration`, branch
`arc/direct-ratchet-conversation-nip17-integration`), based on
`arc/direct-double-ratchet-cryptographic-core @ 080cb99` (the completed
Ratchet Cryptographic Core). No production edit preceded this report.

A second Arc (Signed Recipient Deletion Request Types, Validation, and
Durable State) is running concurrently in its own separate worktree/branch.
This report does not inspect, stage, or reference that worktree's
uncommitted files, and does not merge its branch.

## 1. Alpha range history and collision record

Two sibling branches previously both used **Alpha 5401–5480**:
`arc/direct-ratchet-state-sealed-persistence-foundation @ be1bc0d` ("Direct
Ratchet State and Sealed Persistence Foundation") and
`arc/local-deletion-capability-state-foundation @ b3b3a6d` /
`arc/signed-recipient-deletion-request-state-foundation @ b3b3a6d` (same
commit, two branch names — "Local Deletion Capability and Deletion-State
Foundation"). This is a pre-existing, already-documented collision; neither
commit is rewritten, amended, or renamed by this Arc.

The completed Ratchet Cryptographic Core Arc then used **Alpha 5481–5560**
(`080cb99`, this Arc's own base).

A full sweep of every branch tip's own top commit title (`git branch -a` +
`git log -1 --format=%s`, sorted numerically) found no branch anywhere
using an Alpha range at or above **5561**. Alpha labels are treated as
documentation labels only — ancestry was independently confirmed via
`git merge-base --is-ancestor`, never inferred from a label alone.

**This Arc claims Alpha 5561–5640** (the earliest genuinely-free
implementation range). Per the parallel-execution coordination, the
concurrent Signed Recipient Deletion Request Arc receives the immediately
following free range, **Alpha 5641–5720**, if and when it uses an Alpha
title — this report does not claim that range on its behalf and performs no
action in its worktree.

## 2. Ancestry of `080cb99` (this Arc's base)

`080cb99` (Ratchet Cryptographic Core) → `be1bc0d` (Ratchet State
Foundation) → `81d1d73` → `9ab4eac` (Alpha 5321–5400) → ... →
`8548845` ("FedOS Beta Canonical Composition", Alpha 5161–5240) →
`3482800` ("FedOS Desktop Beta 0.1 Integration and Acceptance Candidate",
Alpha 5061–5160) → ... → `master @ 3eb9ead` (Alpha 2581–2620; confirmed
`master` **is** an ancestor of `080cb99` via `git merge-base --is-ancestor
master 080cb99`).

`080cb99`'s own tree already contains (confirmed via `git merge-base
--is-ancestor <sha> 080cb99`):

- `22643e0` (`arc/nostr-identity-binding`)
- `71c938b` (`arc/nostr-private-direct-pairwise-fanout-delivery` — the
  **proprietary** `kind: 24700` Direct wire delivery, NOT NIP-17)
- `cb6a666` (`arc/device-trust-runtime-integration`, Alpha 2921–3000,
  "partial — Device authorization honestly stops at the cryptographic
  Device-key blocker")
- `68545db` (`arc/production-master-seed-runtime-activation-secure-unlock`)
- `dd7149f` (`arc/conversation-retention-payload-storage`)

`080cb99`'s own tree does **NOT** contain (confirmed absent by both
`git merge-base --is-ancestor` returning false and a direct `git ls-tree`
sweep for `nip17`/`rumor`/`seal`/`gift` under `src/`, which found zero real
wire-adapter files — only Master-Seed-sealing files unrelated to NIP-17
Seal, and doc references from an unrelated Group Pairwise Fanout review
inventory):

- `97e563b` / `cd5584b` / `100c231` (the real NIP-17 Rumor/Seal/Gift Wrap
  wire adapter lineage)
- `a64b1ac` (`nostr-private-wire-standardization`, the route-vocabulary
  ancestor of the above)
- `4672244` (`review/multi-device-device-trust-v1` — a separate, unmerged
  design review; `cb6a666` above is the real implementation this review
  recommended, already present)
- `d62090f` (`arc/nostr-secure-messaging-architecture-v1` — a docs-only
  consolidation, itself a sibling of `080cb99`'s own ancestor `3482800`,
  never merged into any lineage; see §3)

## 3. `d62090f` — read as a research input, not merged

`arc/nostr-secure-messaging-architecture-v1 @ d62090f`
(`docs/nostr_secure_messaging_architecture.md`) is a **specification,
docs-only** commit built directly on `3482800` (the same fork point
`080cb99` itself descends through). It is **not** an ancestor of `080cb99`
in the sense of adding files, but sits on the identical base commit, so its
findings apply directly to this Arc's own base. Read in full for this
report; its findings are treated as sourced fact, cited by section:

- §7.1/§7.2: `beta01 @ 3482800` ("the selected base" for that document,
  identical to this Arc's own base lineage) contains the proprietary
  `kind: 24700` Direct wire route but **not** the NIP-17 lineage, confirmed
  independently by this report's own `git ls-tree` sweep (§2 above).
- §7.3 (lineage table): the real `NostrNip17V1WireAdapter` (real crypto,
  reuses real NIP-44 wire crypto + real ephemeral signing) lives only on
  the unmerged NIP-17 chain, tip `100c231`; deferred items on that chain
  are a Group-inbound representation gap, a restart-cycle proof gap, and
  unbuilt mailbox/ephemeral (`kind 21059`) semantics — none of which block
  this Arc's own Direct-only scope.
- §20/§33: Device identity today is `FedosSyncDeviceBinding`'s
  `bound`/`unbound`/`revoked` three-state model plus a
  `"trusted_placeholder"` label — **no per-device key material exists
  anywhere**. `080cb99`'s own ancestor `cb6a666` (Alpha 2921–3000)
  independently confirms the identical finding in its own commit title
  ("Device authorization honestly stops at the cryptographic Device-key
  blocker") and adds a real, durable `FedosDeviceBindingV1` registry
  (`pending`/`trusted`/`revoked`/`unavailable`, no private key, no Master
  Seed). This is the real, accepted Device identity this Arc uses for
  Phase C — see §7 below.
- §39: NIP-17 itself does not provide forward secrecy; a ratchet changes
  only the key fed to NIP-44 underneath NIP-17's own unchanged Rumor/Seal/
  Gift Wrap framing — confirming this Arc's own Phase F instruction
  exactly.
- §42: "Today, this repository has no build that is both live and
  standards-interoperable at the same time" — the selected base's own
  gated Conversation Encryption Authority ("Track B") is explicitly **not**
  NIP-44-wire-compatible (`docs/nip44_wire_compatibility_gap.md`); only the
  unmerged NIP-17 lineage's own `NostrNip17V1WireAdapter` is real,
  vector-verified NIP-44/NIP-17/NIP-59 wire crypto. This is the direct
  reason this Arc must bring the NIP-17 lineage's own wire-adapter files
  forward rather than building atop Track B.
- §47: this document's own recommended next Arc was exactly the Double
  Ratchet review/implementation work now completed
  (`review/fedos-forward-secrecy-double-ratchet-v1 @ b34d608`, the
  Foundation Arc, and the Cryptographic Core Arc). This Arc is the natural
  continuation.

## 4. The NIP-17 lineage in detail

```
master (3eb9ead)
  └─ ... ─ 8c48c95 (Alpha 1471-1540, fork point) ─┐
                                                    │
        080cb99's own ancestry continues forward ──┘ (Beta/Desktop/Ratchet, Alpha 4700-5560)

  8c48c95
   └─ a64b1ac  (Alpha 1611-1690, "Nostr Private Wire Standardization and
   |            Transport Reconciliation" — closed route vocabulary
   |            fedos_private_wire_route.ts: "fedos-private-v1" |
   |            "nostr-nip17-v1" | "unsupported"; NIP-17 adapter exists but
   |            always reports itself unavailable at this point)
   └─ 97e563b  (Alpha 1761-1840, "NIP-17 Rumor Seal Gift Wrap Standard
   |            Delivery" — real NostrNip17V1WireAdapter, real crypto,
   |            still constructor-injectable only, not live-wired)
   └─ cd5584b  (Alpha 1841-1920, "NIP-17 Standard Transport Integration
   |            and Group Pairwise Delivery" — LIVE wiring: an optional
   |            `delivery.sendMailboxNip17` thunk fires immediately after
   |            `encryptionCoordinator.encrypt()` inside
   |            `sendDirectMessage()` itself; Direct in+out and Group
   |            outbound fan-out proven with real Rust/WASM crypto; Outbox
   |            gains an additive `schemaVersion: 2` record (route,
   |            recipientPublicKeyHex, already-signed native event) —
   |            "persist the exact signed Gift Wrap, replay verbatim" is
   |            this lineage's own adopted retry-safety answer, since
   |            plaintext is never retained for re-derivation)
   └─ 100c231  (Alpha 1981-2040, reconciliation-only tip — documents the
                Direct inbound flow, three dedup identities [outer Gift
                Wrap event id / inner Rumor id ("envelopeId", reused
                verbatim, NOT a NIP-01 hash) / local canonical envelopeId],
                and the accepted, un-fixed "Group inbound gap" [a Group
                fanout recipient reads via their own ordinary Direct
                Conversation, never a Group Message record — pre-existing
                by design, out of this Arc's own scope])
```

`review/private-group-crypto-v2 @ 5b55ed6` is the only branch found to
build further on `100c231`; it is an unrelated, unmerged Group-crypto
design review and is not a prerequisite for this Arc's own Direct-only
scope.

## 5. Merge-base / merge-tree analysis (`080cb99` × `100c231`)

`git merge-base 080cb99 100c231` → `8c48c95` (68 commits ahead on the
`080cb99` side since fork, 19 commits ahead on the `100c231` side — a
tractable divergence, not a multi-thousand-commit gulf).

A trial `git merge-tree --write-tree --name-only 080cb99 100c231` (run for
inspection only, then **aborted**, per this report's own "no merge before
the report exists" instruction) found exactly **7 real production-file
conflicts**, all mechanical-additive (both sides independently added new
material to the same shared file, never a semantic redesign of the same
concept):

| File | Conflict cause |
|---|---|
| `README.md` | both sides append their own newest-first status entry |
| `packages/fedos-core-rust/src/lib.rs` | both sides add new `SecretHandleKind`/`HkdfDomain` variants, accessors, and `#[wasm_bindgen]` structs |
| `src/conversation/runtime/fedos_conversation_runtime.ts` | both sides add new constructor wiring / public methods |
| `src/desktop/runtime/fedos_desktop_runtime.ts` | both sides add new runtime construction/wiring |
| `src/desktop/runtime/fedos_desktop_runtime_config.ts` | both sides add new config fields |
| `src/runtime/fedos_wasm_loader.ts` | both sides add new `attemptDevOnly*Call` boundary methods |
| `src/runtime/master_seed/fedos_wasm_master_seed_authority.ts` | both sides extend the same class; `100c231`'s own version predates this Arc's base's much later Master Seed Foundation maturity — the later, more complete side is authoritative, with only genuinely new capability (if any, none expected — NIP-17's own Master Seed usage is via the already-existing `resolveConversationKey()`-shaped call, unchanged) carried forward |

All other conflicts (in the hundreds) are the repository's own established
historical fixed-count test pattern (`pub fn` counts, `#[wasm_bindgen]`
counts, `HkdfDomain`/`SecretHandleKind` variant lists) — both sides
independently bulk-updated the same pinned assertions with different
correct values for their own lineage's own additions. These are resolved
mechanically, post-merge, by recomputing the correct combined value from
the actually-merged `lib.rs`/`fedos_wasm_loader.ts`, exactly as the
Foundation and Cryptographic Core Arcs already established as this
repository's own convention — never by blindly preferring one side.

**Six additive-only production directories/files** merge with zero
conflict (`git merge-tree` reports them without a CONFLICT marker,
confirmed by direct inspection): the entire
`src/conversation/delivery/nostr/nip17/` module (6 files:
`fedos_nip17_rumor.ts`, `fedos_nip59_seal.ts`, `fedos_nip59_gift_wrap.ts`,
`fedos_nostr_nip17_v1_wire_adapter.ts`,
`fedos_wasm_ephemeral_gift_wrap_signing_authority.ts`,
`fedos_nip17_inbound_import_coordinator.ts`), plus mechanical widenings to
`src/conversation/transport/*` (Outbox codec/persistence/scheduler/
publisher/signed-event-source gain the additive `schemaVersion: 2` union
member) and `src/conversation/messaging/*`
(`fedos_conversation_direct_messaging_coordinator.ts` gains the optional
`delivery` dependency; `fedos_conversation_direct_message_send_result.ts`
gains the optional `delivery` field).

## 6. Overlap classification (Phase A step 7)

| Category | Files |
|---|---|
| Mechanical additive | `src/conversation/transport/*` (Outbox V2 union), `src/conversation/messaging/*` (optional delivery dependency), the whole `nip17/` module |
| Historical fixed-count test | ~300+ `test/*.test.ts` files pinning `pub fn`/`#[wasm_bindgen]`/`HkdfDomain`/`SecretHandleKind` counts |
| Documentation-only | `docs/secure_runtime_alpha_433_*`, `_435_*`, `_437_*` (confirmed byte-identical between both branches — no actual conflict despite historical proximity), all `docs/secure_runtime_alpha_16xx_18xx_19xx_*` NIP-17-lineage-only docs (net-new, no overlap) |
| Semantic but compatible | `README.md` (both append; resolved by keeping both entries, newest-first) |
| Architecture conflict | **none found** — see §7 |

## 7. Architecture-conflict check (Phase A step 10 gate)

Checked explicitly, per this Arc's own binding instruction to stop and
document rather than invent a third parallel architecture if found
incompatible:

- **Conversation Runtime ownership**: both sides extend the SAME
  `FedosConversationRuntime` class additively (new constructor-injected
  dependencies / new public methods); neither redefines its existing
  public surface. **Compatible.**
- **Master Seed Authority ownership**: the NIP-17 lineage's own Master
  Seed usage for the Gift Wrap ephemeral signer and the inner NIP-44 layer
  is via the same `resolveConversationKey()`-shaped call already present
  and unchanged in `080cb99`'s own, later, more mature Master Seed
  Foundation. **Compatible** — no ownership redefinition needed.
- **Private Wire Adapter ownership**: the existing closed
  `FedosPrivateWireRouteRequest`/`FedosPrivateWireRoute` vocabulary
  (`"fedos-private-v1" | "nostr-nip17-v1" | "unsupported"`,
  `fedos_private_wire_route.ts`, frozen since Alpha 1613) is additive-
  extensible — this Arc adds `"nostr-nip17-v1-ratchet"` as a NEW value,
  never renaming or repurposing the existing two. **Compatible.**
- **Device identity**: both sides agree device identity is
  account-scoped-binding-only, no independent per-device key — neither
  side claims otherwise. **Compatible** — this Arc's own Phase C ratchet
  session identity provides the actual per-Device-pair cryptographic
  separation (via the ratchet's own DH keys), never assuming a per-device
  signing key that does not exist.
- **Secret persistence**: the NIP-17 lineage introduces no new sealed
  secret type; the Ratchet Foundation/Core Arcs' own sealed-persistence
  mechanism (`seal_direct_ratchet_secret`/`restore_direct_ratchet_secret`)
  is unaffected and unused by anything on the NIP-17 side. **Compatible.**

**No architecture conflict found.** This Arc proceeds with a real
prerequisite merge of `100c231` into
`arc/direct-ratchet-conversation-nip17-integration`, resolving the 7
production-file conflicts by combining both sides' additions (never
discarding either), and mechanically recomputing every historical
fixed-count test's pinned value against the truly-merged `lib.rs`/
`fedos_wasm_loader.ts`.

## 8. Selected integration base and plan

- **Base**: `080cb99` (already checked out as this branch's start point).
- **Prerequisite merge**: `100c231` (NIP-17 Rumor/Seal/Gift Wrap wire
  adapter lineage tip), merged in as one explicit merge commit before any
  new ratchet-integration code is written.
- **No other lineage requires a merge**: Device Trust (`cb6a666`), Master
  Seed activation (`68545db`), Retention (`dd7149f`) are already ancestors
  of `080cb99`. `review/multi-device-device-trust-v1 @ 4672244` and
  `arc/nostr-secure-messaging-architecture-v1 @ d62090f` are read-only
  research inputs (§2, §3), not merge candidates (both are docs-only or
  superseded by later, real implementation already in `080cb99`'s own
  ancestry).
- **New production work** (this Arc's own primary commit, after the
  merge): the canonical route vocabulary extension
  (`"nostr-nip17-v1-ratchet"`), Device-pair ratchet session resolution,
  the session-establishment boundary, outbound/inbound integration at the
  `sendDirectMessage()`/`receiveNip17Rumor()` seam the NIP-17 lineage
  already built, and the real vertical slice — per Phases B–Q of this
  Arc's own mission.
- **Next unused Alpha range**: **5561–5640** (this Arc). **5641–5720** is
  reserved for the concurrent Deletion Request Arc, if and when it adopts
  an Alpha title — not claimed or acted on here.
