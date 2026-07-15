# Secure Runtime Alpha 430 — Nostr Signing Boundary Completion Gate / Declaration

Stage 6 of the Alpha 422–430 Nostr Outbound Signing Boundary Decision &
Foundation Arc. Declares only what was honestly achieved. **Alpha 428
and Alpha 429 do not exist as docs or tests** — nothing was implemented
to adapt (Alpha 428) or verify (Alpha 429), and fabricating either
would misrepresent unattempted work, matching this repository's own
established precedent (`docs/secure_runtime_alpha_420_outbox_foundation_completion.md`
§3, which likewise skipped fabricating Alpha 422–430 docs when Phase B
blocked at Alpha 421).

## 1. Completion declaration — Phase A (Alpha 422–426)

Declared complete:

- **Existing Rust/WASM boundary inventory** — twelve questions
  answered with exact `file:line` citations
  (`docs/secure_runtime_alpha_422_nostr_signing_boundary_inventory.md`).
  Established the crate's own existing precedent for exposing opaque
  secret-bearing handles across WASM safely (`AeadKeyHandle`/`AeadCiphertextHandle`),
  and that no new Cargo dependency or feature is required for a narrow
  Nostr export.
- **Signing boundary option adopted** — Option A (narrow WASM export
  wrapping the existing Rust pipeline), Options B/C/D/E/F compared and
  rejected with reasons specific to this repository's own inventory,
  not merely restated from the Arc's own prediction
  (`docs/secure_runtime_alpha_423_nostr_signing_boundary_options.md`).
- **Signing authority scope decided** — Option D: fixed `kind = {1}`,
  deterministic `accountIndex`-derived pubkey only, no caller-supplied
  `pubkey`/`id`/`sig`, no `FedosBoardPost` coupling
  (`docs/secure_runtime_alpha_424_nostr_signing_authority_scope.md`).
- **Input model specified** — `FedosNostrUnsignedEventRequest`, five
  fields, fail-closed validation rules
  (`docs/secure_runtime_alpha_425_nostr_signing_input_model.md`).
- **Output model specified** — reuse of the existing
  `FedosNostrWireEvent` shape; explicit decision NOT to introduce a
  fourth duplicate signed-event type
  (`docs/secure_runtime_alpha_426_signed_nostr_event_output_model.md`).

## 2. Phase B result (Alpha 427–430)

Phase B was attempted starting at its own required first Stage, Alpha
427 (minimal Rust signing boundary implementation). That Stage found
that Alpha 422's own inventory (§13) already established no real
Master Seed material exists anywhere reachable at runtime, in Rust or
TypeScript — every use of `FedosMasterSeedHandle` is confined to
`#[cfg(test)]` fixture bytes, and Master Seed storage/import was
explicitly deferred to "a future Storage Review" at Alpha 144 and never
since revisited. Both paths to obtaining a real seed for the authority
— generating one internally (practically useless, produces a
different identity every session) or accepting raw bytes from
TypeScript (requires JS to hold Master Seed bytes with no existing
protected source, straining Security Invariant 1 at its true origin)
— were evaluated and rejected in
`docs/secure_runtime_alpha_427_minimal_rust_signing_boundary.md`. Per
that Stage's own binding instruction ("if no safe seed authority
exists, stop and report rather than improvising one"), **Phase B is
NOT implemented.** No `FedosNostrSigningAuthority` struct, no new
`#[wasm_bindgen]` export, no `Cargo.toml` change, no
`src/desktop/fedos_nostr_signing_authority.ts`, no
`src/desktop/fedos_wasm_nostr_signing_authority.ts`.

## 3. Gate verification

- **`p2p/` untouched**: confirmed — not modified, staged, imported, or
  inspected by this Arc.
- **No secret-bearing generated artifact committed**: confirmed —
  `packages/fedos-core-rust/pkg/` remains absent from disk and
  gitignored; no `target/`/`Cargo.lock` change.
- **No raw secret getter added**: confirmed — zero Rust file modified.
- **No new dependency**: confirmed — `Cargo.toml`/`package.json`
  untouched; Alpha 422 §5 already established none was required.
- **Outbox files unchanged**: confirmed — no file under
  `src/board/outbox/` or `fedos_desktop_host.ts` touched.
- **Board/Query/Host write semantics unchanged**: confirmed — no
  `src/board/` or `src/desktop/host/` file touched.
- **Inbound Protocol Adapters unchanged**: confirmed — no
  `src/desktop/nostr_event_id_verifier.ts`,
  `nostr_signature_verifier.ts`, or `combined_inbound_event_validator.ts`
  touched.
- **No temporary compile probe left behind**: confirmed — none was
  created; the Rust safety conclusion (Alpha 422 §3–§5) was reachable
  entirely from static inspection of the existing precedent
  (`AeadKeyHandle`/`AeadCiphertextHandle`) without compiling a probe.

**Gate: Phase A PASSED. Phase B BLOCKED — honestly, not silently.**

## 4. Next Arc recommendation

**Not** "Secure Runtime Alpha 431–440: Nostr Outbound Board Publisher
Arc" — that recommendation is conditioned on Alpha 427–430 completing,
which it did not; a Publisher Arc would immediately rediscover this
same blocker with no new information gained.

**Recommended: Secure Runtime — Master Seed Authority Boundary Arc**
(numbering TBD by whichever Stage sequences it), the "future Storage
Review" Alpha 144 already named and deferred, now overdue. Its job:
decide, and implement, exactly ONE safe, reviewed way for a real
32-byte Master Seed to come into existence and be held such that
(a) it is NOT regenerated randomly every session, (b) it is NOT ever
required to sit as raw bytes in ordinary JS-reachable memory
unprotected, and (c) its own storage/backup/unlock story is decided
deliberately rather than assumed. Only once that Arc lands does a
Nostr Signing Authority (this Arc's already-complete Phase A design,
Alpha 423–426) have a real seed to construct against — at which point
Phase B (Alpha 427–430) can be attempted again using the SAME design,
with zero re-litigation needed.

## 5. See also

- `docs/secure_runtime_alpha_422_nostr_signing_boundary_inventory.md`
- `docs/secure_runtime_alpha_423_nostr_signing_boundary_options.md`
- `docs/secure_runtime_alpha_424_nostr_signing_authority_scope.md`
- `docs/secure_runtime_alpha_425_nostr_signing_input_model.md`
- `docs/secure_runtime_alpha_426_signed_nostr_event_output_model.md`
- `docs/secure_runtime_alpha_427_minimal_rust_signing_boundary.md`
- `docs/secure_runtime_alpha_421_existing_nostr_outbound_construction_inventory.md`
- `docs/secure_runtime_alpha_144_recovery_threat_model_decision.md`
