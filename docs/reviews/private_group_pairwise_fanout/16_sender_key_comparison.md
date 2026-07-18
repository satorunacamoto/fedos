# Review 16 — Sender Key Comparison

## Restated, not re-derived: Sender Key remains the named standards-track upgrade path, unimplemented

The prior review's own comparison
(`docs/reviews/private_protocol_delivery_group_v1/15_group_strategy.md`,
building on `docs/reviews/private_conversation_security/05_key_distribution.md`)
already named Sender Key (each sender maintains one symmetric key,
distributed once to the group, messages encrypted once per sender
rather than once per recipient) as the standards-track future
direction, explicitly deferred pending group sizes/removal-frequency
being better understood in practice. Confirmed unchanged at this
review's own later commit: zero Sender Key code exists anywhere in
`packages/fedos-core-rust/src/` (grep for `sender[_ ]?key`, case
insensitive, zero hits beyond incidental substring matches).

## Direct comparison against the pairwise-fanout architecture this review specifies (`04`)

| Property | Pairwise Fanout (`04`, this review) | Sender Key |
|---|---|---|
| New cryptographic primitive required | **None** — reuses the existing pairwise ECDH primitive N times | One (a per-sender symmetric key + its own distribution mechanism) |
| Ciphertexts per message | O(N) — one per recipient | O(1) — one per sender, decryptable by every current holder of that sender's key |
| Member removal | No re-encryption needed (`09`) — future sends simply omit the removed member from recipient planning (`05`) | No re-encryption of PAST content needed either, but the sender's OWN key must be considered compromised/rotated going forward for a fully rigorous removal story — this review does not evaluate that rigor for Sender Key since it is not implemented |
| Member addition | No historical access (`10`) — identical limitation | Same limitation — a new member cannot decrypt a sender's PAST messages under their old sender key either, without separate history delivery |
| Metadata cost | Group size directly inferable from N simultaneous deliveries (`13`) | Lower — one ciphertext per sender per message, less obviously N-shaped to an observer |
| Implementation cost | Zero new primitives, additive orchestration only (`04`) | Requires designing/reviewing a full sender-key distribution + rotation mechanism from scratch |
| Buildable today without further crypto design | **Yes** | **No** |

## Why this review still recommends fanout as the nearer-term step despite Sender Key's metadata advantage

Consistent with the prior review's own "choose the safest realistic
next step, not the most ambitious" framing (`docs/reviews/private_protocol_delivery_group_v1/15_group_strategy.md`),
and this review's own instruction to recommend only additive evolution:
fanout requires zero new cryptographic design and builds entirely on
the now-real, verified Direct Activation/Messaging pipeline (`03`).
Sender Key requires solving open questions this review is not
authorized to solve (a new key-distribution/rotation primitive) before
any code could exist. This is not a claim that fanout is a superior
long-term architecture — `13`'s own metadata-leakage finding is a real,
acknowledged cost fanout carries that Sender Key would reduce.

## Explicit refusal to invent

This review does not design a Sender Key distribution mechanism, key
rotation policy, or per-sender key lifecycle — doing so would be
inventing cryptography, prohibited by this review's own ground rules.

## See also

- `15_backup_model.md`, `17_mls_comparison.md`, `18_migration_path.md`
- `docs/reviews/private_protocol_delivery_group_v1/15_group_strategy.md`
