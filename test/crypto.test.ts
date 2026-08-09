import { describe, it, expect } from "vitest";
import {
  webCryptoSha256Hex,
  constantTimeHexEqual,
} from "../src/os/messenger/adapters/nostr/protocol/crypto.js";

describe("webCryptoSha256Hex", () => {
  it("matches the known SHA-256 vector for 'abc'", async () => {
    // NIST FIPS 180-4 test vector.
    expect(await webCryptoSha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("matches the known SHA-256 vector for the empty string", async () => {
    expect(await webCryptoSha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});

describe("constantTimeHexEqual", () => {
  it("returns true for identical strings", () => {
    expect(constantTimeHexEqual("deadbeef", "deadbeef")).toBe(true);
  });

  it("returns false for different content of equal length", () => {
    expect(constantTimeHexEqual("deadbeef", "deadbee0")).toBe(false);
  });

  it("returns false for different lengths", () => {
    expect(constantTimeHexEqual("dead", "deadbeef")).toBe(false);
  });
});
