# Runtime backend risk register — Stage 411 (docs only, no code)

**Status: this document adds no code.** It names, in writing, the
risks a future stage MUST review before advancing any item in
`docs/runtime_backend_implementation_sequence.md` (Stage 410). Naming
a risk here does not mitigate it — each mitigation is deferred to the
future stage that actually lands the relevant sequence item, which
must reference this register and state how (or whether) the risk is
addressed before that stage is considered complete.

## 1. Risk table

| # | Risk | Sequence items affected | Severity if unaddressed |
|---|---|---|---|
| 1 | WASM memory secret handling | 3, 4, 6 | High — a private key or derived secret living in linear WASM memory has no OS-level protection (no `mlock`, no guaranteed zeroing) once the value crosses the JS↔WASM boundary; a memory dump or a buggy loader could expose it. |
| 2 | OneDrive/Windows path issue | 2, 3, 5, 6 | Medium — this repository already lives under a OneDrive-synced path containing non-ASCII characters (`OneDrive - 公立諏訪東京理科大学`); `cargo test`/`cargo check --tests` in this exact environment already fails linking `serde_derive`/`getrandom` dev-dependencies via mingw-w64 because of it (see `docs/runtime_backend_verification_policy.md`, Stage 412). A `wasm32` build adds a second toolchain (`wasm-bindgen`/`wasm-pack`) that may hit the same class of path issue independently. |
| 3 | Smart App Control | 2, 3 | Medium — Windows Smart App Control can block newly-introduced, unsigned build tooling (a freshly-installed `wasm-bindgen-cli`/`wasm-pack` binary) from executing at all, with a failure mode that looks like a build error rather than a policy block; must be checked for BEFORE assuming a toolchain failure is a code bug. |
| 4 | `target`/`Cargo.lock` guard | 2, 3 | Low, but a repeated regression risk — `packages/fedos-core-rust` has followed a "no `Cargo.lock`/`target` committed" convention since Stage 73 (`docs/rust_dependency_adoption.md` §7); introducing a `wasm32` build target multiplies the number of local build artifact directories (`target/wasm32-unknown-unknown/...`) that must be kept out of version control. |
| 5 | Public API accidental exposure | 4, 6, 7 | High — `wasm-bindgen`'s `#[wasm_bindgen]` macro can accidentally widen a function's visibility or generate a JS-callable export for something intended to stay `pub(crate)`; every export added by item 4 must be checked against the existing 27-`pub fn` public surface (`docs/fedos_core_public_api_design.md`) so nothing new is reachable from JS that was not deliberately reviewed as public. |
| 6 | Runtime accidental activation | 7, 8 | High — the entire point of the Dual Lock (`docs/runtime_crypto_activation_policy.md`) and every fail-closed placeholder in the chain is that flipping one flag by accident (a default changed from `false` to `true`, an env var leaking from a dev `.env` into a build) must not be sufficient to reach `"Allowed"`; items 7–8 are exactly the stages where a real flag starts to exist, so this risk is highest exactly when the sequence reaches them. |

## 2. Detail per risk

### Risk 1 — WASM memory secret handling

Once item 6 (NIP-44 real connection) exists, a `SecretHandle`-derived
key or a decrypted message body will, however briefly, exist as bytes
inside WASM linear memory. Unlike the Rust-native `zeroize`-on-drop
guarantee `docs/fedos_core_rust_safety.md` §6 already requires inside
the crate itself, a value that has been copied across the
`wasm-bindgen` boundary into a JS-visible `ArrayBuffer`/`Uint8Array`
is subject to whatever the JS garbage collector's own timing and
compaction behavior chooses — there is no cross-boundary zeroize
guarantee today, and no browser/Node API to force one. This must be
named as an explicit, reviewed limitation (not silently assumed safe)
before item 4 (loader) or item 6 (NIP-44) is attempted.

### Risk 2 — OneDrive/Windows path issue

Confirmed, reproducible in this exact environment: with zero Rust file
changes, `cargo check --tests`/`cargo test` fail because the repo's
absolute path contains non-ASCII characters, which breaks mingw-w64's
linker when linking the `serde_derive`/`getrandom` dev-dependencies.
`cargo check` (no test target) succeeds. This is an environment
property, not a code defect, but it blocks the `cargo test` gate
`docs/runtime_backend_verification_policy.md` (Stage 412) requires for
every future Rust/WASM-touching stage — see that document for the
mandated workaround (WSL or an ASCII-only path).

### Risk 3 — Smart App Control

Windows 11's Smart App Control (when enabled) can silently block
execution of a newly downloaded, unsigned CLI tool. `wasm-bindgen-cli`
and `wasm-pack` are exactly this shape of tool the first time either
is installed on a machine that has not run them before. A future stage
introducing either (sequence item 2) must check Smart App Control's
current mode (`Get-MpComputerStatus` in an elevated PowerShell,
per the OS's own control panel) and treat a build failure with no
useful error output as a possible policy block, not only a possible
code/toolchain bug.

### Risk 4 — `target`/`Cargo.lock` guard

The existing convention (`docs/rust_dependency_adoption.md` §7,
"pinned, not committed") already keeps `Cargo.lock` and `target/` out
of version control for the native build. A `wasm32` target adds a
second, parallel build-output tree
(`target/wasm32-unknown-unknown/{debug,release}/`); the `.gitignore`
entry covering `target/` already covers this by pattern, but any
future stage introducing the `wasm32` target must explicitly verify
(not assume) that the new subdirectory is in fact excluded, since a
`.wasm` file landing in the repository would violate
`docs/fedos_core_wasm_safety.md`'s existing "no `.wasm` file
committed" rule.

### Risk 5 — Public API accidental exposure

`#[wasm_bindgen]` is a macro that changes a Rust item's generated
bindings; misapplying it (e.g. annotating an internal helper instead
of only the reviewed public entry points) can make something
JS-callable that was never intended to be reachable outside the crate.
Any stage landing sequence item 4 must diff the resulting `.d.ts`/glue
code's exported symbol list against the existing, reviewed 27-`pub
fn` list (`docs/fedos_core_public_api_design.md`,
`docs/public_capability_matrix.md`) and fail the stage if any
additional symbol is exposed without its own review.

### Risk 6 — Runtime accidental activation

Every guard test since Stage 34 exists to prove one property: no
default configuration, no accidental env var, and no un-reviewed code
path can reach `"Allowed"`. Items 7–8 are the first stages in this
entire program where a real, functioning activation path will exist
behind a flag — meaning, for the first time, the flag itself becomes
the only thing standing between "inert" and "live." Any stage landing
item 7 or 8 must ship its own dedicated guard test asserting the
default (flag unset, or set to any value other than the one exact
expected sentinel) still resolves non-`"Allowed"`, mirroring the
existing `evaluateRuntimeCryptoActivation`/`evaluateWorkerCryptoActivation`
test coverage this repository already has for every combination that
exists today.

## 3. What this register does not do

- It does not fix any of the six risks — each is deferred to the
  sequence item(s) named in §1's second column.
- It does not add, remove, or change any dependency, build target, or
  `.gitignore` entry.
- It does not change `evaluateRuntimeCryptoActivation`/
  `evaluateWorkerCryptoActivation`, any Dual Lock behavior, or any
  existing guard test.

## See also

- `docs/runtime_backend_implementation_sequence.md` (Stage 410) — the
  sequence this register's risks are mapped against.
- `docs/runtime_backend_verification_policy.md` (Stage 412) — the
  `cargo check`/`cargo test` policy that directly follows from Risk 2.
- `docs/fedos_core_rust_safety.md` §6 — the existing zeroize-on-drop
  rule Risk 1 contrasts with WASM's lack of an equivalent guarantee.
- `docs/rust_dependency_adoption.md` §7 — the "pinned, not committed"
  convention Risk 4 extends to the `wasm32` target.
- `docs/fedos_core_public_api_design.md` /
  `docs/public_capability_matrix.md` — the reviewed 27-`pub fn`
  surface Risk 5's diff check is against.
- `docs/runtime_crypto_activation_policy.md` — the Dual Lock Risk 6
  extends into the WASM-backed activation path.
