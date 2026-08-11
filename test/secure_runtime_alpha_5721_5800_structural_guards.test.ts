/**
 * Secure Runtime Alpha 5721–5800 (FedOS Ratchet Peer Notification and
 * Capability Advertisement Arc) — Phase R (Archive/Search/Sync/Transport
 * exclusion) and Phase S (structural guards). Source-text assertions,
 * mirroring `test/secure_runtime_alpha_5401_5480_structural_exclusion_guards.test.ts`'s
 * own established style — never modifying an Archive/Search/Sync file to
 * add an exclusion marker.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

declare const process: { cwd(): string };

function readAllSourceFilesRecursive(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const absoluteDir = join(process.cwd(), dir);
  function walk(current: string, relative: string): void {
    let entries: string[];
    try {
      entries = readdirSync(current) as string[];
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(current, entry);
      const relPath = join(relative, entry);
      if (entry.endsWith(".ts")) {
        out.set(relPath, readFileSync(fullPath, "utf8") as string);
      } else {
        walk(fullPath, relPath);
      }
    }
  }
  walk(absoluteDir, dir);
  return out;
}

const peerCapabilitySourceFiles = readAllSourceFilesRecursive(join("src", "conversation", "ratchet", "peer_capability"));

describe("Alpha 5721-5800 — Phase R: Archive/Search/Sync exclusion", () => {
  it("this Arc adds zero files under Archive, Search, or any device-sync directory", () => {
    expect(peerCapabilitySourceFiles.size).toBeGreaterThan(0);
  });

  it("no peer_capability source file imports Archive, Search, or Sync journal modules", () => {
    const forbidden = [/from ["'].*\/archive\//, /from ["'].*\/search\//, /sync_journal/i, /from ["'].*\/relay_sync\//, /from ["'].*\/sync_scheduler\//];
    for (const [path, source] of peerCapabilitySourceFiles) {
      for (const pattern of forbidden) {
        expect(pattern.test(source), `${path} must not match ${pattern}`).toBe(false);
      }
    }
  });

  it("no existing Archive/Search/device-sync source file imports the new peer_capability module", () => {
    for (const dir of ["src/conversation/archive", "src/conversation/search"]) {
      const files = readAllSourceFilesRecursive(dir);
      for (const [path, source] of files) {
        expect(source, `${path} must not import peer_capability`).not.toMatch(/from ["'].*\/peer_capability\//);
      }
    }
  });

  it("the peer-capability control payload is never dispatched as a Conversation chat message", () => {
    const runtimeSource = readFileSync(join(process.cwd(), "src", "conversation", "runtime", "fedos_conversation_runtime.ts"), "utf8") as string;
    // The peer-capability attempt in `receiveNip17Rumor()` must be tried
    // and must `return` BEFORE the legacy chat-message coordinator's own
    // `receiveRumor()` call -- confirmed by requiring the peer-capability
    // block's own marker to appear textually before the legacy coordinator line.
    const peerCapabilityMarkerIndex = runtimeSource.indexOf("this.#peerCapabilityRuntime.importPeerCapabilityPayload(rumor.content)");
    const legacyCoordinatorIndex = runtimeSource.indexOf("return this.#nip17InboundImportCoordinator.receiveRumor(rumor, relaySource);");
    expect(peerCapabilityMarkerIndex).toBeGreaterThan(-1);
    expect(legacyCoordinatorIndex).toBeGreaterThan(-1);
    expect(peerCapabilityMarkerIndex).toBeLessThan(legacyCoordinatorIndex);
  });
});

describe("Alpha 5721-5800 — Phase S: structural guards", () => {
  it("no new public Nostr event kind is introduced -- only the existing kind-1 (account authorization) and the existing NIP-17 Gift Wrap kinds are referenced", () => {
    const authSource = peerCapabilitySourceFiles.get(join("src", "conversation", "ratchet", "peer_capability", "fedos_ratchet_peer_capability_authentication.ts"))!;
    expect(authSource).toMatch(/FIXED_NOSTR_KIND = 1/);
    // No file in this Arc references a numeric Nostr kind other than 1 (account auth, reused from the existing Device Binding pattern).
    for (const [path, source] of peerCapabilitySourceFiles) {
      const kindLiterals = source.match(/\bkind\s*[:=]\s*(\d+)/g) ?? [];
      for (const literal of kindLiterals) {
        expect(literal, `${path}: ${literal}`).toMatch(/\b1\b/);
      }
    }
  });

  it("no file in this Arc defines a route/suite/capability string outside the closed vocabulary module", () => {
    const vocabPath = join("src", "conversation", "ratchet", "peer_capability", "fedos_ratchet_peer_capability_vocabulary.ts");
    for (const [path, source] of peerCapabilitySourceFiles) {
      if (path === vocabPath) continue;
      expect(source, `${path} must not define a NEW route/suite literal array`).not.toMatch(/FEDOS_RATCHET_PEER_CAPABILITY_KNOWN_ROUTES\s*=/);
      expect(source, `${path} must not define a NEW suite literal array`).not.toMatch(/FEDOS_RATCHET_PEER_CAPABILITY_KNOWN_SUITES\s*=/);
    }
  });

  it("the inbound coordinator never calls a Device Registry mutation method (putEvent) -- evidence only, never an administrative command", () => {
    const inboundSource = peerCapabilitySourceFiles.get(join("src", "conversation", "ratchet", "peer_capability", "fedos_ratchet_peer_capability_inbound_coordinator.ts"))!;
    expect(inboundSource).not.toMatch(/deviceRegistry\.putEvent/);
    expect(inboundSource).not.toMatch(/\.revokeDevice\(/);
    expect(inboundSource).not.toMatch(/\.registerDevice\(/);
  });

  it("no file in this Arc references Group/Sender-Key, MLS, PQ/hybrid, or account/Nostr identity rotation", () => {
    const forbidden = [/sender-key/i, /senderkey/i, /\bmls\b/i, /post-quantum/i, /\bhybrid.?crypto\b/i, /identity.?rotation/i, /account.?rotation/i];
    for (const [path, source] of peerCapabilitySourceFiles) {
      for (const pattern of forbidden) {
        expect(pattern.test(source), `${path} must not match ${pattern}`).toBe(false);
      }
    }
  });

  it("no file in this Arc touches p2p/ or .tmp_gen/", () => {
    for (const [path] of peerCapabilitySourceFiles) {
      expect(path).not.toMatch(/^p2p\//);
      expect(path).not.toMatch(/\.tmp_gen/);
    }
  });

  it("the capability advertisement enforces a concrete maximum entry count", () => {
    const vocabSource = peerCapabilitySourceFiles.get(join("src", "conversation", "ratchet", "peer_capability", "fedos_ratchet_peer_capability_vocabulary.ts"))!;
    expect(vocabSource).toMatch(/FEDOS_RATCHET_PEER_CAPABILITY_MAX_ENTRIES\s*=\s*\d+/);
  });

  it("the acceptance policy outcome vocabulary is never a boolean -- it is a closed string union with more than two values", () => {
    const outcomeSource = peerCapabilitySourceFiles.get(join("src", "conversation", "ratchet", "peer_capability", "fedos_ratchet_peer_capability_acceptance_outcome.ts"))!;
    const values = outcomeSource.match(/"[a-z-]+"/g) ?? [];
    expect(new Set(values).size).toBeGreaterThan(2);
  });

  it("no automatic route activation -- the outbound coordinator never mutates Ratchet session/route state, and the inbound coordinator never selects a route", () => {
    const outboundSource = peerCapabilitySourceFiles.get(join("src", "conversation", "ratchet", "peer_capability", "fedos_ratchet_peer_capability_outbound_coordinator.ts"))!;
    const inboundSource = peerCapabilitySourceFiles.get(join("src", "conversation", "ratchet", "peer_capability", "fedos_ratchet_peer_capability_inbound_coordinator.ts"))!;
    for (const source of [outboundSource, inboundSource]) {
      expect(source).not.toMatch(/initializeDirectRatchetSession/);
      expect(source).not.toMatch(/resetDirectRatchetSession/);
      expect(source).not.toMatch(/sendDirectRatchetMessage/);
    }
  });
});
