import { describe, it, expect } from "vitest";
import { NoopChatProvider } from "../src/os/_legacy_prototype/chat/noop_chat.js";
import { CHAT_PROVIDER_KINDS } from "../src/os/_legacy_prototype/chat/types.js";
import type {
  ChatFetchDecision,
  ChatFetchRequest,
  ChatMessageDescriptor,
  ChatProvider,
  ChatProviderStatus,
  ChatSendDecision,
  ChatSendRequest,
} from "../src/os/_legacy_prototype/chat/types.js";
import { createRuntime, selectChatProvider } from "../src/os/_legacy_prototype/runtime/create_runtime.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import chatTypesSource from "../src/os/_legacy_prototype/chat/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopChatSource from "../src/os/_legacy_prototype/chat/noop_chat.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

const chatProviderSources = [chatTypesSource, noopChatSource].join("\n");
const runtimeSources = [runtimeSource, runtimeTypesSource].join("\n");

const cleanMessage: ChatMessageDescriptor = {
  idRef: "msg-1",
  chatRef: "chat-1",
  authorRef: "author-1",
  createdAt: 1000,
  metadata: { note: "sample" },
};

describe("NoopChatProvider", () => {
  it("1. is always unavailable", () => {
    const provider = new NoopChatProvider();
    const status = provider.status();
    expect(status.allowed).toBe(false);
    expect(status.state).toBe("unavailable");
  });

  it("2. sendPlaceholder denies and sends nothing", async () => {
    const provider = new NoopChatProvider();
    const request: ChatSendRequest = { kind: "direct_placeholder", message: cleanMessage };
    const decision = await provider.sendPlaceholder(request);
    expect(decision.allowed).toBe(false);
    expect(decision.state).toBe("unavailable");
  });

  it("3. fetchPlaceholder denies and returns no items", async () => {
    const provider = new NoopChatProvider();
    const request: ChatFetchRequest = { kind: "direct_placeholder", chatRef: "chat-1" };
    const decision = await provider.fetchPlaceholder(request);
    expect(decision.allowed).toBe(false);
    expect(decision.items).toEqual([]);
  });

  it("4. never throws", async () => {
    const provider = new NoopChatProvider();
    expect(() => provider.status()).not.toThrow();
    await expect(
      provider.sendPlaceholder({ kind: "test_placeholder", message: {} }),
    ).resolves.toBeDefined();
    await expect(provider.fetchPlaceholder({ kind: "test_placeholder" })).resolves.toBeDefined();
  });
});

describe("ChatProvider labels", () => {
  it("5. every chat-provider kind is a placeholder label", () => {
    for (const kind of CHAT_PROVIDER_KINDS) {
      expect(kind).toMatch(/_placeholder$/);
    }
  });
});

describe("Stage 111 — Chat provider runtime selection", () => {
  it("6. no overrides -> NoopChatProvider", () => {
    expect(selectChatProvider()).toBeInstanceOf(NoopChatProvider);
    expect(createRuntime().chatProvider).toBeInstanceOf(NoopChatProvider);
  });

  it("7. overrides.chatProvider wins", () => {
    const stub = new NoopChatProvider();
    expect(selectChatProvider(undefined, { chatProvider: stub })).toBe(stub);
    expect(createRuntime(undefined, { chatProvider: stub }).chatProvider).toBe(stub);
  });

  it("8. createRuntime does not call sendPlaceholder/fetchPlaceholder", async () => {
    let sendCalls = 0;
    let fetchCalls = 0;
    const spy: ChatProvider = {
      status: (): ChatProviderStatus => ({ allowed: false, state: "unavailable" }),
      sendPlaceholder: async (_r: ChatSendRequest): Promise<ChatSendDecision> => {
        sendCalls += 1;
        return { allowed: false, state: "unavailable" };
      },
      fetchPlaceholder: async (_r: ChatFetchRequest): Promise<ChatFetchDecision> => {
        fetchCalls += 1;
        return { allowed: false, state: "unavailable", items: [] };
      },
    };
    const rt = createRuntime(undefined, { chatProvider: spy });
    expect(rt.chatProvider).toBe(spy);
    expect(sendCalls).toBe(0);
    expect(fetchCalls).toBe(0);
  });

  it("9. Worker source does not select or call a ChatProvider", () => {
    expect(workerSource).not.toMatch(/\bChatProvider\b/);
    expect(workerSource).not.toMatch(/NoopChatProvider/);
    expect(workerSource).not.toMatch(/\.sendPlaceholder\s*\(|\.fetchPlaceholder\s*\(/);
  });
});

describe("chat provider boundary is decoupled and free of real transports", () => {
  it("10. types declare no content/body/bytes field", () => {
    expect(chatTypesSource).not.toMatch(/interface\s+ChatMessageDescriptor[\s\S]*?\breadonly\s+content\s*[?:]/);
    expect(chatTypesSource).not.toMatch(/interface\s+ChatMessageDescriptor[\s\S]{0,400}\breadonly\s+body\s*[?:]/);
    expect(chatTypesSource).not.toMatch(/interface\s+ChatMessageDescriptor[\s\S]{0,400}\breadonly\s+bytes\s*[?:]/);
  });

  it("11. imports no relay/WebSocket/HTTP library and issues no fetch", () => {
    const importLines = chatProviderSources
      .split("\n")
      .filter((line: string) => /^\s*import\b/.test(line));
    const denylist = ["ws", "websocket", "node-fetch", "node:http", "node:https"];
    for (const line of importLines) {
      for (const banned of denylist) {
        expect(line.toLowerCase()).not.toContain(banned);
      }
    }
    expect(chatProviderSources).not.toMatch(/\bfetch\s*\(/);
    expect(chatProviderSources).not.toMatch(/\bnew\s+WebSocket\s*\(/);
  });

  it("12. performs no NIP-04/NIP-44/NIP-17 encryption and calls no encrypt/decrypt", () => {
    expect(chatProviderSources).not.toMatch(/nip0?4\s*\(|nip44\s*\(|nip17\s*\(/i);
    expect(chatProviderSources).not.toMatch(/\bencrypt\s*\(|\bdecrypt\s*\(/);
  });

  it("13. does not import FederationProvider, StorageBackend, or CryptoProvider", () => {
    expect(chatProviderSources).not.toMatch(/from\s+['"].*federation\//);
    expect(chatProviderSources).not.toMatch(/from\s+['"].*storage\//);
    expect(chatProviderSources).not.toMatch(/from\s+['"].*crypto\//);
    expect(chatProviderSources).not.toMatch(
      /:\s*(FederationProvider|StorageBackend|CryptoProvider)\b/,
    );
  });

  it("14. Runtime source imports no relay/WebSocket/encryption library for chat selection", () => {
    const importLines = runtimeSources
      .split("\n")
      .filter((line: string) => /^\s*import\b/.test(line));
    const denylist = ["websocket", "nip44", "nip04"];
    for (const line of importLines) {
      for (const banned of denylist) {
        expect(line.toLowerCase()).not.toContain(banned);
      }
    }
  });

  it("15. does not mutate its input", async () => {
    const provider = new NoopChatProvider();
    const request: ChatSendRequest = { kind: "direct_placeholder", message: cleanMessage };
    const snapshot = JSON.stringify(request);
    await provider.sendPlaceholder(request);
    expect(JSON.stringify(request)).toBe(snapshot);
  });
});
