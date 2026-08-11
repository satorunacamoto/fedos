# Legacy prototype (`src/os/_legacy_prototype/`)

## What this is

This directory holds the dormant pre-pivot **"nostr-window"** product: a
Reddit-style, read-only "window" into Nostr, built as a **Cloudflare
Workers** application (`worker.ts` was its `fetch` entrypoint; `index.ts`
was its public barrel export). FedOS pivoted away from this product to
become a focused, end-to-end encrypted Direct-message messenger; this code
predates that pivot and was never updated for it.

It has **no deploy path**: there is no Cloudflare Workers deployment
config, wrangler configuration, or CI job anywhere in this repository that
builds or ships `worker.ts`. It is kept **only for its existing test
coverage** (see below) — moving it here does not add, remove, or revalidate
any of that coverage; the ~295 tests that previously exercised it at their
old import paths now exercise it at these new paths instead.

## Contents

The moved directories, verbatim (internal relative structure preserved):
`chat/`, `community/`, `social/`, `thread/`, `query/`, `ingest/`,
`indexer/`, `cache/`, `nearby/`, `asset/`, `sign/`, `render/`,
`federation/`, `promotion/`, plus `worker.ts`, `index.ts`, and
`runtime/create_runtime.ts` + `runtime/types.ts` (the two individual files
of `src/runtime/` that belonged to this product's `AppRuntime` selection
layer — the rest of `src/runtime/` is live, current core infrastructure and
was left in place).

`notification/` is **only partially here**: only `bridge.ts` was kept in
this quarantine (it composes `ChatRoom`/`ChatMessage`/`SpaceBase` — types
from this directory's own dead `chat/`/`community/` — into notification
payloads, and has no live consumer). The other 3 files originally moved
here during this Arc (`types.ts`, `policy.ts`, `noop_notification.ts`) were
moved back out to `src/notification/` after the audit below found a real
live consumer — see "Not part of the shipped Electron app" for why.

`packages/meshkv/` (a separate npm package, consumed only by the now-legacy
`asset/meshkv_*` files) was **not moved** — it stays physically where it
is. It is now logically legacy-only/dormant: nothing outside this directory
depends on it.

## Not part of the shipped Electron app

This code is not part of FedOS Desktop's Electron packaging in the sense
that matters for the product: none of its routes, pages, or providers run
in the shipped app, and it was never wired into `src/desktop/`,
`src/conversation/`, `src/board/`, or `src/device/`.

An initial pass of this quarantine moved all 4 `notification/` files here,
including `types.ts` and `policy.ts`. Verifying "never in any
production/runtime tsconfig or packaging target" then found a real,
pre-existing exception: those two files ARE transitively compiled by three
of the shipped app's own packaging tsconfigs (`tsconfig.runtime.json`,
`tsconfig.beta-runtime.json`, `tsconfig.host-bridge.json`) via a real, live
import — `src/desktop/notification/fedos_desktop_notification_types.ts`
(the LIVE desktop notification boundary) reuses `isSensitiveNotificationField`
from `notification/policy.ts` for its own `detail`-field validation, via a
deliberate, `eslint-disable`-marked exception documented in that file's own
header. That file's header also describes `src/notification/` itself as a
generic, **forward-looking** "Stage 39" seam for a future external push
transport (Telegram/LINE/APNs/FCM/Email) — i.e. it predates the
"nostr-window" pivot narrative and was never actually part of the dead
Cloudflare Workers product; it is FedOS-native, numbered infrastructure
that just isn't wired to a real transport yet.

Given a real live consumer exists, `types.ts`, `policy.ts`, and
`noop_notification.ts` (the 3 files with no dead-prototype coupling — they
only import each other) were moved back to `src/notification/`, restoring
their original location, rather than leaving a live→legacy import in place.
Only `bridge.ts` (which imports `ChatRoom`/`ChatMessage` from this
directory's own `chat/` and `SpaceBase` from `community/` — genuinely dead
types) stays quarantined here; it has no live consumer. `tsc -p
tsconfig.runtime.json/.beta-runtime.json/.host-bridge.json --noEmit` all
pass with zero errors after this correction.

Everything else moved here was confirmed to have **no** reference from
`tsc --listFilesOnly` output for any of the five production/runtime
tsconfigs (`tsconfig.runtime.json`, `tsconfig.beta-runtime.json`,
`tsconfig.host-bridge.json`, `tsconfig.settings-host-bridge.json`,
`tsconfig.unlock-runtime.json`).

## Boundary with `src/os/commerce/`

Some files here still reference the commerce-shaped subset that was moved
separately to `src/os/commerce/` (e.g. `render/product.ts` imports
`catalog/directory.ts`; `runtime/create_runtime.ts` imports
`payment/noop_payment.ts`). Those imports were rewritten to point at the
new commerce location — this legacy directory and `src/os/commerce/` remain
two distinct capabilities with different futures (commerce may become real
product surface; this directory is kept only for historical test coverage),
they simply share code that predates both moves.
