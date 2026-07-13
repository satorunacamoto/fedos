# Secure Runtime Alpha 243 — Canonical Event ID Verification

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/desktop/nostr_event_id_verifier.ts`. This is Stage 3 of the
Alpha 241–250 Nostr Inbound Event Validation Arc, following Alpha
242's own `FedosValidatedNostrEvent`.**

## 1. Why now

`validateInboundNostrEvent`'s (Alpha 245) own required order names
Event ID verification as its FIRST cryptographic step. This Stage
builds exactly that, as a standalone, independently-testable function.

## 2. What was implemented

```ts
export function verifyNostrEventId(event: FedosNostrWireEvent): boolean
```

The SMALLEST honest API of the two candidates this Arc's own
instruction offered (a plain boolean vs. a `FedosEventIdValidationDecision`
object) — nothing downstream needs more than a pass/fail gate, and
Alpha 247's own "no oracle-like detailed failure reason at the public
listener boundary" requirement means a richer type would only invite a
future caller to leak one it should not.

Reconstructs NIP-01's own canonical pre-image, `[0, pubkey, created_at,
kind, tags, content]`, escaping ONLY the six characters NIP-01 itself
names (`\n` `"` `\\` `\r` `\t` `\b` `\f`), SHA-256-hashes the UTF-8
bytes, and compares the result against `event.id`.

## 3. Why NOT `src/nostr/event.ts`'s `verifyEventId` — the Alpha 191
   escaping divergence, reconciled

This Arc's own Alpha 243 instruction requires: "If TypeScript
serialization is used, explicitly reconcile it with the known legacy
escaping divergence identified in Alpha 191." Alpha 241 §3.2/§3.3
(this Arc) already found and explained the divergence precisely:
`serializeForId` (`src/nostr/event.ts`) builds its pre-image via
`JSON.stringify`, which escapes NIP-01's own six characters PLUS every
other C0 control character as `\uXXXX`. Alpha 191 §3 (Nostr Event
Foundation Arc) already flagged this as acceptable ONLY for verifying
this repository's OWN, freshly-signed outbound events — never audited
as safe for events originating from arbitrary Nostr clients, which
this Arc's own inbound path must handle.

**The reconciliation this Stage performs is: write a NEW, independent
implementation matching NIP-01's own rule exactly, rather than reusing
the divergent one.** `escapeNip01CanonicalString` (this file, private)
implements the SAME six-character rule
`escape_json_string_internal` (`packages/fedos-core-rust/src/lib.rs`,
Alpha 193) already implements in Rust — algorithm-for-algorithm, though
this file shares no code, type, or import with either the Rust module
or `src/nostr/event.ts`. Alpha 248's own known-answer tests confirm
this Stage's own implementation produces the SAME id a real,
independently-generated Schnorr-signed event's own signer computed —
by real execution, not by inspection alone.

## 4. Why no Rust/wasm boundary

This Arc's own Alpha 243 instruction: "Prefer reusing the outbound
Rust canonicalization only if an already-safe, non-public path
exists. Do not add a new wasm export solely to avoid a small,
reviewable pure verifier unless inventory proves duplication would be
unsafe." Alpha 241 §2/§5 already confirmed
`serialize_nostr_event_canonical_internal` is `pub(crate) fn`, nested
inside `master_root`, never `#[wasm_bindgen]`-exported — there is no
already-safe, non-public path from TypeScript to it. Duplicating
NIP-01's own six-character escape rule in TypeScript is a small,
closed, fully-specified, independently-testable function — exactly the
"small, reviewable pure verifier" this Arc's own instruction prefers
over a new wasm export, and no inventory finding proves the
duplication itself unsafe (Alpha 248 proves the opposite).

## 5. Structural confirmation (real inspection, this Stage)

- `verifyNostrEventId` is the ONLY export.
- Zero `await`, zero `Promise`, zero `async` keyword — fully
  synchronous.
- Zero reference to `src/nostr/*` or `src/sign/*` anywhere in this
  file.
- The private escaper matches exactly six `case` branches
  (`\n`/`"`/`\\`/`\r`/`\t`/`\b`/`\f`) with a `default` fallthrough that
  passes every other character verbatim — confirmed by direct
  inspection and by Alpha 248's own non-ASCII UTF-8 test case.

## 6. What this Stage does NOT do

- Does **not** implement `verifyNostrEventSignature` or
  `validateInboundNostrEvent` — Alpha 244/245's own deliverables.
- Does **not** perform signature verification of any kind — id
  self-consistency only, never authorship.
- Does **not** modify `src/nostr/event.ts`, `src/nostr/crypto.ts`, or
  `packages/fedos-core-rust/src/lib.rs` — all remain exactly as they
  were.
- Does **not** modify `fedos_relay.ts`, `null_relay.ts`,
  `websocket_relay.ts`, `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `desktop_application.ts`, Storage,
  Observation, `Cargo.toml`, or `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_242_validated_nostr_event_model.md`
- `docs/secure_runtime_alpha_244_bip340_signature_verification.md`
- `docs/secure_runtime_alpha_241_existing_inbound_validation_inventory.md`
- `docs/secure_runtime_alpha_193_canonical_event_serialization.md`
- `docs/secure_runtime_alpha_191_nostr_event_model_inventory.md`
