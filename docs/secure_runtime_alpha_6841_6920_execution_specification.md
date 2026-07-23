# Secure Runtime Alpha 6841–6920 — Implementation Execution Specification

**Stage 2 execution plan, written before any production source edit.**

## Exact diffs planned

### 1. `src/desktop/production_activation/fedos_production_master_seed_authority.ts`

- Add `import type { FedosDirectRatchetSealingAuthority } from "../../conversation/ratchet/fedos_direct_ratchet_sealing_authority.js";`
- Change `export class FedosProductionMasterSeedAuthority implements FedosMasterSeedAuthority` to also `implements FedosDirectRatchetSealingAuthority`.
- Add two methods, mirroring `FedosWasmMasterSeedAuthority`'s own implementation exactly (same try/catch-fails-closed style this file's own `seal()`/`resolveConversationKey()` already use, calling `h.seal_direct_ratchet_secret(...)`/`h.restore_direct_ratchet_secret(...)` on the SAME `#handle` via `#ensure()`):

```ts
async sealDirectRatchetSecret(
  localDeviceRef: string,
  remoteDeviceRef: string,
  conversationId: string,
  generation: number,
  secretBytes: Uint8Array,
): Promise<string | null> {
  const h = this.#ensure();
  if (!h) return null;
  try {
    const value = h.seal_direct_ratchet_secret(localDeviceRef, remoteDeviceRef, conversationId, generation, secretBytes);
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

async restoreDirectRatchetSecret(
  localDeviceRef: string,
  remoteDeviceRef: string,
  conversationId: string,
  generation: number,
  sealedBlob: string,
): Promise<Uint8Array | null> {
  const h = this.#ensure();
  if (!h) return null;
  try {
    const value = h.restore_direct_ratchet_secret(localDeviceRef, remoteDeviceRef, conversationId, generation, sealedBlob);
    return (value ?? null) as Uint8Array | null;
  } catch {
    return null;
  }
}
```

### 2. `src/desktop/runtime/fedos_desktop_runtime_config.ts`

Add one field immediately after `directRatchetImportRecordLogPath`, before `conversationDirectRatchet`:

```ts
/** Secure Runtime Alpha 6841-6920 -- the ALREADY-ACTIVATED canonical production
 * Master Seed Authority (the SAME object profile unlock already constructed),
 * reused directly for Direct Ratchet's own seal/restore + conversation-key
 * resolution -- mirrors conversationArchiveMasterSeedAuthority's own EXISTING
 * pattern exactly. Never a second authority, never a second WASM instance. */
readonly conversationDirectRatchetMasterSeedAuthority?: FedosMasterSeedAuthority;
```

### 3. `src/desktop/onboarding/fedos_profile_initialization_coordinator.ts`

Add one line to `#buildRuntimeConfig()`, immediately after the existing
`directRatchetImportRecordLogPath` line, mirroring
`conversationArchiveMasterSeedAuthority`'s own line exactly:

```ts
conversationDirectRatchetMasterSeedAuthority: this.#deps.directRatchetEnabled === true ? this.#deps.masterSeedAuthority : undefined,
```

### 4. `src/desktop/runtime/fedos_desktop_runtime.ts`

Widen the `conversationDirectRatchetDeps` derivation. Before:

```ts
const conversationDirectRatchetDeps: FedosConversationDirectRatchetIntegrationDependencies | undefined =
  config.conversationDirectRatchet ??
  (config.directRatchetEnabled && productionCryptoGraph !== null
    ? {
        ...
        sealingAuthority: isFedosDirectRatchetSealingAuthority(productionCryptoGraph.masterSeedAuthority) ? productionCryptoGraph.masterSeedAuthority : null,
        masterSeedAuthority: productionCryptoGraph.masterSeedAuthority,
        ...
      }
    : undefined);
```

After (one new local `const` above it, condition and two field sources
widened; every other field byte-for-byte unchanged):

```ts
// Secure Runtime Alpha 6841-6920 -- prefer the ALREADY-ACTIVATED canonical
// production authority (config.conversationDirectRatchetMasterSeedAuthority,
// the SAME object profile unlock already constructed) over the dev-gated
// productionCryptoGraph path -- eliminates the second, independent WASM
// instance/Master Seed Authority the immediately-prior Arc's own real
// packaged run proved was the last reachability blocker. The dev-gated path
// remains fully intact for any caller that still supplies
// conversationProductionCrypto directly (unchanged behavior, zero regression).
const directRatchetMasterSeedAuthority =
  config.conversationDirectRatchetMasterSeedAuthority ?? productionCryptoGraph?.masterSeedAuthority;
const conversationDirectRatchetDeps: FedosConversationDirectRatchetIntegrationDependencies | undefined =
  config.conversationDirectRatchet ??
  (config.directRatchetEnabled && directRatchetMasterSeedAuthority !== undefined
    ? {
        deviceRegistry: deviceRegistryPersistence!,
        sessionPersistence: config.directRatchetSessionLogPath !== undefined ? new AppendOnlyFedosDirectRatchetSessionPersistence(config.directRatchetSessionLogPath) : undefined,
        sealedSecretPersistence: config.directRatchetSealedSecretLogPath !== undefined ? new AppendOnlyFedosSealedDirectRatchetSecretPersistence(config.directRatchetSealedSecretLogPath) : undefined,
        resetRecordPersistence: config.directRatchetResetRecordLogPath !== undefined ? new AppendOnlyFedosDirectRatchetSessionResetRecordPersistence(config.directRatchetResetRecordLogPath) : undefined,
        importRecordPersistence: config.directRatchetImportRecordLogPath !== undefined ? new AppendOnlyFedosPrivateNostrImportRecordPersistence(config.directRatchetImportRecordLogPath) : undefined,
        sealingAuthority: isFedosDirectRatchetSealingAuthority(directRatchetMasterSeedAuthority) ? directRatchetMasterSeedAuthority : null,
        masterSeedAuthority: directRatchetMasterSeedAuthority,
        localDeviceRef: config.localDeviceId!,
        sendMailboxNip17Control,
      }
    : undefined);
```

Zero change to any guard/throw block above this derivation; zero change
to any other subsystem's own derivation.

### 5. `test/secure_runtime_alpha_6521_6600_structural_guards.test.ts`

Test 8's own regex is widened (still forbids the dev double, now also
recognizes the new, equally-legitimate source):

```ts
it("8. no development seed double is ever used to construct a real sealing/production crypto authority in fedos_desktop_runtime.ts -- directRatchet's own sealingAuthority/masterSeedAuthority are sourced exclusively from the canonical production authority (either the already-activated one or, for dev/test callers, productionCryptoGraph), never a development double", () => {
  const runtimeSource = stripComments(readFileSync(join(REPO_ROOT, "src", "desktop", "runtime", "fedos_desktop_runtime.ts"), "utf8") as string);
  expect(runtimeSource).not.toMatch(/DevelopmentFedosMasterSeedAuthority/);
  expect(runtimeSource).toMatch(/config\.directRatchetEnabled\s*&&\s*directRatchetMasterSeedAuthority\s*!==\s*undefined/);
  expect(runtimeSource).toMatch(/config\.conversationDirectRatchetMasterSeedAuthority\s*\?\?\s*productionCryptoGraph\?\.masterSeedAuthority/);
});
```

### 6. New test files (this Arc's own)

- `test/secure_runtime_alpha_6841_6920_production_direct_ratchet_sealing.test.ts`
  — real WASM, mirrors the 10-case suite in
  `secure_runtime_alpha_5401_5480_direct_ratchet_sealing_authority.test.ts`,
  but constructs `FedosProductionMasterSeedAuthority` via the REAL
  production activation path (`activateFedosProductionProfileMasterSeed`),
  **never setting `NODE_ENV=development`** — proving the exact claim this
  Arc exists to prove.
- `test/secure_runtime_alpha_6841_6920_structural_guards.test.ts` — proves
  `FedosProductionMasterSeedAuthority` now implements
  `FedosDirectRatchetSealingAuthority`; proves the Coordinator threads the
  new field; proves zero Rust source changed; proves the WASM export count
  is unchanged; proves `fedos_electron_beta_main.cts` is byte-for-byte
  unchanged by this Arc.
- `test/secure_runtime_alpha_6841_6920_real_production_vertical_slice.test.ts`
  — extends `secure_runtime_alpha_6521_6600_real_production_vertical_slice.test.ts`'s
  own pattern, but drives the REAL production activation path (not
  `DevelopmentFedosMasterSeedAuthority`) and asserts `directRatchet()` is
  now non-null.
- Electron-spike-side real packaged proof, extending this session's own
  `secure_runtime_alpha_6761_6840_settings_relay_reachability.test.ts`.

## Why no Electron-main change is planned

`fedos_electron_beta_main.cts`'s own `buildFreshCoordinator()` (this
session's own prior Arc, `f3e0658`) already passes `directRatchetEnabled:
true` to the Coordinator whenever a real relay is configured. Since the
Coordinator itself will now derive `conversationDirectRatchetMasterSeedAuthority`
from its own already-held `this.#deps.masterSeedAuthority` (a field the
Electron main already supplies), reachability should close automatically
with ZERO Electron-main edits. This is verified empirically in Phase K
below, not assumed.

## Verification sequence (planned, executed in Stage 2 proper)

`npm run typecheck` → `cargo test` (expected: 639/640, same pre-existing
failure, zero Rust source touched) → `npm run build:wasm` (expected:
byte-identical artifact, since zero Rust source changed) → targeted new
tests → existing Ratchet/NIP-17/Session-Reset/Peer-Capability/Desktop-
config/Settings-to-Relay/Identity-Transition/Deletion/Safety-Center test
files (regression, unmodified) → Electron package/subprocess tests → real
packaged vertical slice → secret scan → full `npm test`.
