import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InMemoryFedosConversationCapabilityPersistence } from "../src/os/messenger/conversations/capability/persistence/in_memory_fedos_conversation_capability_persistence.js";
import { AppendOnlyFedosConversationCapabilityPersistence } from "../src/os/messenger/conversations/capability/persistence/append_only_fedos_conversation_capability_persistence.js";
import type { FedosConversationCapabilityPersistence } from "../src/os/messenger/conversations/capability/persistence/fedos_conversation_capability_persistence.js";
import type {
  FedosPersistedConversationCapabilityIssuedEventV1,
  FedosPersistedConversationCapabilityRedeemedEventV1,
} from "../src/os/messenger/conversations/capability/persistence/fedos_persisted_conversation_capability_v1.js";

function issuedEvent(capabilityId: string, conversationId: string): FedosPersistedConversationCapabilityIssuedEventV1 {
  return {
    schemaVersion: 1,
    eventType: "issued",
    capabilityId,
    conversationId,
    action: "join-conversation",
    issuerAuthority: "fedos",
    issuerPublicIdentifier: "alice",
    issuerIdentityId: null,
    intendedRecipientAuthority: null,
    intendedRecipientPublicIdentifier: null,
    intendedRecipientIdentityId: null,
    maxUses: 5,
    expiresAt: null,
    issuedAt: 1_700_000_000,
    bearerVerifier: "deadbeef",
  };
}

function redeemedEvent(capabilityId: string, redeemerPublicIdentifier: string): FedosPersistedConversationCapabilityRedeemedEventV1 {
  return {
    schemaVersion: 1,
    eventType: "redeemed",
    capabilityId,
    redeemerAuthority: "fedos",
    redeemerPublicIdentifier,
    redeemerIdentityId: null,
    redeemedAt: 1_700_000_050,
  };
}

/**
 * Secure Runtime Alpha 1601-1610 -- `listConversationCapabilityEvents()`,
 * the one additive `FedosConversationCapabilityPersistence` port method
 * this Arc adds (mirrors `hasRedeemedEvent()`'s own Alpha 841 additive
 * precedent) so Archive Export/Restore can replay RAW Capability events
 * rather than a lossy reconstructed current-state record.
 */
function runSharedContract(label: string, makeBackend: () => FedosConversationCapabilityPersistence, cleanup?: () => void) {
  describe(`Secure Runtime Alpha 1601-1610 -- listConversationCapabilityEvents (${label})`, () => {
    afterEach(() => {
      cleanup?.();
    });

    it("1. returns both issued and redeemed events for one conversation", () => {
      const backend = makeBackend();
      backend.putEvent(issuedEvent("cap-1", "conv-a"));
      backend.putEvent(redeemedEvent("cap-1", "bob"));

      const events = backend.listConversationCapabilityEvents("conv-a");
      expect(events.length).toBe(2);
      expect(events.some((e) => e.eventType === "issued")).toBe(true);
      expect(events.some((e) => e.eventType === "redeemed")).toBe(true);
    });

    it("2. excludes events for a DIFFERENT conversation's capability", () => {
      const backend = makeBackend();
      backend.putEvent(issuedEvent("cap-1", "conv-a"));
      backend.putEvent(issuedEvent("cap-2", "conv-b"));
      backend.putEvent(redeemedEvent("cap-2", "carol"));

      const events = backend.listConversationCapabilityEvents("conv-a");
      expect(events.length).toBe(1);
      expect(events[0]?.capabilityId).toBe("cap-1");
    });

    it("3. returns an empty array for a conversation with no capabilities", () => {
      const backend = makeBackend();
      backend.putEvent(issuedEvent("cap-1", "conv-a"));
      expect(backend.listConversationCapabilityEvents("conv-unknown")).toEqual([]);
    });

    it("4. multiple redemptions for the same capability all appear", () => {
      const backend = makeBackend();
      backend.putEvent(issuedEvent("cap-1", "conv-a"));
      backend.putEvent(redeemedEvent("cap-1", "bob"));
      backend.putEvent(redeemedEvent("cap-1", "carol"));

      const events = backend.listConversationCapabilityEvents("conv-a");
      expect(events.length).toBe(3);
      expect(events.filter((e) => e.eventType === "redeemed").length).toBe(2);
    });
  });
}

runSharedContract("in-memory", () => new InMemoryFedosConversationCapabilityPersistence());

const tempDirs: string[] = [];
runSharedContract(
  "append-only",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-archive-capability-"));
    tempDirs.push(dir);
    return new AppendOnlyFedosConversationCapabilityPersistence(join(dir, "capability-events.ndjson"));
  },
  () => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()!;
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
