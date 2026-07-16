# Review 08 — Encryption Readiness Gate

Six independent sub-checks, matching this review's own required scope,
each verified directly against real source in `01`. Every one resolves
`"unavailable"` today, but for SIX DIFFERENT structural reasons — kept
separate because a future Arc will not resolve them all at once, and a
gate that collapses them would hide which specific one unblocked.

## 1. Authority available

`FedosRuntimeCryptoProvider.status()` returns `state: "NotConnected"`
unconditionally (`src/runtime/fedos_runtime_crypto_provider.ts`).
`NoopCryptoProvider.getStatus()` returns `state: "unavailable"`
unconditionally (`src/crypto/noop_crypto.ts`). Neither ever reaches a
different state — there is no code path, environment variable, or
constructor parameter that flips either. **Resolves: unavailable,
permanently, in this checked-out tree.**

## 2. Supported suite

`FEDOS_INTERNAL_CAPABILITY_SURFACE`
(`src/runtime/fedos_runtime_crypto_provider.ts`) names
`runtime_nip44_wire_placeholder` as `"internal-only"` — meaning the
underlying `packages/fedos-core-rust` pipeline genuinely exists and is
tested by that crate's own suite — but explicitly states this "carries
no operational meaning, changes no `encrypt`/`decrypt` behavior."
`EncryptedPayloadAlgorithm` (`src/storage/encrypted_payload.ts`) names
`"chacha20poly1305" | "aes256gcm"` as labels only, never wired to any
executing code. **Resolves: a suite is NAMED but not SELECTABLE by
anything that actually runs.**

## 3. Creator key-ready

Depends transitively on `FedosMasterSeedAuthority.isAvailable()`
(`src/runtime/master_seed/fedos_master_seed_authority.ts`), whose one
real implementation (`FedosWasmMasterSeedAuthority`) routes every
method through `attemptDevOnlyMasterSeed*Call()` — gated to
Development Runtime by naming convention, and further blocked by the
absent WASM artifact (`fedosWasmArtifactGenerated()` fixed `false`,
`src/runtime/fedos_wasm_artifact.ts`). **Resolves: unavailable outside
Development Runtime, and unavailable there too, since no `.wasm` +
bindgen pair exists in this tree at all.**

## 4. Initial epoch creatable

No `KeyEpoch`/epoch type exists anywhere in `src/conversation/` (`01`)
— `FedosConversationCapabilityDescriptor`'s own header explicitly
excludes `keyEpochReference` ("this Arc implements no encryption").
There is nothing to check readiness OF; the concept has no
representation in this checked-out tree at all. **Resolves:
structurally absent, not merely unavailable.**

## 5. Future participants can receive keys

No key-distribution mechanism of any kind exists between Membership
admission and any encryption primitive — `FedosConversationMembershipAuthority.admit()`
never touches `src/crypto`/`src/runtime` (confirmed by import
inspection, `01`). **Resolves: no code path exists to evaluate.**

## 6. Artifact/runtime activated

`fedosWasmArtifactGenerationObserved()` fixed `true` (an attempt was
made — `cargo build` succeeded, `wasm-bindgen` failed, per that file's
own Stage 457–460 header) but `fedosWasmArtifactGenerated()` fixed
`false` (no usable artifact resulted). `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED
= false`, permanently, no override path. **Resolves: unavailable, with
a documented, honest record of the one real attempt having failed.**

## The gate as construction actually must apply it

```ts
function evaluateEncryptionReadiness(): "unavailable" | "available" {
  // Every one of 1-6 above resolves to a blocking condition in this
  // checked-out tree. A real implementation would AND all six; this
  // review's own honest conclusion, verified against real source, is
  // that the AND is unconditionally "unavailable" today -- not a
  // simplification, an observed fact.
  return "unavailable";
}
```

## Metadata-only draft distinction

Per this review's own required framing: a Conversation MAY be
constructed as a metadata-only DRAFT only if explicitly and separately
distinguished from a usable/active state — `09` is the dedicated
review for that distinction and its own Option comparison. This review
does not itself decide draft-vs-reject; it only establishes that
`evaluateEncryptionReadiness()` above is the SAME gate value `09`'s
Option A/B/C/D comparison consumes as input.
