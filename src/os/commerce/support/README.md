# Support (reserved)

This directory is a reserved seam. **No Support domain exists yet** — there is
no ticketing, no customer-support conversation model, no case/queue state,
and no code here today. This file exists only to reserve the location and
record the intended shape for when that domain is built.

## Future shape

When a Support domain is implemented, it composes with:

- A `MessagingPort` (from `src/os/core/ports/`) — Support never depends on a
  messenger implementation directly, only on the Port abstraction Messenger
  publishes.
- One or more channel adapters, each living under `support/adapters/<channel>/`
  (see `support/adapters/telegram/` for the first reserved one) — Support
  domain code stays channel-agnostic; only the adapter directory for a given
  channel may know that channel's SDK/wire format.

## Status

Inert scaffolding / reserved location only. No order, ticket, case, or queue
concept is defined anywhere in this repository yet.
