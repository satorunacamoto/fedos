import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, readdirSync } from "node:fs";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import activationCoordinatorSource from "../../../src/os/messenger/conversations/activation/fedos_conversation_direct_activation_coordinator.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import activationResultSource from "../../../src/os/messenger/conversations/activation/fedos_conversation_direct_activation_result.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import activationRecordSource from "../../../src/os/messenger/conversations/activation/fedos_persisted_conversation_activation_v1.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import activeLookupSource from "../../../src/os/messenger/conversations/activation/fedos_conversation_active_lookup.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import messagingCoordinatorSource from "../../../src/os/messenger/conversations/messaging/fedos_conversation_direct_messaging_coordinator.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sendResultSource from "../../../src/os/messenger/conversations/messaging/fedos_conversation_direct_message_send_result.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import participantResolverSource from "../../../src/os/messenger/conversations/encryption/identity/fedos_conversation_participant_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import retentionAuthoritySource from "../../../src/os/messenger/conversations/retention/fedos_payload_retention_authority.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilityDescriptorSource from "../../../src/os/messenger/conversations/capability/fedos_conversation_capability_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../../../package.json?raw";
import { assertFedosRootDependencyInvariant } from "../../helpers/fedos_root_dependency_invariant.js";

/**
 * Private Group Pairwise Fanout review -- source alignment. Verifies,
 * against this worktree's own real checked-out `src/` (== `d8f01cf`, see
 * `01_nip17_inventory.md`/`03_runtime_compatibility.md`), the "current
 * implementation reality" claims `01`-`20` make: the Activation/Messaging
 * layer is real, the Private-Group Gate rejects group activation, and
 * NIP-17/gift-wrap/Sender-Key/MLS remain entirely absent. Never asserts
 * that any Fanout Coordinator implementation exists -- only what this
 * review's own docs claim IS true of the repository today.
 */

const DOCS_DIR = "docs/reviews/private_group_pairwise_fanout";
const TEST_DIR = "test/reviews/private_group_pairwise_fanout";

const EXPECTED_DOCS: readonly string[] = [
  "01_nip17_inventory.md",
  "02_gift_wrap_inventory.md",
  "03_runtime_compatibility.md",
  "04_pairwise_fanout_architecture.md",
  "05_recipient_planning.md",
  "06_conversation_generation_boundaries.md",
  "07_group_membership_evolution.md",
  "08_history_semantics.md",
  "09_member_removal.md",
  "10_member_addition.md",
  "11_offline_delivery.md",
  "12_expiration_strategy.md",
  "13_relay_trust_assumptions.md",
  "14_local_canonical_history.md",
  "15_backup_model.md",
  "16_sender_key_comparison.md",
  "17_mls_comparison.md",
  "18_migration_path.md",
  "19_threat_model.md",
  "20_final_recommendation.md",
];

const MIN_CHARS = 800;

function readDoc(name: string): string {
  return readFileSync(`${DOCS_DIR}/${name}`, "utf8") as string;
}

function allSrcFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true }) as Array<{ name: string; isDirectory(): boolean }>;
  let files: string[] = [];
  for (const entry of entries) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      files = files.concat(allSrcFiles(path));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".rs")) {
      files.push(path);
    }
  }
  return files;
}

describe("Private Group Pairwise Fanout review -- deliverable structure", () => {
  it("1. index.md exists and is non-trivial", () => {
    const index = readDoc("index.md");
    expect(index.length).toBeGreaterThan(MIN_CHARS);
  });

  it("2. every one of the 20 numbered review docs exists on disk", () => {
    const entries = readdirSync(DOCS_DIR) as string[];
    for (const expected of EXPECTED_DOCS) {
      expect(entries).toContain(expected);
    }
  });

  it("3. exactly 21 files exist in the docs directory -- index + 20 reviews, no stray or missing file", () => {
    const entries = (readdirSync(DOCS_DIR) as string[]).filter((name) => name.endsWith(".md"));
    expect(entries.length).toBe(21);
  });

  it("4. every numbered doc is non-trivial and opens with the correct heading", () => {
    for (const name of EXPECTED_DOCS) {
      const content = readDoc(name);
      expect(content.length, `${name} should be substantive`).toBeGreaterThan(MIN_CHARS);
      const number = name.slice(0, 2);
      expect(content.split("\n")[0], `${name}'s first line`).toMatch(new RegExp(`^# Review ${number} `));
    }
  });

  it("5. exactly 3 test files exist in this review's own test directory", () => {
    const entries = (readdirSync(TEST_DIR) as string[]).filter((name) => name.endsWith(".test.ts"));
    expect(entries.sort()).toEqual([
      "architecture_boundary_invariants.test.ts",
      "recommendation_consistency.test.ts",
      "source_alignment.test.ts",
    ]);
  });
});

describe("Private Group Pairwise Fanout review -- source alignment (base commit reality)", () => {
  it("6. the Direct Activation Coordinator's own Private-Group Gate rejects any non-'direct' draft mode with 'unsupported-mode'", () => {
    expect(activationCoordinatorSource as string).toMatch(/Private-Group Gate/);
    expect(activationCoordinatorSource as string).toMatch(/draft\.mode !== "direct"/);
    expect(activationCoordinatorSource as string).toMatch(/return \{ outcome: "unsupported-mode" \}/);
  });

  it("7. the Activation phase vocabulary is exactly five phases, forward-only", () => {
    expect(activationRecordSource as string).toMatch(
      /"prepared"\s*\|\s*"readiness-confirmed"\s*\|\s*"lifecycle-activated"\s*\|\s*"completed"\s*\|\s*"terminal-failed"/,
    );
  });

  it("8. fedosConversationActivationId is deterministic -- same conversationId always yields the same activation id", async () => {
    const { fedosConversationActivationId } = (await import(
      "../../../src/conversation/activation/fedos_persisted_conversation_activation_v1.js"
    )) as { fedosConversationActivationId: (id: string) => string };
    expect(fedosConversationActivationId("conv-1")).toBe("activation::conv-1");
    expect(fedosConversationActivationId("conv-1")).toBe(fedosConversationActivationId("conv-1"));
    expect(fedosConversationActivationId("conv-1")).not.toBe(fedosConversationActivationId("conv-2"));
  });

  it("9. the active-conversation lookup requires BOTH a persisted draft AND a completed Activation fact -- never the draft's own lifecycleState", () => {
    expect(activeLookupSource as string).toMatch(/activation\.phase !== "completed"/);
    expect(activeLookupSource as string).not.toMatch(/draft\.lifecycleState/);
  });

  it("10. the Direct Activation result vocabulary carries exactly 14 outcomes, including 'unsupported-mode' and 'already-active'", () => {
    const matches = (activationResultSource as string).match(/readonly outcome:\s*"[a-z-]+"/g) ?? [];
    expect(matches.length).toBe(14);
    expect(activationResultSource as string).toMatch(/outcome:\s*"unsupported-mode"/);
    expect(activationResultSource as string).toMatch(/outcome:\s*"already-active"/);
  });

  it("11. sendDirectMessage's own success outcome is named 'sent-locally', never 'sent' or 'delivered' -- grounds 11's offline-delivery finding", () => {
    expect(sendResultSource as string).toMatch(/outcome:\s*"sent-locally"/);
    expect(sendResultSource as string).not.toMatch(/outcome:\s*"sent"[^-]/);
    expect(sendResultSource as string).not.toMatch(/outcome:\s*"delivered"/);
  });

  it("12. listDirectMessages sorts by createdAt ascending with an Envelope-id tie-break, and documents this as LOCAL ordering only", () => {
    expect(messagingCoordinatorSource as string).toMatch(
      /envelopes\.sort\(\(a, b\) => \(a\.createdAt !== b\.createdAt \? a\.createdAt - b\.createdAt : a\.id\.localeCompare\(b\.id\)\)\)/,
    );
    expect(messagingCoordinatorSource as string).toMatch(/never implies protocol\/global ordering/i);
  });

  it("13. the participant resolver requires exactly one other active member -- the invariant fanout's synthetic Conversations must each individually satisfy", async () => {
    expect(participantResolverSource as string).toMatch(/outcome:\s*"ambiguous-counterparty"/);
    const { MembershipFedosConversationParticipantResolver } = (await import(
      "../../../src/conversation/encryption/identity/fedos_conversation_participant_resolver.js"
    )) as {
      MembershipFedosConversationParticipantResolver: new (authority: unknown) => {
        resolveCounterparty(conversationId: string, local: unknown): { outcome: string };
      };
    };
    const threeActive = {
      findMembership: () => ({ state: "active", participant: { authority: "fedos", publicIdentifier: "me" } }),
      listMemberships: () => [
        { state: "active", participant: { authority: "fedos", publicIdentifier: "me" } },
        { state: "active", participant: { authority: "nostr", publicIdentifier: "a".repeat(64) } },
        { state: "active", participant: { authority: "nostr", publicIdentifier: "b".repeat(64) } },
      ],
    };
    const resolver = new MembershipFedosConversationParticipantResolver(threeActive as never);
    const result = resolver.resolveCounterparty("group-conv" as never, {
      authority: "fedos",
      publicIdentifier: "me",
      identityId: null,
    } as never);
    // A group-shaped roster fails the frozen resolver -- confirming any
    // synthetic per-pair Conversation a Fanout Coordinator constructs must
    // itself carry only exactly one counterparty's own Membership record.
    expect(result.outcome).toBe("ambiguous-counterparty");
  });

  it("14. the retention authority's own security claims explicitly exclude cloud backup deletion and worldwide deletion -- grounds 15's backup-model discipline", () => {
    expect(retentionAuthoritySource as string).toMatch(/MUST NOT claim/);
    expect(retentionAuthoritySource as string).toMatch(/cloud\s*\n?\s*\*?\s*backup deletion/);
  });

  it("15. expiresAt exists only on Capability, never on an Envelope -- grounds 12's expiration-strategy finding", () => {
    expect(capabilityDescriptorSource as string).toMatch(/expiresAt:\s*number \| null/);
  });

  it("16. no relay pool / multi-relay concept exists -- the single-relay assumption is a repeated, explicit guardrail -- grounds 13's finding", () => {
    for (const file of [
      "src/desktop/runtime/fedos_desktop_runtime.ts",
      "src/desktop/node_websocket_relay_socket_factory.ts",
      "src/board/publish/nostr/fedos_relay_ok_correlated_nostr_board_publisher.ts",
    ]) {
      const text = readFileSync(file, "utf8") as string;
      expect(text, `${file} should name Relay Pool as absent/prohibited`).toMatch(/Relay Pool/);
    }
  });

  it("17. no Sender Key, MLS, NIP-17, or gift-wrap code exists anywhere in packages/fedos-core-rust/src or src/conversation -- grounds 01/02/16/17's inventory findings", () => {
    for (const file of [...allSrcFiles("packages/fedos-core-rust/src"), ...allSrcFiles("src/conversation")]) {
      const text = readFileSync(file, "utf8") as string;
      expect(text, `${file} should not reference a group-crypto scheme or NIP-17/gift-wrap`).not.toMatch(
        /sender[_ ]?key|\bMLS\b|nip-?17|gift.?wrap/i,
      );
    }
  });

  it("18. package.json still carries exactly two production dependencies -- no new dependency introduced by this review", () => {
    const parsed = JSON.parse(packageJsonSource as string) as { dependencies: Record<string, string> };
    assertFedosRootDependencyInvariant(parsed.dependencies);
  });
});
