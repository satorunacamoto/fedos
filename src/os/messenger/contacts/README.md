# `src/os/messenger/contacts/` — RESERVED, and intentionally empty

This arc's kickoff prompt asked for a `contacts/` bucket mapped from
`src/conversation/encryption/identity/*` (the participant/identity/
counterparty/key resolvers — the closest thing this codebase has to
"contacts"), *or* a documented recommendation to keep it nested under
`conversations/` if it turns out too entangled to cleanly split. This
directory documents the second outcome.

## The decision

Measured fan-in (`grep` for `encryption/identity` import paths across
`src/`, current tree):

- **22 files inside `src/conversation/**`** import from it directly —
  `activation/fedos_conversation_direct_activation_coordinator.ts`,
  `messaging/fedos_conversation_direct_messaging_coordinator.ts`,
  `deletion_request/*`, `identity_transition/peer_integration/*`, and
  `encryption/coordination/*` all resolve local/counterparty identity
  through these 5 files.
- **1 file outside `src/conversation/`** imports from it:
  `src/desktop/runtime/fedos_desktop_runtime_config.ts`.

The real audience for this code is `conversations/` itself. Hoisting it to
a sibling top-level bucket today would lengthen the relative-import path
for all 22 internal call sites for a separation whose only present-day
external beneficiary is one Desktop runtime-config file — not a strong
enough signal that this is an independently-reusable "contacts" capability
yet, as opposed to conversation-internal identity plumbing that happens to
also expose the one seam a different part of Desktop currently needs.

**Where the code actually lives (once the physical move happens):**
`src/os/messenger/conversations/encryption/identity/**` — see
`../conversations/README.md`.

## When to revisit this

If a future capability outside `conversations/` (e.g. a board-authorship
identity linkage, or an `os/commerce` seller-identity lookup) needs to
resolve a FedOS participant identity independent of any conversation
context, that is the signal to actually hoist `encryption/identity/**` out
to this directory and update the 23 current call sites (22 internal + 1
external) to the new path. Until then, this directory stays empty and
reserved rather than holding a copy, a re-export shim, or a partial split
that would create two sources of truth for "how do I resolve a
counterparty."

RESERVED — see `docs/architecture/MESSENGER-ARCHITECTURE.md` and
`docs/architecture/MESSENGER-MIGRATION-MAPPING.md` for the full picture.
