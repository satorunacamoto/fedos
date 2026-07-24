# 03 — Identity Layer Taxonomy

"Identity key" is never used as a catch-all in this review. Fourteen
distinct layers, each defined precisely, each verified against real
source (citations per `01`).

| Layer | Public/secret | Canonical identifier | Owner | Lifetime | Derivation source | Persisted where | Peer-visible | Relay-visible | Archive-visible | Device-Sync-visible | Revocable | Rotatable today | Replacement consequence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Master Seed | Secret | None (opaque handle) | The profile | Until `clear()`/profile deletion | Real CSPRNG | Sealed envelope, local disk only | No | No | No | No | No (only replaceable via new profile) | No | Every derived value below changes |
| Local profile identity | Public (metadata) | Profile descriptor's own local id | The local install | Until profile deletion | Local, not cryptographic | `FedosLocalProfileDescriptorV1` | No | No | No | No | N/A | N/A | New profile = new everything below |
| FedOS account identity | Public | `{authority:"nostr", publicIdentifier, identityId:null}` | The account | Life of the Master Seed | = Nostr public key (see below) | Profile descriptor, every downstream reference | Yes | Indirectly (via Nostr events) | Yes | Yes | No | No | See `04` |
| Nostr identity/public key | Public (secret key never leaves Rust) | 64-hex secp256k1 pubkey | The account | Life of the Master Seed + accountIndex | HKDF chain: seed → identity root → application root → nostr root → `(nostr root, accountIndex)` | Not separately persisted; re-derived | Yes | Yes | Yes | Yes | No | No | See `05` |
| Device identity | Public | `deviceId` (opaque string) | One physical/logical Device | Until revoked | Caller-chosen at registration | `FedosDeviceBindingV1` | Yes (via Device Binding facts) | No (private-transport only) | No | Yes | Yes (terminal) | No (new `deviceId` required) | New Device Binding required |
| Device signing key | Secret | `publicKeyHex` (opaque ref: `devicePublicKeyRef`) | One Device, one process | Process-memory only | Real CSPRNG (`schnorr.utils.randomSecretKey()`) | Never durably persisted | Public half only, best-effort | No | No | No | Implicitly, via Device revocation | No | Device must be replaced (new keypair) |
| Device Binding | Public (metadata) | `deviceId` + `accountRef` | The account, for one Device | Until revoked | Registration authority | Append-only Device Registry | Partially (trust state) | No | No | Yes | Yes (terminal `"revoked"`) | No | See `11` |
| Conversation identity | Public | `FedosConversationId` = `boardId::threadId` | The Conversation | Life of the thread | Local board/thread ids only — NEVER a pubkey | Conversation/Membership/Envelope persistence | Yes | No (never embeds pubkeys) | Yes | No | N/A | N/A | Unaffected by any identity rotation (see `13`) |
| Membership identity | Public | `FedosConversationMembership.participant` (= a Conversation participant reference) | The Conversation | Until `revoked`/`left` | Set at draft/redemption time | Membership persistence | Yes | No | Yes | No | Yes (`revoked`/`left`) | No | See `13` |
| Peer/contact identity | Public | `FedosConversationParticipantReference{authority,publicIdentifier,identityId}` | The peer's own account | Indefinite, until superseded | Whatever the peer's own account identity currently is | Membership, capability, observation records | Yes | Yes (via Nostr events) | Yes | No | N/A | No (peer-controlled) | Orphaned records if the peer's own identity changes (see `10`) |
| Ratchet session identity | Public (structure), secret (bound keys) | `FedosDirectRatchetSessionId` (8-segment string, embeds truncated account pubkeys) | One Device pair | One generation | `(localAccountRef, localDeviceRef, remoteAccountRef, remoteDeviceRef, conversationId, suite, generation)` | Session persistence | No (never transmitted) | No | No | No | Yes (`revoked` lifecycle state) | No (new generation only) | See `12` |
| Ratchet DH public key | Public | `ratchetPublicKeyHex` | One session generation | One generation | Real ECDH keypair, ephemeral per generation | `session-init` NIP-17 payload, live-state snapshot | Yes (to the session peer only) | No | No | No | Superseded on reset | N/A (ratchets by design) | Session-scoped only, unrelated to account/Nostr rotation |
| Capability-advertisement identity | Public | `senderAccountRef`/`senderDeviceRef` inside `FedosRatchetPeerCapabilityAdvertisementV1` | The advertising Device | One advertisement's `revision` | Copied from the account/Device identity active at signing time | Peer Capability Observation (recipient side only) | Yes (to the one addressed recipient) | No | No | No | N/A | N/A | Static snapshot; orphaned if the account rotates (see `10`, `16`) |
| Archive identity reference | Public | Whatever `FedosConversationParticipantReference` was live at message time, embedded in restored Membership/Envelope facts | The Archive | Permanent, immutable | Copied verbatim at archive time | Archive bundle | No (local only) | No | Yes (by definition) | No | No — historical facts are never revoked | No | Never rewritten (see `14`) |

## Governing rule

**Account identity and Nostr identity are literally the same layer in
this codebase today** (row 3 = row 4, verified in `04`/`05`) — this
review treats "account identity rotation" and "Nostr identity rotation"
as one decision, not two, and states this explicitly rather than
analyzing them as if independent (`06`, `20`).
