# Secure Runtime Alpha 431 — Existing Secret Authority and Storage Inventory

Phase A, Stage 1 of the Alpha 431–450 Master Seed Authority & Nostr
Signing Activation Arc. Direct inspection of `packages/fedos-core-rust/src/lib.rs`,
`Cargo.toml`, and the relevant `src/runtime/*.ts` files, answering the
twelve questions this Stage's own instruction poses.

## Findings

1. **Cryptographically secure random generation exists in Rust.**
   `getrandom = { version = "0.3", features = ["wasm_js"] }` is an
   existing production dependency; `fedos_random_bytes_32()` (crate
   root) already calls `getrandom::fill` and is exercised by
   `#[wasm_bindgen] pub fn random_bytes_32()`, exported and used by
   `AeadKeyHandle` generation today.

2. **No real Master Seed constructor exists.** Every use of
   `FedosMasterSeedHandle::new_from_32_bytes_for_internal_use` outside
   `#[cfg(test)]` fixtures is unreachable — nothing in production code
   calls it. `master_root::FedosMasterSeedHandle` itself is `pub(crate)`
   only, never `#[wasm_bindgen]`-exported (Alpha 422's own regression
   guard, confirmed unbroken).

3. **No plaintext-secret persistence exists anywhere** — `grep` for
   `write_file`/`fs::write`/`localStorage` touching anything under
   `master_root` or `secret_handle` returns nothing. `src/vault/types.ts`
   is explicitly key-material-free by its own header.

4. **DPAPI is real, runnable production code, not a skeleton.**
   `src/runtime/fedos_windows_dpapi_helper.ts` shells to
   `powershell.exe` and calls
   `[System.Security.Cryptography.ProtectedData]::Protect/Unprotect`
   directly — genuinely executable on a real Windows host, not a
   placeholder. It operates on arbitrary `Uint8Array` ciphertext, has no
   Master-Seed-specific awareness, and is Desktop/Windows-only by
   construction (`child_process.execFileSync("powershell.exe", ...)`).

5. **DPAPI can operate in the current Host environment.** This
   development environment is Windows (`win32`), and PowerShell is
   available (verified: this Arc runs entirely on a Windows host with a
   working `powershell.exe`). However, DPAPI is user/machine-bound —
   unusable from a Worker, a browser tab, or any non-Windows-Desktop
   Host — so it cannot be the ONE sealing-key authority for every
   runtime this crate targets (see Alpha 433).

6. **Current ciphertext storage does not accept arbitrary sealed
   envelopes as a first-class concept.**
   `fedos_runtime_ciphertext_storage.ts`/`fedos_runtime_storage_backend.ts`
   operate on `AeadCiphertextHandle`-shaped values keyed to the
   existing `AeadAadDomain` enum (`RootKey`/`Identity`/`Storage`/
   `Conversation`/`TestOnly`) — there is no existing "opaque sealed
   blob, arbitrary caller-defined schema" storage contract, and Alpha
   439 below decides this Arc does not add a Host-level store either.

7. **No device-bound secret authority exists in production code** —
   DPAPI exists as a general Windows primitive (see #4) but nothing in
   this crate/repo wires it to a Master Seed today.

8. **No passphrase-based authority exists** — `argon2` is an existing
   dependency (Stage 84) but, before this Arc, is called only from
   `#[cfg(test)]` RFC 9106 vector verification
   (`crypto::rfc9106_vectors`), never in production code.

9. **WASM can retain a non-`Clone` opaque seed Authority.** This
   crate's existing `AeadKeyHandle`/`AeadCiphertextHandle` precedent
   already proves a `#[wasm_bindgen]` struct with zero derives, held
   across multiple JS-side calls by reference, survives round-trips
   through `wasm-bindgen`'s ownership model without `Clone`.

10. **Generated WASM glue is built at build time, never tracked.**
    `packages/fedos-core-rust/.gitignore` reserves `/pkg/`; the root
    `package.json` has a `build:wasm` script
    (`cargo build --target wasm32-unknown-unknown --release && wasm-bindgen ...`)
    that is never invoked by this Arc or committed to this repository.

11. **No runtime can actually restore the authority after restart
    today** — there is no sealed form, no store, and no restore method;
    this Arc's own Alpha 435/437 introduce the first one.

12. **Ripple scope**: one new crate-root `FedosMasterSeedAuthority`
    struct plus a small codec module in `lib.rs`; one new
    `AeadAadDomain::MasterSeedSealing` variant (touching
    `aead_internal.rs`/`aead_envelope_bridge.rs`, both narrowly);
    five new TypeScript files under `src/runtime/master_seed/` and
    `src/nostr/sign/`; new gated methods appended to the existing
    `FedosWasmLoaderSkeleton` (`src/runtime/fedos_wasm_loader.ts`). No
    file outside this list changes.

No temporary probe was left in place; the only probes run (existence
checks, `grep`, `cargo test` scoped runs) left no artifact.
