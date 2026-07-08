# FedOS Onion-like Routing — Design Review (non-binding, docs only)

**Status: research/design notes only. This document adds NO code, NO
cryptography, NO relay client, NO onion-routing implementation, and NO
Runtime/Worker connection of any kind.** It exists so that a
multi-hop, NIP-59-Gift-Wrap-based relay envelope idea is studied — with
its mechanics, open questions, and risks written down — *before* anyone
is tempted to implement it. It builds on, and does not replace, the
single-hop private-DM work already planned in
[`docs/nostr_dm_bridge.md`](nostr_dm_bridge.md) and
[`docs/nip44_wire_implementation_roadmap.md`](nip44_wire_implementation_roadmap.md).

This is a threat-model-and-mechanism sketch, not a specification and
not a security guarantee. Where a section touches security-sensitive
ground it lists **risks and open questions** rather than promising
properties. Do not treat any statement here as "safe", "anonymous", or
"final".

---

## 1. This is NOT a Tor alternative

FedOS does not, and this document does not propose to, replace Tor,
I2P, Mixnets, or any general-purpose anonymity network. Those systems
solve a much harder, much more general problem (arbitrary low-latency
traffic anonymization) with mechanisms this sketch does not have —
fixed-size cells, cover traffic, guard/middle/exit node diversity,
consensus-audited relay lists, and years of adversarial analysis. This
document is scoped to ONE narrow question: **could Nostr's existing
NIP-59 Gift Wrap primitive be nested to move a single message through
more than one hop before its final recipient sees it, and if so, what
would that cost in risk?** Any resemblance to "FedOS as an anonymity
network" is explicitly disclaimed.

## 2. What this is: an onion-like RELAY ENVELOPE, not onion ROUTING

"Onion-like" here means only: **payload nesting**, where each hop can
peel exactly one encrypted layer to reveal "who to forward to next"
without seeing the plaintext meant for the final recipient. It borrows
the LAYERING idea from onion routing, not the network model. FedOS has
no dedicated relay/circuit infrastructure — this idea rides entirely on
top of existing Nostr relays (dumb, NIP-01 event stores) and existing
FedOS-running peers acting as hop participants. There is no fixed
circuit, no negotiated path, and no guarantee any given hop is
reachable or honest.

## 3. Reuses NIP-59 Gift Wrap, nested — does not invent new cryptography

NIP-17 (private DMs) already uses a two-layer construction on top of a
plaintext event (a "rumor"):

1. **Seal** (NIP-59 kind 13) — the rumor, NIP-44-encrypted and signed
   by the REAL sender.
2. **Gift Wrap** (NIP-59 kind 1059) — the seal, NIP-44-encrypted again
   and signed by a random, single-use EPHEMERAL key, tagged (`p`) to
   the recipient's real pubkey.

This document's idea is: **nest additional Gift Wrap layers**, one per
hop, so that hop *N*'s Gift Wrap contains — as its sealed payload — the
COMPLETE Gift Wrap event addressed to hop *N+1*, rather than a final
rumor. Only the LAST layer's seal contains the actual rumor for the
real final recipient. No new encryption primitive, key-derivation
scheme, or cipher is proposed; this is exclusively a nesting/composition
idea on top of NIP-44 (encryption) and NIP-59 (gift wrap) as they
already exist in the Nostr ecosystem and as this repository's own
`nip44_wire_implementation_roadmap.md` already plans to eventually
connect.

**Open question, not resolved here:** whether nesting a full Gift Wrap
EVENT as a Seal's "rumor" content is compatible with NIP-59's rumor
shape (an unsigned `kind` event) as currently specified, or whether it
would require a new, FedOS-specific event kind/tag convention. This
document does not decide that; it is flagged as unresolved.

## 4. What each hop can and cannot see

| Hop role | Sees | Does NOT see |
|---|---|---|
| Any intermediate hop *N* | The outer Gift Wrap event addressed to its own pubkey (kind, ephemeral sender pubkey, its own `p` tag, timestamp, ciphertext size); after decrypting its own layer with its own key: the NEXT hop's full Gift Wrap event (i.e., "forward this to hop N+1"). | The original sender's real pubkey (each layer's Gift Wrap is signed by a fresh ephemeral key); the final rumor's plaintext content; how many hops came before it; in a naive design, potentially how many hops remain (see §7 risks). |
| The relay(s) storing/forwarding events | Every Gift Wrap event's `p` tag (which pubkey it is addressed to), signing (ephemeral) pubkey, timestamp, and ciphertext byte size — same visibility a relay always has for any Nostr event. | Any plaintext content of any layer (all layers remain NIP-44 ciphertext to the relay). |
| The final recipient (last hop) | The innermost Seal and rumor — the real content, and the real sender's pubkey (from the Seal's signature), exactly as a normal NIP-17 DM today. | Which intermediate hops were used, or whether any were used at all. |

## 5. Illustrative 3-hop example: A → B → C → D

A (sender) wants to reach D (final recipient) through two intermediate
FedOS peers, B and C, without B or C learning A's identity or D's
identity from each other's perspective, and without D learning that B
or C were involved.

```
A builds, innermost first:
  Rumor          = { plaintext message, for D }
  Seal_D         = NIP-44-encrypt(Rumor) signed by A            <- only D can ever attribute this to A
  GiftWrap_D     = NIP-44-encrypt(Seal_D) signed by ephemeral e1, p-tag = D

  Seal_C         = NIP-44-encrypt(GiftWrap_D) signed by ephemeral e2  <- "rumor" here is GiftWrap_D itself (see §3 open question)
  GiftWrap_C     = NIP-44-encrypt(Seal_C) signed by ephemeral e3, p-tag = C

  Seal_B         = NIP-44-encrypt(GiftWrap_C) signed by ephemeral e4
  GiftWrap_B     = NIP-44-encrypt(Seal_B) signed by ephemeral e5, p-tag = B

A publishes ONLY GiftWrap_B to a relay B is known to read from.

B fetches GiftWrap_B (p-tag matches B), decrypts with B's own key,
  recovers Seal_B -> GiftWrap_C. B republishes GiftWrap_C to a relay
  C is known to read from. B never sees Rumor or A's real pubkey.

C fetches GiftWrap_C, decrypts, recovers Seal_C -> GiftWrap_D.
  C republishes GiftWrap_D to a relay D is known to read from. C
  never sees Rumor, A's real pubkey, or that B was the previous hop
  (only that "some ephemeral key e4" sent it).

D fetches GiftWrap_D, decrypts down to Seal_D -> Rumor, and learns
  the message and that A (the real signer of Seal_D) sent it. D does
  NOT learn that B or C relayed it.
```

This is illustrative ONLY — it is not implemented, not a wire format,
and not reviewed for the open question in §3.

## 6. Relay routing proposal (rejected as primary design)

One possible design: relays themselves unwrap each layer and
re-publish to the next hop. **This document does not recommend this.**
It would require relay-operator code changes (relays are, by NIP-01
design, dumb event stores — this repository has no relationship with
any relay operator and cannot assume custom relay logic), concentrates
trust in relay operators who would need private-key material or a
decryption oracle (unacceptable), and turns every participating relay
into a high-value target. Named here only to rule it out explicitly.

## 7. FedOS peer routing proposal (the design this document actually studies)

The alternative — and the one this document actually studies — keeps
relays exactly as dumb as NIP-01 already assumes: relays only ever
store and serve events, exactly as they do today for ordinary NIP-17
DMs. The unwrapping/re-wrapping/republishing happens entirely in
FedOS-running PEER clients (Desktop-first, per
[`docs/fedos_runtime_positioning.md`](fedos_runtime_positioning.md)) that
voluntarily opt in to act as intermediate hops:

- A hop peer subscribes (ordinary NIP-01 `REQ` filter) for Gift Wrap
  events `p`-tagged to a hop-specific pubkey it controls.
- On receiving one, it attempts NIP-44 decryption; if it succeeds,
  the layer was meant for it as a relay hop; if it fails, the event
  was not addressed to it as a hop (or was noise/abuse — see §9).
- It republishes the recovered inner Gift Wrap to whatever relay set
  the next hop is known to read from.

**Explicitly unsolved by this document:** timing/batching discipline
before republishing (naive immediate-forward defeats the timing-
correlation goal — see §9), how a sender learns which peers are
willing hops and their read-relay sets, and any incentive/reputation
model for volunteer hops. None of these are designed here.

## 8. Relationship to existing NIP-17/NIP-59 work in this repository

- This is **the same NIP-44/NIP-59 primitive** `docs/nostr_dm_bridge.md`
  and `docs/nip44_wire_implementation_roadmap.md` already plan for
  ordinary single-hop private DMs — nested, not reinvented.
- It is **strictly downstream** of that existing roadmap: NIP-44's
  real wire connection and NIP-59 Gift Wrap are not yet connected to
  Runtime/Worker/Nostr in this repository (`docs/nip44_wire_implementation_roadmap.md`
  §"Stage 257+ candidates" — Stage 259 "NIP-17 planning" is itself
  still a future, undecided stage). This multi-hop idea cannot be
  prototyped before that single-hop foundation is real.
- It does **not** change, replace, or accelerate any existing NIP-17/
  NIP-44 stage — it is a SEPARATE, later, explicitly-deferred track
  (see §10).

## 9. Risks (unsolved; not mitigated by anything in this document)

- **Timing correlation.** An observer watching relay publish/fetch
  timestamps across hops (even without decrypting anything) can
  correlate "an event arrived at relay X at time T, and a related-size
  event left for relay Y shortly after" — the classic timing-attack
  Tor's guard/middle/exit diversity and defenses (which this scheme
  has none of) exist to blunt. No padding, delay-batching, or cover
  traffic is designed here.
- **Packet/event size correlation.** Each nested layer adds Seal +
  Gift Wrap overhead, so ciphertext size grows (or shrinks, from the
  observer's viewpoint, hop by hop) in a way that is NOT disguised by
  fixed-size cells (unlike Tor). A global or relay-side observer could
  infer hop depth or position in the path from size deltas alone.
- **Malicious relay.** A relay sees every layer's `p`-tag, signing
  (ephemeral) pubkey, and timestamp even though it never sees
  plaintext; a relay used at multiple hops (or colluding relays) could
  correlate hop pubkeys, selectively withhold/delay/duplicate events
  to specific hops, or log everything indefinitely — no relay
  non-logging guarantee exists or is assumed.
- **Relay auth / logging.** Relays commonly require NIP-42 auth or log
  connecting IP addresses regardless of Nostr-layer pseudonymity — the
  SAME caveat `docs/deniable_storage_research.md` §7 already raised
  for ordinary Nostr use applies identically to every hop peer here:
  the transport is not assumed unobserved.
- **Spam / abuse.** An open, opt-in hop-peer network invites abuse: a
  hop peer cannot know whether a Gift Wrap event addressed to its hop
  pubkey is legitimate without attempting a NIP-44 decryption first —
  a decryption-attempt flood is a CPU/bandwidth DoS vector. Separately,
  volunteering as a hop makes a FedOS peer an anonymizing relay for
  traffic it does not control, the same "abuse of goodwill" problem
  Tor exit-node and mixnet operators already face; no reputation,
  rate-limit, or proof-of-work gate is designed here.
- **Delivery failure.** There is no acknowledgment, retry, or
  reliability guarantee across multiple independent hops and relay
  sets. Any single offline hop peer, or any relay that refuses,
  rate-limits, or purges an event under its own retention policy,
  silently breaks delivery — with no feedback channel back to the
  sender defined by this document. This mirrors
  `docs/deniable_storage_research.md` §7's point that a Nostr "delete"
  is a request, not a guarantee; the same non-guarantee applies to
  delivery in the forward direction here.

## 10. FedOS policy on this idea

- **Docs only, for now.** Nothing in this document is implemented or
  scheduled. No `src/`, `packages/`, `Cargo.toml`, or `package.json`
  change accompanies it.
- **Re-evaluate only after NIP-44/NIP-59 are for real.** This idea is
  explicitly gated behind the SAME single-hop NIP-44 wire connection
  and NIP-59 Gift Wrap implementation `docs/nip44_wire_implementation_roadmap.md`
  already plans and has NOT yet built. No multi-hop prototype work
  starts before that foundation is real, reviewed, and stable.
- **EMSR/Ontology are for abuse OBSERVATION, not production routing.**
  Per `docs/fedos_runtime_positioning.md` §4, the Python
  experimentation/EMSR/Ontology surface (future, unimplemented,
  `"PythonPlanned"`) is where analysis of abuse patterns for an idea
  like this would eventually live — offline research and observation
  only, never the production TypeScript runtime or the Rust safety
  boundary, and never implemented by this document.
- **A separate protocol from deletion coordination and ordinary DMs.**
  This onion-like multi-hop relay envelope is NOT the same thing as
  the ordinary single-hop NIP-17 DM bridge (`docs/nostr_dm_bridge.md`)
  and is NOT the same thing as any future deletion-coordination
  protocol (NIP-09-style delete propagation). The three must not be
  conflated in design, in code, or in future scheduling — each is its
  own, separately-reviewed protocol surface.

## 11. What this document does NOT do

- Does **not** implement NIP-17 or NIP-59 (the real Rust/TypeScript
  wire work remains exactly where `docs/nip44_wire_implementation_roadmap.md`
  left it — unconnected).
- Does **not** implement onion routing or any relay-hop client of any
  kind.
- Does **not** implement relay publish/send/subscribe code of any
  kind — no network call, no `fetch`, no WebSocket client.
- Does **not** connect Runtime (`create_runtime.ts`) or Worker
  (`src/worker.ts`) to anything described here.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`,
  or write `import()` of any kind (static or dynamic).
- Does **not** execute any cryptographic operation — no key
  generation, no encryption, no decryption, no signing.
- Does **not** add a Cargo or `package.json` dependency.
- Does **not** claim anonymity, unlinkability, or any other security
  property as achieved — every property discussed above is named as a
  RISK or an OPEN QUESTION, never as solved.

## See also

- `docs/nostr_dm_bridge.md` — the existing single-hop NIP-17 DM
  publish/receive planning this idea nests on top of, unchanged.
- `docs/nip44_wire_implementation_roadmap.md` — the NIP-44 wire
  connection roadmap this idea is strictly downstream of and gated
  behind.
- `docs/public_nip44_wire_api.md` — the opaque-handle-only public
  boundary this idea would eventually need to route through, if ever
  built.
- `docs/deniable_storage_research.md` — the sibling "research
  boundary, non-binding, docs only" precedent this document follows in
  structure and tone, including its Nostr IP-logging and
  delete-is-a-request caveats, which apply here too.
- `docs/fedos_runtime_positioning.md` — the repository-wide scope
  statement naming Python/EMSR/Ontology as the future, unimplemented
  home for abuse-pattern observation referenced in §10.
- `docs/runtime_crypto_threat_model.md` — the fail-closed design
  discipline this document's "risks, not guarantees" framing is
  consistent with.
