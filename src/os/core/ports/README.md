# `src/os/core/ports`

These are the neutral seam contracts between `os/core`, `os/messenger`, and
`os/commerce`. `os/commerce` depends on these ports, not on messenger
internals; `os/messenger` (a later arc) provides the adapters that implement
them (e.g. a Nostr-backed `MessagingPort`).

No adapter implementations belong in this directory — interfaces only.
