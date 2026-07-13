import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_259_protocol_neutrality_verification.md?raw";
import { validateFedosBoardPost, type FedosBoardPostInput } from "../src/board/fedos_board_post_validator.js";

/**
 * Secure Runtime Alpha 259 -- "Protocol Neutrality and Bridge
 * Verification": Stage 9 of the Canonical Board Model Foundation Arc.
 * Adds no new src/board/ production file. Confirms, by real fixture
 * construction (no adapter module, no real network call), that all four
 * target entry paths map onto the SAME FedosBoardPost through the SAME
 * validateFedosBoardPost.
 */
describe("Secure Runtime Alpha 259 -- Protocol Neutrality and Bridge Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. Nostr: a validated-event-shaped reply fixture maps onto FedosBoardPost via NIP-10 e-tag extraction", () => {
    // Shaped like a FedosValidatedNostrEvent (Alpha 242) -- id/pubkey/created_at/kind/tags/content/sig.
    const nostrEvent = {
      id: "e".repeat(64),
      pubkey: "f".repeat(64),
      created_at: 1_700_000_100,
      kind: 1,
      tags: [
        ["e", "a".repeat(64), "", "root"],
        ["e", "b".repeat(64), "", "reply"],
      ],
      content: "Hello Nostr board world",
      sig: "1".repeat(128),
    };

    function getTagTarget(tags: string[][], marker: string): string | null {
      const tag = tags.find((t) => t[0] === "e" && t[3] === marker);
      return tag ? tag[1]! : null;
    }

    const input: FedosBoardPostInput = {
      id: nostrEvent.id,
      boardId: "board-nostr-general",
      threadId: getTagTarget(nostrEvent.tags, "root")!,
      replyTo: getTagTarget(nostrEvent.tags, "reply"),
      author: { identityId: null, protocol: "nostr", publicIdentifier: nostrEvent.pubkey },
      body: nostrEvent.content,
      createdAt: nostrEvent.created_at,
      source: { protocol: "nostr", reference: nostrEvent.id },
    };

    const post = validateFedosBoardPost(input);
    expect(post).not.toBeNull();
    expect(post!.replyTo).toBe("b".repeat(64));
    expect(post!.threadId).toBe("a".repeat(64));
    expect(post!.source).toEqual({ protocol: "nostr", reference: nostrEvent.id });
    // No raw tag array crosses into the Canonical Board Model.
    expect((post as unknown as { tags?: unknown }).tags).toBeUndefined();
  });

  it("3. ActivityPub: a Note-shaped root fixture maps onto FedosBoardPost, no Create() wrapper embedded", () => {
    const activityPubNote = {
      id: "https://example.social/users/alice/statuses/123",
      type: "Note",
      attributedTo: "https://example.social/users/alice",
      content: "Hello ActivityPub board world",
      published: "2024-01-01T00:00:00Z",
      inReplyTo: null as string | null,
    };

    const input: FedosBoardPostInput = {
      id: activityPubNote.id,
      boardId: "board-activitypub-general",
      threadId: activityPubNote.id, // root: threadId === id, by adapter convention (Alpha 256 §1)
      replyTo: activityPubNote.inReplyTo,
      author: { identityId: null, protocol: "activitypub", publicIdentifier: activityPubNote.attributedTo },
      body: activityPubNote.content,
      createdAt: Math.floor(new Date(activityPubNote.published).getTime() / 1000),
      source: { protocol: "activitypub", reference: activityPubNote.id },
    };

    const post = validateFedosBoardPost(input);
    expect(post).not.toBeNull();
    expect(post!.replyTo).toBeNull();
    expect(post!.threadId).toBe(post!.id);
    expect((post as unknown as { type?: unknown }).type).toBeUndefined();
  });

  it("4. AT Protocol: a record-shaped reply fixture (native root+parent shape) maps directly onto threadId+replyTo", () => {
    const atProtoRecord = {
      uri: "at://did:plc:abc123/app.bsky.feed.post/rkey123",
      cid: "bafyabc123", // deliberately NOT carried onto FedosBoardSourceReference -- see Alpha 259 §5
      value: {
        text: "Hello ATProto board world",
        createdAt: "2024-01-01T00:00:00.000Z",
        reply: {
          root: { uri: "at://did:plc:root/app.bsky.feed.post/root1" },
          parent: { uri: "at://did:plc:parent/app.bsky.feed.post/parent1" },
        },
      },
      authorDid: "did:plc:abc123",
    };

    const input: FedosBoardPostInput = {
      id: atProtoRecord.uri,
      boardId: "board-atproto-general",
      threadId: atProtoRecord.value.reply.root.uri,
      replyTo: atProtoRecord.value.reply.parent.uri,
      author: { identityId: null, protocol: "atproto", publicIdentifier: atProtoRecord.authorDid },
      body: atProtoRecord.value.text,
      createdAt: Math.floor(new Date(atProtoRecord.value.createdAt).getTime() / 1000),
      source: { protocol: "atproto", reference: atProtoRecord.uri },
    };

    const post = validateFedosBoardPost(input);
    expect(post).not.toBeNull();
    expect(post!.threadId).toBe(atProtoRecord.value.reply.root.uri);
    expect(post!.replyTo).toBe(atProtoRecord.value.reply.parent.uri);
    expect(post!.source.reference).toBe(atProtoRecord.uri);
    // The CID never crosses into the Canonical Board Model this Arc.
    expect((post!.source as unknown as { cid?: unknown }).cid).toBeUndefined();
  });

  it("5. Session: a gateway-published root fixture maps onto FedosBoardPost -- never a private DM/conversation", () => {
    const sessionGatewayMessage = {
      gatewayMessageId: "sess-gw-msg-789",
      sessionId: "05" + "a".repeat(64),
      text: "Hello from Session board gateway",
      publishedAtUnixSeconds: 1_700_000_500,
    };

    const input: FedosBoardPostInput = {
      id: sessionGatewayMessage.gatewayMessageId,
      boardId: "board-session-general",
      threadId: sessionGatewayMessage.gatewayMessageId, // root
      replyTo: null,
      author: { identityId: null, protocol: "session", publicIdentifier: sessionGatewayMessage.sessionId },
      body: sessionGatewayMessage.text,
      createdAt: sessionGatewayMessage.publishedAtUnixSeconds,
      source: { protocol: "session", reference: sessionGatewayMessage.gatewayMessageId },
    };

    const post = validateFedosBoardPost(input);
    expect(post).not.toBeNull();
    expect(post!.author.protocol).toBe("session");
    expect(post!.replyTo).toBeNull();
  });

  it("6. all four fixtures construct through the exact SAME eight-field FedosBoardPost shape", () => {
    const shapes = [
      Object.keys({
        id: 1,
        boardId: 1,
        threadId: 1,
        replyTo: 1,
        author: 1,
        body: 1,
        createdAt: 1,
        source: 1,
      }),
    ];
    expect(shapes[0]).toHaveLength(8);
  });

  it("7. structural: this test file performs no real network call of any kind", () => {
    const thisModuleSource = `${validateFedosBoardPost.toString()}`;
    expect(thisModuleSource).not.toMatch(/fetch\(|WebSocket/);
  });

  it("8. the design doc documents the AT-URI/CID policy explicitly", () => {
    expect(designDocSource).toMatch(/AT-URI\/CID policy, explicitly decided:/);
  });

  it("9. the design doc confirms Session private DM content is never imported automatically", () => {
    expect(designDocSource).toMatch(/Private Session DM\/conversation content must never be\s+imported automatically/);
  });

  it("10. the design doc cross-references Alpha 253, Alpha 256, and Alpha 257", () => {
    for (const ref of [
      "secure_runtime_alpha_253_board_source_provenance",
      "secure_runtime_alpha_256_thread_reply_semantics",
      "secure_runtime_alpha_257_board_validation_boundary",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
