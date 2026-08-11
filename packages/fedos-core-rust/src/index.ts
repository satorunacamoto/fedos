/**
 * @nostr-window/fedos-core-rust — public entry point (stable import surface).
 *
 * Stage 59 ships the PACKAGE BOUNDARY only: the `FedosCoreCrypto` seam and a
 * permanently-inert `PlaceholderFedosCoreCrypto`. This is the INTENDED future
 * home of a RustCrypto-backed WASM/FFI crypto core — but there is no Rust, no
 * WASM, and no cryptography in this package today.
 *
 * `PlaceholderFedosCoreCrypto` is the safe default: it reports `unavailable`,
 * advertises placeholder capabilities (labels of intent only), and refuses
 * every operation with a non-sensitive `FedosCoreDecision`. It generates no
 * randomness, derives no key, encrypts/decrypts nothing, and holds no
 * key/seed/plaintext/ciphertext bytes. Every method is total and never throws.
 *
 * The host reaches this package ONLY through its own adapter
 * (`src/crypto/fedos_core_adapter.ts`), never through these internals. When a
 * real Rust/WASM core lands, it drops in behind `FedosCoreCrypto` here.
 */

export type {
  FedosCoreAeadAlgorithm,
  FedosCoreCapability,
  FedosCoreCrypto,
  FedosCoreDecision,
  FedosCoreDecryptRequest,
  FedosCoreDeriveKeyRequest,
  FedosCoreEncryptRequest,
  FedosCoreKdfKind,
  FedosCoreRandomBytesRequest,
  FedosCoreState,
  FedosCoreStatus,
} from "./types.js";
export { FEDOS_CORE_CAPABILITIES } from "./types.js";

/**
 * Stage 63 — the FedOS Core WASM loader boundary (loader SEAM only, disabled by
 * default). Re-exported on the package's stable import surface. It loads no real
 * WASM: no `fetch`, no dynamic `import()`, no `WebAssembly.instantiate`, no path
 * resolution, and no cryptography. Any `core` a loader returns is only the inert
 * `PlaceholderFedosCoreCrypto`. It is NOT wired into the runtime or the Worker.
 */
export {
  FEDOS_CORE_WASM_LOADER_CAPABILITIES,
  NoopFedosCoreWasmLoader,
  PlaceholderFedosCoreWasmLoader,
  fedosCoreWasmDecisionToCore,
  loadFedosCoreWasm,
} from "./wasm_loader.js";
export type {
  FedosCoreWasmLoader,
  FedosCoreWasmLoaderCapability,
  FedosCoreWasmLoaderState,
  FedosCoreWasmLoaderStatus,
  FedosCoreWasmLoadDecision,
  FedosCoreWasmLoadRequest,
} from "./wasm_loader.js";

/**
 * The placeholder FedOS core: permanently `unavailable`. It advertises the
 * placeholder capabilities as labels of FUTURE intent, but every operation is
 * denied — nothing runs, nothing is generated, nothing is stored. This is the
 * drop-in stand-in until a real Rust/WASM core implements `FedosCoreCrypto`.
 *
 * Architecture Dependency Closure arc — moved to its own leaf file,
 * `./placeholder_core.ts`, so `wasm_loader.ts` (which needs to construct
 * this class) does not have to import this barrel file back, which used to
 * be this package's one real (runtime-level) file-to-file import cycle.
 * Re-exported here unchanged — this package's public import surface
 * (`@nostr-window/fedos-core-rust`) still exports both names exactly as
 * before.
 */
export { PlaceholderFedosCoreCrypto, createFedosCoreCrypto } from "./placeholder_core.js";
