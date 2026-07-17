import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import activationCoordinatorSource from "../../../src/conversation/activation/fedos_conversation_direct_activation_coordinator.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../../../src/conversation/runtime/fedos_conversation_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import directMessagingSource from "../../../src/conversation/messaging/fedos_conversation_direct_messaging_coordinator.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import policyAxesSource from "../../../src/conversation/construction/fedos_private_conversation_policy.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import membershipTransitionSource from "../../../src/conversation/membership/fedos_conversation_membership_transition.ts?raw";

/**
 * Private Group Pairwise Fanout review -- architecture boundary invariants.
 * Verifies, against real source, the constraints `04`-`10`'s own
 * architecture depends on: the Private-Group Gate is never bypassed by
 * FedosConversationRuntime's own public surface, Direct policy stays
 * fixed regardless of caller, and Membership transitions stay exactly
 * admit/revoke/leave (no group-specific transition this review's own
 * "never touch Membership for group-evolution signalling" finding, `07`,
 * depends on). Never asserts a Fanout Coordinator exists.
 */

describe("Private Group Pairwise Fanout review -- Private-Group Gate boundary", () => {
  it("1. FedosConversationRuntime exposes activateDirectConversation/sendDirectMessage/readDirectMessage/listDirectMessages, delegating to the frozen Coordinators, never re-implementing their gates", () => {
    expect(runtimeSource as string).toMatch(/activateDirectConversation\(conversationId: string\)/);
    expect(runtimeSource as string).toMatch(/this\.#activationCoordinator\.activateDirectConversation\(conversationId\)/);
    expect(runtimeSource as string).toMatch(/this\.#directMessagingCoordinator\.sendDirectMessage\(command\)/);
    expect(runtimeSource as string).toMatch(/this\.#directMessagingCoordinator\.readDirectMessage\(command\)/);
    expect(runtimeSource as string).toMatch(/this\.#directMessagingCoordinator\.listDirectMessages\(id\)/);
  });

  it("2. the Direct Activation Coordinator writes only Activation coordination facts -- it never persists an Envelope or a Payload during activation, matching 04's 'no message ever sent during activation' finding", () => {
    expect(activationCoordinatorSource as string).toMatch(/No message is ever sent during activation/);
    expect(activationCoordinatorSource as string).not.toMatch(/envelopePersistence\.putEnvelope|payloadStorage\.putPayload/);
  });

  it("3. sendDirectMessage/readDirectMessage never accept a caller-supplied sender identity, account index, counterparty key, suite, or key epoch -- the command shape is exactly {conversationId, body, replyToEnvelopeId} for send", () => {
    expect(directMessagingSource as string).toMatch(
      /export interface FedosConversationDirectMessageSendCommand \{\s*readonly conversationId: string;\s*readonly body: string;\s*readonly replyToEnvelopeId: string \| null;\s*\}/,
    );
    expect(directMessagingSource as string).not.toMatch(/localAccountIndex|counterpartyPublicKeyHex/);
  });

  it("4. the fixed direct-message suite/epoch are resolved internally, never caller-chosen", () => {
    expect(directMessagingSource as string).toMatch(/FIXED_DIRECT_MESSAGE_SUITE.*=.*"ChaCha20Poly1305"/);
    expect(directMessagingSource as string).toMatch(/never the caller-chosen|never caller-chosen/i);
  });

  it("5. Direct-mode policy axes are fixed regardless of caller -- federationEligibility is 'local-only' for both direct and private-group, matching 06's 'no special-casing' finding", () => {
    expect(policyAxesSource as string).toMatch(/federationEligibility:\s*"local-only"/);
  });

  it("6. Membership transitions remain exactly admit/revoke/leave -- no group-specific transition exists, grounding 07's 'membership evolution signal lives only in the group roster' finding", () => {
    expect(membershipTransitionSource as string).toMatch(/"admit"\s*\|\s*"revoke"\s*\|\s*"leave"/);
    expect(membershipTransitionSource as string).not.toMatch(/"fanout"|"group-sync"|"epoch-bump"/);
  });

  it("7. the Direct Activation Coordinator's own sequence never short-circuits except on a durably-completed fact -- every other path revalidates from scratch, grounding 09's 'forward-only, no downgrade' finding used for member-removal reasoning", () => {
    expect(activationCoordinatorSource as string).toMatch(/existing\?\.phase === "completed"\)\s*return\s*\{\s*outcome:\s*"already-active"\s*\}/);
    expect(activationCoordinatorSource as string).toMatch(/REVALIDATED IN FULL on every call/);
  });
});
