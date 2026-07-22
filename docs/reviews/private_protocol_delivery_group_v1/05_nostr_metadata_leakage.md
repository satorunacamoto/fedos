# Review 05 — Nostr Metadata Leakage

## Ciphertext confidentiality is not anonymity — restated as this review's own required framing

Even a hypothetical, fully-shipped NIP-17 gift-wrap delivery would
leave the following observable to any relay operator or passive
observer, none of it protected by encrypting the message content:

- **Sender pubkey.** A plain (non-gift-wrapped) NIP-44 DM event exposes
  the real sender pubkey in the event's own `pubkey` field — this
  repository has no gift-wrap layer today (`04`), so if a NIP-44-only
  path were shipped without gift wrap, the real sender would be
  directly visible per-event, defeating one of NIP-17's own stated
  purposes.
- **Recipient tags.** A `p`-tag (or equivalent addressing) naming the
  recipient is how a relay/client routes a DM; even gift-wrapped
  delivery still needs *some* addressing at the outer layer (typically
  a per-recipient ephemeral key in NIP-17's own design, which this
  review does not re-derive — see `04`'s named research gap). Without
  gift wrap, a real recipient pubkey in a `p`-tag directly links two
  real identities.
- **Event kind.** A distinct `kind` value for encrypted DMs is itself a
  signal ("this account sends/receives private messages") independent
  of content.
- **Timestamps.** `created_at` is plaintext on every Nostr event
  (`src/nostr/types.ts`'s `NostrEvent`); traffic-timing analysis (who
  messages whom, how often, at what cadence) is unaffected by content
  encryption.
- **Relay choice.** Which relay(s) an account publishes to/reads from
  is itself metadata a relay operator observes directly, and this
  repository's own `FedosPublishScheduler`/Outbox model (`10`) does not
  today randomize or pad relay selection.
- **Event size.** Ciphertext length correlates with plaintext length;
  NIP-44's own real implementation in this crate (`nip44_padding.rs`,
  confirmed present, unexported) exists specifically to blunt this via
  length padding — but padding is a wire-format detail this review
  does not assume is wired correctly end-to-end without the export
  work `04` names as incomplete.
- **Reply structure.** As `03` notes, a private reply reference must
  live **inside** the encrypted layer, not as a plaintext `e`-tag — the
  existing NIP-10 thread-resolution code (`fedos_board_nostr_adapter.ts`)
  operates on plaintext tags today and must not be reused unmodified
  for private replies without this distinction being enforced.

## What this review does and does not claim

This review does **not** claim that encrypting Envelope content (which
this repository's own AEAD pipeline already does correctly, per `01`)
provides any traffic-analysis or sender/recipient-anonymity guarantee.
Any future Arc's own documentation, README status entries, or user-
facing claims about "private messaging" must distinguish **content
confidentiality** (real, once `04`'s export/wiring work lands) from
**metadata privacy** (not addressed by anything in this repository
today, and only partially addressed even by NIP-17 gift wrap itself —
relay choice and timing remain observable regardless).

## See also

- `04_nostr_readiness.md`
- `docs/reviews/private_conversation_security/13_thread_local_pseudonym.md`,
  `14_operator_non_linkability.md` (this repository's own prior,
  still-valid findings on operator-side linkability, not re-derived
  here)
