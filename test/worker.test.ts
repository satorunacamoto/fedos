import { describe, it, expect } from "vitest";
import worker, { handleRequest, selectCache, selectDirectory } from "../src/worker.js";
// Worker source as a string for a static "no provider/fetch wiring" check.
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
import { InMemoryEventCache } from "../src/cache/event_cache.js";
import { KvEventCache, type KvLikeNamespace } from "../src/cache/kv_event_cache.js";
import { InMemorySpaceDirectory } from "../src/community/directory.js";
import { D1SpaceDirectory } from "../src/community/d1_directory.js";
import type {
  D1LikeDatabase,
  D1LikePreparedStatement,
} from "../src/indexer/d1_index.js";
import { NoopSignatureVerifier } from "../src/nostr/signature.js";
import { SAMPLE_VAULT_MEMBER } from "../src/community/sample_spaces.js";
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

describe("worker space directory routes", () => {
  it("1. sample mode shows the space directory", async () => {
    const body = await (await handleRequest(new Request("http://localhost/"))).text();
    expect(body).toContain('class="space-directory"');
    expect(body).toContain("General");
    expect(body).toContain("Lounge");
  });

  it("2. ?space=general shows only that space's threads", async () => {
    const body = await (
      await handleRequest(new Request("http://localhost/?space=general"))
    ).text();
    expect(body).toContain('class="space-landing"');
    expect(body).toContain("General community thread.");
    expect(body).not.toContain("Lounge chatter.");
    expect(body).not.toContain("Secret vault note.");
  });

  it("3. ?space=<unknown> renders not-found with the escaped id", async () => {
    const res = await handleRequest(
      new Request("http://localhost/?space=" + encodeURIComponent("<nope>")),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Space not found");
    expect(body).not.toContain("<nope>");
    expect(body).toContain("&lt;nope&gt;");
  });

  it("4. private space denies a guest", async () => {
    const body = await (
      await handleRequest(new Request("http://localhost/?space=vault"))
    ).text();
    expect(body).toContain("Access denied");
    expect(body).not.toContain("Secret vault note.");
  });

  it("5. private space allows a member via ?actor", async () => {
    const body = await (
      await handleRequest(
        new Request(`http://localhost/?space=vault&actor=${SAMPLE_VAULT_MEMBER}`),
      )
    ).text();
    expect(body).toContain('class="space-landing"');
    expect(body).toContain("Secret vault note.");
  });

  it("6. escapes a malicious ?actor value", async () => {
    const body = await (
      await handleRequest(
        new Request("http://localhost/?actor=" + encodeURIComponent("<script>")),
      )
    ).text();
    expect(body).not.toContain("viewing as <code><script>");
    expect(body).toContain("&lt;script&gt;");
  });
});

describe("worker publish prototype (mock-only)", () => {
  const OWNER = "a".repeat(64); // owner of the sample spaces (can post anywhere)

  it("1. ?space=general&compose=1 shows the publish prototype panel", async () => {
    const body = await (
      await handleRequest(new Request("http://localhost/?space=general&compose=1"))
    ).text();
    expect(body).toContain('class="publish-prototype"');
    expect(body).toContain("Compose — preview only");
  });

  it("2. an allowed actor with content shows the unsigned event preview", async () => {
    const body = await (
      await handleRequest(
        new Request(
          `http://localhost/?space=general&compose=1&actor=${OWNER}&content=${encodeURIComponent("hello world")}`,
        ),
      )
    ).text();
    expect(body).toContain("Unsigned event preview");
    expect(body).toContain("hello world");
    // No id/sig were produced — this app does not sign.
    expect(body).toContain("<code>id</code>");
    expect(body).toContain("<code>sig</code>");
  });

  it("3. a denied actor shows the denied reason and no preview", async () => {
    // announce is an admins-only channel; the owner can post but a stranger cannot.
    const stranger = "c".repeat(64);
    const body = await (
      await handleRequest(
        new Request(
          `http://localhost/?space=announce&compose=1&actor=${stranger}&content=hi`,
        ),
      )
    ).text();
    expect(body).toContain("publish-denied");
    expect(body).not.toContain("Unsigned event preview");
  });

  it("4. escapes a <script> content value in the preview", async () => {
    const body = await (
      await handleRequest(
        new Request(
          `http://localhost/?space=general&compose=1&actor=${OWNER}&content=${encodeURIComponent("<script>alert(1)</script>")}`,
        ),
      )
    ).text();
    expect(body).not.toContain("<script>alert(1)</script>");
    expect(body).toContain("&lt;script&gt;");
  });

  it("5. without ?compose the prototype panel is not shown", async () => {
    const body = await (
      await handleRequest(new Request(`http://localhost/?space=general&actor=${OWNER}`))
    ).text();
    expect(body).not.toContain('class="publish-prototype"');
  });

  it("6. there is no publish endpoint / no POST behavior", async () => {
    // A POST is handled exactly like a GET (read-only render); nothing is sent.
    const res = await handleRequest(
      new Request(`http://localhost/?space=general&compose=1&actor=${OWNER}&content=hi`, {
        method: "POST",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    // Still just the preview; the button is disabled and mock-only.
    expect(body).toContain("mock only");
    expect(body).toContain("disabled");
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

describe("worker space directory selection", () => {
  class StubD1 implements D1LikeDatabase {
    prepare(): D1LikePreparedStatement {
      const stmt: D1LikePreparedStatement = {
        bind: () => stmt,
        run: () => Promise.resolve({}),
        all: () => Promise.resolve({ results: [] }),
        first: () => Promise.resolve(null),
      };
      return stmt;
    }
    batch(): Promise<unknown[]> {
      return Promise.resolve([]);
    }
  }

  it("12. uses a D1SpaceDirectory when the D1 binding is present", () => {
    expect(selectDirectory({ NOSTR_SPACE_DB: new StubD1() })).toBeInstanceOf(D1SpaceDirectory);
  });

  it("13. falls back to the in-memory sample directory without a binding", () => {
    expect(selectDirectory()).toBeInstanceOf(InMemorySpaceDirectory);
    expect(selectDirectory({})).toBeInstanceOf(InMemorySpaceDirectory);
  });
});

describe("worker promotion placeholders (read-only)", () => {
  it("1. ?space=general shows empty header/footer promotion placeholders", async () => {
    const body = await (
      await handleRequest(new Request("http://localhost/?space=general"))
    ).text();
    expect(body).toContain('class="promotion-placeholder promotion-space"');
    expect(body).toContain('data-placement="space_header"');
    expect(body).toContain('data-placement="space_footer"');
    // No ad candidate / destination is ever rendered.
    expect(body).not.toContain("destination");
  });

  it("2. the no-space board shows the directory but no promotion placeholder", async () => {
    const body = await (await handleRequest(new Request("http://localhost/"))).text();
    expect(body).toContain('class="space-directory"');
    expect(body).not.toContain("promotion-placeholder");
  });

  it("3. introduces no provider call or new fetch wiring in the Worker", () => {
    const src: string = workerSource;
    // The placeholders are rendered purely; no promotion provider is constructed.
    expect(src).not.toContain("EdgeRecPromotionProvider");
    expect(src).not.toContain("MockPromotionProvider");
    expect(src).not.toContain("getPromotions");
    expect(src).not.toContain("getRecommendations");
    expect(src).not.toContain("edge_rec_adapter");
  });
});
