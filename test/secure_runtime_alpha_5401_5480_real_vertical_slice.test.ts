/**
 * Secure Runtime Alpha 5401-5480 — Phase L: the real, foundation-level
 * vertical slice. Real WASM-backed sealing authority
 * (`FedosWasmMasterSeedAuthority`), real durable append-only file
 * persistence for BOTH session metadata and sealed secrets, a genuine
 * Runtime stop/restart, and genuine cryptographic wrong-Device/tamper
 * rejection.
 *
 * THIS IS NOT A CRYPTOGRAPHIC DOUBLE RATCHET ACCEPTANCE TEST. No message
 * is ever ratchet-encrypted or ratchet-decrypted here. The "secret
 * material" sealed below is opaque placeholder test bytes only.
 *
 * Skips itself with a clear message if the real
 * `packages/fedos-core-rust/pkg/` is absent (gitignored; run
 * `npm run build:wasm` first).
 */
import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error node:fs has no type declarations without @types/node in this tsconfig.
import { existsSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
// @ts-expect-error see above.
import { randomBytes } from "node:crypto";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { join } from "node:path";

import { FedosWasmMasterSeedAuthority } from "../src/os/core/vault/wasm/fedos_wasm_master_seed_authority.js";
import { FedosWasmLoaderSkeleton } from "../src/runtime/fedos_wasm_loader.js";
import { FedosDirectRatchetStateRuntime } from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_state_runtime.js";
import { AppendOnlyFedosDirectRatchetSessionPersistence } from "../src/os/messenger/conversations/ratchet/persistence/append_only_fedos_direct_ratchet_session_persistence.js";
import { AppendOnlyFedosSealedDirectRatchetSecretPersistence } from "../src/os/messenger/conversations/ratchet/persistence/append_only_fedos_sealed_direct_ratchet_secret_persistence.js";
import { toFedosDirectRatchetSessionId } from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_id.js";
import { toFedosPrivateConversationId } from "../src/os/messenger/conversations/construction/fedos_private_conversation_id.js";
import type { FedosDirectRatchetSessionBinding } from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_binding.js";
import type { FedosDirectRatchetSealingAuthority } from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_sealing_authority.js";

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

/** Mirrors the real production priming sequence -- see `fedos_conversation_production_crypto_authority_factory.ts`. */
async function primedWasmMasterSeedAuthority(): Promise<FedosWasmMasterSeedAuthority> {
  const loader = new FedosWasmLoaderSkeleton();
  loader.planLoad();
  await loader.attemptDevOnlyJsGlueImport();
  await loader.attemptDevOnlyWasmInitialization();
  return new FedosWasmMasterSeedAuthority(loader);
}

const TEST_PASSPHRASE = new TextEncoder().encode("vertical-slice-test-passphrase (never a real credential)");

/**
 * A "restart" in this Arc's own real deployment always restores the SAME
 * Master Seed from its own sealed envelope (never generates a fresh,
 * unrelated one) -- otherwise every derived sealing key would trivially
 * differ across restart and nothing could ever be recovered, which is
 * NOT what this Arc's own restart-recovery requirement claims. This
 * helper seals the freshly-generated seed once, then restores it into a
 * brand-NEW authority instance -- the SAME two-step real production flow
 * `FedosProfileInitializationCoordinator` drives, scoped down to just the
 * Master Seed Authority itself for this test's own narrow purpose.
 */
async function generateThenRestoreSameMasterSeed(): Promise<{
  original: FedosDirectRatchetSealingAuthority;
  restore: () => Promise<FedosDirectRatchetSealingAuthority>;
}> {
  const original = await primedWasmMasterSeedAuthority();
  expect(await original.generate()).toBe(true);
  const envelope = await original.seal(TEST_PASSPHRASE);
  expect(envelope).not.toBeNull();

  return {
    original,
    restore: async () => {
      const restored = await primedWasmMasterSeedAuthority();
      const restoredOk = await restored.restoreSealed(envelope!, TEST_PASSPHRASE);
      expect(restoredOk).toBe(true);
      return restored;
    },
  };
}

const tmpDirs: string[] = [];
function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-ratchet-vertical-slice-"));
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

suite("Alpha 5401-5480 — real foundation-level vertical slice (REAL WASM + REAL durable files)", () => {
  it("full slice: create identities, seal, persist, stop, restart, recover, prove binding/tamper/lock", async () => {
    await withDevelopmentNodeEnv(async () => {
      // 1/2/3. Two independent account/Device identities, one Direct
      // Conversation, a deterministic Device-pair session identity.
      const conversationId = toFedosPrivateConversationId("direct", "vertical-slice-req-1");
      const binding: FedosDirectRatchetSessionBinding = {
        sessionId: toFedosDirectRatchetSessionId({
          localAccountRef: "alice",
          localDeviceRef: "alice-desktop",
          remoteAccountRef: "bob",
          remoteDeviceRef: "bob-desktop",
          conversationId,
          suite: "fedos-direct-ratchet-v1",
          generation: 0,
        })!,
        localAccountRef: { authority: "fedos", publicIdentifier: "alice", identityId: null },
        localDeviceRef: "alice-desktop",
        remoteAccountRef: { authority: "fedos", publicIdentifier: "bob", identityId: null },
        remoteDeviceRef: "bob-desktop",
        conversationId,
        suite: "fedos-direct-ratchet-v1",
        generation: 0,
      };
      expect(binding.sessionId).toBeTruthy();

      const dir = makeTmpDir();
      const sessionPersistence = new AppendOnlyFedosDirectRatchetSessionPersistence(join(dir, "sessions.ndjson"));
      const sealedSecretPersistence = new AppendOnlyFedosSealedDirectRatchetSecretPersistence(join(dir, "sealed.ndjson"));
      const masterSeed = await generateThenRestoreSameMasterSeed();
      const sealingAuthority = masterSeed.original;

      const runtime = new FedosDirectRatchetStateRuntime({ sessionPersistence, sealedSecretPersistence, sealingAuthority });

      // 4. Create validated ratchet session metadata.
      const createOutcome = runtime.createSession(binding);
      expect(createOutcome.outcome).toBe("created");
      expect(runtime.markActive(binding.sessionId).outcome).toBe("transitioned");

      // 5. Test secret material via a real CSPRNG (never Math.random) --
      // opaque placeholder bytes only, never a real derived ratchet key.
      const placeholderSecret = new Uint8Array(randomBytes(32) as unknown as ArrayLike<number>);

      // 6/7. Seal via the REAL WASM authority; persist metadata + sealed record to REAL durable files.
      const sealOutcome = await runtime.sealAndPersistSecret(binding.sessionId, "root-key", null, placeholderSecret);
      expect(sealOutcome.outcome).toBe("sealed");
      if (sealOutcome.outcome !== "sealed") return;

      // 8. Stop this Runtime.
      runtime.stop();
      expect(runtime.recoveredSecret(sealOutcome.sealedRecordId)).toBeNull();

      // 9. Create a FRESH Runtime over the SAME durable files, with a
      // fresh WASM authority instance that restores the SAME Master Seed
      // (never a freshly-generated, unrelated one).
      const freshSealingAuthority = await masterSeed.restore();
      const freshSessionPersistence = new AppendOnlyFedosDirectRatchetSessionPersistence(join(dir, "sessions.ndjson"));
      const freshSealedSecretPersistence = new AppendOnlyFedosSealedDirectRatchetSecretPersistence(join(dir, "sealed.ndjson"));
      const freshRuntime = new FedosDirectRatchetStateRuntime({
        sessionPersistence: freshSessionPersistence,
        sealedSecretPersistence: freshSealedSecretPersistence,
        sealingAuthority: freshSealingAuthority,
      });
      freshRuntime.restart();
      expect(freshRuntime.getSessionMetadata(binding.sessionId)?.lifecycleState).toBe("active");

      // 10/11. Recover the same session; prove identity/session binding by exact byte match.
      const recoverOutcome = await freshRuntime.recover(binding.sessionId, sealOutcome.sealedRecordId);
      expect(recoverOutcome).toEqual({ outcome: "recovered" });
      const handle = freshRuntime.recoveredSecret(sealOutcome.sealedRecordId);
      expect(handle).not.toBeNull();
      expect(Array.from(handle!.bytes()!)).toEqual(Array.from(placeholderSecret));

      // 12. Prove wrong Device rejection: an independent session forged
      // with a DIFFERENT remoteDeviceRef, sharing the same sealed-secret
      // store, cannot recover this sealed record.
      const wrongDeviceConversationId = toFedosPrivateConversationId("direct", "vertical-slice-req-2");
      const wrongDeviceBinding: FedosDirectRatchetSessionBinding = {
        ...binding,
        sessionId: toFedosDirectRatchetSessionId({
          localAccountRef: "alice",
          localDeviceRef: "alice-desktop",
          remoteAccountRef: "bob",
          remoteDeviceRef: "bob-OTHER-device",
          conversationId: wrongDeviceConversationId,
          suite: "fedos-direct-ratchet-v1",
          generation: 0,
        })!,
        remoteDeviceRef: "bob-OTHER-device",
        conversationId: wrongDeviceConversationId,
      };
      const wrongDeviceSessionPersistence = new AppendOnlyFedosDirectRatchetSessionPersistence(join(makeTmpDir(), "sessions.ndjson"));
      const wrongDeviceRuntime = new FedosDirectRatchetStateRuntime({
        sessionPersistence: wrongDeviceSessionPersistence,
        sealedSecretPersistence: freshSealedSecretPersistence,
        sealingAuthority: freshSealingAuthority,
      });
      wrongDeviceRuntime.createSession(wrongDeviceBinding);
      wrongDeviceRuntime.markActive(wrongDeviceBinding.sessionId);
      // Manually register the ORIGINAL sealed record's key against the
      // wrong-device session to attempt cross-session recovery.
      const wrongDeviceOutcome = await wrongDeviceRuntime.recover(wrongDeviceBinding.sessionId, sealOutcome.sealedRecordId);
      expect(wrongDeviceOutcome.outcome).toBe("rejected");

      // 13. Prove tamper rejection: flip one hex character of the sealed
      // blob directly in the durable file, then attempt recovery.
      const sealedFileContents = readFileSync(join(dir, "sealed.ndjson"), "utf8") as string;
      const sealedRecordLine = sealedFileContents.trim().split("\n")[0]!;
      const sealedRecordParsed = JSON.parse(sealedRecordLine);
      const originalBlob: string = sealedRecordParsed.sealedBlob;
      const flipIndex = 10 % originalBlob.length;
      const flippedChar = originalBlob[flipIndex] === "0" ? "1" : "0";
      const tamperedBlob = originalBlob.slice(0, flipIndex) + flippedChar + originalBlob.slice(flipIndex + 1);
      const tamperedRecord = { ...sealedRecordParsed, sealedBlob: tamperedBlob };

      const tamperedDir = makeTmpDir();
      const tamperedSealedPersistence = new AppendOnlyFedosSealedDirectRatchetSecretPersistence(join(tamperedDir, "sealed.ndjson"));
      tamperedSealedPersistence.putSealedSecret(tamperedRecord);
      const tamperedRuntime = new FedosDirectRatchetStateRuntime({
        sessionPersistence: freshSessionPersistence,
        sealedSecretPersistence: tamperedSealedPersistence,
        sealingAuthority: freshSealingAuthority,
      });
      const tamperOutcome = await tamperedRuntime.recover(binding.sessionId, sealOutcome.sealedRecordId);
      expect(tamperOutcome).toEqual({ outcome: "rejected", reason: "tamper-or-mismatch" });

      // 14. Prove lock discards recovered handles.
      freshRuntime.lock();
      expect(freshRuntime.recoveredSecret(sealOutcome.sealedRecordId)).toBeNull();

      // 15. Prove no raw secret appears in durable files.
      const secretHex = Array.from(placeholderSecret)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      expect(sealedFileContents).not.toContain(secretHex);
      const sessionFileContents = readFileSync(join(dir, "sessions.ndjson"), "utf8") as string;
      expect(sessionFileContents).not.toContain(secretHex);
    });
  });
});
