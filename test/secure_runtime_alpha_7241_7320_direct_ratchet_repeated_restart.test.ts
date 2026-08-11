/**
 * Secure Runtime Alpha 7241-7320 — FedOS Long-Running Runtime Reliability
 * and Recovery Arc — Direct Ratchet session persistence across REPEATED
 * restarts.
 *
 * `test/secure_runtime_alpha_6921_7000_production_session_vertical_slice.test.ts`
 * (unmodified by this Arc) already proves ONE real seal -> clear ->
 * fresh-generation -> restore cycle. This Arc's own required scope
 * ("Ratchet persistence across repeated restarts") asks specifically
 * whether that survives MULTIPLE consecutive cycles under real,
 * continued messaging -- nobody had proven that before. This file is pure
 * validation: it constructs no new capability, calls no method that
 * doesn't already exist on `FedosDirectRatchetCryptographicSession`
 * (`src/conversation/ratchet/fedos_direct_ratchet_cryptographic_session.ts`,
 * unmodified), and never touches Ratchet's own cryptographic design.
 *
 * **`NODE_ENV` is never read or set anywhere in this file.**
 * Skips itself with a clear message if the real `pkg/` (+ pinned
 * manifest) is absent.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { createElectronMainHostAttestation } from "../src/os/messenger/desktop/production_activation/fedos_production_desktop_host_attestation.js";
import { activateFedosProductionProfileMasterSeed } from "../src/os/messenger/desktop/production_activation/fedos_production_profile_activation.js";
import { FedosProductionMasterSeedAuthority } from "../src/os/messenger/desktop/production_activation/fedos_production_master_seed_authority.js";
import { FEDOS_PRODUCTION_ARTIFACT_DIR } from "../src/os/messenger/desktop/production_activation/fedos_production_desktop_crypto_activation_authority.js";
import { FedosDirectRatchetCryptographicSession } from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_cryptographic_session.js";

declare const process: { cwd(): string };

const PKG_DIR = join(process.cwd(), FEDOS_PRODUCTION_ARTIFACT_DIR);
const WASM_PATH = join(PKG_DIR, "fedos_core_rust_bg.wasm");
const MANIFEST_PATH = join(PKG_DIR, "fedos_wasm_artifact_manifest.v1.json");
const REAL_ARTIFACT_PRESENT = existsSync(WASM_PATH) && existsSync(MANIFEST_PATH);

const suite = REAL_ARTIFACT_PRESENT ? describe : describe.skip;

async function realProductionAuthority(appId: string): Promise<FedosProductionMasterSeedAuthority> {
  const attestation = createElectronMainHostAttestation({ appId, appVersion: "0.0.1" })!;
  const activation = await activateFedosProductionProfileMasterSeed({ attestation });
  expect(activation.outcome).toBe("activated");
  if (activation.outcome !== "activated") throw new Error("unreachable");
  const authority = activation.masterSeedAuthority as FedosProductionMasterSeedAuthority;
  expect(await authority.generate()).toBe(true);
  return authority;
}

async function publicKeyHexFor(authority: FedosProductionMasterSeedAuthority): Promise<string> {
  const handle = await authority.accessForNostrSigningAuthorityInternalUse();
  const hex = (handle as { public_key_hex_for_account: (i: number) => string | undefined } | null)?.public_key_hex_for_account(0);
  expect(hex).toBeDefined();
  return hex!;
}

const CONVERSATION_ID = "conv-7241-7320-repeated-restart";
const ALICE_DEVICE = "alice-device-7241";
const BOB_DEVICE = "bob-device-7241";
const PASSPHRASE = new TextEncoder().encode("alice production repeated-restart passphrase 7241");

suite("Alpha 7241-7320 -- Direct Ratchet session state survives FOUR consecutive real seal/clear/restore cycles under continued real messaging, never just one", () => {
  it("counters, chain state, and decryptability all remain correct across 4 full generation boundaries", async () => {
    const aliceAuthorityGen0 = await realProductionAuthority("com.fedos.desktop.test.alice-7241-repeated");
    const bobAuthority = await realProductionAuthority("com.fedos.desktop.test.bob-7241-repeated");

    const alicePublicKeyHex = await publicKeyHexFor(aliceAuthorityGen0);
    const bobPublicKeyHex = await publicKeyHexFor(bobAuthority);

    // Bob's own session (the receiver) is constructed ONCE and never
    // reconstructed across generations in this file -- mirrors the
    // baseline test's own convention exactly (only Alice's own identity/
    // session generation is what a real restart replaces here; Bob's own
    // authority never clears, so his own long-lived session object is the
    // stable reference point every one of Alice's fresh generations must
    // keep decrypting correctly against, and vice versa).
    const bobSession = await FedosDirectRatchetCryptographicSession.createAsReceiver(bobAuthority, 0, alicePublicKeyHex, "session-repeated", BOB_DEVICE, 0);
    expect(bobSession).not.toBeNull();
    if (bobSession === null) return;
    const bobRatchetPublicKey = await bobSession.localRatchetPublicKeyHex();
    expect(bobRatchetPublicKey).not.toBeNull();

    let aliceAuthority = aliceAuthorityGen0;
    let aliceSession = await FedosDirectRatchetCryptographicSession.createAsSender(aliceAuthority, 0, bobPublicKeyHex, "session-repeated", ALICE_DEVICE, 0, bobRatchetPublicKey!);
    expect(aliceSession).not.toBeNull();
    if (aliceSession === null) return;

    let expectedSendCounter = 0;
    let messageIndex = 0;

    async function sendAndVerify(): Promise<void> {
      const message = new TextEncoder().encode(`repeated-restart-message-${messageIndex}`);
      messageIndex += 1;
      const wire = await aliceSession!.encrypt(message);
      expect(wire, "encrypt must succeed through the REAL, currently-live production authority generation").not.toBeNull();
      const decrypted = await bobSession!.decrypt(wire!, Date.now());
      expect(decrypted).toEqual(message);
      expectedSendCounter += 1;
      expect(await aliceSession!.sendCounter()).toBe(expectedSendCounter);
    }

    // Two real messages per generation, so counter progression across a
    // restart boundary is proven, not just "it still works after one send".
    await sendAndVerify();
    await sendAndVerify();

    // Four consecutive real restart cycles (5 total generations of
    // Alice's own identity + session) -- the actual "repeated restarts"
    // requirement no prior Arc's own coverage attempted.
    for (let cycle = 1; cycle <= 4; cycle++) {
      const remoteRatchetPublicKeyAtSeal = await aliceSession!.remoteRatchetPublicKeyHex();
      const previousSendingChainLengthAtSeal = await aliceSession!.previousSendingChainLength();
      const bobRemoteRatchetPublicKeyAtSeal = await bobSession.remoteRatchetPublicKeyHex();
      const bobPreviousSendingChainLengthAtSeal = await bobSession.previousSendingChainLength();

      const aliceSealed = await aliceSession!.sealState(aliceAuthority, BOB_DEVICE, CONVERSATION_ID);
      expect(aliceSealed, `alice's own session must seal on restart cycle ${cycle}`).not.toBeNull();
      const bobSealed = await bobSession.sealState(bobAuthority, ALICE_DEVICE, CONVERSATION_ID);
      expect(bobSealed, `bob's own session must seal on restart cycle ${cycle}`).not.toBeNull();

      // Seal Alice's own MASTER SEED identity too -- a genuine restart
      // recovers the SAME identity via `restoreSealed()`, never a fresh
      // `generate()` (matches the baseline test's own established
      // production lock->unlock contract, repeated here for EVERY cycle,
      // not just once).
      const masterSeedEnvelope = await aliceAuthority.seal(PASSPHRASE);
      expect(masterSeedEnvelope, `alice's own master seed must seal on restart cycle ${cycle}`).not.toBeNull();

      await aliceAuthority.clear();
      const attestationNextGen = createElectronMainHostAttestation({ appId: "com.fedos.desktop.test.alice-7241-repeated", appVersion: "0.0.1" })!;
      const activationNextGen = await activateFedosProductionProfileMasterSeed({ attestation: attestationNextGen });
      expect(activationNextGen.outcome).toBe("activated");
      if (activationNextGen.outcome !== "activated") throw new Error("unreachable");
      const aliceAuthorityNextGen = activationNextGen.masterSeedAuthority as FedosProductionMasterSeedAuthority;
      expect(aliceAuthorityNextGen).not.toBe(aliceAuthority);
      const restored = await aliceAuthorityNextGen.restoreSealed(masterSeedEnvelope!, PASSPHRASE);
      expect(restored, `identity restore must succeed on restart cycle ${cycle}`).toBe(true);
      expect(await publicKeyHexFor(aliceAuthorityNextGen), `restored identity must be IDENTICAL across restart cycle ${cycle}`).toBe(alicePublicKeyHex);
      aliceAuthority = aliceAuthorityNextGen;

      const aliceSessionRestored = await FedosDirectRatchetCryptographicSession.restore(
        aliceAuthority,
        BOB_DEVICE,
        CONVERSATION_ID,
        "session-repeated",
        ALICE_DEVICE,
        0,
        expectedSendCounter,
        0,
        previousSendingChainLengthAtSeal ?? 0,
        remoteRatchetPublicKeyAtSeal,
        aliceSealed!,
      );
      expect(aliceSessionRestored, `alice's own session must restore on restart cycle ${cycle}`).not.toBeNull();
      aliceSession = aliceSessionRestored;

      const bobSessionRestored = await FedosDirectRatchetCryptographicSession.restore(
        bobAuthority,
        ALICE_DEVICE,
        CONVERSATION_ID,
        "session-repeated",
        BOB_DEVICE,
        0,
        0,
        expectedSendCounter,
        bobPreviousSendingChainLengthAtSeal ?? 0,
        bobRemoteRatchetPublicKeyAtSeal,
        bobSealed!,
      );
      expect(bobSessionRestored, `bob's own session must restore on restart cycle ${cycle}`).not.toBeNull();
      // Bob's session object reference is reassigned to the freshly
      // restored one too (his own authority never cleared, but the
      // Ratchet session state itself is Rust-owned and must also be
      // re-derived from the sealed bytes on this side, exactly mirroring
      // Alice's own restore above).
      Object.assign(bobSession, bobSessionRestored);

      // Two more real messages per cycle -- proves the RESTORED session
      // genuinely keeps working (not merely "restore returned non-null"),
      // for every one of the 4 cycles, never just the last one.
      await sendAndVerify();
      await sendAndVerify();
    }

    // 2 initial + 4 cycles * 2 = 10 real encrypt/decrypt round trips across 5 total identity/session generations.
    expect(expectedSendCounter).toBe(10);
  });
});
