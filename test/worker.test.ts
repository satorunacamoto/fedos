import { describe, it, expect } from "vitest";
import worker, { handleRequest } from "../src/worker.js";

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
    // Inject a factory that fails, so no real network is touched.
    const failingFactory = () => {
      throw new Error("connection refused");
    };
    const res = await handleRequest(
      new Request("http://localhost/?relay=wss://relay.damus.io"),
      failingFactory,
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
