# Secure Runtime Alpha 421 — Existing Nostr Outbound Construction Inventory

**Status: this Stage is REVIEW ONLY — it makes NO code change.** Stage 1
of the Alpha 421–430 Nostr Outbound Board Publisher Foundation Arc
(Phase B). **Conclusion: Phase B is BLOCKED at this Stage — see §4.**

## 1. Method

Traced the full path `FedosBoardPost → Nostr Event fields → Event ID →
Signature → wire shape`, by direct inspection of:
`packages/fedos-core-rust/src/lib.rs` (all `pub`/`pub(crate)` items
touching Nostr key material), every `#[wasm_bindgen]`-annotated export
in that file, `src/nostr/{event,crypto,signature,noble_signature,publish,types}.ts`,
`src/desktop/{fedos_event_descriptor,fedos_nostr_wire_event,fedos_relay,websocket_relay}.ts`,
`src/desktop/desktop_application.ts`, `src/identity/*`, and
`src/sign/{nip07,publish_flow,validate}.ts`, plus the design docs and
tests for Alpha 141–200 (Deterministic Identity Derivation / Nostr
Secret Key / Schnorr Signing / Event Foundation Arcs).

## 2. Findings, numbered per the Arc instruction

1. **Rust owns the only real Nostr secret-key material, and it is
   `pub(crate)`-confined, deliberately.** `FedosNostrSecretKeyHandle`
   (`packages/fedos-core-rust/src/lib.rs`, ~line 3444) wraps a
   `SecretHandle` and is declared `pub(crate) struct` — confirmed by
   direct read AND by `test/secure_runtime_alpha_163_nostr_secret_key_handle.test.ts`'s
   own structural assertion (`expect(libRsSource).not.toMatch(/^pub struct FedosNostrSecretKeyHandle/m)`).
   Its own byte-exposure method is named
   `expose_bytes_for_internal_nostr_secret_key_derivation` — `pub(crate)`,
   named "internal" deliberately, with a doc comment restricting its
   real use to `derive_nostr_secret_key_internal`'s own caller
   discipline.
2. **Account-index derivation, public-key derivation, and BIP-340
   signing are ALL `pub(crate)` internal Rust functions** —
   `derive_nostr_root_internal`, `derive_nostr_secret_key_internal`,
   `derive_nostr_public_key_internal`, `derive_nostr_signature_internal`
   (names read directly from `lib.rs`) — none is `pub`, none is
   `#[wasm_bindgen]`.
3. **Public identifier encoders exist but operate on already-public
   data only** (`src/identity/fedos_nostr_public_identity_source*.ts`,
   `FedosIdentityDescriptor` — `id`/`provider`/`publicIdentifier`/
   `displayName`/`avatar`, all public by Alpha 028/045's own explicit
   exclusion list) — no path from these back to secret material.
4. **No TypeScript Event builder exists for OUTBOUND construction.**
   `src/nostr/event.ts` exposes `serializeForId` (canonicalization for
   id computation) only; `src/desktop/fedos_nostr_wire_event.ts` and
   `fedos_event_descriptor.ts` are READ-side shapes for INBOUND,
   already-signed events.
5. **`WebSocketRelay.publish()`/`FedosRelay.publish()`
   (`src/desktop/websocket_relay.ts`/`fedos_relay.ts`) accept an
   already-built, already-signed wire event — neither signs, neither
   knows about Nostr keys of any kind.** Confirmed reusable AS
   TRANSPORT for a future publisher, once a signed event exists.
6. **The Rust crate exposes exactly 13 `#[wasm_bindgen]` functions
   today, and NONE relates to Nostr signing or event construction** —
   confirmed by direct enumeration; every one concerns AEAD key
   generation/encryption (`generate_aead_key_handle`, `encrypt_aead`,
   and their surrounding request/response/error types). **TypeScript
   CANNOT invoke the real Rust Nostr signing/event path today, at all,
   through any existing export.**
7. **No outbound Event Builder of any kind exists** — confirmed by
   grep across `src/`: no function anywhere constructs an unsigned Nostr
   event from a `FedosBoardPost` or otherwise.
8. **`OK`-to-Outbox correlation**: moot given finding 6 — no signed
   event can be produced to publish and correlate an `OK` against, this
   Arc.
9. **Host CAN coordinate Board + Outbox honestly without a network
   call** — already implemented and shipped in Phase A
   (`submitPostWithOutbox`, Alpha 419) — this finding is UNAFFECTED by
   the signing-boundary blocker below, since Phase A never needed real
   cryptography.
10. **Ripple scope for Phase B, as designed, would have been**:
    `src/board/publish/nostr/*` (new) plus zero changes to `src/nostr/*`,
    `src/desktop/fedos_relay.ts`, or `src/desktop/websocket_relay.ts`
    beyond consuming their EXISTING public surface — moot, since Phase
    B does not proceed past this Stage (§4).

## 3. Separately confirmed: TypeScript-side Nostr crypto is
   VERIFY-ONLY, by the module's own explicit documentation

`src/nostr/noble_signature.ts`'s own header states, verbatim: **"This
module verifies only; it never signs. No private keys are involved."**
`src/nostr/signature.ts` defines only a `SignatureVerifier` interface
(`verify(event): Promise<boolean>`) — no `sign` method exists on any
type in `src/nostr/`. `src/sign/nip07.ts` implements a NIP-07
(`window.nostr`-shaped) EXTERNAL signer delegate — genuinely
key-material-free by its own design ("it never holds, generates, or
stores a private key") — but it is a BROWSER-extension-injection
pattern with no Desktop Host wiring anywhere in this repository, and
inventing that wiring is a nontrivial new design decision this Arc's
own instruction does not authorize ("smallest honest boundary," not "a
new signing-delegation product surface").

## 4. Critical finding — STOP AND REPORT, per this Arc's own instruction

**TypeScript cannot invoke the existing Rust Nostr signing/event path
without a new WASM export (finding 6), and this repository has no
other real signing authority reachable from `FedosDesktopHost` today
(finding 3, §3).** This Arc's own instruction is explicit and binding:

> "If TypeScript cannot invoke the existing Rust signing/event path
> without a new WASM export or secret-boundary redesign, STOP AND
> REPORT before implementing a second signing stack. Do not duplicate
> private-key cryptography in TypeScript."

A new WASM export is a Rust change — forbidden by this Arc's own
Absolute Prohibitions (`Rust changes`, `Cargo.toml changes`).
Re-deriving/re-signing in TypeScript using `@noble/curves` (already a
dependency, used today for VERIFICATION only) would require either
duplicating the entire deterministic key-derivation hierarchy in a
second language (explicitly forbidden: "duplicate cryptography
implementation") or exporting the real derived secret bytes out of Rust
for TypeScript to sign with (explicitly forbidden: "raw secret export",
"no raw-secret boundary regression"). Wiring NIP-07 into the Desktop
Host is not itself prohibited by name, but it is a genuinely new
signing-delegation integration this Stage did not find pre-designed
anywhere, and inventing it now would not be "the smallest honest
boundary" this Arc's own Alpha 423/424 explicitly require — it would be
a new product surface decided unilaterally, mid-Arc.

**Per this Arc's own instruction (Alpha 430 §"If cryptographic boundary
blocked Phase B"), Phase B (Alpha 422–430) is not attempted.** No
mapping decision, no publisher input boundary, no event builder, no
transport, no delivery observation, no restart/idempotency test, and no
four-protocol safety verification is implemented for Alpha 422–430 —
implementing any of them would require exactly the signing capability
this Stage confirms does not exist reachably.

## 5. See also

- `docs/secure_runtime_alpha_420_outbox_foundation_completion.md`
- `docs/secure_runtime_alpha_163_nostr_secret_key_handle.md`
- `docs/secure_runtime_alpha_182_nostr_signature_handle.md`
