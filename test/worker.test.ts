import { describe, it, expect } from "vitest";
import worker, { handleRequest, selectCache } from "../src/worker.js";
import { InMemoryEventCache } from "../src/cache/event_cache.js";
import { KvEventCache, type KvLikeNamespace } from "../src/cache/kv_event_cache.js";
import { NoopSignatureVerifier } from "../src/nostr/signature.js";
import type {
  RelaySocketEvent,
  RelaySocketEventType,
  RelaySocketLike,
  WebSocketFactory,
} from "../src/nostr/ws_relay.js";
import type { NostrEvent } from "../src/nostr/types.js";

const DAMUS = "wss://relay.damus.io";

function sampleEvent(): NostrEvent {
  return {
    id: "1".repeat(64),
    pubkey: "a".repeat(64),
    created_at: 1700000000,
    kind: 1,
    tags: [],
    content: "live note from relay",
    sig: "b".repeat(128),
  };
}

/** A scripted socket that answers REQ with the given events then EOSE. */
function scriptedFactory(
  events: NostrEvent[],
  counter?: { calls: number },
): WebSocketFactory {
  return () => {
    if (counter) counter.calls++;
    const listeners: Partial<
      Record<RelaySocketEventType, ((ev: RelaySocketEvent) => void)[]>
    > = {};
    const socket: RelaySocketLike = {
      send(data: string) {
        const m = JSON.parse(data);
        if (m[0] === "REQ") {
          const subId = m[1] as string;
          for (const l of listeners.message ?? []) {
            for (const ev of events) {
              l({ data: JSON.stringify(["EVENT", subId, ev]) });
            }
            l({ data: JSON.stringify(["EOSE", subId]) });
          }
        }
      },
      close() {},
      addEventListener(type, listener) {
        (listeners[type] ??= []).push(listener);
      },
    };
    return socket;
  };
}

describe("worker fetch handler", () => {
  it("returns 200 text/html", async () => {
    const res = await handleRequest(new Request("http://localhost/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("serves a full HTML document containing the sample thread", async () => {
    const res = await handleRequest(new Request("http://localhost/"));
    const body = await res.text();
    expect(body.startsWith("<!doctype html>")).toBe(true);
    expect(body).toContain("Welcome to nostr-window");
    // Sample content with HTML chars must arrive escaped, not raw.
    expect(body).not.toContain("<script>");
    expect(body).toContain("&lt;script&gt;");
  });

  it("exposes a default export with a fetch method", async () => {
    const res = await worker.fetch(new Request("http://localhost/"));
    expect(res.status).toBe(200);
  });

  it("reflects ?sort=top in the query status panel", async () => {
    const res = await handleRequest(new Request("http://localhost/?sort=top"));
    const body = await res.text();
    expect(body).toContain("sort=<strong>top</strong>");
  });

  it("falls back to sort=new for an invalid sort param", async () => {
    const res = await handleRequest(new Request("http://localhost/?sort=bogus"));
    const body = await res.text();
    expect(body).toContain("sort=<strong>new</strong>");
  });

  it("escapes the ?q search term in the status panel", async () => {
    const res = await handleRequest(
      new Request("http://localhost/?q=" + encodeURIComponent("<script>")),
    );
    const body = await res.text();
    expect(body).not.toContain("<code><script></code>");
    expect(body).toContain("&lt;script&gt;");
  });

  it("rejects a relay that is not on the allowlist with 400", async () => {
    const res = await handleRequest(
      new Request("http://localhost/?relay=wss://evil.example"),
    );
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain("Relay not allowed");
    // The disallowed URL is shown escaped, not connected to.
    expect(body).toContain("wss://evil.example");
  });

  it("renders an error page (not a crash) when an allowlisted relay fails", async () => {
    // Inject a factory that fails plus a fresh cache, so no real network is
    // touched and no prior cache entry can mask the failure.
    const failingFactory = () => {
      throw new Error("connection refused");
    };
    const res = await handleRequest(
      new Request(`http://localhost/?relay=${DAMUS}`),
      failingFactory,
      new InMemoryEventCache(),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Relay connection failed");
  });

  it("sample mode still works when no relay is given", async () => {
    const res = await handleRequest(new Request("http://localhost/"));
    const body = await res.text();
    expect(body).toContain("Sample mode");
    expect(body).toContain("Welcome to nostr-window");
  });
});

describe("worker live relay caching", () => {
  it("misses then hits: the second request does not re-open the socket", async () => {
    const cache = new InMemoryEventCache();
    const counter = { calls: 0 };
    const factory = scriptedFactory([sampleEvent()], counter);

    // Use the Noop verifier so the fake-signature sample event stays visible;
    // this test is about caching, not signature verification.
    const first = await handleRequest(
      new Request(`http://localhost/?relay=${DAMUS}`),
      factory,
      cache,
      NoopSignatureVerifier,
    );
    const firstBody = await first.text();
    expect(firstBody).toContain("cache=<strong>miss</strong>");
    expect(firstBody).toContain("live note from relay");
    expect(counter.calls).toBe(1);

    const second = await handleRequest(
      new Request(`http://localhost/?relay=${DAMUS}`),
      factory,
      cache,
      NoopSignatureVerifier,
    );
    const secondBody = await second.text();
    expect(secondBody).toContain("cache=<strong>hit</strong>");
    expect(secondBody).toContain("live note from relay");
    expect(counter.calls).toBe(1); // factory NOT called again
  });

  it("?cache=0 bypasses the cache", async () => {
    const cache = new InMemoryEventCache();
    const counter = { calls: 0 };
    const factory = scriptedFactory([sampleEvent()], counter);

    const res = await handleRequest(
      new Request(`http://localhost/?relay=${DAMUS}&cache=0`),
      factory,
      cache,
      NoopSignatureVerifier,
    );
    const body = await res.text();
    expect(body).toContain("cache=<strong>bypass</strong>");
    expect(counter.calls).toBe(1);
  });

  it("clamps ?ttl to the maximum", async () => {
    const cache = new InMemoryEventCache();
    const res = await handleRequest(
      new Request(`http://localhost/?relay=${DAMUS}&ttl=99999`),
      scriptedFactory([sampleEvent()]),
      cache,
      NoopSignatureVerifier,
    );
    const body = await res.text();
    expect(body).toContain("ttl=300s");
  });
});

describe("worker live signature verification", () => {
  const SIGNED_EVENT = {
    id: "54e612edddef0b67e2e46b6cbe0c70368f4cc55a7a4efd774c08066bc74b7f0b",
    pubkey: "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
    created_at: 1700000000,
    kind: 1,
    tags: [] as string[][],
    content: "hello nostr — Stage 8 vector",
    sig: "9fafd52912c74d10ea33a981cc4e3d43789add77daaf31ed62b02c2760caa96d9b6393a007ad885810e75239cc87cbc859574fbfbc64d2ea795f1c097bfced59",
  };

  it("enables verification and shows a validly-signed event", async () => {
    const res = await handleRequest(
      new Request(`http://localhost/?relay=${DAMUS}`),
      scriptedFactory([SIGNED_EVENT]),
      new InMemoryEventCache(),
      // default verifier (Noble) via no 4th arg
    );
    const body = await res.text();
    expect(body).toContain("signature verification: enabled");
    expect(body).toContain("hello nostr");
  });

  it("drops an event whose signature fails verification", async () => {
    const forged = { ...SIGNED_EVENT, content: "forged content" };
    const res = await handleRequest(
      new Request(`http://localhost/?relay=${DAMUS}`),
      scriptedFactory([forged]),
      new InMemoryEventCache(),
    );
    const body = await res.text();
    expect(body).toContain("signature verification: enabled");
    expect(body).not.toContain("forged content");
    expect(body).toContain("No threads to display.");
  });
});

describe("worker cache backend selection", () => {
  class MockKv implements KvLikeNamespace {
    store = new Map<string, string>();
    async get(key: string): Promise<string | null> {
      return this.store.get(key) ?? null;
    }
    async put(): Promise<void> {}
    async delete(): Promise<void> {}
  }

  it("10. uses a KvEventCache when the KV binding is present", () => {
    const cache = selectCache({ NOSTR_EVENT_CACHE: new MockKv() });
    expect(cache).toBeInstanceOf(KvEventCache);
  });

  it("11. falls back to the in-memory cache when no binding is present", () => {
    expect(selectCache()).toBeInstanceOf(InMemoryEventCache);
    expect(selectCache({})).toBeInstanceOf(InMemoryEventCache);
  });

  it("default fetch wires env through to the cache backend", async () => {
    // No relay param -> sample mode -> 200 regardless of backend.
    const res = await worker.fetch(new Request("http://localhost/"), {
      NOSTR_EVENT_CACHE: new MockKv(),
    });
    expect(res.status).toBe(200);
  });
});
