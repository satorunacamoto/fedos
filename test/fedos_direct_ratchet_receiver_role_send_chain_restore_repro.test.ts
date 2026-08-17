/**
 * FedOS Message Delivery Truth arc — targeted, deterministic (no Tor, no
 * relay, no Electron) reproduction of the receiver-role sending-chain
 * hypothesis flagged by a prior arc's own real public-Tor investigation:
 * does a RECEIVER-role Direct Ratchet session's sending chain (which only
 * becomes ready after its first real decrypt, per the Double Ratchet
 * protocol's own design) survive a real seal -> clear -> restore cycle?
 *
 * Uses `FedosDirectRatchetCryptographicSession.isReadyToSend()` directly
 * against the real WASM Ratchet core -- the same real production
 * authority pattern already proven by
 * `secure_runtime_alpha_7241_7320_direct_ratchet_repeated_restart.test.ts`
 * (unmodified). Skips itself if the real pkg/ artifact is absent.
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

const CONVERSATION_ID = "conv-delivery-truth-receiver-role-repro";
const ALICE_DEVICE = "alice-device-delivery-truth";
const BOB_DEVICE = "bob-device-delivery-truth";

suite("FedOS Message Delivery Truth -- receiver-role sending-chain restore reproduction", () => {
  it("Alice (RECEIVER role) is ready to send immediately after her first real decrypt; after a real seal->clear->restore cycle, isReadyToSend() must still be true, and a real encrypt() after restore must actually succeed", async () => {
    const aliceAuthority = await realProductionAuthority("com.fedos.desktop.test.alice-delivery-truth-repro");
    const bobAuthority = await realProductionAuthority("com.fedos.desktop.test.bob-delivery-truth-repro");

    const alicePublicKeyHex = await publicKeyHexFor(aliceAuthority);
    const bobPublicKeyHex = await publicKeyHexFor(bobAuthority);

    // Alice enters as RECEIVER (this is the exact role asymmetry the prior
    // arc's own real Tor reproduction hit: Bob initiates, Alice receives).
    let aliceSession = await FedosDirectRatchetCryptographicSession.createAsReceiver(aliceAuthority, 0, bobPublicKeyHex, "session-delivery-truth", ALICE_DEVICE, 0);
    expect(aliceSession).not.toBeNull();
    if (aliceSession === null) return;
    const aliceRatchetPublicKey = await aliceSession.localRatchetPublicKeyHex();
    expect(aliceRatchetPublicKey).not.toBeNull();

    const bobSession = await FedosDirectRatchetCryptographicSession.createAsSender(bobAuthority, 0, alicePublicKeyHex, "session-delivery-truth", BOB_DEVICE, 0, aliceRatchetPublicKey!);
    expect(bobSession).not.toBeNull();
    if (bobSession === null) return;

    // BEFORE any decrypt: a fresh receiver-role session is honestly NOT
    // ready to send yet (Double Ratchet protocol fact, not a bug).
    expect(await aliceSession.isReadyToSend()).toBe(false);

    // Bob (sender role) sends the first real message.
    const msg1 = new TextEncoder().encode("bob's first real message to alice");
    const wire1 = await bobSession.encrypt(msg1);
    expect(wire1, "Bob's own sender-role encrypt must succeed").not.toBeNull();

    // Alice decrypts it -- per Double Ratchet, THIS is what makes her own
    // sending chain ready.
    const decrypted1 = await aliceSession.decrypt(wire1!, Date.now());
    expect(decrypted1).toEqual(msg1);
    expect(await aliceSession.isReadyToSend(), "immediately after her first real decrypt, Alice must be ready to send -- this is the known-working, pre-restart case").toBe(true);

    // Real seal (checkpoint), matching exactly what a real process restart does.
    const remoteRatchetPublicKeyAtSeal = await aliceSession.remoteRatchetPublicKeyHex();
    const previousSendingChainLengthAtSeal = await aliceSession.previousSendingChainLength();
    const sealed = await aliceSession.sealState(aliceAuthority, BOB_DEVICE, CONVERSATION_ID);
    expect(sealed, "Alice's post-decrypt (now sender-ready) session must seal").not.toBeNull();

    // Real master-seed seal BEFORE clearing (mirrors the repeated-restart
    // test's own established, working order exactly), then real clear +
    // reactivate, matching a real production master-seed lock/relaunch
    // cycle.
    const PASSPHRASE = new TextEncoder().encode("delivery-truth-repro-passphrase");
    const masterSeedEnvelope = await aliceAuthority.seal(PASSPHRASE);
    expect(masterSeedEnvelope, "Alice's own master seed must seal").not.toBeNull();
    await aliceAuthority.clear();
    const attestationNextGen = createElectronMainHostAttestation({ appId: "com.fedos.desktop.test.alice-delivery-truth-repro", appVersion: "0.0.1" })!;
    const activationNextGen = await activateFedosProductionProfileMasterSeed({ attestation: attestationNextGen });
    expect(activationNextGen.outcome).toBe("activated");
    if (activationNextGen.outcome !== "activated") throw new Error("unreachable");
    const aliceAuthorityNextGen = activationNextGen.masterSeedAuthority as FedosProductionMasterSeedAuthority;
    expect(aliceAuthorityNextGen).not.toBe(aliceAuthority);
    const restored = await aliceAuthorityNextGen.restoreSealed(masterSeedEnvelope!, PASSPHRASE);
    expect(restored, "identity restore must succeed").toBe(true);
    expect(await publicKeyHexFor(aliceAuthorityNextGen), "restored identity must be IDENTICAL across restart").toBe(alicePublicKeyHex);

    const aliceSessionRestored = await FedosDirectRatchetCryptographicSession.restore(
      aliceAuthorityNextGen,
      BOB_DEVICE,
      CONVERSATION_ID,
      "session-delivery-truth",
      ALICE_DEVICE,
      0,
      0, // sendCounter: Alice has not sent anything yet
      1, // receiveCounter: Alice has decrypted exactly 1 message
      previousSendingChainLengthAtSeal ?? 0,
      remoteRatchetPublicKeyAtSeal,
      sealed!,
    );
    expect(aliceSessionRestored, "Alice's session must restore").not.toBeNull();
    if (aliceSessionRestored === null) return;
    aliceSession = aliceSessionRestored;

    // THE ACTUAL ROOT-CAUSE QUESTION: is the restored receiver-role
    // session still ready to send?
    const readyAfterRestore = await aliceSession.isReadyToSend();

    // Real, unambiguous proof either way: attempt a real encrypt() after
    // restore -- this is what Alice's actual reply-send does in
    // production, not metadata inspection.
    const reply = new TextEncoder().encode("alice's real reply after a real restart");
    const wireReply = await aliceSession.encrypt(reply);

    if (!readyAfterRestore || wireReply === null) {
      // Root cause CONFIRMED: this is the real, reproducible defect the
      // prior arc's own real-Tor investigation surfaced. Fail the test
      // with a clear diagnostic rather than silently passing -- this
      // assertion is the deterministic local proof the mandate requires
      // before any fix is written.
      expect(readyAfterRestore, "CONFIRMED ROOT CAUSE: a receiver-role Direct Ratchet session's sending-chain readiness does NOT survive seal->clear->restore, even though isReadyToSend() was true before the restore cycle").toBe(true);
      expect(wireReply, "CONFIRMED ROOT CAUSE: encrypt() after restore returns null for a restored receiver-role session").not.toBeNull();
      return;
    }

    // If it DOES work, prove it round-trips for real (Bob must decrypt it).
    const bobDecryptedReply = await bobSession.decrypt(wireReply, Date.now());
    expect(bobDecryptedReply, "root cause NOT reproduced locally: restored receiver-role session sent a real message Bob genuinely decrypted").toEqual(reply);
  });
});
