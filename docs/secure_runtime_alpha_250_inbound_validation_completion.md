# Secure Runtime Alpha 250 — Inbound Validation Completion

**Status: this Stage is REVIEW ONLY — it makes NO further code change
of any kind. This is Stage 10, the closing Stage, of the Alpha
241–250 Nostr Inbound Event Validation Arc.**

## 1. Why now

Alpha 241 inventoried the existing (unsafe-to-reuse-as-is) validation
code and decided this Arc's own boundary; Alpha 242–246 built the
validated-event type, both cryptographic verifiers, the combined
validator, and the external delivery adapter; Alpha 247 reviewed
failure semantics; Alpha 248–249 verified the whole chain by real
execution, both standalone and wired through a real `WebSocketRelay`.
This Stage issues the Arc's own closing Completion Declaration and
freezes inbound validation at its current, deliberately minimal shape.

## 2. The Foundation, confirmed complete

```
FedosNostrWireEvent (Alpha 234, frozen)      FedosValidatedNostrEvent (Alpha 242)
  id/pubkey/created_at/kind/                   SAME seven fields, verbatim --
  tags/content/sig -- structurally               construction-restricted to
  parsed, NOT yet trusted                        combined_inbound_event_validator.ts
        |                                        by convention
        |
        v
verifyNostrEventId(event) -> boolean          verifyNostrEventSignature(event) -> boolean
  (Alpha 243) NIP-01-exact canonical              (Alpha 244) schnorr.verify DIRECTLY,
  serialization + SHA-256, reconciling            over event.id bytes, under
  the Alpha 191 JSON.stringify divergence          event.pubkey -- reuses the SAME
                                                    primitive NobleSignatureVerifier
                                                    itself calls, never redesigned
        \                                          /
         \                                        /
          v                                      v
       validateInboundNostrEvent(event) -> FedosValidatedNostrEvent | null   (Alpha 245)
         id verification FIRST, signature verification SECOND,
         null for EVERY failure (Alpha 247: eight causes, one outcome),
         deep-cloned + Object.freeze'd output

       createValidatedEventListener(listener) -> FedosSubscriptionListener   (Alpha 246)
         an EXTERNAL adapter -- zero change to FedosRelay/WebSocketRelay/NullRelay --
         wraps the EXISTING onSubscriptionMessage() (Alpha 236, unchanged)

-- verified by real execution: known-answer + full tamper matrix + NIP-01
   canonicalization edge cases (Alpha 248); wired through a real
   WebSocketRelay + fake socket, including reconnect/stale-callback and
   multi-subscription isolation (Alpha 249) --
```

Zero new Rust code, zero new Cargo dependency, zero new npm
dependency: `package.json`'s own `dependencies` count stays fixed at
2, unchanged across this whole Arc (Alpha 241 §3.6, reconfirmed here).
Every capability this Arc's own "Already complete and MUST NOT be
redesigned" list names — connection lifecycle, publish transport, REQ/
CLOSE, EVENT/EOSE/OK/NOTICE parsing, subscription-scoped delivery,
`FedosNostrWireEvent`, outbound Event ID generation, and the BIP-340
Schnorr verification PRIMITIVE itself — is confirmed UNCHANGED in its
own public contract, by direct inspection and by `git diff`.

## 3. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE. Cryptographic
validation for inbound NIP-01 Events now exists as a distinct
boundary: a parsed `FedosNostrWireEvent` becomes a trusted
`FedosValidatedNostrEvent` only after BOTH its Event ID and its
BIP-340 signature independently verify, and ONLY a validated event may
ever cross the validated-event listener boundary
(`createValidatedEventListener`, Alpha 246) — entirely in TypeScript,
entirely under `src/desktop/`, with ZERO new Cargo/npm dependency, ZERO
Rust/wasm change of any kind (Alpha 241 §3.5/§3.6, reconfirmed
throughout), ZERO Relay Pool, ZERO automatic reconnect, ZERO storage,
ZERO reference to the legacy, escaping-divergent
`src/nostr/event.ts`/`noble_signature.ts` (Alpha 241, reconfirmed
unchanged throughout this Arc), and ZERO redesign of any frozen
capability this Arc's own instruction list named.**

The following are now declared complete, exactly as this Arc's own
Alpha 250 instruction lists:

- **Inbound structural parsing** — unchanged, Alpha 233 (prior Arc).
- **Canonical Event ID verification** — `verifyNostrEventId`, Alpha
  243, reconciling the Alpha 191 escaping divergence for the inbound
  path.
- **BIP-340 signature verification** — `verifyNostrEventSignature`,
  Alpha 244, reusing the SAME `schnorr.verify` primitive
  `NobleSignatureVerifier` itself calls.
- **Validated-event type boundary** — `FedosValidatedNostrEvent`,
  Alpha 242, convention-restricted construction.
- **Fail-closed invalid-event handling** — `validateInboundNostrEvent`,
  Alpha 245; eight distinct failure causes, one indistinguishable
  outcome, Alpha 247.
- **Subscription-scoped validated delivery** — `createValidatedEventListener`,
  Alpha 246, an external adapter, zero change to the frozen transport.
- **Listener exception isolation** — confirmed at both the transport
  level (Alpha 235/236, unchanged) and the adapter level (Alpha 246's
  own inner `try`/`catch`), by real execution (Alpha 249).
- **Transport/validation/consumer separation** — confirmed structurally:
  `websocket_relay.ts` carries zero reference to
  `validateInboundNostrEvent`/`FedosValidatedNostrEvent`/any Alpha
  242–246 symbol; the validation layer carries zero reference to
  socket/connection state of any kind.

**The following remain explicitly out of scope, exactly as this Arc's
own Goals and Absolute Prohibitions lists require:**

- **Relay Pool, cross-relay deduplication** — `FedosRelay` still names
  exactly one connection target.
- **Persistent storage, moderation, deletion semantics, replaceable
  events, addressable events** — none of NIP-09/NIP-16/NIP-33's own
  semantics was touched; a validated event is handed to a caller and
  this Arc's own code retains nothing afterward.
- **DM, NIP-42, NIP-05, NIP-46** — none was added or touched.
- **Automatic reconnect, GUI** — unchanged from every prior Arc's own
  finding; `desktop_application.ts`/`create_desktop_application.ts`
  remain byte-for-byte unmodified.

**Next Arc recommendation — ONE candidate, matching this Arc's own
preferred recommendation exactly:** **Canonical Board Model Foundation
Arc.** Now that a single Relay can receive AND validate Nostr Events
honestly — the precondition this Arc's own instruction states plainly
("Relay Pool must not be recommended until a single Relay can receive
and validate events honestly," carried forward from Alpha 240 §3 one
Arc ago, and now SATISFIED) — the next product-level requirement is to
define the board/thread/reply model BEFORE multiplying transport
complexity with a Relay Pool. This Stage does not recommend another
crypto-review Arc: implementation here found no real blocker requiring
one (Alpha 241's own inventory answered all seven required questions
without discovering any gap needing further cryptographic review), and
this Arc's own instruction states plainly not to recommend one absent
such a finding.

## 4. What this Stage does NOT do

- Does **not** modify `fedos_validated_nostr_event.ts`,
  `nostr_event_id_verifier.ts`, `nostr_signature_verifier.ts`,
  `combined_inbound_event_validator.ts`, or
  `validated_subscription_adapter.ts` beyond what Alpha 242–246
  already landed — no further production code change.
- Does **not** wire this Arc's own validation capability into
  `DesktopApplication`, `AppRuntime`, or any Runtime/Worker construct.
- Does **not** implement Relay Pool, storage, moderation, the board
  model, DM, NIP-42, NIP-46, NIP-05, or GUI.
- Does **not** modify `src/desktop/desktop_application.ts`,
  `create_desktop_application.ts`, `src/identity/*`, `src/nostr/*`,
  `src/sign/*`, `create_runtime.ts`, `types.ts`, `worker.ts`, Storage,
  Observation, `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`, or
  `package.json`.

## 5. See also

- `docs/secure_runtime_alpha_249_relay_validation_integration.md`
- `docs/secure_runtime_alpha_248_known_answer_tamper_verification.md`
- `docs/secure_runtime_alpha_247_validation_failure_semantics.md`
- `docs/secure_runtime_alpha_246_validated_subscription_delivery.md`
- `docs/secure_runtime_alpha_245_combined_inbound_event_validator.md`
- `docs/secure_runtime_alpha_244_bip340_signature_verification.md`
- `docs/secure_runtime_alpha_243_canonical_event_id_verification.md`
- `docs/secure_runtime_alpha_242_validated_nostr_event_model.md`
- `docs/secure_runtime_alpha_241_existing_inbound_validation_inventory.md`
- `docs/secure_runtime_alpha_240_relay_reception_completion.md`
