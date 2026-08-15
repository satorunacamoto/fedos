# Frozen Test Matrix (Coordinator, mandate §28-31)

Synthesizes Agent X's proposed shape (`04_THREAT_MODEL_AND_PRIVACY.md` §4)
into the mandate's required 18 protocol scenarios + 7 Direct Ratchet
scenarios. This is the implementation checklist for Agent A (protocol unit
tests) and Agent R (ratchet integration tests).

## Protocol test matrix (18 required scenarios -> concrete tests)

| # | Mandate scenario | Concrete test | Expected outcome |
|---|---|---|---|
| 1 | Valid assertion | Real dual-signature announcement, first contact | `"accepted-new-device"`, Registry binding `"trusted"` |
| 2 | Wrong account | `senderAccountRef` != verified signer pubkey | `"bad-account-signature"`, no Registry write |
| 3 | Wrong device | `deviceProofOfPossession` signed by a DIFFERENT keypair than `devicePublicKeyHex` names | `"bad-device-signature"`, no Registry write |
| 4 | Malformed signature | Truncated/non-hex signature bytes | `"malformed"`, rejected before any crypto call |
| 5 | Tampered payload | Flip one byte of each signed field independently (senderAccountRef, deviceId, epoch, capabilities, nonce) — one test per field | Every individually-tampered field breaks `"bad-account-signature"` verification |
| 6 | Exact replay | Byte-identical redelivery (same nonce) | `"duplicate"`, idempotent, zero new Registry mutation |
| 7 | Stale/superseded | Lower `epoch` delivered after a higher one already accepted | `"stale"`, Registry binding unchanged |
| 8 | New device | Second, distinct `deviceId` for the same `senderAccountRef` | `"accepted-new-device"`, coexists with the first, both `"trusted"` |
| 9 | Multiple devices | Query Registry for an account with 2+ trusted devices | Both present independently, neither's fact leaks into the other's query |
| 10 | Wrong persona/profile | Same physical test harness, two distinct local Personas/profiles | Profile A's observation never visible from Profile B's Registry/store |
| 11 | Wrong conversation substitution | Announcement legitimately accepted while Direct Conversation X active, then a Direct Ratchet session bootstrap attempted for unrelated conversation Y with the same peer account | Session bootstrap for Y uses its OWN conversationId-scoped session id (Agent R, unaffected); no fact leaks a session into the wrong conversation |
| 12 | Unknown peer | Announcement from an account never seen before, but recipient matches local account | Same as #1 — first contact IS the expected case, `"accepted-new-device"` (no `"untrusted-device"` gate, per `06` §4) |
| 13 | Restart | Accept an announcement, restart the Runtime/process, re-query | Registry binding + observation record both durably survive |
| 14 | Offline discovery | Recipient offline when announcement published; reconnect later | NIP-17 mailbox `since`-filter reconnect delivers it; accepted normally on receipt |
| 15 | Duplicate relay delivery | Same relay redelivers the identical event twice | `"duplicate"` both times after the first `"accepted"`, no double-Registry-write |
| 16 | Reordered assertions | Epoch N+2 delivered before N+1 | N+2 accepted first (no prior to compare); N+1 arriving after is `"stale"`; both eventually consistent regardless of delivery order |
| 17 | Identity replacement | Peer completes Identity Replacement; old-identity binding remains historical; query under new identity | Zero bindings under the new identity until a fresh announcement arrives (per `07`) |
| 18 | Stale device after identity replacement | Old-identity device continues sending ordinary traffic post-replacement, no fresh announcement under new identity | Old binding still reads correctly for OLD identity's own historical state; new identity's Security UI reads DEVICE_KNOWLEDGE as unknown, never silently inherited |

## Additional adversarial coverage from Agent X (not in the mandate's base 18, still required — §39-42)

- Wrong recipient (bilateral addressing): announcement addressed to account A rejected when evaluated as if received by account B — `"wrong-recipient"`, checked before signature verification.
- Conflicting re-key: same `deviceId`, new `devicePublicKeyHex`, higher epoch — `"conflicting"`, existing binding untouched (mirrors Mallory-claims-Bob's-identity attack: Mallory cannot take over Bob's already-announced `deviceId` slot without Bob's own account signature).
- Downgrade: previously-claimed capability silently dropped in a later, otherwise-valid announcement — treated as `"conflicting"`, never silent acceptance.
- No-silent-downgrade meta-test: every withhold/replay/reorder/duplicate/delay combination above asserted to never produce an unqualified "good"/"trusted" Security-UI state without an `asOf`/staleness qualifier.
- Privacy: device-identifier codec rejects any string not matching the fixed 32-hex-char shape (closing Agent X §2.3 item 1); no capability field accepts free text; no query path enumerates all announcements for an account without the caller holding at least one addressed-to-them announcement.

## Direct Ratchet test matrix (7 required scenarios)

| # | Scenario | Concrete test | Expected outcome |
|---|---|---|---|
| 1 | Authenticated -> bootstrap succeeds | Trusted binding exists (via this protocol), first outbound send in a fresh conversation | `resolveFedosDirectRatchetDevicePair()` resolves; a real crypto session establishes; message encrypts/decrypts round-trip |
| 2 | Missing -> fails truthfully | No announcement ever received for this peer | `"remote-device-unknown"`; UI DEVICE_KNOWLEDGE/FORWARD_SECRECY read `unknown`/`unavailable`, never a fabricated GOOD |
| 3 | Wrong device -> rejects | Session bootstrap attempted against a `deviceId` with no `"trusted"` Registry binding (e.g. rejected `"conflicting"` re-key attempt) | `"remote-device-not-trusted"` or `"remote-device-unknown"`, no session created |
| 4 | Wrong account binding -> rejects | Attempt to bootstrap a session using a device announced by account X, addressed against a conversation whose counterparty is account Y | Device pair resolver never matches; no session, no crypto material crosses accounts |
| 5 | Stale/superseded -> no silent bootstrap | A `"stale"`-rejected announcement's claimed device is never written to the Registry | No Registry mutation means the ratchet resolver never even sees it — negative-space test asserting Registry untouched |
| 6 | Restart -> correct session state | Establish a real session, restart both processes, send again | Session persists (Agent R §4, existing durable log), no duplicate/corrupt state, message continues correctly |
| 7 | Replay -> no duplicate/corruption | Redeliver the announcement that originally triggered bootstrap, after a session already exists | `"duplicate"` at the protocol layer; zero effect on the already-established ratchet session (session lifecycle is independent of announcement replay once bootstrapped) |

## Explicit non-claims (carry forward, never contradict in tests or copy)

- No test may assert or produce a UI string implying human identity
  verification ("identity verified", "fully secure", etc. — full forbidden
  list in `05_SECURITY_CLAIM_BOUNDARIES.md`, reused verbatim).
- `FORWARD_SECRECY: good` must only ever be produced when a real, active
  ratchet session is confirmed AND the message-delivery routing actually
  targets that exact device (existing controller logic, unchanged by this
  arc except for the new fact source feeding DEVICE_KNOWLEDGE).
- No test may claim "message cannot be recovered" or similar absolute
  cryptographic claims not already supported by the existing threat model.
