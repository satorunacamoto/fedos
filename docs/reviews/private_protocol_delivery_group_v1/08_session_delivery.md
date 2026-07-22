# Review 08 — Session Delivery

## What exists today, confirmed by direct source read

`src/board/session/` contains two files, both inbound and public-post-shaped:

- `fedos_validated_session_post.ts` — `FedosValidatedSessionPost`, six
  fields: `messageId, sessionId, authorId, body, createdAt, replyTo`.
  `sessionId` is retained on the validated type but never propagated
  onto `FedosBoardPost`.
- `fedos_session_board_adapter.ts` — pure mapping only. Its own header
  is the most explicit of all four protocol adapters about scope: this
  Arc has "NO responsibility before the Gateway (Session network, Oxen
  connection, private keys, encryption/decryption, DM retrieval, storage
  sync are all explicitly out of scope and absolutely prohibited)."

## Answering the three required questions directly

**Can a Session identity resolve to encryption recipient material?**
No — confirmed absent. Nothing in `src/board/session/` or elsewhere in
this repository resolves a Session ID to any key material; the
adapter's own header places key handling entirely upstream, at a
"Gateway" this repository does not implement.

**Is the gateway one-way only?** As far as this repository's own source
shows, yes: the adapter validates and maps an already-received,
already-decrypted `FedosValidatedSessionPost` **into** the board post
model — there is no outbound direction anywhere in `src/board/session/`
or `src/board/publish/` for Session. This review states this as "no
outbound path exists in this repository's own source," not as a general
claim about the real Session network's own directionality, which this
review has not researched.

**Does a public/private distinction exist?** No — `FedosValidatedSessionPost`
has no visibility/audience field of any kind, and the adapter's own
header frames the entire Session integration as a single undifferentiated
inbound path. Whatever public/private distinction the real Session
protocol makes (Session is generally understood by this repository's
own comments to be a private/DM-oriented network, unlike Nostr's public
relay model) is not represented anywhere in this repository's type
system.

**Is official Session specification research mandatory before any
outbound work?** Yes — unconditionally. This is, per the prior Security
review's own §20 finding (cited here, not re-derived), the largest gap
of the four protocols: Session has no signing/event/relay code of any
kind in this repository (unlike Nostr), no inbound-only Activity/record
model to extend (unlike ActivityPub/AT Protocol) — there is categorically
nothing here to adapt, only a single, explicitly out-of-scope inbound
mapping function.

## Explicit refusal to generalize

**This review does not generalize Session network behavior from the
Board adapter.** The adapter's own header explicitly disclaims
authority over "Session network, Oxen connection" behavior — treating
its narrow inbound-mapping scope as evidence about the real Session
protocol's own properties (onion routing, key exchange, group
messaging) would be exactly the kind of unsupported protocol claim this
review's own ground rules prohibit.

## Verdict

**Option D (unsupported) today**, for the same structural reason as
ActivityPub and AT Protocol — no outbound path exists — but with a
categorically larger research gap before even a first design could
begin, since no adjacent inbound machinery exists to reason from at
all.

## See also

- `01_source_inventory.md`, `03_internal_vs_wire_envelope.md`
- `06_activitypub_delivery.md`, `07_atproto_delivery.md`
- `docs/reviews/private_conversation_security/20_blockers_recommendation.md`
