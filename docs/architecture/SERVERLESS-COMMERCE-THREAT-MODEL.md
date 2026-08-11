# Serverless Commerce Threat Model

Status: **DESIGN ONLY — no source changed by this document.**
Parent: [COMMERCE-DECENTRALIZED-DATA-PLANE.md](./COMMERCE-DECENTRALIZED-DATA-PLANE.md)

## 1. Tor threat model — accurate claims only

**Grounding:** `src/os/messenger/onion/` contains only an 18-line `README.md`; zero onion-routing code exists in this repository today (confirmed by direct grep, corroborating the prior audit's "onion corpus is 6,050 lines of zero code" finding — that figure is the size of the *design docs*, `docs/fedos_onion_like_routing.md` + `docs/fedos_transport_modes.md` + related, not implementation). The `tor_nostr_ipfs` `FedosNetworkProfile` in the parent doc is therefore a **transport routing flag for a future implementation**, not a description of anything that runs today.

The accurate claim, stated plainly, for when Tor transport is eventually implemented:

> **Tor can reduce direct network exposure (hides the device's own IP from relays/gateways/IPFS nodes it talks to), but does not make IPFS/Nostr metadata automatically private.** Tor is a transport-layer anonymity tool. It says nothing about what the *application-layer* data itself reveals once it reaches a relay, gateway, or IPFS node — that is a data-classification problem (`COMMERCE-PRIVACY-DATA-CLASSIFICATION.md`), not a transport problem.

### 1.1 Leakage channels that Tor does NOT close

| Channel | What leaks even over Tor | Why Tor doesn't help |
|---|---|---|
| **DHT leakage** | IPFS content routing (Kademlia DHT) announces "I have CID X" to the network as part of normal IPFS operation — this announcement itself is a queryable, semi-public fact, independent of which IP made the announcement. | Tor hides *who* announced it (partially — see relay metadata below), not *that* it was announced, nor which CIDs exist. |
| **CID correlation** | Reusing the same CID across multiple products, personas, or time windows lets an observer correlate them (same underlying ciphertext bytes) even without ever seeing plaintext. | Tor provides no protection against correlating *public, content-derived identifiers* — that's a property of the identifier itself, not of the network path used to fetch it. |
| **Relay metadata** | Nostr relays see: which pubkey published which event, at what timestamp, of what size, to which relay — even for encrypted-content (NIP-44) events, the *event metadata* (kind, pubkey, created_at, tags) is plaintext by protocol design. | Tor hides the publisher's IP from the relay; it does not hide the event metadata the relay operator can see by definition of running a relay. |
| **Timing leakage** | Request timing (when a CID was fetched, when an event was published) can correlate a persona's activity pattern across otherwise-unlinked epochs/personas, or correlate a buyer's fetch of a manifest with a merchant's publish of it. | Tor adds latency variance but does not provide traffic-analysis resistance against a patient, correlating observer — this is a known, general limitation of low-latency anonymity networks, not specific to FedOS. |
| **Public gateway leakage** | If a client (or a buyer without a full IPFS node) fetches a CID via an HTTP-to-IPFS public gateway rather than the P2P network directly, the gateway operator sees a plain HTTP request for that CID from the requesting IP. | Using Tor to reach the gateway closes the IP-to-gateway-operator link, but the gateway operator (and anyone who logs its traffic) still learns "someone, via Tor, fetched CID X at time T" — request pattern and CID remain visible to the gateway regardless of transport. |

### 1.2 No anonymity guarantees

This design makes **no anonymity guarantee**. Specifically it does **not** claim:

- Unlinkability of a persona's Nostr publishing pattern from its IPFS fetch pattern (a determined relay+gateway-colluding observer can plausibly correlate timing).
- Protection against a global passive adversary (out of scope for Tor generally, and out of scope for this design specifically).
- That running the `tor_nostr_ipfs` profile makes a merchant's real-world identity unrecoverable — it raises the cost of correlation, it does not make correlation impossible.

## 2. Threat tabletop

For each scenario: what leaks / what remains protected / what can be verified / what FedOS cannot guarantee.

### T1 — Relay observes events
- **Leaks:** publishing pubkey, event kind, timestamp, event size, tags (per NIP-01/relay-metadata reality above) for every Commerce event this persona ever publishes to that relay.
- **Protected:** any field classified ENCRYPTED NOSTR or better in `COMMERCE-PRIVACY-DATA-CLASSIFICATION.md` (order/payment/buyer identity content) — ciphertext only.
- **Verifiable:** the relay (or anyone downstream) can verify event signatures, but cannot verify ciphertext content.
- **Cannot guarantee:** that a relay operator, given enough events over time, can't build a behavioral profile of publishing cadence/volume for a given persona epoch.

### T2 — IPFS node observes CID request
- **Leaks:** the requesting node's participation in fetching a specific CID (size, rough content-type if content-type is itself part of the manifest and colocated in the request pattern — it is not embedded in the CID request itself, only correlatable via the separately-fetched manifest).
- **Protected:** plaintext content (encrypted before content-addressing, per `COMMERCE-MEDIA-STORAGE.md` §5).
- **Verifiable:** the fetching node can verify `integrityHash` matches the fetched ciphertext.
- **Cannot guarantee:** that repeated fetches of the same CID by the same requester don't build a fetch-pattern profile of that requester's interest in a specific product.

### T3 — Public gateway sees request
- **Leaks:** requester IP (unless Tor-routed — see §1.1), CID requested, timestamp — visible to the gateway operator in plain HTTP logs.
- **Protected:** content itself (still ciphertext).
- **Verifiable:** nothing new beyond T2 from the requester's side; the gateway operator gains a stronger position (IP-linked, not just network-position-linked) than a P2P DHT observer.
- **Cannot guarantee:** gateway operators don't retain logs indefinitely; FedOS controls neither gateway policy nor retention.

### T4 — Buyer and merchant collude
- **Leaks:** nothing beyond what each already legitimately knows — collusion is two parties who already hold the ENCRYPTED NOSTR channel's plaintext, pooling it (e.g. to fabricate a `TradeCompletionAttestation` for a trade that didn't really happen as described, or to inflate reputation).
- **Protected:** nothing extra is protected against this — it's an endpoint-trust problem, not a wire-protocol one.
- **Verifiable:** a third party can still verify that both signatures on the resulting attestation are cryptographically valid — it cannot verify the *underlying trade actually occurred as claimed*.
- **Cannot guarantee:** that a bilateral, mutually-signed attestation reflects a real transaction. This is a fundamental limit of any self-reported bilateral attestation scheme and is explicitly *not* solved by this design (see `PSEUDONYMOUS-REPUTATION.md` §5).

### T5 — Rating spam
- **Leaks:** nothing new.
- **Protected:** the requirement for bilateral (not unilateral) attestation signing (§2 of the reputation doc) raises the cost of pure spam versus a single-party "leave infinite fake reviews" model.
- **Verifiable:** each attestation's dual signature is independently checkable, so spam volume is at least *counted honestly* (no forged counterparty signatures) even if the *trades themselves* are collusive (see T4).
- **Cannot guarantee:** spam-proofness. Two colluding parties can still mass-produce mutually-signed attestations (this collapses into T4 + Sybil, T6). Rate-limiting/staking/cost mechanisms are not specified in this design.

### T6 — Sybil personas
- **Leaks:** nothing extra.
- **Protected:** each `PersonaEpoch` requires its own keypair and, to gain reputation, its own set of counterparty-corroborated attestations — creating many personas doesn't itself grant reputation, only real (or collusive, see T4) bilateral trade attestations do.
- **Verifiable:** an observer can count distinct epoch keys and see that reputation is per-epoch, not free.
- **Cannot guarantee:** Sybil resistance. Nothing in this design imposes a cost (staking, proof-of-work, identity binding) on creating new personas — this is an explicitly open gap, consistent with the parent doc's "open decisions" and with prior repo findings (memory: "market solved fraud with collateral, not identity" — a collateral-based mitigation is a plausible follow-up but is not part of this design).

### T7 — Old Persona key compromised
- **Leaks:** an attacker holding a compromised old epoch key can sign new `CarryOverProof`s or attestations *as that old epoch*, retroactively or going forward, until the compromise is discovered.
- **Protected:** per `PERSONA-EPOCH-ROTATION.md` §4, "a compromised old epoch key alone never proves a carry-over claim legitimate" — but that rule constrains what a *verifier* should conclude, it does not prevent the attacker from *producing* a signature.
- **Verifiable:** the signature itself is cryptographically valid (that's the problem — compromise doesn't break signature validity).
- **Cannot guarantee:** revocation. This design has **no revocation registry** for a compromised epoch key (flagged explicitly as an open item in `PERSONA-EPOCH-ROTATION.md` §8). A user's only mitigation today, at the design level, is to rotate to a fresh epoch with `evidenceLevel: "none"` and lose the linkable carry-over, rather than "revoke and keep the old epoch's reputation."

### T8 — Epoch rotation
- **Leaks:** if `evidenceLevel: "old-epoch-key-signed"` is chosen, the link between old and new epoch is *intentionally* disclosed (see `PERSONA-EPOCH-ROTATION.md` §7 linkability table) — this is a deliberate user trade-off (keep reputation, accept linkability), not an accidental leak.
- **Protected:** with `evidenceLevel: "none"` or `"self-attested-only"`, no third party can cryptographically link the two epochs.
- **Verifiable:** whichever evidence level was chosen is itself verifiable as to *which level it is* — a verifier always knows how much to trust a carry-over claim.
- **Cannot guarantee:** that a persona choosing `"none"` isn't *behaviorally* linkable via out-of-band signals (writing style, timing patterns, product catalog overlap) — this design only addresses cryptographic/protocol-level linkability, not behavioral fingerprinting.

### T9 — Merchant attempts fake reviews
- **Leaks:** nothing new beyond T4/T5 — a merchant faking reviews needs either a colluding counterparty (T4) or Sybil buyer personas (T6) to produce validly-signed bilateral attestations; a merchant cannot unilaterally forge a buyer-side signature.
- **Protected:** the bilateral-signature requirement (§2) is the primary structural defense — a fake review requires a fake *counterparty*, not just fake text.
- **Verifiable:** anyone can check both signatures are present and valid.
- **Cannot guarantee:** that a merchant operating enough Sybil buyer personas (T6) can't still produce a chain of validly-signed but fabricated attestations — same fundamental limit as T4/T6, not independently solved here.

### T10 — Buyer selectively discloses proof
- **Leaks:** exactly, and only, what the buyer chooses to disclose via Layer 2 (pseudonymous proof) or a scoped `CapabilityGrant` (Layer 3) — this is the *intended* behavior of the semi-public board design (`PSEUDONYMOUS-REPUTATION.md` §6), not a leak.
- **Protected:** everything not explicitly included in the disclosed attestation/claim set remains at its original classification (LOCAL ONLY / ENCRYPTED NOSTR / OPTIONAL DISCLOSURE).
- **Verifiable:** the recipient of a selective disclosure can verify every signature in what was disclosed, and can verify that nothing beyond the scoped `CapabilityGrant`'s resource was handed over (grant scoping is checked at the composition-root boundary, per `PSEUDONYMOUS-REPUTATION.md` §6).
- **Cannot guarantee:** that the recipient of a selective disclosure doesn't retain/re-share it after receiving it — once disclosed to a party, FedOS has no technical control over that party's copy (standard limitation of any disclosure-based, non-DRM system).

### T11 — Media modified
- **Leaks:** nothing new.
- **Protected:** `integrityHash` in the `SignedProductMediaManifest` binds the manifest's signature to specific ciphertext bytes — any modification to the stored bytes (by a malicious/faulty IPFS node, or a tampered gateway) is detectable because the fetched bytes' hash won't match `integrityHash`.
- **Verifiable:** any client can independently recompute the hash of fetched bytes and compare to the signed manifest's `integrityHash` before ever attempting to decrypt/render.
- **Cannot guarantee:** availability of the *correct* bytes (see T12) — integrity checking detects tampering, it does not repair or guarantee delivery of the unmodified original.

### T12 — Ciphertext unavailable
- **Leaks:** nothing.
- **Protected:** nothing is exposed by unavailability — this is an availability failure, not a confidentiality failure.
- **Verifiable:** `MediaStorePort.has(ref)` (design, `COMMERCE-MEDIA-STORAGE.md` §2) lets a client cheaply detect unavailability before attempting a full fetch, and the Product/manifest metadata (title, description, price) remains usable even if the media blob is gone — this is why the manifest is a *separate*, always-public-metadata layer from the blob itself.
- **Cannot guarantee:** long-term availability of any given CID. This design does not specify a pinning/replication strategy (flagged as an explicit open decision in `COMMERCE-DECENTRALIZED-DATA-PLANE.md` §5, item 3) — IPFS content with no pinning party can become permanently unfetchable, and FedOS provides no guarantee against that today.

## 3. Summary table

| # | Scenario | Guarantee level |
|---|---|---|
| T1 | Relay observes events | Metadata leaks by protocol design; content protected. |
| T2 | IPFS node observes CID request | Fetch-pattern leaks; content protected. |
| T3 | Public gateway sees request | IP+CID leaks (unless Tor); content protected. |
| T4 | Buyer/merchant collude | Not solved — endpoint-trust limit. |
| T5 | Rating spam | Partially mitigated (bilateral signing); not spam-proof. |
| T6 | Sybil personas | Not solved — no Sybil-resistance cost mechanism specified. |
| T7 | Old Persona key compromised | Not solved — no revocation registry. |
| T8 | Epoch rotation | Working as designed — linkability is an explicit user choice. |
| T9 | Fake reviews | Structurally raised cost (needs a counterparty); not eliminated. |
| T10 | Selective disclosure | Working as designed; no control over post-disclosure re-sharing. |
| T11 | Media modified | Detected via integrity hash. |
| T12 | Ciphertext unavailable | Detected; not prevented — no pinning strategy specified. |
