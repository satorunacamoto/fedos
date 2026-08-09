import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, readdirSync } from "node:fs";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import envelopeSource from "../../../src/os/messenger/conversations/envelope/fedos_conversation_message_envelope.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import encryptionCoordinatorSource from "../../../src/os/messenger/conversations/encryption/fedos_conversation_encryption_coordinator.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import decryptionCoordinatorSource from "../../../src/os/messenger/conversations/encryption/fedos_conversation_decryption_coordinator.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import participantResolverSource from "../../../src/os/messenger/conversations/encryption/identity/fedos_conversation_participant_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import counterpartyResolverSource from "../../../src/os/messenger/conversations/encryption/identity/fedos_conversation_counterparty_public_key_resolver.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import lifecycleStateSource from "../../../src/os/messenger/conversations/construction/fedos_conversation_lifecycle_state.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardOutboxTypesSource from "../../../src/os/messenger/board/outbox/fedos_board_outbox_types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import outboundPublishResultSource from "../../../src/os/messenger/board/publish/fedos_outbound_publish_result.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import deliveryObservationSource from "../../../src/os/messenger/board/observation/fedos_delivery_observation.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import transitionGraphSource from "../../../src/os/messenger/board/observation/fedos_delivery_observation_transition_graph.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilityMatrixSource from "../../../src/os/_legacy_prototype/federation/nostr_mapping.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedCapabilityMatrixSource from "../../../src/os/_legacy_prototype/federation/capability_matrix.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../../../package.json?raw";

/**
 * Private Protocol Delivery and Group Encryption V1 review -- source
 * alignment. Verifies, against this worktree's own real checked-out
 * `src/`/`packages/` (== `d15a107`, see `01_source_inventory.md`), the
 * "current implementation reality" claims `01`-`20` make. Never asserts
 * that any FUTURE (unimplemented) delivery/group-crypto capability
 * exists -- only what this review's own docs claim IS true today.
 */

const DOCS_DIR = "docs/reviews/private_protocol_delivery_group_v1";
const TEST_DIR = "test/reviews/private_protocol_delivery_group_v1";

const EXPECTED_DOCS: readonly string[] = [
  "01_source_inventory.md",
  "02_delivery_responsibility.md",
  "03_internal_vs_wire_envelope.md",
  "04_nostr_readiness.md",
  "05_nostr_metadata_leakage.md",
  "06_activitypub_delivery.md",
  "07_atproto_delivery.md",
  "08_session_delivery.md",
  "09_delivery_eligibility.md",
  "10_outbox_intent.md",
  "11_delivery_results.md",
  "12_retry_duplicates.md",
  "13_delivery_storage.md",
  "14_group_crypto_inventory.md",
  "15_group_strategy.md",
  "16_pairwise_fanout.md",
  "17_epochs_membership.md",
  "18_multi_device.md",
  "19_dependency_graph.md",
  "20_normative_next_arc.md",
];

const MIN_CHARS = 800;
const MIN_LINES = 20;

function readDoc(name: string): string {
  return readFileSync(`${DOCS_DIR}/${name}`, "utf8") as string;
}

describe("Private Protocol Delivery and Group Encryption V1 review -- deliverable structure", () => {
  it("1. index.md exists and is non-trivial", () => {
    const index = readDoc("index.md");
    expect(index.length).toBeGreaterThan(MIN_CHARS);
    expect(index.split("\n").length).toBeGreaterThan(MIN_LINES);
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

  it("4. every numbered doc is non-trivial (real content, not a stub)", () => {
    for (const name of EXPECTED_DOCS) {
      const content = readDoc(name);
      expect(content.length, `${name} should be substantive`).toBeGreaterThan(MIN_CHARS);
    }
  });

  it("5. every numbered doc opens with an H1 heading matching '# Review NN — <Title>'", () => {
    for (const name of EXPECTED_DOCS) {
      const content = readDoc(name);
      const number = name.slice(0, 2);
      const firstLine = content.split("\n")[0];
      expect(firstLine, `${name}'s first line`).toMatch(new RegExp(`^# Review ${number} `));
    }
  });

  it("6. exactly 3 test files exist in this review's own test directory", () => {
    const entries = (readdirSync(TEST_DIR) as string[]).filter((name) => name.endsWith(".test.ts"));
    expect(entries.sort()).toEqual([
      "delivery_boundary_invariants.test.ts",
      "group_strategy_consistency.test.ts",
      "source_alignment.test.ts",
    ]);
  });
});

describe("Private Protocol Delivery and Group Encryption V1 review -- source alignment (base commit reality)", () => {
  it("7. FedosConversationMessageEnvelope carries no protocol-native wire fields -- grounds 03's Option A rejection", () => {
    expect(envelopeSource as string).toMatch(/conversationId:\s*FedosConversationId/);
    expect(envelopeSource as string).toMatch(/payloadId:\s*FedosConversationPayloadId/);
    expect(envelopeSource as string).not.toMatch(/pubkey|actorId|authorDid|sessionId/i);
  });

  it("8. the Encryption/Decryption Coordinators fail closed to 'conversation-not-active' by reading raw persisted lifecycleState -- grounds 01/09/19's root-blocker finding", () => {
    expect(encryptionCoordinatorSource as string).toMatch(/persistedDraft\.lifecycleState !== "active"/);
    expect(encryptionCoordinatorSource as string).toMatch(/outcome:\s*"conversation-not-active"/);
    expect(decryptionCoordinatorSource as string).toMatch(/persistedDraft\.lifecycleState !== "active"/);
    expect(decryptionCoordinatorSource as string).toMatch(/outcome:\s*"conversation-not-active"/);
  });

  it("9. only 'draft' is a constructible lifecycle state -- grounds 01/19/20's root-blocker finding", () => {
    expect(lifecycleStateSource as string).toMatch(/"draft"\s*\|\s*"active"\s*\|\s*"closed"\s*\|\s*"tombstoned"/);
    expect(lifecycleStateSource as string).toMatch(/FEDOS_CONVERSATION_CONSTRUCTIBLE_LIFECYCLE_STATE/);
  });

  it("10. the participant resolver requires exactly one other active member -- grounds 14's 'group encryption is actively rejected, not merely unbuilt' finding", async () => {
    expect(participantResolverSource as string).toMatch(/outcome:\s*"no-counterparty"/);
    expect(participantResolverSource as string).toMatch(/outcome:\s*"ambiguous-counterparty"/);
    const mod = await import("../../../src/conversation/encryption/identity/fedos_conversation_participant_resolver.js");
    const { MembershipFedosConversationParticipantResolver } = mod as {
      MembershipFedosConversationParticipantResolver: new (authority: unknown) => {
        resolveCounterparty(conversationId: string, local: unknown): { outcome: string };
      };
    };
    const zeroOthers = {
      findMembership: () => ({ state: "active", participant: { authority: "fedos", publicIdentifier: "me" } }),
      listMemberships: () => [{ state: "active", participant: { authority: "fedos", publicIdentifier: "me" } }],
    };
    const resolver = new MembershipFedosConversationParticipantResolver(zeroOthers as never);
    const result = resolver.resolveCounterparty("conv-1" as never, { authority: "fedos", publicIdentifier: "me", identityId: null } as never);
    expect(result.outcome).toBe("no-counterparty");

    const twoOthers = {
      findMembership: () => ({ state: "active", participant: { authority: "fedos", publicIdentifier: "me" } }),
      listMemberships: () => [
        { state: "active", participant: { authority: "fedos", publicIdentifier: "me" } },
        { state: "active", participant: { authority: "nostr", publicIdentifier: "a".repeat(64) } },
        { state: "active", participant: { authority: "nostr", publicIdentifier: "b".repeat(64) } },
      ],
    };
    const resolver2 = new MembershipFedosConversationParticipantResolver(twoOthers as never);
    const result2 = resolver2.resolveCounterparty("conv-1" as never, { authority: "fedos", publicIdentifier: "me", identityId: null } as never);
    expect(result2.outcome).toBe("ambiguous-counterparty");
  });

  it("11. the counterparty public-key resolver accepts only 'nostr' authority participants -- grounds 04/09/14's 'Nostr-only counterparty' finding", async () => {
    expect(counterpartyResolverSource as string).toMatch(/outcome:\s*"unsupported-authority"/);
    const { resolveFedosConversationCounterpartyPublicKeyHex } = (await import(
      "../../../src/conversation/encryption/identity/fedos_conversation_counterparty_public_key_resolver.js"
    )) as {
      resolveFedosConversationCounterpartyPublicKeyHex: (p: unknown) => { outcome: string };
    };
    const activitypubResult = resolveFedosConversationCounterpartyPublicKeyHex({
      authority: "activitypub",
      publicIdentifier: "someone@example.social",
      identityId: null,
    });
    expect(activitypubResult.outcome).toBe("unsupported-authority");
    const nostrResult = resolveFedosConversationCounterpartyPublicKeyHex({
      authority: "nostr",
      publicIdentifier: "a".repeat(64),
      identityId: null,
    });
    expect(nostrResult.outcome).toBe("resolved");
  });

  it("12. FedosBoardOutboxIntent carries a post by reference only, never a body/content field -- grounds 10's outbox-intent finding", () => {
    expect(boardOutboxTypesSource as string).toMatch(/postId:\s*FedosBoardPostId/);
    expect(boardOutboxTypesSource as string).not.toMatch(/content:|body:|plaintext:|ciphertext:/);
  });

  it("13. FedosOutboundPublishResult distinguishes accepted/rejected/failed, never a fourth 'delivered' state -- grounds 11's result-vocabulary finding", () => {
    expect(outboundPublishResultSource as string).toMatch(/outcome:\s*"accepted"/);
    expect(outboundPublishResultSource as string).toMatch(/outcome:\s*"rejected"/);
    expect(outboundPublishResultSource as string).toMatch(/outcome:\s*"failed"/);
    expect(outboundPublishResultSource as string).not.toMatch(/outcome:\s*"delivered"/);
  });

  it("14. FedosDeliveryObservation's transition graph treats accepted/rejected/failed as terminal -- grounds 12's retry-semantics finding", () => {
    expect(deliveryObservationSource as string).toMatch(/"queued"\s*\|\s*"publishing"\s*\|\s*"accepted"\s*\|\s*"rejected"\s*\|\s*"failed"/);
    expect(transitionGraphSource as string).toMatch(/accepted:\s*Object\.freeze<FedosDeliveryObservationState\[\]>\(\[\]\)/);
    expect(transitionGraphSource as string).toMatch(/rejected:\s*Object\.freeze<FedosDeliveryObservationState\[\]>\(\[\]\)/);
    expect(transitionGraphSource as string).toMatch(/failed:\s*Object\.freeze<FedosDeliveryObservationState\[\]>\(\[\]\)/);
  });

  it("15. no NIP-17/NIP-59/gift-wrap code exists anywhere this review's own source-reading touched -- grounds 04's readiness finding", () => {
    for (const source of [envelopeSource, encryptionCoordinatorSource, decryptionCoordinatorSource]) {
      expect(source as string).not.toMatch(/nip-?17|nip-?59|gift.?wrap/i);
    }
  });

  it("16. src/federation/capability_matrix.ts explicitly rejects private messaging over the Nostr adapter, citing NIP-17/NIP-44 as out of scope -- grounds 04's readiness finding", () => {
    expect(fedCapabilityMatrixSource as string).toMatch(/private_message_placeholder/);
    expect(fedCapabilityMatrixSource as string).toMatch(/NIP-17\/NIP-44 out of scope/);
  });

  it("17. src/federation/nostr_mapping.ts's own guardrail names NIP-44/NIP-17 and DM as explicitly out of scope -- grounds 04's readiness finding", () => {
    expect(capabilityMatrixSource as string).toMatch(/NO NIP-44\/NIP-17,\s*NO DM/i);
  });

  it("18. zero cross-references exist between src/board/outbox|publish|observation and src/conversation -- grounds 01/10's domain-independence finding", () => {
    function allSrcFiles(dir: string): string[] {
      const entries = readdirSync(dir, { withFileTypes: true }) as Array<{ name: string; isDirectory(): boolean }>;
      let files: string[] = [];
      for (const entry of entries) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          files = files.concat(allSrcFiles(path));
        } else if (entry.name.endsWith(".ts")) {
          files.push(path);
        }
      }
      return files;
    }
    for (const dir of ["src/board/outbox", "src/board/observation", "src/board/publish"]) {
      for (const file of allSrcFiles(dir)) {
        const text = readFileSync(file, "utf8") as string;
        expect(text, `${file} should not reference the Conversation domain`).not.toMatch(/conversation/i);
      }
    }
  });

  it("19. package.json still carries exactly two production dependencies -- no new dependency introduced by this review", () => {
    const parsed = JSON.parse(packageJsonSource as string) as { dependencies: Record<string, string> };
    expect(Object.keys(parsed.dependencies).sort()).toEqual(["@noble/curves", "@noble/hashes"]);
  });
});
