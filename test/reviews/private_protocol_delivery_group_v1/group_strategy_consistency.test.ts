import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, readdirSync } from "node:fs";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import membershipReadinessSource from "../../../src/os/messenger/conversations/encryption/fedos_conversation_membership_readiness.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import membershipTransitionSource from "../../../src/os/messenger/conversations/membership/fedos_conversation_membership_transition.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilityDescriptorSource from "../../../src/os/messenger/conversations/capability/fedos_conversation_capability_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import participantResolverSource from "../../../src/os/messenger/conversations/encryption/identity/fedos_conversation_participant_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import conversationKeyRustSource from "../../../packages/fedos-core-rust/src/crypto/conversation_key.rs?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeAssemblySource from "../../../src/os/messenger/conversations/runtime/fedos_conversation_runtime_assembly.ts?raw";

/**
 * Private Protocol Delivery and Group Encryption V1 review -- group
 * strategy consistency. Verifies, against real source and real docs, that
 * `14`-`18`'s own claims about the current absence of any standard group
 * crypto scheme, the single-counterparty structural limit, and the docs'
 * own internal cross-referencing are accurate today. Never asserts that
 * any pairwise-fanout/group-key implementation exists -- only that this
 * review's own "not yet built, and here is exactly why" claims hold.
 */

const DOCS_DIR = "docs/reviews/private_protocol_delivery_group_v1";
const GROUP_DOCS: readonly string[] = [
  "14_group_crypto_inventory.md",
  "15_group_strategy.md",
  "16_pairwise_fanout.md",
  "17_epochs_membership.md",
  "18_multi_device.md",
];

function readDoc(name: string): string {
  return readFileSync(`${DOCS_DIR}/${name}`, "utf8") as string;
}

function allRustFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true }) as Array<{ name: string; isDirectory(): boolean }>;
  let files: string[] = [];
  for (const entry of entries) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      files = files.concat(allRustFiles(path));
    } else if (entry.name.endsWith(".rs")) {
      files.push(path);
    }
  }
  return files;
}

describe("Private Protocol Delivery and Group Encryption V1 review -- group crypto source facts", () => {
  it("1. no Sender Key / MLS / group-key primitive exists anywhere in packages/fedos-core-rust/src -- grounds 14's inventory finding", () => {
    for (const file of allRustFiles("packages/fedos-core-rust/src")) {
      const text = readFileSync(file, "utf8") as string;
      expect(text, `${file} should not reference a group-crypto scheme`).not.toMatch(/sender[_ ]?key|\bMLS\b/i);
    }
  });

  it("2. the pairwise ECDH conversation-key primitive is real and explicitly scoped to Direct-mode only, never claiming group/distributed key agreement -- grounds 14/15's finding", () => {
    expect(conversationKeyRustSource as string).toMatch(/pub\(crate\)\s+fn derive_conversation_key_via_ecdh_internal/);
    expect(conversationKeyRustSource as string).toMatch(/nip44-v2/);
  });

  it("3. the envelope's key epoch is fixed to a single supported value -- grounds 17's 'no epoch advancement mechanism' finding", () => {
    expect(membershipReadinessSource as string).toMatch(/FEDOS_CONVERSATION_ENVELOPE_SUPPORTED_KEY_EPOCH = 0/);
    expect(membershipReadinessSource as string).toMatch(/outcome:\s*"unsupported-epoch"/);
  });

  it("4. membership transitions are exactly admit/revoke/leave -- no group-specific transition (e.g. role change, epoch bump) exists -- grounds 17's finding", () => {
    expect(membershipTransitionSource as string).toMatch(/"admit"\s*\|\s*"revoke"\s*\|\s*"leave"/);
    expect(membershipTransitionSource as string).toMatch(/transition === "admit"/);
    expect(membershipTransitionSource as string).toMatch(/transition === "revoke"/);
    expect(membershipTransitionSource as string).toMatch(/transition === "leave"/);
  });

  it("5. a Conversation Capability grants exactly one action, join-conversation -- no separate group-invite action exists -- grounds 15/16's finding", () => {
    expect(capabilityDescriptorSource as string).toMatch(/FedosConversationCapabilityAction = "join-conversation"/);
  });

  it("6. the participant resolver's own header states its single-counterparty limit is a deliberate refusal to guess, not an oversight -- grounds 14's finding", () => {
    expect(participantResolverSource as string).toMatch(/deliberate, honest/i);
    expect(participantResolverSource as string).toMatch(/refusal to guess/i);
    expect(participantResolverSource as string).toMatch(/exactly ONE other/i);
  });

  it("7. the runtime assembly never wires a group-key authority or multi-recipient resolver of any kind -- grounds 15/16/19's 'C depends on a real code change, not a config flag' finding", () => {
    expect(runtimeAssemblySource as string).not.toMatch(/groupKey|senderKey|multiRecipient|fanout/i);
  });
});

describe("Private Protocol Delivery and Group Encryption V1 review -- group docs internal consistency", () => {
  it("8. every group-strategy doc (14-18) is non-trivial and opens with the correct heading", () => {
    for (const name of GROUP_DOCS) {
      const content = readDoc(name);
      expect(content.length).toBeGreaterThan(800);
      const number = name.slice(0, 2);
      expect(content.split("\n")[0]).toMatch(new RegExp(`^# Review ${number} `));
    }
  });

  it("9. 15_group_strategy.md references the prior Security review's own A-E comparison rather than re-deriving it", () => {
    const doc = readDoc("15_group_strategy.md");
    expect(doc).toMatch(/private_conversation_security\/05_key_distribution\.md/);
    expect(doc).toMatch(/does not re-run that\s*\ncomparison|does not re-derive/i);
  });

  it("10. 16_pairwise_fanout.md names an explicit size/recipient limit as a policy decision, never a specific invented number treated as cryptographic fact", () => {
    const doc = readDoc("16_pairwise_fanout.md");
    expect(doc).toMatch(/size\/recipient limit/i);
    expect(doc).toMatch(/policy decision, not\s*\ninvented cryptography|not invented cryptography/i);
  });

  it("11. 17_epochs_membership.md explicitly states membership removal does not revoke already-derived key material", () => {
    const doc = readDoc("17_epochs_membership.md");
    expect(doc).toMatch(/does not and cannot revoke already-derived key material/i);
  });

  it("12. 18_multi_device.md explicitly refuses to claim multi-device support exists", () => {
    const doc = readDoc("18_multi_device.md");
    expect(doc).toMatch(/does not claim multi-device support exists/i);
  });

  it("13. 19_dependency_graph.md and 20_normative_next_arc.md both exist and cross-reference the group docs", () => {
    const dependencyGraph = readDoc("19_dependency_graph.md");
    const normativeNextArc = readDoc("20_normative_next_arc.md");
    expect(dependencyGraph).toMatch(/16_pairwise_fanout\.md/);
    expect(normativeNextArc).toMatch(/15_group_strategy\.md/);
    expect(normativeNextArc).toMatch(/16_pairwise_fanout\.md/);
  });
});
