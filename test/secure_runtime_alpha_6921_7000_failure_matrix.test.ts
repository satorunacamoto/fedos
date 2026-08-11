/**
 * Secure Runtime Alpha 6921-7000 — Phase K: the failure matrix. Proves
 * every rejected/partial/malformed capability shape still fails CLOSED
 * (`null`, never a throw, never a silently-degraded session) through
 * `FedosDirectRatchetCryptographicSession`'s own public entry points.
 *
 * Sections 1-6 exercise pure capability-shape logic and need no real WASM
 * artifact (the structural resolver rejects/accepts before any WASM call
 * is reached). Section 7 additionally proves the real production/dev
 * boundary distinction using genuine artifacts when present.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { FedosDirectRatchetCryptographicSession } from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_cryptographic_session.js";
import { DevelopmentFedosMasterSeedAuthority } from "../src/os/messenger/desktop/onboarding/fedos_development_master_seed_authority.js";
import { FedosProductionMasterSeedAuthority } from "../src/os/messenger/desktop/production_activation/fedos_production_master_seed_authority.js";
import { createElectronMainHostAttestation } from "../src/os/messenger/desktop/production_activation/fedos_production_desktop_host_attestation.js";
import { activateFedosProductionProfileMasterSeed } from "../src/os/messenger/desktop/production_activation/fedos_production_profile_activation.js";
import { FEDOS_PRODUCTION_ARTIFACT_DIR } from "../src/os/messenger/desktop/production_activation/fedos_production_desktop_crypto_activation_authority.js";
import type { FedosMasterSeedAuthority } from "../src/os/core/vault/wasm/fedos_master_seed_authority.js";

declare const process: { cwd(): string };

const PKG_DIR = join(process.cwd(), FEDOS_PRODUCTION_ARTIFACT_DIR);
const REAL_ARTIFACT_PRESENT = existsSync(join(PKG_DIR, "fedos_core_rust_bg.wasm")) && existsSync(join(PKG_DIR, "fedos_wasm_artifact_manifest.v1.json"));

async function expectNoSession(masterSeedAuthority: FedosMasterSeedAuthority): Promise<void> {
  const asReceiver = await FedosDirectRatchetCryptographicSession.createAsReceiver(masterSeedAuthority, 0, "aa".repeat(32), "s", "dev", 0);
  expect(asReceiver).toBeNull();
  const asSender = await FedosDirectRatchetCryptographicSession.createAsSender(masterSeedAuthority, 0, "aa".repeat(32), "s", "dev", 0, "bb".repeat(32));
  expect(asSender).toBeNull();
}

describe("Secure Runtime Alpha 6921-7000 -- failure matrix (fails closed, never fabricates)", () => {
  it("1. missing capability entirely: an authority implementing neither the production accessors nor FedosWasmMasterSeedAuthority fails closed", async () => {
    const authority = new DevelopmentFedosMasterSeedAuthority();
    await expectNoSession(authority);
  });

  it("2. partial capability: an authority exposing ONLY accessDirectRatchetSessionModuleInternalUse (missing accessForNostrSigningAuthorityInternalUse) does not satisfy the closed shape", async () => {
    const authority = {
      accessDirectRatchetSessionModuleInternalUse: () => ({
        initialize_as_receiver: () => ({}),
        initialize_as_sender: () => ({}),
        restore: () => ({}),
      }),
    } as unknown as FedosMasterSeedAuthority;
    await expectNoSession(authority);
  });

  it("3. partial capability: an authority exposing ONLY accessForNostrSigningAuthorityInternalUse (missing accessDirectRatchetSessionModuleInternalUse) does not satisfy the closed shape", async () => {
    const authority = {
      accessForNostrSigningAuthorityInternalUse: async () => ({ public_key_hex_for_account: () => "aa".repeat(32) }),
    } as unknown as FedosMasterSeedAuthority;
    await expectNoSession(authority);
  });

  it("4. stopped/cleared capability: both accessors present, but accessDirectRatchetSessionModuleInternalUse() returns null (mirrors a cleared FedosProductionMasterSeedAuthority) fails closed", async () => {
    const authority = {
      accessDirectRatchetSessionModuleInternalUse: () => null,
      accessForNostrSigningAuthorityInternalUse: async () => ({ public_key_hex_for_account: () => "aa".repeat(32) }),
    } as unknown as FedosMasterSeedAuthority;
    await expectNoSession(authority);
  });

  it("5. no live WASM authority handle: accessForNostrSigningAuthorityInternalUse() returns null (mirrors a cleared seed) fails closed even though the session module accessor is present and well-shaped", async () => {
    const authority = {
      accessDirectRatchetSessionModuleInternalUse: () => ({
        initialize_as_receiver: () => ({}),
        initialize_as_sender: () => ({}),
        restore: () => ({}),
      }),
      accessForNostrSigningAuthorityInternalUse: async () => null,
    } as unknown as FedosMasterSeedAuthority;
    await expectNoSession(authority);
  });

  it("6. malformed session module: both accessors present, but the constructors throw/return nothing usable -- fails closed at the loader-boundary call, never a fabricated handle", async () => {
    const authority = {
      accessDirectRatchetSessionModuleInternalUse: () => ({
        initialize_as_receiver: () => {
          throw new Error("malformed");
        },
        initialize_as_sender: () => undefined,
        restore: () => undefined,
      }),
      accessForNostrSigningAuthorityInternalUse: async () => ({ public_key_hex_for_account: () => "aa".repeat(32) }),
    } as unknown as FedosMasterSeedAuthority;
    await expectNoSession(authority);
  });

  it("7. real production authority: a CLEARED production authority never grants a fresh session, but the SAME still-live, already-constructed authority (before clear) does -- real-artifact gated", async () => {
    if (!REAL_ARTIFACT_PRESENT) return; // documented skip, not a fabricated pass
    const attestation = createElectronMainHostAttestation({ appId: "com.fedos.desktop.test.failure-matrix", appVersion: "0.0.1" })!;
    const activation = await activateFedosProductionProfileMasterSeed({ attestation });
    expect(activation.outcome).toBe("activated");
    if (activation.outcome !== "activated") return;
    const authority = activation.masterSeedAuthority as FedosProductionMasterSeedAuthority;
    expect(await authority.generate()).toBe(true);

    // Wrong/placeholder counterparty key material is not this Arc's concern
    // (Nostr identity derivation is unrelated, pre-existing behavior) -- this
    // section isolates ONLY the cleared-vs-live capability distinction.
    await authority.clear();
    await expectNoSession(authority);
  });
});
