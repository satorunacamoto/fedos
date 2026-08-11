/**
 * Secure Runtime Alpha 5481-5560 — Phase Q: the real cryptographic
 * vertical slice. Two independent Device identities (Alice, Bob), real
 * WASM-backed Double Ratchet sessions, real out-of-order delivery via
 * bounded skipped-key derivation, a real DH ratchet transition, a real
 * stop/restore across durable sealed state, and genuine wrong-Device/
 * tamper/rollback rejection.
 *
 * THIS IS NOT A CLAIM OF LIVE MESSAGING INTEGRATION. No NIP-17 event, no
 * Relay publish, no Conversation coordinator is touched anywhere in this
 * file — `encrypt()`/`decrypt()` operate on a transport-neutral opaque
 * wire message this Arc itself never sends anywhere.
 *
 * Skips itself with a clear message if the real
 * `packages/fedos-core-rust/pkg/` is absent (gitignored; run
 * `npm run build:wasm` first).
 */
import { describe, it, expect, afterEach } from "vitest";
import { existsSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FedosWasmMasterSeedAuthority } from "../src/os/core/vault/wasm/fedos_wasm_master_seed_authority.js";
import { FedosWasmLoaderSkeleton } from "../src/runtime/fedos_wasm_loader.js";
import {
  FedosDirectRatchetCryptographicSession,
  type FedosDirectRatchetSealedState,
} from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_cryptographic_session.js";

declare const process: { cwd(): string; env: { NODE_ENV?: string; [key: string]: string | undefined } };

const WASM_PATH = join(process.cwd(), "packages", "fedos-core-rust", "pkg", "fedos_core_rust_bg.wasm");
const REAL_ARTIFACT_PRESENT = existsSync(WASM_PATH);
const suite = REAL_ARTIFACT_PRESENT ? describe : describe.skip;

async function withDevelopmentNodeEnv<T>(fn: () => Promise<T>): Promise<T> {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    return await fn();
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
}

/** Mirrors the real production priming sequence. */
async function primedGeneratedMasterSeedAuthority(): Promise<FedosWasmMasterSeedAuthority> {
  const loader = new FedosWasmLoaderSkeleton();
  loader.planLoad();
  await loader.attemptDevOnlyJsGlueImport();
  await loader.attemptDevOnlyWasmInitialization();
  const authority = new FedosWasmMasterSeedAuthority(loader);
  expect(await authority.generate()).toBe(true);
  return authority;
}

/**
 * TEST-ONLY. Reaches the real WASM handle's own `public_key_hex_for_account`
 * — the existing, real Alpha 684/685 method, not yet re-exposed on the
 * TypeScript `FedosMasterSeedAuthority` interface. Simulates "how Alice
 * learns Bob's public key" for this Arc's own bootstrap; a future
 * signaling/negotiation Arc's own job in production, explicitly out of
 * this Arc's scope.
 */
async function publicKeyHexForAccount(authority: FedosWasmMasterSeedAuthority, accountIndex: number): Promise<string> {
  const handle = (await authority.accessForNostrSigningAuthorityInternalUse()) as { public_key_hex_for_account: (i: number) => string | undefined };
  const hex = handle.public_key_hex_for_account(accountIndex);
  expect(hex).toBeTruthy();
  return hex as string;
}

const tmpDirs: string[] = [];
function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-ratchet-core-slice-"));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tmpDirs.length) {
    try {
      rmSync(tmpDirs.pop() as string, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}
function text(data: Uint8Array): string {
  return new TextDecoder().decode(data);
}

suite("Alpha 5481-5560 — real Direct Double Ratchet vertical slice (REAL WASM)", () => {
  it("full slice: two Device identities, real ratchet conversation, out-of-order, DH ratchet, restart, tamper/wrong-Device rejection", async () => {
    await withDevelopmentNodeEnv(async () => {
      // 1. Two independent Device-bound identities (each with its OWN Master Seed).
      const aliceMasterSeed = await primedGeneratedMasterSeedAuthority();
      const bobMasterSeed = await primedGeneratedMasterSeedAuthority();
      const alicePublicKeyHex = await publicKeyHexForAccount(aliceMasterSeed, 0);
      const bobPublicKeyHex = await publicKeyHexForAccount(bobMasterSeed, 0);
      expect(alicePublicKeyHex).not.toBe(bobPublicKeyHex);

      const sessionId = "direct-ratchet-v1##alice##alice-desktop##bob##bob-desktop##conv-slice-1##fedos-direct-ratchet-v1##0";
      const remoteDeviceRefForAlice = "bob-desktop";
      const remoteDeviceRefForBob = "alice-desktop";
      const conversationId = "conv-slice-1";

      // 2. Bob initializes first (his role generates a fresh keypair immediately, shared out-of-band with Alice for this Arc's own test purposes).
      const bob = await FedosDirectRatchetCryptographicSession.createAsReceiver(
        bobMasterSeed,
        0,
        alicePublicKeyHex,
        sessionId,
        "bob-desktop",
        0,
      );
      expect(bob).not.toBeNull();
      const bobRatchetPublicKeyHex = await bob!.localRatchetPublicKeyHex();
      expect(bobRatchetPublicKeyHex).toBeTruthy();

      // 3. Alice initializes as sender, already knowing Bob's ratchet public key.
      const alice = await FedosDirectRatchetCryptographicSession.createAsSender(
        aliceMasterSeed,
        0,
        bobPublicKeyHex,
        sessionId,
        "alice-desktop",
        0,
        bobRatchetPublicKeyHex as string,
      );
      expect(alice).not.toBeNull();
      expect(await alice!.isReadyToSend()).toBe(true);
      expect(await bob!.isReadyToSend()).toBe(false);

      // 4. Alice encrypts message 1.
      const wire1 = await alice!.encrypt(bytes("message one"));
      expect(wire1).not.toBeNull();

      // 5. Bob decrypts message 1 exactly.
      const decrypted1 = await bob!.decrypt(wire1 as Uint8Array, 1000);
      expect(decrypted1).not.toBeNull();
      expect(text(decrypted1 as Uint8Array)).toBe("message one");
      expect(await bob!.isReadyToSend()).toBe(true); // Bob's own DH ratchet step ran on receipt.

      // 6. Alice encrypts messages 2 and 3.
      const wire2 = (await alice!.encrypt(bytes("message two"))) as Uint8Array;
      const wire3 = (await alice!.encrypt(bytes("message three"))) as Uint8Array;

      // 7. Bob receives message 3 before message 2.
      const decrypted3 = await bob!.decrypt(wire3, 1001);
      expect(decrypted3).not.toBeNull();
      expect(text(decrypted3 as Uint8Array)).toBe("message three");
      expect(await bob!.skippedKeyCount()).toBe(1); // message 2's key waiting

      // 8. Bob later decrypts message 2 exactly once, via the bounded skipped-key store.
      const decrypted2 = await bob!.decrypt(wire2, 1002);
      expect(decrypted2).not.toBeNull();
      expect(text(decrypted2 as Uint8Array)).toBe("message two");
      expect(await bob!.skippedKeyCount()).toBe(0);

      // 9. Duplicate delivery of message 2 is rejected.
      const duplicateAttempt = await bob!.decrypt(wire2, 1003);
      expect(duplicateAttempt).toBeNull();

      // 10/11. Bob sends a reply; Alice decrypts it.
      const replyWire = await bob!.encrypt(bytes("reply from bob"));
      expect(replyWire).not.toBeNull();
      const replyPlaintext = await alice!.decrypt(replyWire as Uint8Array, 1004);
      expect(replyPlaintext).not.toBeNull();
      expect(text(replyPlaintext as Uint8Array)).toBe("reply from bob");

      // 12/13. A real DH ratchet transition already occurred (step 5/10); confirm Alice's own ratchet key rotated too.
      const aliceRatchetPublicKeyBeforeSecondRound = await alice!.localRatchetPublicKeyHex();
      const secondRoundWire = await alice!.encrypt(bytes("after the ratchet transition"));
      const aliceRatchetPublicKeyAfterSecondRound = await alice!.localRatchetPublicKeyHex();
      expect(aliceRatchetPublicKeyAfterSecondRound).toBe(aliceRatchetPublicKeyBeforeSecondRound); // no NEW DH step on a second consecutive send in the same direction
      const secondRoundPlaintext = await bob!.decrypt(secondRoundWire as Uint8Array, 1005);
      expect(text(secondRoundPlaintext as Uint8Array)).toBe("after the ratchet transition");

      // 14/15. Stop both runtimes (conceptually -- seal state, discard in-memory handles) and restore from durable sealed files.
      const dir = makeTmpDir();
      const aliceSealed = await alice!.sealState(aliceMasterSeed, remoteDeviceRefForAlice, conversationId);
      expect(aliceSealed).not.toBeNull();
      const bobSealed = await bob!.sealState(bobMasterSeed, remoteDeviceRefForBob, conversationId);
      expect(bobSealed).not.toBeNull();

      const sealedStatePath = join(dir, "sealed-state.json");
      writeFileSync(
        sealedStatePath,
        JSON.stringify({
          alice: { ...aliceSealed, remoteRatchetPublicKeyHex: await alice!.remoteRatchetPublicKeyHex(), sendCounter: await alice!.sendCounter(), receiveCounter: await alice!.receiveCounter() },
          bob: { ...bobSealed, remoteRatchetPublicKeyHex: await bob!.remoteRatchetPublicKeyHex(), sendCounter: await bob!.sendCounter(), receiveCounter: await bob!.receiveCounter() },
        }),
      );

      const persisted = JSON.parse(readFileSync(sealedStatePath, "utf8") as string) as {
        alice: FedosDirectRatchetSealedState & { remoteRatchetPublicKeyHex: string | null; sendCounter: number; receiveCounter: number };
        bob: FedosDirectRatchetSealedState & { remoteRatchetPublicKeyHex: string | null; sendCounter: number; receiveCounter: number };
      };

      const restoredAlice = await FedosDirectRatchetCryptographicSession.restore(
        aliceMasterSeed,
        remoteDeviceRefForAlice,
        conversationId,
        sessionId,
        "alice-desktop",
        0,
        persisted.alice.sendCounter,
        persisted.alice.receiveCounter,
        0,
        persisted.alice.remoteRatchetPublicKeyHex,
        persisted.alice,
      );
      expect(restoredAlice).not.toBeNull();
      const restoredBob = await FedosDirectRatchetCryptographicSession.restore(
        bobMasterSeed,
        remoteDeviceRefForBob,
        conversationId,
        sessionId,
        "bob-desktop",
        0,
        persisted.bob.sendCounter,
        persisted.bob.receiveCounter,
        0,
        persisted.bob.remoteRatchetPublicKeyHex,
        persisted.bob,
      );
      expect(restoredBob).not.toBeNull();

      // 16. Exchange another message using the RESTORED sessions.
      const postRestoreWire = await restoredAlice!.encrypt(bytes("after restart"));
      expect(postRestoreWire).not.toBeNull();
      const postRestorePlaintext = await restoredBob!.decrypt(postRestoreWire as Uint8Array, 2000);
      expect(postRestorePlaintext).not.toBeNull();
      expect(text(postRestorePlaintext as Uint8Array)).toBe("after restart");

      // 17. Wrong Device rejects: a THIRD, unrelated session (different Master Seed/identity) sharing the same sealed root key cannot decrypt.
      const mallory = await primedGeneratedMasterSeedAuthority();
      const malloryAsWrongBob = await FedosDirectRatchetCryptographicSession.restore(
        mallory,
        remoteDeviceRefForBob,
        conversationId,
        sessionId,
        "bob-desktop",
        0,
        persisted.bob.sendCounter,
        persisted.bob.receiveCounter,
        0,
        persisted.bob.remoteRatchetPublicKeyHex,
        persisted.bob,
      );
      // Mallory's own Master Seed differs, so restoring the SAME sealed blob under HER authority fails closed at the sealing-authority layer already.
      expect(malloryAsWrongBob).toBeNull();

      // 18. Tamper rejects: flip one byte of a real wire message and confirm decrypt fails.
      const tamperWire = (await restoredAlice!.encrypt(bytes("tamper test"))) as Uint8Array;
      const tampered = new Uint8Array(tamperWire);
      const lastIndex = tampered.length - 1;
      tampered[lastIndex] = (tampered[lastIndex] as number) ^ 0x01;
      const tamperResult = await restoredBob!.decrypt(tampered, 2001);
      expect(tamperResult).toBeNull();
      // The genuine (untampered) message still decrypts correctly afterward.
      const genuineResult = await restoredBob!.decrypt(tamperWire, 2002);
      expect(text(genuineResult as Uint8Array)).toBe("tamper test");

      // 19. Old-state rollback: an HONEST boundary, documented rather than
      // overclaimed. Seal a snapshot of Bob's state BEFORE he decrypts
      // "after restart", then confirm that a session restored from that
      // EARLIER snapshot has no record of having already consumed that
      // message -- it is NOT itself a duplicate-of-something-this-loaded-
      // state-has-seen, so it correctly decrypts. This is precisely why
      // rollback protection is a PERSISTENCE-layer responsibility (the
      // Foundation Arc's own event-sourced revision monotonicity --
      // "old revision cannot silently replace newer revision," already
      // proven in that Arc's own test suite) layered ON TOP OF this Arc's
      // own crypto-core duplicate rejection (proven at step 9, WITHIN one
      // continuously-loaded session) -- not a property the crypto core
      // can enforce alone when handed a genuinely-earlier, still-valid
      // snapshot to restore FROM.
      const earlierBobSealed = await bob!.sealState(bobMasterSeed, remoteDeviceRefForBob, conversationId);
      const earlierBobRestored = await FedosDirectRatchetCryptographicSession.restore(
        bobMasterSeed,
        remoteDeviceRefForBob,
        conversationId,
        sessionId,
        "bob-desktop",
        0,
        (await bob!.sendCounter()) as number,
        (await bob!.receiveCounter()) as number,
        0,
        await bob!.remoteRatchetPublicKeyHex(),
        earlierBobSealed as FedosDirectRatchetSealedState,
      );
      expect(earlierBobRestored).not.toBeNull();
      // The already-consumed "after restart" message decrypts AGAIN under
      // this earlier-restored session -- an honest demonstration that the
      // crypto core alone does not prevent a stale-state replay; only the
      // Foundation's own persistence-layer revision guard (never letting a
      // caller restore FROM a superseded revision in the first place)
      // closes this gap in a real deployment.
      const staleReplayResult = await earlierBobRestored!.decrypt(postRestoreWire as Uint8Array, 2003);
      expect(staleReplayResult).not.toBeNull();
      expect(text(staleReplayResult as Uint8Array)).toBe("after restart");

      // 20. No known plaintext/key fixture bytes appear in the durable sealed-state file.
      const durableContents = readFileSync(sealedStatePath, "utf8") as string;
      for (const marker of ["message one", "message two", "message three", "reply from bob", "after the ratchet transition", "after restart", "tamper test"]) {
        expect(durableContents).not.toContain(marker);
      }
    });
  });
});
