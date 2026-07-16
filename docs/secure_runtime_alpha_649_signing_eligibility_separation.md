# Secure Runtime Alpha 649 — Signing Eligibility Separation

Stage 9. Formalizes:

```
Canonical Board Author  ≠  Nostr Signing Authority  ≠  Display Pseudonym
```

- **Canonical Board Author** = `FedosBoardAuthorReference` (Alpha 254)
  — what `FedosBoardPost.author` durably records.
- **Nostr Signing Authority** = `FedosNostrSigningAuthority`
  (`src/nostr/sign/fedos_nostr_signing_authority.ts`, Alpha 442/445) —
  what actually produces a valid `sig` over an event.
- **Display Pseudonym** — no such concept exists anywhere in this
  codebase (confirmed by inventory, Alpha 641) — this Arc introduces
  none either.

## The confirmed blocker

A resolved Nostr-compatible author (`protocol: "nostr"`) is eligible
for a Nostr Outbox target ONLY IF signing authority proves control of
the matching identity. Direct inspection of
`FedosNostrSigningAuthority`/`FedosWasmNostrSigningAuthority` (Alpha
641 §8) confirms: `signEvent(request)` takes an `accountIndex: number`
only — there is no method anywhere that maps an `accountIndex` to a
`publicIdentifier`, and no method that answers "does this signing
authority control the key behind identity X?"

**Matching strings alone (`author.publicIdentifier === someKnownPubkey`)
is NOT proof of key ownership** — a `publicIdentifier` is, by its own
contract (Alpha 028), already-public, non-secret data; anyone can state
it. Only a signature verifiable against that same public key would
prove control, and no such check is exposed today.

## Resolution

Per this Arc's own instruction, Nostr publication eligibility stays
**fail closed** — `evaluateFedosOutboundEligibility()`
(`src/board/runtime/eligibility/fedos_outbound_eligibility_evaluator.ts`)
returns `{ outcome: "ineligible", reason: "identity-not-controlled" }`
for EVERY `"nostr"` target, unconditionally, until a future Arc adds a
safe key-control check. This is the concrete blocker Alpha 680
recommends as the next Arc's own primary candidate ("C — Nostr
Identity-to-Signing Authority Binding Arc") when it is the dominant
limitation.
