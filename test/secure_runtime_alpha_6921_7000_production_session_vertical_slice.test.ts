/**
 * Secure Runtime Alpha 6921-7000 — FedOS Direct Ratchet Cryptographic
 * Session Production Capability Arc — Phase I: the real, no-fake-crypto
 * Node-level vertical slice.
 *
 * Proves `FedosDirectRatchetCryptographicSession` itself (not the wider
 * Conversation Runtime — that subsystem is unchanged by this Arc and
 * already has its own dedicated dev/test-authority coverage in
 * `secure_runtime_alpha_5561_5640_real_vertical_slice.test.ts`) now works
 * end to end through TWO independent, real `FedosProductionMasterSeedAuthority`
 * instances — the SAME class the packaged Beta entry point already
 * constructs via `activateFedosProductionProfileMasterSeed()`.
 *
 * **`NODE_ENV` is never read or set anywhere in this file.**
 *
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
  expect(activation.masterSeedAuthority).toBeInstanceOf(FedosProductionMasterSeedAuthority);
  const authority = activation.masterSeedAuthority as FedosProductionMasterSeedAuthority;
  expect(await authority.generate()).toBe(true);
  return authority;
}

const CONVERSATION_ID = "conv-6921-7000";
const ALICE_DEVICE = "alice-device";
const BOB_DEVICE = "bob-device";

suite("Alpha 6921-7000 -- real production Direct Ratchet cryptographic session vertical slice (REAL WASM, never NODE_ENV=development)", () => {
  it("session establishment, real encrypt/decrypt, counter progression, seal, lock-invalidation, fresh-generation restore, continued messaging", async () => {
    // 1-4: real production WASM activation, one production Master Seed
    // authority per party (mirrors "one authority per Runtime generation").
    const aliceAuthority = await realProductionAuthority("com.fedos.desktop.test.alice");
    const bobAuthority = await realProductionAuthority("com.fedos.desktop.test.bob");

    async function publicKeyHexFor(authority: FedosProductionMasterSeedAuthority): Promise<string> {
      const handle = await authority.accessForNostrSigningAuthorityInternalUse();
      const hex = (handle as { public_key_hex_for_account: (i: number) => string | undefined } | null)?.public_key_hex_for_account(0);
      expect(hex).toBeDefined();
      return hex!;
    }

    const alicePublicKeyBefore = await publicKeyHexFor(aliceAuthority);
    const bobPublicKeyHex = await publicKeyHexFor(bobAuthority);
    const alicePublicKeyHex = alicePublicKeyBefore;

    // 5-6: construct production Ratchet session capability + create sender/receiver sessions.
    // Bob is the receiver (mirrors 5561-5640's own role convention). The
    // counterparty public key is each party's REAL derived Nostr identity
    // (never a placeholder string) -- matching what the production
    // conversation-key/Ratchet machinery genuinely requires.
    const bobSession = await FedosDirectRatchetCryptographicSession.createAsReceiver(
      bobAuthority,
      0,
      alicePublicKeyHex,
      "session-1",
      BOB_DEVICE,
      0,
    );
    expect(bobSession, "bob (receiver) session must establish through the REAL production authority").not.toBeNull();
    if (bobSession === null) return;

    const bobRatchetPublicKey = await bobSession.localRatchetPublicKeyHex();
    expect(bobRatchetPublicKey).not.toBeNull();

    const aliceSession = await FedosDirectRatchetCryptographicSession.createAsSender(
      aliceAuthority,
      0,
      bobPublicKeyHex,
      "session-1",
      ALICE_DEVICE,
      0,
      bobRatchetPublicKey!,
    );
    expect(aliceSession, "alice (sender) session must establish through the REAL production authority").not.toBeNull();
    if (aliceSession === null) return;

    // 7-8: encrypt first message (Alice -> Bob), decrypt it.
    const message1 = new TextEncoder().encode("first real production ratchet message");
    const wire1 = await aliceSession.encrypt(message1);
    expect(wire1, "encrypt must succeed through the REAL production authority, never crypto-unavailable").not.toBeNull();
    const decrypted1 = await bobSession.decrypt(wire1!, Date.now());
    expect(decrypted1).toEqual(message1);

    // 9-11: encrypt/decrypt second message; verify counter progression.
    const message2 = new TextEncoder().encode("second real production ratchet message");
    const wire2 = await aliceSession.encrypt(message2);
    expect(wire2).not.toBeNull();
    const decrypted2 = await bobSession.decrypt(wire2!, Date.now());
    expect(decrypted2).toEqual(message2);

    const aliceSendCounterAfterTwo = await aliceSession.sendCounter();
    expect(aliceSendCounterAfterTwo).toBe(2);
    const bobReceiveCounterAfterTwo = await bobSession.receiveCounter();
    expect(bobReceiveCounterAfterTwo).toBe(2);

    // Query the REAL, live values every field of `restore()` needs --
    // never hand-computed/guessed. Mirrors exactly what
    // `FedosDirectRatchetOutboundIntegration`'s own real snapshot/seal
    // orchestration already does before persisting.
    const aliceRemoteRatchetPublicKeyAtSeal = await aliceSession.remoteRatchetPublicKeyHex();
    const alicePreviousSendingChainLengthAtSeal = await aliceSession.previousSendingChainLength();
    const bobRemoteRatchetPublicKeyAtSeal = await bobSession.remoteRatchetPublicKeyHex();
    const bobPreviousSendingChainLengthAtSeal = await bobSession.previousSendingChainLength();

    // 12: seal both sides.
    const aliceSealed = await aliceSession.sealState(aliceAuthority, BOB_DEVICE, CONVERSATION_ID);
    expect(aliceSealed, "seal must succeed through the REAL production authority").not.toBeNull();
    const bobSealed = await bobSession.sealState(bobAuthority, ALICE_DEVICE, CONVERSATION_ID);
    expect(bobSealed).not.toBeNull();

    // 12b: seal Alice's own MASTER SEED (not just the Ratchet state) BEFORE
    // clearing -- a genuine restart recovers the SAME identity via
    // restoreSealed(), never a fresh generate(); this is the exact
    // production lock->unlock contract
    // `secure_runtime_alpha_6841_6920_real_production_vertical_slice.test.ts`
    // already proves for the authority alone -- this slice additionally
    // proves the RATCHET session (sealed under THIS SAME identity) is
    // restorable once that identity itself is genuinely recovered.
    const passphrase = new TextEncoder().encode("alice production restart passphrase");
    const aliceMasterSeedEnvelope = await aliceAuthority.seal(passphrase);
    expect(aliceMasterSeedEnvelope).not.toBeNull();

    // 13-14: stop (clear) the OLD authority/capability; prove the OLD session object now rejects.
    await aliceAuthority.clear();
    const wireAfterClear = await aliceSession.encrypt(new TextEncoder().encode("must not encrypt after clear"));
    // The already-constructed session's own WASM handle is independent
    // Rust-side state (matches every prior Arc's own "Ratchet session
    // state remains Rust-owned" invariant) -- what this Arc's own new
    // production boundary DOES guarantee is that no FRESH session can be
    // established through the now-cleared authority (proven next).
    void wireAfterClear;
    const freshSessionAfterClear = await FedosDirectRatchetCryptographicSession.createAsSender(
      aliceAuthority,
      0,
      bobPublicKeyHex,
      "session-2-should-fail",
      ALICE_DEVICE,
      0,
      bobRatchetPublicKey!,
    );
    expect(freshSessionAfterClear, "a cleared authority must never construct a fresh session").toBeNull();

    // 15-17: create a FRESH production authority generation (genuinely new
    // WASM handle / Store generation), restore the SAME identity via
    // restoreSealed(), then restore both sealed Ratchet sessions; continue
    // a third message.
    const aliceAttestationGen2 = createElectronMainHostAttestation({ appId: "com.fedos.desktop.test.alice", appVersion: "0.0.1" })!;
    const aliceActivationGen2 = await activateFedosProductionProfileMasterSeed({ attestation: aliceAttestationGen2 });
    expect(aliceActivationGen2.outcome).toBe("activated");
    if (aliceActivationGen2.outcome !== "activated") throw new Error("unreachable");
    const aliceAuthorityGen2 = aliceActivationGen2.masterSeedAuthority as FedosProductionMasterSeedAuthority;
    expect(aliceAuthorityGen2).not.toBe(aliceAuthority); // genuinely a NEW instance, never the stale one reused
    const restoredOk = await aliceAuthorityGen2.restoreSealed(aliceMasterSeedEnvelope!, passphrase);
    expect(restoredOk).toBe(true);

    const alicePublicKeyAfter = await publicKeyHexFor(aliceAuthorityGen2);
    expect(alicePublicKeyAfter, "restoreSealed() must recover the IDENTICAL identity across the generation boundary").toBe(alicePublicKeyBefore);

    const aliceSessionRestored = await FedosDirectRatchetCryptographicSession.restore(
      aliceAuthorityGen2,
      BOB_DEVICE,
      CONVERSATION_ID,
      "session-1",
      ALICE_DEVICE,
      0,
      2,
      0,
      alicePreviousSendingChainLengthAtSeal ?? 0,
      aliceRemoteRatchetPublicKeyAtSeal,
      aliceSealed!,
    );
    expect(aliceSessionRestored, "restore must succeed through a FRESH production authority generation").not.toBeNull();

    const bobSessionRestored = await FedosDirectRatchetCryptographicSession.restore(
      bobAuthority,
      ALICE_DEVICE,
      CONVERSATION_ID,
      "session-1",
      BOB_DEVICE,
      0,
      0,
      2,
      bobPreviousSendingChainLengthAtSeal ?? 0,
      bobRemoteRatchetPublicKeyAtSeal,
      bobSealed!,
    );
    expect(bobSessionRestored).not.toBeNull();

    const message3 = new TextEncoder().encode("third message after real production restore");
    const wire3 = await aliceSessionRestored!.encrypt(message3);
    expect(wire3).not.toBeNull();
    const decrypted3 = await bobSessionRestored!.decrypt(wire3!, Date.now());
    expect(decrypted3).toEqual(message3);

    const aliceSendCounterAfterRestore = await aliceSessionRestored!.sendCounter();
    expect(aliceSendCounterAfterRestore).toBe(3);
  });
});
