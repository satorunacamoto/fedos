# Telegram support adapter (reserved)

Reserved location for a **future** Telegram channel adapter for the Support
domain (`src/os/commerce/support/`). No Telegram adapter, SDK dependency, or
bot integration exists in this repository today — this directory is empty
except for this file.

## Rule

When a real adapter is built here, Telegram SDK types/packages/wire formats
must stay contained to this directory. `src/os/commerce/support/` domain
code must never import a Telegram-specific type or package directly — it may
only depend on the channel-neutral contract this adapter will implement.

## Status

Inert scaffolding / reserved location only. No Telegram code exists anywhere
in this repository.
