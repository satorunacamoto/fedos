# FedOS Transport Modes — Design Review (non-binding, docs only)

**Status: research/design notes only. This document adds NO code, NO
cryptography, NO relay client, NO payment implementation, and NO
Runtime/Worker connection of any kind.** It exists to separate ONE
anonymous-delivery strategy into THREE, because DMs, public boards, and
legal content distribution have genuinely different, sometimes
CONFLICTING requirements — a single one-size-fits-all transport would
either leak DM timing to gain board-style reach, or cripple board reach
to gain DM-style timing concealment. This document names the split
*before* anyone is tempted to build one undifferentiated transport.

This is a threat-model-and-mechanism sketch, not a specification and
not a security guarantee. Do not treat any statement here as "safe",
"anonymous", or "final".

---

## 1. Why three modes, not one

- **Quiet DM Mode** optimizes for *timing concealment between two
  people who already know each other's pubkey*. Its enemy is
  correlation — every additional hop, mirror, or notification is
  attack surface, not a feature.
- **Public Board Mode** optimizes for *reach and availability of
  content nobody is hiding the existence of*. Its enemy is spam and
  abuse — anonymity of the READER is a nice-to-have, but the CONTENT
  itself is already public by design.
- **Legal Content Distribution Mode** optimizes for *buyer/seller
  transaction confidentiality for goods that are legal to sell*. Its
  enemy is framing this capability as an anonymous marketplace for
  anything — privacy protects the transaction, not the legality of
  what is being transacted.

Applying Quiet DM's minimal-hop, no-notification posture to a public
board would strangle its reach for no benefit (the content is public
already). Applying Public Board's multipath/mirror posture to a DM
would hand a timing/size-correlation attacker exactly the redundant
signal `docs/fedos_onion_like_routing.md` §9 already flags as
unsolved. They must stay separate.

## 2. Relationship to existing work

- **NIP-17/NIP-59 foundation.** All three modes assume the SAME
  underlying NIP-44/NIP-59 primitive `docs/nostr_dm_bridge.md` and
  `docs/nip44_wire_implementation_roadmap.md` already plan — none of
  it is connected yet (`docs/nip44_wire_implementation_roadmap.md`
  §"Stage 257+ candidates"). No mode in this document can be
  prototyped before that foundation is real.
- **Onion-like routing.** `docs/fedos_onion_like_routing.md` studies
  nesting Gift Wrap layers for MULTI-hop delivery. Quiet DM Mode
  (§3) deliberately does **not** adopt that idea — see §3's own
  rationale for why more hops, without the cover traffic/padding that
  document admits are unsolved, can make timing/size correlation
  WORSE, not better. The onion-like idea remains a separate, deferred,
  not-yet-decided research track; it is not any mode's default here.
- **Marketplace/payment boundary.** `docs/marketplace_boundary.md`
  already fixes that no real payment, checkout, or `PurchaseGrant` is
  implemented anywhere in this repository. Legal Content Distribution
  Mode (§5) does not change that — it only reasons about what a future
  payment integration would need to respect, if one is ever built.
- **Notification Bridge.** `docs/vault_crypto_identity.md` §"APNs / FCM
  metadata leakage" already names the risk that push-notification
  providers observe delivery metadata regardless of payload
  encryption. Quiet DM Mode's "no notification" rule (§3) is a direct
  consequence of that existing, documented risk.

## 3. Mode 1 — Quiet DM Mode

For one-to-one private messages between correspondents who already
have each other's pubkey (the ordinary NIP-17 case).

| Property | Value | Rationale |
|---|---|---|
| Foundation | NIP-17/NIP-59 (assumed, not yet connected) | Same primitive as ordinary private DMs — no new cryptography. |
| Hop count | **0–1 hop** | Zero hops (direct relay fetch) is the default; at most ONE intermediate hop, never the multi-hop nesting `docs/fedos_onion_like_routing.md` studies. Fewer hops means fewer relay-visible correlation points — see §1. |
| Notifications | **None** | No APNs/FCM/Telegram/LINE push of any kind for a Quiet DM event. Push providers see delivery timing/tokens regardless of payload encryption (`docs/vault_crypto_identity.md`); a DM whose entire point is timing concealment must not hand that signal to a third-party push provider. |
| Multipath / mirroring | **None** | A DM is fetched from ONE relay (or the small, fixed relay set the correspondents already share) — no fan-out, no mirror copies. Mirroring a DM increases the number of relays that can observe its metadata for no delivery-reliability gain proportional to the risk. |
| Zaps / payment | **None** | A Quiet DM never carries a Lightning zap request or receipt of any kind — payment metadata (amount, LNURL, zap request tags) is itself a correlation and identity signal orthogonal to the message content. |
| Delivery model | **Periodic pull** | The recipient's client polls its known relay(s) on an interval, rather than reacting to a push. This avoids the notification-provider leak above and avoids revealing "I am online right now" via an immediate fetch-on-publish pattern — at the cost of latency, which this mode explicitly accepts. |
| Priority | **Timing concealment** | Every other property in this mode is subordinate to minimizing timing/behavioral correlation between the two correspondents — reach, discoverability, and latency are NOT priorities here. |

**Explicitly unsolved, same as `docs/fedos_onion_like_routing.md` §9:**
periodic pull still leaks SOME timing information (poll interval,
jitter, or lack thereof); this document does not claim the interval
scheme is free of correlation risk, only that it is preferable to an
immediate push.

## 4. Mode 2 — Public Board Mode

For Reddit-style thread/board content this product organizes Nostr
events into — content that is public by design; nobody is hiding that
it exists.

| Property | Value | Rationale |
|---|---|---|
| Multipath / mirroring | **Allowed** | Since the content is already public, publishing to multiple relays (mirroring) increases availability and censorship-resistance with no NEW privacy cost — the content was never hidden. |
| Notifications | **Allowed** | Board activity (replies, mentions) may use the Notification Bridge boundary (`src/notification/*`) normally — there is no DM-style timing-concealment goal to protect here. |
| Abuse observation | **Mandatory** | Per `docs/fedos_runtime_positioning.md` §4 and `docs/fedos_onion_like_routing.md` §10, the Python EMSR/Ontology surface (future, unimplemented, `"PythonPlanned"`) is where abuse-pattern OBSERVATION for open, multipath, notification-enabled content must eventually live — offline research and analysis only, never the production TypeScript runtime or the Rust safety boundary. A Public Board deployment without SOME abuse-observation plan is not this mode; observation is a REQUIREMENT of this mode, not an optional add-on. |
| Spam countermeasures | **Mandatory** | An open, multipath, notification-enabled surface is the highest-abuse-risk of the three modes — the SAME "spam/abuse" risk `docs/fedos_onion_like_routing.md` §9 already named for hop peers applies here to board posting. A required countermeasure PLAN (rate limiting, proof-of-work, reputation, or moderation — none designed or implemented here) must exist before this mode is ever deployed for real. |

**Explicitly unsolved:** neither the EMSR/Ontology abuse-observation
design nor any specific spam countermeasure mechanism is specified by
this document — both are named as REQUIRED future work, not delivered
here.

## 5. Mode 3 — Legal Content Distribution Mode

For distributing content that is **legal to sell/share** (e.g., a
creator's own digital goods, per the existing `src/commerce/`/
`src/marketplace/` boundaries) where buyer/seller identity privacy
matters but the transaction itself is not illicit.

| Property | Value | Rationale |
|---|---|---|
| Content scope | **Legal content ONLY** | This mode does not exist for, and must never be marketed for, illegal goods or services of any kind. Content legality is a PRECONDITION for using this mode, not a consequence of it. |
| Mirroring | **Allowed** | Same reasoning as Public Board Mode §4 — legal, seller-published content benefits from availability; there is nothing to hide about the CONTENT's existence. |
| Payment | **Handled cautiously** | Per `docs/marketplace_boundary.md`, no real payment, checkout, or `PurchaseGrant` exists anywhere in this repository today. If a future stage ever connects one, it must compose the EXISTING `PaymentProvider` (`src/payment/`) and `EntitlementProvider` (`src/creator/entitlement.ts`) seams — never a new, parallel, less-reviewed payment path invented for this mode specifically. |
| Buyer/seller privacy | **Protected, but not the point** | Ordinary transaction-privacy protections (e.g., not exposing a buyer's full identity to the public board, not exposing a seller's unrelated activity to a buyer) are legitimate and may be applied — but privacy is a property of a LEGAL transaction here, never a marketed feature for evading law enforcement, tax reporting, or age/content restrictions. |
| Illegal-market framing | **FORBIDDEN** | See §6 for the specific forbidden wording/positioning this mode must never use. |

## 6. Forbidden framing for Legal Content Distribution Mode

Regardless of any future implementation, this mode's product surface
must **never** present, market, or design toward claims such as:

- "anonymous marketplace" / "buy anything untraceably"
- "no KYC" / "no ID required" as a FEATURE (as opposed to a plain,
  incidental fact about a specific legal product category)
- "avoid taxes" / "off the books" / "no paper trail"
- "sell anything" / any framing that treats content-legality
  gating as an obstacle to route around rather than a precondition
- Any wording implying this mode exists to facilitate illegal goods,
  services, or evasion of law enforcement

This mirrors `docs/deniable_storage_research.md` §8's existing
"forbidden UI wording" discipline for a different feature area — the
same posture (describe mechanisms and their limits; never
over-promise or invite misuse) applies here.

## 7. Comparison table

| | Quiet DM | Public Board | Legal Content Distribution |
|---|---|---|---|
| Hop count | 0–1 | N/A (public) | N/A (public) |
| Notifications | None | Allowed | Allowed |
| Multipath / mirror | None | Allowed | Allowed |
| Payment / Zaps | None | N/A | Handled cautiously, via existing seams only |
| Abuse observation | N/A (private, 2-party) | **Mandatory** | Recommended (legality gating is the primary control) |
| Spam countermeasures | N/A | **Mandatory** | Recommended |
| Primary goal | Timing concealment | Reach + availability | Legal transaction confidentiality |

## 8. What this document does NOT do

- Does **not** implement NIP-17 or NIP-59 — all three modes remain
  exactly as unconnected as `docs/nip44_wire_implementation_roadmap.md`
  already documents.
- Does **not** implement onion routing or any multi-hop relay client —
  Quiet DM Mode explicitly caps at 1 hop and does not adopt
  `docs/fedos_onion_like_routing.md`'s nesting idea.
- Does **not** implement payment of any kind — `docs/marketplace_boundary.md`'s
  "no real payment" state is unchanged.
- Does **not** connect Runtime (`create_runtime.ts`) or Worker
  (`src/worker.ts`) to anything described here.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`, or
  write `import()` of any kind (static or dynamic).
- Does **not** add a Cargo or `package.json` dependency.
- Does **not** claim any property above (timing concealment, spam
  resistance, transaction privacy) as ACHIEVED — every property is a
  design GOAL for a future implementation, never a shipped guarantee.

## See also

- `docs/fedos_onion_like_routing.md` — the multi-hop research this
  document's Quiet DM Mode explicitly does NOT adopt, and whose risk
  analysis (§9) motivates several choices here.
- `docs/nostr_dm_bridge.md` / `docs/nip44_wire_implementation_roadmap.md`
  — the still-unconnected NIP-17/NIP-44/NIP-59 foundation all three
  modes assume.
- `docs/marketplace_boundary.md` — the existing "no real payment"
  state Legal Content Distribution Mode's payment caution is
  consistent with.
- `docs/deniable_storage_research.md` — the sibling "research
  boundary, non-binding, docs only" precedent this document follows in
  structure and tone, including its forbidden-wording discipline (§8).
- `docs/fedos_runtime_positioning.md` — the repository-wide scope
  statement naming Python/EMSR/Ontology as the future home for abuse
  observation referenced in §4.
- `docs/vault_crypto_identity.md` — the source of the APNs/FCM
  metadata-leakage risk motivating Quiet DM Mode's "no notification"
  rule.
