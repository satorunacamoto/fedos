# FedOS Core WASM Loader — Safety Rules (binding)

**Status: this document adds no code.** It fixes, in writing, the safety
contract that `packages/fedos-core-rust/src/wasm_loader.ts` (Stage 63) already
implements — the LOADER SEAM a future stage would use to bring a real
RustCrypto-backed WASM module online behind the Stage 59 `FedosCoreCrypto` seam —
so that when a real loader is eventually built (actual WASM instantiation), it
cannot accidentally regress the rules that matter most: **nothing loads
automatically, nothing is fetched, and no cryptography runs until an audited core
exists behind an explicit, disabled-by-default gate.**

If a future change to this area would violate a rule below, the rule wins —
change the code, not this document, or open a new Stage to renegotiate the rule
explicitly.

This is a safety contract, not a marketing claim. Nothing here should be read as
"secure", "audited", or "complete". It states what the WASM loader does and does
not do, and why. See [`docs/vault_crypto_identity.md`](vault_crypto_identity.md)
for the surrounding Vault / Crypto / Identity design, the Stage 59 crypto package
boundary ([`packages/fedos-core-rust`](../packages/fedos-core-rust/README.md)),
and [`docs/webauthn_passkey_safety.md`](webauthn_passkey_safety.md) for the
sibling unlock-trigger contract.

---

## 1. Purpose of the WASM loader boundary

`packages/fedos-core-rust/src/wasm_loader.ts` exists for exactly one job: to be
the SEAM a future stage uses to ask "may we bring a WASM crypto core online, and
if so, hand me the core?" — nothing more.

- **WASM loader boundary safety contract.** It names the states, capabilities,
  request, and decision a real loader WOULD expose (`FedosCoreWasmLoader`), so a
  real loader can drop in later behind the same interface without the rest of the
  app depending on any concrete WASM/fetch API.
- **Future Rust crypto core replacement point.** `packages/fedos-core-rust` is
  where a real RustCrypto-backed WASM/FFI core is INTENDED to live one day; this
  loader is the future swap point that would produce a `FedosCoreCrypto`.
- **NOT an implementation spec.** This is a boundary and a set of prohibitions,
  not a design for how to actually compile, fetch, verify, or instantiate WASM.
  That design belongs to its own future explicit stage (see §10).
- **No runtime loading yet.** Today nothing is loaded: `NoopFedosCoreWasmLoader`
  is permanently `disabled`, and `PlaceholderFedosCoreWasmLoader` only ever hands
  back the inert `PlaceholderFedosCoreCrypto` (itself `unavailable`).

## 2. Absolute rules (never negotiable without a new Stage)

- **No automatic WASM loading.** A load NEVER happens implicitly — not on import,
  not on runtime construction, not on first crypto use. A load happens only when
  a caller explicitly asks a loader to `load(...)`, and even then nothing real is
  loaded in this stage.
- **No `fetch` by default.** The loader issues no network request. A real loader
  must not fetch a module without an explicit, reviewed, disabled-by-default gate.
- **No dynamic import by default.** The loader performs no dynamic `import()` of a
  module. No module URL/specifier is ever resolved and imported.
- **No `WebAssembly.instantiate` by default.** The loader calls no
  `WebAssembly.instantiate` / `WebAssembly.compile` (or streaming variants). No
  WASM bytes are ever compiled or instantiated.
- **No path/URL resolution from env.** No environment variable, binding, or
  config value is ever read and turned into a module path, URL, or specifier. The
  loader takes no `RuntimeEnv` and resolves no location.
- **No secrets in `moduleRef` / `integrityRef`.** These are OPAQUE, non-secret
  labels only. They must never carry a URL, filesystem path, subresource-integrity
  hash, API key, token, or any secret, and the loader must never resolve or fetch
  them.
- **No crypto operation until an audited core exists.** No KDF/HKDF/Argon2, no
  AEAD, no CSPRNG/random, no zeroize, and no key generation/derivation runs here.
  Real cryptography waits for an audited Rust/WASM core behind its own explicit
  stage.

## 3. Information that MAY be handled

Only the following, all non-secret, may ever cross this boundary:

- **Opaque `moduleRef`** — `FedosCoreWasmLoadRequest.moduleRef`: a human/UI label
  for "which module", never a URL/path/specifier.
- **Opaque `integrityRef`** — `FedosCoreWasmLoadRequest.integrityRef`: a label for
  "which integrity expectation", never an actual SRI hash or digest.
- **Coarse loader state** — one of `FedosCoreWasmLoaderState`
  (`disabled` / `unloaded` / `loaded_placeholder` / `unavailable` / `error`).
- **Placeholder capability** — one of `FedosCoreWasmLoaderCapability`
  (`wasm_loader_placeholder`, `instantiate_placeholder`,
  `integrity_check_placeholder`, `rust_core_placeholder`) — labels of future
  intent, never a launched feature.
- **`PlaceholderFedosCoreCrypto` only** — the sole `core` a decision may carry is
  the permanently-inert placeholder core (itself `unavailable`). A real core is
  never produced here.

## 4. Information that MUST NEVER be handled

The following must never be stored, logged, rendered, returned, or resolved by
this boundary — in any state:

- **raw module URL** (any http/https/ws/data URL)
- **endpoint URL** (any relay, CDN, or origin address)
- **filesystem path** (absolute or relative)
- **API key** (or bearer/session/refresh token)
- **seed** (master seed or any key-derivation input)
- **key material** (private/symmetric/public key bytes)
- **plaintext / ciphertext bytes** (any payload bytes)
- **stack trace** (any exception object, message, or trace)
- **raw loader error** (any underlying error text from a future loader/engine)

## 5. Integrity / provenance policy

- **`integrityRef` is an opaque label only.** It is a name for an integrity
  expectation, not a hash. The loader neither computes nor compares any digest.
- **No real hash verification is implemented.** There is no SRI check, no digest
  comparison, and no signature verification in this stage.
- **A real loader needs real provenance.** Before any real WASM is loaded, the
  future stage must establish: a **pinned digest** (exact content hash), a
  **signed release** (verifiable publisher signature), a **reproducible build**
  (independently rebuildable from source), and a **versioned manifest** (an
  explicit, reviewed record of which artifact is expected).
- **Never load real WASM without an integrity check.** A real module must never be
  fetched-and-run on trust. Absent a verified pinned digest, the loader must
  refuse (stay `disabled`/`error`), never "load anyway".

## 6. Relationship to Runtime / Worker

- **No auto-load from `createRuntime`.** `src/runtime/create_runtime.ts`
  constructs no loader and calls no `load`. Building a runtime loads nothing.
- **No auto-load from the Worker.** `src/worker.ts` constructs no loader and calls
  no `load`. Serving a request loads nothing.
- **Loader selection is a separate Stage.** Letting the runtime *select* a loader
  (env → Noop/Placeholder), the way payment/notification/WebAuthn providers are
  selected, is its own future stage — and even then it is selection only.
- **Actual load is a further, separate Stage.** Even after a loader is selectable,
  actually loading a real module (fetch + verify + instantiate) is yet another
  explicit, disabled-by-default stage.
- **Status page shows a constructor label only.** If a selected loader is ever
  surfaced on the read-only runtime status page, it appears as a coarse
  `constructor.name` label only — no `load`/`unload`/status method is called to
  build the page.

## 7. Relationship to the CryptoProvider

- **`FedosCoreCryptoProvider` is the adapter.** `src/crypto/fedos_core_adapter.ts`
  bridges a `FedosCoreCrypto` to the host `CryptoProvider` interface; it is the
  single point the host would consume a core.
- **The bridge only extracts a core from a decision.** `fedosCoreWasmDecisionToCore`
  pulls the `core` a `FedosCoreWasmLoadDecision` produced (or `undefined`); it
  constructs nothing and resolves nothing. Any core it yields is the inert
  placeholder core.
- **No real KDF / AEAD / random / zeroize is implemented.** Neither the loader,
  the bridge, nor the adapter runs cryptography. Those belong to a future audited
  core behind the `FedosCoreCrypto` seam.
- **Noop / Placeholder are not a safety guarantee.** They are inert stand-ins.
  "The placeholder didn't do anything dangerous" is not the same as "the system is
  secure"; no security, confidentiality, or "safe storage" claim is made here.

## 8. Error handling

- **No raw error displayed.** A failure never surfaces the underlying error to the
  user or logs.
- **No stack trace.** No exception object, message, or trace is rendered, logged,
  or returned.
- **No endpoint / path echoed.** A failure reason never echoes a module URL, path,
  `moduleRef`, `integrityRef`, or any request label.
- **Error state + fixed reason only.** A caught failure resolves to an `error`
  state with a FIXED, non-sensitive reason string — as `loadFedosCoreWasm` already
  does when a loader throws/rejects.

## 9. Test policy for this area

Any change that touches `packages/fedos-core-rust/src/wasm_loader.ts` (and any
future real loader) must be covered by tests that:

- **Assert no `.wasm` is committed** — no WASM binary ships in the package.
- **Assert no `.rs` / `Cargo.toml` / `Cargo.lock` is committed** — no Rust crate
  or manifest ships until its own explicit stage.
- **Assert no `fetch` / dynamic `import()` / `WebAssembly.instantiate`** — the
  loader source references none of them, and running `load` in the test env issues
  no `fetch` and calls no `WebAssembly.instantiate`/`compile`.
- **Assert Runtime / Worker are not wired** — `src/runtime/create_runtime.ts` and
  `src/worker.ts` contain no `wasm`/`fedos` loader reference; no loader is
  constructed in the core.
- **Assert `moduleRef` / `integrityRef` are not resolved** — behavior is identical
  regardless of their values, and the decision reason never echoes them.
- **Assert no input mutation** — `load` / the safe wrapper never mutate the passed
  request.

These are enforced today in `test/fedos_core_wasm_loader.test.ts` (Stage 63).

## 10. Future implementation prerequisites

A real loader (one that actually fetches, verifies, and instantiates WASM) is OUT
OF SCOPE for Stage 63 and requires its own explicit, reviewed Stage. Before any
real WASM is loaded, ALL of the following must be in place:

- **Rust crate separated.** The real core lives in its own Rust crate, distinct
  from the TypeScript boundary.
- **Audited dependencies.** Every crypto dependency is reviewed and pinned.
- **`zeroize` / `secrecy` / `subtle`.** Secret bytes are zeroized on drop, wrapped
  in secrecy types, and compared in constant time.
- **AEAD test vectors.** Authenticated-encryption correctness is proven against
  known-answer vectors.
- **KDF test vectors.** Key-derivation correctness is proven against known-answer
  vectors.
- **Reproducible build.** The WASM artifact is independently rebuildable from
  source to the same bytes.
- **Pinned digest.** The exact expected artifact hash is pinned and verified
  before instantiation.
- **Explicit disabled-by-default runtime gate.** Loading is off unless an explicit
  env + user opt-in enables it, following the existing dual-flag/opt-in pattern.
- **No auto network.** Even when enabled, no fetch happens without an explicit,
  reviewed trigger — never implicitly on load or first use.

## 11. Conclusion (current state)

- **Docs only.** This stage adds no code and changes nothing under `src/` or
  `packages/fedos-core-rust/src/`.
- **No real WASM.** No `.wasm` file, no Rust, no `fetch`, no dynamic import, and no
  `WebAssembly.instantiate` exists anywhere in this boundary.
- **No cryptography.** Nothing here derives a key, encrypts, generates randomness,
  or zeroizes; the only core produced is the inert placeholder.
- **A future explicit stage is required.** A real loader must be its own reviewed,
  disabled-by-default Stage satisfying §5 and §10 — never grown silently out of
  the Stage 63 seam.
