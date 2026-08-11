# FedOS Messenger — Migration Staging Order

Status: proposal only, for the follow-up arc that performs the physical
`git mv` sequence described in
`docs/architecture/MESSENGER-MIGRATION-MAPPING.md`. Nothing in this arc
moved a file — this document exists so that arc can start immediately with
zero open ordering questions.

## Per-stage process (repeat for every stage below)

1. **Move** — `git mv` every file in the stage's file set from its old path
   to its new path (per the mapping doc — mechanical, no judgment calls).
2. **Leave a shim at the old path** — a thin re-export file
   (`export * from "<new path>.js";` plus, for a default export, an
   explicit named re-export) at the OLD filename, so any not-yet-updated
   importer elsewhere in the repo keeps resolving and compiling. This is
   what makes each stage independently shippable rather than an
   all-or-nothing 764-file cutover.
3. **Typecheck** — `npm run typecheck:core` (`tsc --noEmit`, `src`+`test`
   scope) and, once anything in a given stage is packaging-relevant,
   `npm run typecheck:electron`. Compare the error COUNT and the FULL list
   against the last known-good baseline, not just the count (a new error
   hiding behind a fixed one is invisible to a raw count diff).
4. **Targeted tests** — run the `vitest` suites that cover the moved
   subtree (file-name grep on the stage's own topic, e.g. `-t` or a path
   filter) plus the two boundary tests
   (`test/architecture_boundary_messenger.test.ts`,
   `test/architecture_boundary_adapter_port_shapes.test.ts`) every stage,
   since both walk `src/os/messenger/**` and would catch an accidental
   commerce import or a broken adapter relative path immediately.
5. **Packaging audit** — check whether any file the stage just moved is
   referenced by LITERAL path in `tsconfig.beta-runtime.json`,
   `tsconfig.runtime.json`, `tsconfig.unlock-runtime.json`,
   `tsconfig.host-bridge.json`, `tsconfig.settings-host-bridge.json`,
   `packages/fedos-desktop-electron-spike/scripts/copy_static_assets.mjs`,
   or `packages/fedos-desktop-electron-spike/electron_builder.beta.config.json`.
   If yes, update that literal path in the SAME commit as the move — do not
   rely on the shim from step 2 to carry a build config forward
   indefinitely; a shim is a compatibility bridge for callers, not a
   substitute for the build's own canonical file list.

The prompt that started this arc named `tsconfig.beta-runtime.json`
specifically as one of the three files to check. This document also checked
`tsconfig.runtime.json`, `tsconfig.unlock-runtime.json`,
`tsconfig.host-bridge.json`, and `tsconfig.settings-host-bridge.json` — four
sibling root tsconfigs with the IDENTICAL literal-`include`-list risk,
found while reading `package.json`'s own `build:*` scripts. All five are
covered below. `copy_static_assets.mjs` and `electron_builder.beta.config.json`
were also checked directly: neither references any file under
`src/conversation/`, `src/board/`, `src/desktop/`, `src/device/`, or
`src/nostr/` by literal path — `copy_static_assets.mjs` only copies HTML
pages that live inside `packages/fedos-desktop-electron-spike/src/` itself
(a sibling package, out of this migration's scope entirely), and
`electron_builder.beta.config.json` references build OUTPUT
(`dist/...`, `../../dist`), never a `src/...` source path. **Neither needs
any update at any stage of this migration.**

## Measured external fan-in (the ordering signal)

`grep -rlE "from ['\"](\.\./)+<bucket>/" src test packages --include="*.ts"`,
counting files OUTSIDE the bucket itself that import something from it —
i.e. how many call sites a shim at the old path is standing in for. Lower
means a smaller, easier-to-verify blast radius for that stage.

| Current source dir | External importers | Becomes (primary target) |
|---|---:|---|
| `src/conversation/` (minus `delivery/nostr/`, `transport/`) | 41 | `conversations/` |
| `src/board/` | 45 | `board/` |
| `src/desktop/` (minus `notification/`) | 46 | `desktop/` |
| `src/device/` | 66 | `device/` |
| `src/nostr/` | 68 | `adapters/nostr/protocol/` |
| `src/desktop/notification/` (subset of the 46 above) | 20 | `notifications/` |
| `src/conversation/transport/` (subset of the 41 above) | 12 | `adapters/nostr/transport/` |
| `src/conversation/delivery/nostr/` (subset of the 41 above) | 14 | `adapters/nostr/conversation_delivery/` |

`desktop` is deliberately NOT placed by this table's own ranking (46 would
put it in the middle) — see "Why desktop is last regardless of its fan-in
number" below.

## Stage order

### Stage 1 — `conversations/` (377 files; fan-in 41, the lowest measured)

The largest single bucket by file count, but the smallest external blast
radius: only 41 files anywhere in the repo import something from
`src/conversation/` today (excluding the `delivery/nostr/`/`transport/`
subtrees carved out to Stage 4). Moving it first means every later stage
that also happens to import `conversations/**` (board does not; device does
not; desktop's `beta`/`onboarding`/`presentation` layers do, e.g.
`fedos_conversation_creator_identity_authority.ts`) already sees the final,
settled path.

**377 files is too large for one atomic commit.** Recommended internal
batching (still all "Stage 1", executed as an ordered sequence of smaller
commits, each independently typecheck-clean): foundational leaf types and
persistence first, feature coordinators last — mirrors the codebase's own
existing internal dependency direction (higher-level coordinators import
the lower-level pieces, never the reverse):

1. `fedos_conversation_id.ts`, `fedos_conversation_record*.ts`,
   `membership/`, `envelope/`, `payload_storage/`, `persistence/` — no
   dependencies on anything else in this bucket besides each other and
   `board/` (see the note on `conversations/` → `board/` coupling below).
2. `capability/`, `construction/`, `activation/`, `readiness/` — build on
   batch 1.
3. `encryption/` (including `encryption/identity/` — moves WITH
   `conversations/`, not to a separate `contacts/` bucket; see the mapping
   doc's "The `contacts/` decision") — builds on batches 1–2.
4. `messaging/`, `group/`, `ratchet/` (+ `ratchet_persistence`/
   `peer_capability` if present under that name at execution time) — the
   send/receive/pairwise-fanout layer; builds on batches 1–3. Note:
   `messaging/fedos_conversation_direct_messaging_coordinator.ts` imports
   `../delivery/nostr/nip17/fedos_direct_conversation_plain_message_payload.js`
   — that import still resolves correctly (longer relative path to the
   still-current `src/conversation/delivery/nostr/` location) since Stage 4
   hasn't run yet; no shim needed for this direction.
5. `archive/` (+ `archive_cli/`), `retention/`, `deletion/`,
   `deletion_request/`, `identity_transition/` (+ `peer_integration/`),
   `invitation/` (+ `invitation_bootstrap/`), `search/` — the outermost,
   most feature-layered subtrees; builds on all of the above.

**Cross-bucket coupling to be aware of, not blocked by:** `conversations/`
imports `board/` types directly today (`FedosBoardReader`, `FedosBoardId`,
etc. — part of the measured 41). Both stay inside `os/messenger`, so this
is not a boundary violation, but it means Stage 1 files will import `board/`
via a relative path to the STILL-CURRENT `src/board/` location (Stage 2
hasn't run yet) — same "longer path to an unmoved sibling" pattern as the
`delivery/nostr` note above, not a shim.

**Packaging audit:** `src/conversation/construction/fedos_conversation_creator_identity_authority.ts`
is pinned by literal path in BOTH `tsconfig.beta-runtime.json` and
`tsconfig.runtime.json`. Update both `include` arrays to
`src/os/messenger/conversations/construction/fedos_conversation_creator_identity_authority.ts`
in the same commit that moves this one file (it can move in batch 2 above
without waiting for the rest of the bucket).

### Stage 2 — `board/` (85 files; fan-in 45)

Self-contained federated/social posting. Nothing in `device/`, `nostr/`, or
`desktop/notification/` depends on it (per the measured fan-in, its 45
external importers are concentrated in `conversations/`, already moved in
Stage 1, plus a handful of `desktop/` presentation files). No internal
sub-batching proposed — 85 files with a real existing subdirectory split
(`activitypub/`, `atproto/`, `observation/`, `outbox/`, `persistence/`,
`publish/`, `query/`, `repository/`, `runtime/`, `session/`) is a reasonable
single-commit size, but split if CI/review size limits require it, in the
same "foundational persistence/repository first, `runtime/`+`publish/`
last" spirit as Stage 1.

**Packaging audit:** none of the 31 tsconfig-pinned files fall under
`src/board/`. No tsconfig update needed at this stage.

### Stage 3 — `device/` (88 files; fan-in 66)

Device identity/pairing/sync. Higher fan-in than `board/` — more of the
rest of the (still largely unmoved-at-this-point) codebase reaches into it,
concentrated in `desktop/` (Device Pairing UI, sync presentation wiring)
and, to a lesser extent, `conversations/ratchet/` (device-pair resolution
for the Ratchet session — already moved in Stage 1, so this direction is
already settled by the time Stage 3 runs). Internal batching: `crypto/`,
`persistence/`, `sync_events/` first (foundational); `binding_challenge/`,
`relay_sync/`, `sync_package/`, `sync_scheduler/`, `sync_session/`,
`transfer/`, `runtime/` after.

**Packaging audit:** `src/device/sync_events/fedos_device_sync_event_bridge.ts`
is pinned by literal path in BOTH `tsconfig.beta-runtime.json` and
`tsconfig.runtime.json`. Update both `include` arrays to
`src/os/messenger/device/sync_events/fedos_device_sync_event_bridge.ts` in
the same commit that moves this file.

### Stage 4 — `adapters/nostr/` (57 files: `src/nostr/` 12 + `delivery/nostr/` 24 + `transport/` 21; fan-in 68 for `src/nostr/` alone, the highest of the five current source dirs)

A three-way merge (see the mapping doc's own subfolder split rationale:
`protocol/`, `conversation_delivery/`, `transport/`) placed here — after
`conversations/`, `board/`, and `device/` have each already proven the
move → shim → typecheck → test → packaging-audit cycle at least once, and
right before the highest-risk `desktop/` stage — specifically BECAUSE
`src/nostr/` carries the highest measured external fan-in (68) of any of
the five current source directories: more of the rest of the codebase
depends on these low-level protocol types (`NostrEvent`, signing, relay)
than on anything else being moved, including two files OUTSIDE messenger
entirely (`src/commerce/bridge.ts`, `src/commerce/classify.ts` — see
"Pre-existing boundary note" below). Doing the widest-blast-radius move
after three successful dry runs, rather than first, is the more
conservative reading of "lowest fan-in first" when one candidate is both
"smallest by file count" and "highest by fan-in" at once — file count and
fan-in diverge here, and this document treats measured fan-in as the
authoritative signal per this arc's own instructions.

Internal order within the stage: `src/nostr/` (protocol primitives — the
one every other Nostr-touching file depends on, incl. the other two
subtrees in this same stage) first, then `delivery/nostr/` (which imports
`../../../nostr/` types), then `transport/` (which imports both).

**Pre-existing boundary note (not fixed by this migration, must not be
forgotten by it):** `src/commerce/bridge.ts` and `src/commerce/classify.ts`
already import `NostrEvent` from `src/nostr/types.ts` today — a real,
currently-live commerce → messenger dependency that predates this arc. A
shim at `src/nostr/types.ts` re-exporting from
`src/os/messenger/adapters/nostr/protocol/types.ts` keeps those two
commerce files compiling through this stage without modification, but it
does NOT fix the underlying boundary violation — `test/architecture_boundary_commerce.test.ts`
(a concurrent agent's own commerce-side boundary test) does not currently
check for this direction (commerce → messenger), only messenger → commerce
and Telegram/BTCPay SDK leakage, so this violation is not caught by any
automated test today. Flagged here for the Coordinator to route to whoever
owns `src/commerce/`: the real fix is either (a) `os/core` grows a
protocol-neutral event-shape type commerce depends on instead, or (b)
commerce consumes Nostr event data through a Port. Out of scope for this
migration-staging document to resolve, but the shim must not be treated as
"resolved."

**Packaging audit:** none of the 31 tsconfig-pinned files fall under
`src/nostr/`, `src/conversation/delivery/nostr/`, or
`src/conversation/transport/`. No tsconfig update needed at this stage.

### Stage 5 — `notifications/` (3 files; fan-in 20, a small subset of `desktop/`'s 46)

`src/desktop/notification/` peeled off `desktop/` and moved on its own,
before the rest of `desktop/`, for two reasons: it is small and
self-contained (3 files, and — per `src/os/messenger/adapters/notification_port_adapter.ts`,
already built in this arc — the coordinator's own dependency surface is
just its own Port, `fedos_desktop_notification_port.ts`, no persistence, no
crypto, no transport), and moving it separately proves the "peel one
subtree out of the still-mostly-unmoved `desktop/` composition layer"
pattern at low risk before attempting the rest of that (much larger,
much-more-referenced) directory in Stage 6.

**Packaging audit:** `src/desktop/notification/fedos_desktop_notification_coordinator.ts`
is pinned by literal path in BOTH `tsconfig.beta-runtime.json` and
`tsconfig.runtime.json`. Update both `include` arrays to
`src/os/messenger/notifications/fedos_desktop_notification_coordinator.ts`
in the same commit.

### Stage 6 — `desktop/` (154 remaining files; fan-in 46 — LAST regardless of that number)

## Why `desktop/` is last regardless of its fan-in

46 external importers is not the highest number measured (`device/`'s 66
and `nostr/`'s 68 both exceed it) — a strict fan-in-only ordering would put
`desktop/` third, not last. It is placed last anyway because raw import
fan-in undercounts its real risk on three specific axes none of the other
four subtrees share:

1. **It is the ONE composition/assembly point.** `desktop/runtime/` wires
   every other domain together (`host_boundary/` — `FedosDesktopHostPort`,
   already a framework-neutral seam — plus `shell/`, `presentation/`,
   `renderer/`, `production_activation/`, `onboarding/`, `settings/`,
   `background/`, `badge/`, `tray/`). A subtle break here doesn't fail one
   feature's tests, it can fail application startup entirely.
2. **31 files across this stage's own scope are pinned by literal path**
   across five different root tsconfigs — by far the largest concentration
   of packaging-audit-required files of any stage (compare: 1 file each in
   Stages 1, 3, and 5; zero in Stages 2 and 4). See the full list below.
3. **The Electron packaging chain terminates here.** `package.json`'s
   `build:beta-runtime`/`build:runtime`/`build:unlock-runtime`/
   `build:host-bridge`/`build:settings-host-bridge` scripts all compile a
   `desktop/**`-rooted file list into the root `dist/`, which
   `electron_builder.beta.config.json`'s own `extraFiles` entry
   (`{ "from": "../../dist", "to": "dist" }`) then packages whole — a
   mistake here is a mistake in the shipped Windows/Linux/macOS artifact,
   not just in `tsc`'s output.

Doing this stage last means every other domain's shims/relative paths are
already settled, so `desktop/`'s own move touches the smallest possible
number of MOVING TARGETS at once (everything it points at has already
landed at its final path) — the move itself still touches many files (154),
but each one's outbound imports need updating only once, not twice.

Internal batching, same "foundational first" spirit: `host_boundary/`,
`host/`, `content_accessor/` first (narrowest, most already-neutral
contracts); `runtime/`, `shell/`, `background/`, `badge/`, `tray/`,
`navigation/` next; `onboarding/`, `production_activation/`, `settings/`
next; `presentation/` + `renderer/` (+ their 4 feature subfolders each)
last (the widest UI-facing surface, most likely to have the most
downstream consumers inside `packages/fedos-desktop-electron-spike/`).

**Packaging audit — all 31 tsconfig-pinned files in this arc's scope,
resolved to which of the five root tsconfigs names each one (union across
all five; a file listed in more than one tsconfig needs every one of them
updated in the same commit):**

| File (relative to `src/`) | Stage | Named in |
|---|---|---|
| `conversation/construction/fedos_conversation_creator_identity_authority.ts` | **1** | beta-runtime, runtime |
| `device/sync_events/fedos_device_sync_event_bridge.ts` | **3** | beta-runtime, runtime |
| `desktop/notification/fedos_desktop_notification_coordinator.ts` | **5** | beta-runtime, runtime |
| `desktop/beta/fedos_desktop_beta_application_assembly.ts` | 6 | beta-runtime |
| `desktop/beta/fedos_desktop_beta_capability_manifest.ts` | 6 | beta-runtime |
| `desktop/beta/fedos_desktop_beta_limitations.ts` | 6 | beta-runtime |
| `desktop/beta/fedos_desktop_beta_release_configuration.ts` | 6 | beta-runtime |
| `desktop/onboarding/fedos_profile_initialization_coordinator.ts` | 6 | beta-runtime, unlock-runtime |
| `desktop/onboarding/fedos_local_profile_paths.ts` | 6 | beta-runtime, unlock-runtime |
| `desktop/onboarding/fedos_local_profile_persistence.ts` | 6 | beta-runtime, unlock-runtime |
| `desktop/onboarding/fedos_profile_unlock_secret.ts` | 6 | beta-runtime, unlock-runtime |
| `desktop/production_activation/fedos_production_profile_activation.ts` | 6 | beta-runtime, unlock-runtime |
| `desktop/production_activation/fedos_production_nostr_signing_authority.ts` | 6 | beta-runtime, unlock-runtime |
| `desktop/production_activation/fedos_production_desktop_host_attestation.ts` | 6 | beta-runtime |
| `desktop/presentation/fedos_desktop_conversation_ui_presentation_boundary.ts` | 6 | beta-runtime |
| `desktop/navigation/fedos_desktop_conversation_window_registry.ts` | 6 | beta-runtime, runtime |
| `desktop/tray/fedos_desktop_tray_coordinator.ts` | 6 | beta-runtime, runtime |
| `desktop/tray/fedos_desktop_tray_types.ts` | 6 | beta-runtime |
| `desktop/background/fedos_desktop_background_lifecycle_coordinator.ts` | 6 | beta-runtime, runtime |
| `desktop/presentation/fedos_desktop_notifications_tray_status_view_model.ts` | 6 | beta-runtime, runtime |
| `desktop/badge/fedos_desktop_badge_coordinator.ts` | 6 | beta-runtime, runtime |
| `desktop/runtime/fedos_desktop_device_sync_presentation_wiring.ts` | 6 | beta-runtime, runtime |
| `desktop/settings/fedos_desktop_settings_controller.ts` | 6 | beta-runtime, settings-host-bridge |
| `desktop/settings/fedos_desktop_settings_application_coordinator.ts` | 6 | beta-runtime |
| `desktop/settings/fedos_desktop_settings_application_ports.ts` | 6 | beta-runtime |
| `desktop/settings/fedos_desktop_settings_application_host_bridge.ts` | 6 | beta-runtime |
| `desktop/settings/fedos_desktop_settings_host_bridge.ts` | 6 | settings-host-bridge |
| `desktop/websocket_relay.ts` | 6 | beta-runtime |
| `desktop/node_websocket_relay_socket_factory.ts` | 6 | beta-runtime |
| `desktop/runtime/run_fedos_desktop_runtime.ts` | 6 | runtime |
| `desktop/host_boundary/fedos_desktop_host_bridge.ts` | 6 | host-bridge |

(A 32nd pinned file, `src/runtime/master_seed/fedos_sealed_master_seed_envelope_persistence.ts`,
appears in `tsconfig.beta-runtime.json` and `tsconfig.unlock-runtime.json`
but is OUT OF SCOPE for this migration — it lives under `src/runtime/`, not
any of the five messenger source directories. Noted here only so the
follow-up arc doesn't mistake its absence from the mapping doc for an
oversight.)

## Summary

| Stage | Bucket | Files | External fan-in | Packaging-audit files |
|---|---|---:|---:|---:|
| 1 | `conversations/` | 377 | 41 (lowest) | 1 |
| 2 | `board/` | 85 | 45 | 0 |
| 3 | `device/` | 88 | 66 | 1 |
| 4 | `adapters/nostr/` | 57 | 68 (highest) | 0 |
| 5 | `notifications/` | 3 | 20 | 1 |
| 6 | `desktop/` | 154 | 46 | 30 |
| **Total** | | **764** | | **33 pins (incl. 2 double-counted across stages 1/3/5's own single files each named in 2 tsconfigs, plus 1 out-of-scope)** |

Six stages, ordered primarily by measured external fan-in (ascending),
with `desktop/` forced last for the composition-layer/packaging-chain
reasons above rather than its own (middling) fan-in number, and
`notifications/` peeled out of `desktop/` early as a low-risk dry run of
"moving something out of the composition layer" before attempting the rest
of it.
