# Secure Runtime Alpha 681 — Existing Identity and Signing Inventory

Stage 1 of Phase A of the Alpha 681–720 Nostr Identity Binding & Outbound
Delivery Activation Arc.

## Findings

1. **Where the resolved `publicIdentifier` originates.** For the default
   production path, `FedosDesktopPublicAuthorAuthority.resolvePublicAuthor()`
   (`src/board/runtime/identity/fedos_desktop_public_author_authority.ts`)
   reads `DesktopApplication.currentPublicIdentity()`, which is itself
   populated by whichever `FedosPublicIdentityReader` the caller configured
   (default: `NullNostrPublicIdentitySource`, so `null`/anonymous-local
   today). Nothing in that chain ever consults a Signing Authority.

2. **Hex, npub, or another form?** Unconstrained — `FedosNostrPublicIdentitySource`
   (`src/identity/fedos_nostr_public_identity_source.ts`) defines
   `publicIdentifier: string` with no format contract. A caller-configured
   source could supply hex, npub, or an arbitrary string.

3. **Can the signer safely expose its derived public identity?** Yes.
   `FedosWasmMasterSeedAuthority` (`src/runtime/master_seed/fedos_wasm_master_seed_authority.ts`)
   already exposes `accessForNostrSigningAuthorityInternalUse()`, an
   internal-only, non-secret opaque handle accessor. The Rust side already
   derives a public key as an intermediate value inside
   `sign_nostr_event_from_master_seed_internal` (`packages/fedos-core-rust/src/lib.rs`)
   without ever returning it — no new cryptography is needed, only a new,
   narrow accessor that stops short of signing.

4. **Does the signer currently expose an account-index-to-pubkey method?**
   No. `FedosNostrSigningAuthority` (`src/nostr/sign/fedos_nostr_signing_authority.ts`)
   exposed only `signEvent()` before this Arc.

5. **Can that method be added without exposing a secret?** Yes — see Alpha
   684/685 below. The derivation chain (`derive_identity_root_internal` →
   `derive_application_root_internal` → `derive_nostr_root_internal` →
   `derive_nostr_secret_key_internal` → `derive_nostr_public_key_internal`)
   already isolates the public key as its own opaque, non-secret
   `FedosNostrPublicKeyHandle` before this Arc ever touched it.

6. **Are Desktop identity and Master Seed authority assembled from the same
   root today?** No. `DesktopApplication`'s identity source and
   `FedosWasmMasterSeedAuthority` are two entirely independent objects with
   no reviewed relationship — exactly the "two independent sources, hope
   they match" anti-pattern Alpha 690 rejects.

7. **Are multiple Nostr accounts expected?** The Rust signing boundary
   already parameterizes every operation by `accountIndex: u32` (Alpha 424),
   but no V1 caller in this codebase selects anything but a single, fixed
   index today.

8. **Is account index stored anywhere?** No persistent account-index
   storage exists. It is passed as a plain call argument only.

9. **Can current runtime config select an account?** No —
   `FedosDesktopRuntimeConfig` (`src/desktop/runtime/fedos_desktop_runtime_config.ts`)
   had no account-index or signing-authority field before this Arc (Alpha
   697 adds one).

10. **Ripple scope.** `src/nostr/sign/*` (new method + new type),
    `src/board/runtime/identity/*` (new binding type/authority/author
    authority), `src/board/runtime/eligibility/*` (integration),
    `src/board/runtime/fedos_board_runtime.ts` (new optional
    dependencies), `src/desktop/runtime/*` (config passthrough),
    `packages/fedos-core-rust/src/lib.rs` (one new `pub fn`), plus the
    mechanical mirror-updates to every pre-existing structural regression
    test in `test/` that hardcodes the crate's total `pub fn` count or
    enumerates its exact names (see Alpha 700's completion report for the
    full list).

An `npub` (or any) string alone proves nothing about key control — this
finding is exactly why Alpha 682 adopts a real, independent Binding
Authority rather than trusting string equality.

See also: `docs/secure_runtime_alpha_641_current_identity_and_author_inventory.md`.
