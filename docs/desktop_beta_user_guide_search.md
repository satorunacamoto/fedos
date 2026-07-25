# FedOS Desktop Beta — Search Guide

## What Search is

Open **Search** from the navigation bar, type a query, and click
**Search**. Results are matched against a **local, plaintext keyword
index built from your own messages** — not an encrypted blind index, and
not a search against ciphertext.

## What Search does and does not cover

- **Only messages you have actually opened are indexed.** A message you
  received but never opened will not appear in search results until you
  open it and its plaintext is revealed at least once.
- **Group messages are deliberately excluded from Search.** A fanned-out
  group envelope's own conversation id is a per-recipient Direct path,
  not the group's own id — indexing it would produce misleading results,
  so it is left out rather than shown incorrectly. (Group Messaging
  itself is not exposed in this pilot at all — see `KNOWN_LIMITATIONS.md`.)
- **The index lives in memory only, never written to disk** as its own
  separate store. It is rebuilt from your already-decrypted local message
  store, not a durable secondary copy.

## Why this isn't an encrypted blind index

An encrypted blind index would let you search without the plaintext
keyword index ever existing outside your own decrypted view. Building one
is real, nontrivial cryptographic work this codebase has not done. Until
then: anyone with access to this application's own process memory while
it's unlocked can, in principle, observe the plaintext search index —
the same exposure as any other already-decrypted content shown on
screen, not a new or larger one. Locking clears it on a best-effort
basis (see `SECURITY.md`'s memory-erasure disclosure).

## Practical tips

- If a message you expect to find isn't showing up, open that
  conversation and the message first, then search again.
- Search queries are not saved or synced anywhere — each search is a
  fresh, local, in-memory lookup.
