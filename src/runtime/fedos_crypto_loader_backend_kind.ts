/**
 * The backend-candidate vocabulary `fedos_crypto_loader_backend.ts`
 * (Stage 714), `fedos_crypto_backend_interface.ts` (Stage 746), and
 * `fedos_crypto_backend_resolver.ts` (Stage 763) all reference by name —
 * split into its own leaf file so the latter two (which sit BELOW the
 * Backend Abstraction in the reach chain — Abstraction calls Interface
 * calls Resolver, all real value edges) can depend on this vocabulary
 * WITHOUT depending on `fedos_crypto_loader_backend.ts` itself, which
 * previously defined it and closed a 3-file type-only cycle
 * (`fedos_crypto_loader_backend.ts` -> `fedos_crypto_backend_interface.ts`
 * -> `fedos_crypto_backend_resolver.ts` -> back to
 * `fedos_crypto_loader_backend.ts`, the loop-closing edge type-only).
 *
 * Nostr Consolidation Plan, Step 5 / architecture cycle detector baseline
 * reduction (`docs/architecture/NOSTR-CONSOLIDATION-PLAN.md`,
 * `test/architecture_cycle_detector.test.ts`) — a dedicated,
 * single-purpose type module, never a mega-types dumping ground: it
 * holds exactly the one declaration all three files already agreed on
 * the shape of, and nothing else. `fedos_crypto_loader_backend.ts`
 * re-exports it unchanged, so its own existing consumer
 * (`runtime_crypto_diagnostics.ts`) needed zero call-site changes.
 *
 * HARD GUARDRAILS (unchanged from `fedos_crypto_loader_backend.ts`'s own,
 * carried forward verbatim for the declaration that moved):
 *   - This file defines a TYPE ONLY — no function, no class, no runtime
 *     behavior of any kind.
 *   - `"WasmPlanned"`/`"NativePlanned"`/`"PythonPlanned"` are labels of
 *     intent only — none is connected to a working or reachable backend.
 */

/**
 * Every backend candidate the Crypto Loader Backend Abstraction currently
 * names. `"WasmPlanned"` is the first implementation candidate,
 * mirroring `fedos_execution_backend.ts`'s own WASM-first selection.
 * `"NativePlanned"` names a future native/desktop/mobile candidate;
 * `"PythonPlanned"` names a future experimentation/analysis-layer
 * candidate.
 */
export type FedosCryptoLoaderBackendKind =
  | "WasmPlanned"
  | "NativePlanned"
  | "PythonPlanned";
