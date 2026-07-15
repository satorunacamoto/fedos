# Secure Runtime Alpha 452 — Publisher Scope and Return Contract Decision

Stage 2 of the Alpha 451–460 Canonical Nostr Outbound Publisher
Foundation Arc. Decision only — no code changes.

## 1. Why this Arc is narrower than README's own "Next Arc" recommendation

Alpha 450 §7 recommended "Secure Runtime Alpha 451–460: Nostr Outbound
Board Publisher **& Delivery Observation** Arc," naming OK-message
correlation and retry/backoff policy as in-scope. This Arc's own
instructions are DELIBERATELY narrower: transport only. This Stage
records that narrowing as an explicit decision, not an oversight —
delivery observation and retry policy remain real, undone work for a
future Arc, not silently dropped.

## 2. Options considered for scope

- **Option A — full flow (Board Reader → Signing → Publish → Observe →
  Retry).** REJECTED this Arc: pulls in OK-correlation (Alpha 236/238's
  own `onRelayMessage` listener) and a retry/backoff policy, both
  explicitly prohibited by this Arc's own instruction list.
- **Option B — transport-only Publisher (Outbox intent + already-signed
  event → `FedosRelay.publish()`), success/failure boolean only.**
  ADOPTED. Matches this Arc's own explicit scope list verbatim:
  Publisher Interface, NostrPublisher, `publishOne()`, `publishBatch()`,
  Outbox→Relay conversion, Relay send, transport only.
- **Option C — do nothing this Arc, defer entirely to a future Arc.**
  REJECTED: Alpha 448's own Publisher-readiness review found zero
  missing dependency shape; every boundary this Publisher needs
  (`FedosBoardOutboxIntent`, `FedosNostrWireEvent`, `FedosEventDescriptor`,
  `FedosRelay.publish()`) already exists and is stable (Alpha 451 §1).
  There is no remaining reason to defer the transport-only slice.

## 3. Return contract decision

`publishOne()`/`publishBatch()` return a **boolean success/failure
signal only** — this Arc's own explicit instruction ("publish()成功/
失敗のみ返す"). Options considered:

- **Result object** (`{ outcome, reason }`, mirroring the UNRELATED
  stray `FedosBoardOutboxPublishResult` shape found at Alpha 451 §4).
  REJECTED: a `reason`/`outcome` field is Observation vocabulary, and a
  `retryPolicy` field is Retry vocabulary — both explicitly prohibited.
- **`Promise<void>`, mirroring `FedosRelay.publish()` itself.**
  REJECTED: this Arc's own instruction requires the CALLER be able to
  distinguish success from failure without a `try`/`catch` of its own —
  `FedosRelay.publish()` itself already throws on transport failure
  (Alpha 216); this Publisher's own job is to absorb that throw and
  report it as data, not to propagate it further.
- **`boolean` (`true` = the one `relay.publish()` call resolved; `false`
  = anything else — protocol mismatch, a thrown/rejected
  `relay.publish()`).** ADOPTED. No failure-reason vocabulary of any
  kind — uniform, unambiguous, and the smallest contract that answers
  "did this one attempt succeed."

## 4. Absolute prohibitions carried into every later Stage

No Retry, Backoff, Observation (delivery-state query, OK/NOTICE
correlation), ACK processing, connection Pool, GUI, ActivityPub,
AT Protocol, Session, Ontology, or `p2p/` reference in any file this Arc
adds or touches — re-verified mechanically by Alpha 459.

## 5. See also

- `docs/secure_runtime_alpha_451_existing_publisher_boundary_inventory.md`
- `docs/secure_runtime_alpha_450_master_seed_authority_and_nostr_signing_activation_completion.md`
- `docs/secure_runtime_alpha_216_publish_api.md`
