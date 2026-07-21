# Secure Runtime Alpha 4821-4900 — Packaged Electron Real-Unlock Acceptance and GUI Passphrase-Input Boundary

Covers Phases B–O. Phase A is in
`secure_runtime_alpha_4821_4900_phase_a_gui_packaging_inventory.md`. The
completion declaration is in
`secure_runtime_alpha_4821_4900_completion_declaration.md`.

This Arc closes the ONLY blocker Alpha 4741-4820 disclosed: the real
production Master Seed path, proven at the Node/source level, had never been
proven through an actual packaged Electron GUI process. It now is — through a
real, offscreen-rendered Electron process crossing the genuine renderer →
preload → main boundary into real WASM, with no development seed double.

## Reconciliation and the one production-source addition

Every prior layer is REUSED UNCHANGED. The coordinator
(`fedos_profile_initialization_coordinator.ts`), the production activation
authority, the pinned manifest + verifier, the capability-limited facade, the
production `FedosMasterSeedAuthority`, the redacting `FedosProfileUnlockSecret`,
and every prior `*_main.cts` are byte-for-byte untouched.

ONE new production-source file was strictly necessary and is an additive
adapter, not a redesign:
`src/desktop/production_activation/fedos_production_nostr_signing_authority.ts`.

Why it was required (verified against real source, not assumed): the
coordinator needs BOTH a `FedosMasterSeedAuthority` AND a
`FedosNostrSigningAuthority` (the latter derives the account public identity
and signs device-binding authorizations). The only existing
`FedosNostrSigningAuthority` that derives from the seed —
`FedosWasmNostrSigningAuthority` — reaches WASM through
`FedosWasmLoaderSkeleton.attemptDevOnlyNostr*Call()`, both gated behind
`devGate.developmentAllowed` (the dev-only `NODE_ENV` gate). Reusing that on
the packaged production path would be exactly the prohibited "silently
downgrade to the dev-only loader," and it would not function in production.
The prior Arc's own acceptance test sidestepped this by injecting a TEST
double (`RealFedosNostrSigningAuthority`, an independent random key), which
only yields a stable identity when a single instance is reused within one
process — it cannot survive a real relaunch.

The new authority calls the SAME opaque WASM handle's own
`public_key_hex_for_account()` / `sign_nostr_event()` methods DIRECTLY (the
identical Rust methods the dev loader ultimately calls), with identical
request validation and fail-closed discipline, but no `NODE_ENV` dependency.
It shares the SAME handle as the production `FedosMasterSeedAuthority` via that
authority's existing module-internal
`accessForNostrSigningAuthorityInternalUse()` accessor — so the derived
identity always reflects the seed currently held and is deterministic /
STABLE across a real process relaunch (the seed IS the account). It exposes
no handle, no secret byte, and never signs in TypeScript.

## Phase B — dedicated secret-input contract

The passphrase enters ONLY through two closed, dedicated commands —
`fedos-profile:create` (`{ label, secret }`) and `fedos-profile:unlock`
(`{ secret }`) — separate from any generic command. Main-process validation
(`validatedLabel` / `validatedSecretBytes`, `fedos_electron_unlock_main.cts`):
strict schema, bounded size (label ≤ 128 chars, secret ≤ 1024 bytes), NO
unknown fields (`keys.every(...)`), no serialization into navigation state, no
echo in any response, no inclusion in any diagnostic/notification/tray/badge
object, no persistence, no retry history carrying the input. The secret is
wrapped immediately in the redacting one-shot `FedosProfileUnlockSecret`
(consumed once by the coordinator, then zeroed) and the reference is released
best-effort right after use. No generic crypto/secret command is exposed.

## Phase C — preload API

`fedos_electron_unlock_preload.cts` exposes exactly ONE frozen object,
`window.fedosProfile`, with a closed method set: `status`, `create`, `unlock`,
`lock`, `quit`. Each is a thin `ipcRenderer.invoke` wrapper around one fixed
`fedos-profile:*` channel literal. It exposes NO `ipcRenderer`, NO
`invoke(channel, any)`, NO filesystem/process/Buffer/crypto/WASM, NO arbitrary
Host command. The object is `Object.freeze`d; renderer code cannot choose an
arbitrary IPC channel.

## Phase D — main-process command handling

Sequence per command: validate request shape and size → wrap the secret in the
self-redacting `FedosProfileUnlockSecret` → run a FRESH coordinator (fresh
production activation) → receive the coordinator's closed coarse result →
release/clear secret and authority references best-effort → return ONLY
JSON-safe, redacted output. No raw `Error`, no stack, no secret in any log,
result, or unhandled rejection. Concurrent create/unlock are serialized by an
`inFlight` flag (a racing command returns a coarse `"busy"`). A failed unlock
constructs NO Runtime and clears its throwaway authority; a successful one
promotes exactly ONE coordinator to `activeCoordinator`. Lock/shutdown during
unlock are safe (the `inFlight` guard + best-effort clears).

## Phase E — onboarding renderer page

`fedos_electron_unlock_page.html` + `fedos_electron_unlock_renderer.ts` (a
plain global browser script, IIFE-scoped, no imports, reads only
`window.fedosProfile`). Screens: welcome, create, unlock, initializing, ready,
unlock-failed, recovery-required, (locked ≡ unlock). Controls: profile label,
passphrase input, passphrase confirmation (create), submit, lock, retry,
quit. Security/UX: inputs are `type=password` `autocomplete="off"`; the live
value is read only at submit and cleared IMMEDIATELY afterward (success or
failure); the secret is never placed in `innerHTML`, a DOM attribute, the
URL/hash, `localStorage`/`sessionStorage`, or `console`; duplicate submit is
disabled while pending; only coarse error text is shown. A restrictive
`Content-Security-Policy` meta (`default-src 'none'; script-src 'self';
connect-src 'none'`) keeps the page local-only. After ready, a minimal safe
"Profile unlocked / Runtime ready" state (label + public account id + device
id + trust state) is shown — the full Conversation UI is deliberately NOT
built in this Arc.

## Phase F — application startup mode

On launch the main process loads the compiled production/onboarding graph,
registers the closed IPC handlers, and opens ONE window; the renderer queries
`status()` and routes to welcome (absent) / unlock (locked) / recovery
(recovery-required) / ready. The Desktop Runtime is NEVER constructed before a
successful create/unlock. After success exactly ONE Runtime exists
(`activeCoordinator`); `lock()` stops it and drops the reference; window
recreation (`app.on("activate")`) never duplicates the Runtime, coordinator,
or WASM authority (a single `activeCoordinator` holds them).

## Phase G — real WASM artifact packaging

The activation authority resolves the pinned artifact from an explicit
`artifactDir` the main process computes from its OWN layout
(`path.join(__dirname, "..", "..", "fedos-core-rust", "pkg")`), never `cwd`
(a packaged app's cwd is arbitrary) — with a `FEDOS_ELECTRON_UNLOCK_ARTIFACT_DIR`
override for tests. The pinned manifest verifier recomputes the wasm SHA-256
from the real bytes and pins the capability profile + allowed exports; a
missing/mismatched/foreign artifact fails closed with no source-tree fallback,
no dev artifact lookup, and no network fetch (proven by the failure-matrix
case). `import()` of the glue is done via `pathToFileURL(specifier).href` (the
`importGlue` seam) — required because Node/Electron ESM cannot `import()` a
raw absolute Windows path; the frozen activation authority is left untouched.
The primary real-process acceptance path spawns `electron dist/<main>.cjs`
directly (matching every prior Electron Arc); root `package.json` is not
mutated during packaging and the defensive package snapshot/restore behavior
of `run_electron_builder_package.mjs` is preserved unchanged.

## Phase H — real packaged create flow (PROVEN)

Through the REAL spawned Electron process (`FEDOS_ELECTRON_UNLOCK_AUTOTEST=create`),
over a fresh temp profile root: first-run WELCOME screen observed → the test
secret typed into the REAL `type=password` inputs and the REAL "Create" button
clicked (renderer → preload → main) → real Master Seed generated and sealed
through WASM → account public identity derived → local Device registered
(reaches `trusted` via real BIP-340 pairing) → READY. Verified: the sealed
file exists and begins `{"v":1,"kdf":"argon2id"`; no plaintext seed/passphrase
on disk; the passphrase field length is 0 after submit; clean shutdown. The
coordinator is NOT invoked directly by the test — the renderer/preload/main
path is exercised.

## Phase I — real packaged unlock flow (PROVEN)

A SEPARATE, fresh Electron process (`FEDOS_ELECTRON_UNLOCK_AUTOTEST=unlock`)
over the Phase H profile: LOCKED screen observed → a WRONG secret submitted →
stays `unlock-failed`, `status().runtimeRunning === false` (no Runtime) → the
CORRECT secret submitted → real Master Seed restored through WASM → account
identity matches the Phase H identity EXACTLY (stable across a real relaunch) →
READY → lock (Runtime stops, `runtimeRunning === false`) → unlock again → ready.
No dev seed double, no dev-only loader, no direct Node test shortcut.

## Phase J — GUI automation strategy

Chosen: option A/E — an Electron internal self-test driven through the REAL
renderer, using the repo's EXISTING subprocess/marked-stdout convention (the
badge/notifications Arcs' precedent), with NO new testing dependency (Playwright
was explicitly NOT added). The self-test (`fedos_electron_unlock_selftest.ts`)
runs in the main process but drives the page via `webContents.executeJavaScript`,
which executes INSIDE the real renderer: it sets the real input values and
`.click()`s the real controls, so every command crosses the genuine preload →
main boundary into real WASM. It never calls a coordinator function directly.
The injected secret is a stand-in for human keystrokes (read from the
environment ONLY in autotest mode, by the harness bridge, never by the app's
normal path).

## Phase K — secret leak scan (PROVEN clean)

For create, wrong unlock, correct unlock, lock, and shutdown, a UNIQUE
per-run secret (`Uniq-<random>-passphrase-4821`) is asserted to appear NOWHERE
except the live input during submission: not in the serialized renderer DOM
(`outerHTML`), not in `localStorage`/`sessionStorage`/URL/hash, not in main
stdout/stderr, not in the profile descriptor, not in any file in the sealed
directory. The sealed file is real Argon2id ciphertext with no plaintext.
(The secret is knowingly present ONLY in the child process's own env — the
harness's keystroke-injection channel — which is explicitly excluded from the
app-surface assertion and documented as such.)

## Phase L — failure matrix (fail closed, no fallback)

Exercised through the packaged app and by source/structure: missing WASM
artifact (`FEDOS_ELECTRON_UNLOCK_ARTIFACT_DIR` → empty dir → create never
reaches ready, no sealed material written, no dev fallback); wrong passphrase
(stays locked, no Runtime); oversized/empty/malformed secret payload and
unknown fields (rejected by `validatedSecretBytes`/`validatedLabel`);
duplicate create / concurrent unlock (serialized by `inFlight`); lock/close/
quit during unlock (guarded); the activation authority's own closed decision
vocabulary (`unsupported-host` / `artifact-missing` / `artifact-invalid` /
`artifact-version-mismatch` / `unapproved-build` / `capability-not-allowed` /
`initialization-failed`) is unchanged and still fail-closed. A direct renderer
attempt to reach Node globals is structurally impossible under
`contextIsolation:true` / `sandbox:true`.

## Phase M — display and environment (real truth for THIS worktree)

Re-verified firsthand, NOT trusted from the prior Arc's different worktree:
Electron installs here and an offscreen (`webPreferences.offscreen:true`,
`show:false`) BrowserWindow starts a real renderer process under the strict
security settings. The acceptance suite runs the packaged process with an
offscreen window, so "headless" is not a blocker — the renderer/preload/main
boundaries are all really crossed. Nothing here is declared blocked.

## Phase N — lock, cleanup, resource ownership

One profile coordinator, one production activation authority, one Master Seed
authority, one Desktop Runtime, one BrowserWindow ownership path at a time; no
duplicate IPC handlers (registered once); no retained unlock payload (zeroed
on consume; throwaway authorities cleared); clean shutdown stops the Runtime
and quits; each real launch uses a clean temp profile root; all test profiles,
`dist`/`pkg`/`target` build output, and temp files are removed per policy
(the acceptance suite `rmSync`s its temp roots in `afterAll`).

## Phase O — structural guards

Production activation remains Electron-main-only (reached only via a valid,
module-branded host attestation a renderer cannot mint); the renderer cannot
import production activation modules (contextIsolation/sandbox); the preload
returns no raw secret; no generic crypto/filesystem IPC; `contextIsolation`,
`nodeIntegration:false`, `sandbox:true` preserved; local content only, no
remote scripts; no development seed double and no dev-only loader in the
packaged flow (asserted in source); no new dependency; no Rust crypto
redesign; no Device/Conversation/Search/Archive/Sender-Key redesign; `p2p/`
and `.tmp_gen/` untouched. No historical test was weakened.

## Threat model (honest)

Raises the bar from "the production Master Seed path is proven only in Node"
to "a real packaged Electron process creates and unlocks a real profile
through real WASM behind a closed passphrase-input boundary, with no secret
leakage observed." It does NOT add cloud/keychain/biometric/automatic unlock
or forgotten-passphrase recovery; it does NOT resist local malware, a modified
binary, or memory scraping; JavaScript strings backing the passphrase cannot
be reliably zeroed (best-effort only, stated plainly). The offscreen renderer
used for automated acceptance is the SAME real renderer process a visible
window uses.

## Baseline vs final comparison

- Baseline (`68545db`): real WASM builds and the production Master Seed
  create/unlock chain is proven only at the Node/source level; NO GUI
  passphrase input, NO closed unlock IPC command, NO packaged-process
  acceptance; the prior Arc declared the packaged GUI run environment-blocked.
- Final: a real, offscreen-rendered packaged Electron process creates and
  unlocks a real profile through real WASM across the genuine
  renderer/preload/main boundary; wrong secret stays locked with no Runtime;
  identity is stable across a real relaunch; lock and re-unlock work; a unique
  secret leaks nowhere on the app's own surfaces. FULL completion.
