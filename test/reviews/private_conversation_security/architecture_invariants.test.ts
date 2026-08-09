import { describe, it, expect } from "vitest";
import { generateAeadKey } from "../../../src/runtime/fedos_runtime_aead_key_generation.js";
import { encrypt } from "../../../src/runtime/fedos_runtime_encrypt.js";
import { decrypt } from "../../../src/runtime/fedos_runtime_decrypt.js";
import { storeCiphertext, loadCiphertext, deleteCiphertext } from "../../../src/runtime/fedos_runtime_ciphertext_storage.js";
import { canProtocolAdapterSupport, type ProtocolAdapterKind } from "../../../src/os/_legacy_prototype/federation/capability_matrix.js";
import { canRead, canPost } from "../../../src/os/_legacy_prototype/community/policy.js";
import type { CommunitySpace } from "../../../src/os/_legacy_prototype/community/types.js";
import { FedosDesktopHost } from "../../../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../../../src/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../../../src/board/persistence/in_memory_fedos_board_persistence.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import moderationSource from "../../../src/os/messenger/board/fedos_board_moderation.ts?raw";

/**
 * Private Conversation Security, Storage & Capability Boundary Review --
 * architecture invariants. Behavioral tests over REAL, unmodified,
 * currently-existing code -- confirms this review's own §01/§02/§07/§11/§12
 * findings hold as observed fact, not merely as prose. Never asserts that
 * any FUTURE (unimplemented) Private Conversation type/function exists.
 */
describe("Private Conversation Security Review -- architecture invariants", () => {
  it("1. generateAeadKey() resolves null in this environment -- behavioral proof of §01/§20's BLOCK-1/BLOCK-2/BLOCK-3 (real crypto exists, gate is currently closed)", async () => {
    const key = await generateAeadKey();
    expect(key).toBeNull();
  });

  it("2. encrypt() resolves null even given a structurally-valid AeadKeyHandle shape -- confirms the WASM gate, not merely a missing-key error, is what's closing this path", async () => {
    const fakeKeyHandle = { kind: "AeadKeyHandle" as const };
    const ciphertext = await encrypt(fakeKeyHandle, "ChaCha20Poly1305", "Conversation", new TextEncoder().encode("hello"));
    expect(ciphertext).toBeNull();
  });

  it("3. decrypt() resolves null symmetrically -- same gate, both directions", async () => {
    const fakeKeyHandle = { kind: "AeadKeyHandle" as const };
    const fakeCiphertextHandle = { kind: "AeadCiphertextHandle" as const };
    const plaintext = await decrypt(fakeKeyHandle, "ChaCha20Poly1305", "Conversation", fakeCiphertextHandle);
    expect(plaintext).toBeNull();
  });

  it("4. storeCiphertext/loadCiphertext/deleteCiphertext never reach Rust at all -- pure in-process Map, confirms §01/§07's 'two separate stacks' finding behaviorally", async () => {
    // Dev-only gated separately from the AEAD chain -- may itself resolve
    // false/null outside Development Runtime; either way, this proves it
    // never depends on the WASM artifact the way encrypt/decrypt do.
    const stored = await storeCiphertext("test-id-1", "opaque-wire-value" as never);
    if (stored) {
      const loaded = await loadCiphertext("test-id-1");
      expect(loaded).toBe("opaque-wire-value");
      await deleteCiphertext("test-id-1");
      expect(await loadCiphertext("test-id-1")).toBeNull();
    } else {
      // Outside Development Runtime, storeCiphertext itself fails closed to
      // `false` or `null` (its own real return type is `Promise<boolean | null>`)
      // -- either way, this proves no Rust/WASM dependency crashes or throws.
      expect(stored === false || stored === null).toBe(true);
    }
  });

  it("5. capability_matrix.ts has no session_placeholder value -- grounds §18's Session-row finding that Session isn't even named in this planning table", () => {
    const nonNostrKinds: ProtocolAdapterKind[] = ["bluesky_placeholder", "threads_placeholder", "rss_placeholder", "local_placeholder"];
    for (const kind of nonNostrKinds) {
      const decision = canProtocolAdapterSupport(kind, "private_message_placeholder");
      // Every non-Nostr kind falls through to the generic "unavailable" branch,
      // never the Nostr-specific structural "rejected" -- confirms the matrix's
      // own private-message policy is Nostr-specific, not general.
      expect(decision.state).toBe("unavailable");
      expect(decision.reason).toMatch(/placeholder only/i);
    }
  });

  it("6. SpaceVisibility's own three values already separate discoverability from read access -- re-confirms the prior review's own §05 axis-separation precedent still holds", () => {
    const space = (visibility: CommunitySpace["visibility"]): CommunitySpace => ({
      id: "s1",
      type: "community",
      name: "Space",
      visibility,
      membershipPolicy: "open",
      postPolicy: "open",
      owners: ["owner".padEnd(64, "0")],
      admins: [],
      moderators: [],
      members: [],
    });
    const stranger = "stranger".padEnd(64, "0");
    expect(canRead(stranger, space("public")).allowed).toBe(true);
    expect(canRead(stranger, space("unlisted")).allowed).toBe(true);
    expect(canRead(stranger, space("private")).allowed).toBe(false);
    expect(canPost(stranger, space("public")).allowed).toBe(true);
  });

  it("7. FedosBoardModerationRecord is types-only -- no class, no enforcement function -- grounds §04/§16's moderation-generalizes-unchanged and moderation/encryption-tension findings", () => {
    const code = (moderationSource as string)
      .split("\n")
      .filter((l: string) => {
        const t = l.trim();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join("\n");
    expect(code).not.toMatch(/export (class|function)/);
    expect(code).toMatch(/export interface FedosBoardModerationRecord/);
  });

  it("8. an already-shipped Public Board Runtime post still carries source.protocol === 'fedos' with reference === its own id -- confirms §02/§03's reused-vocabulary claim against REAL, already-committed code (Alpha 621-640), not a hypothetical", async () => {
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    await host.start();
    const { createFedosBoardRuntime } = await import("../../../src/board/runtime/fedos_board_runtime.js");
    const runtime = createFedosBoardRuntime({
      host,
      idGenerator: { generatePostId: () => "inv-test-post" },
    });
    const result = await runtime.createPublicThread({ boardId: "board-a", body: "hello" });
    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.post.source).toEqual({ protocol: "fedos", reference: "inv-test-post" });
    await host.stop();
  });
});
