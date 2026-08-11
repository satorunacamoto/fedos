import { describe, it, expect, vi } from "vitest";
import { Nip07EventSigner, isNip07Available } from "../src/os/_legacy_prototype/sign/nip07.js";
import type {
  Nip07Provider,
  SignedNostrEvent,
  UnsignedNostrEvent,
} from "../src/os/_legacy_prototype/sign/types.js";

const PUB_A = "a".repeat(64);
const PUB_B = "b".repeat(64);

function signed(overrides: Partial<SignedNostrEvent> = {}): SignedNostrEvent {
  return {
    id: "1".repeat(64),
    pubkey: PUB_A,
    created_at: 1700000000,
    kind: 1,
    tags: [],
    content: "hi",
    sig: "c".repeat(128),
    ...overrides,
  };
}

const unsigned: UnsignedNostrEvent = {
  pubkey: PUB_A,
  created_at: 1700000000,
  kind: 1,
  tags: [],
  content: "hi",
};

function provider(overrides: Partial<Nip07Provider> = {}): Nip07Provider {
  return {
    getPublicKey: async () => PUB_A,
    signEvent: async () => signed(),
    ...overrides,
  };
}

describe("isNip07Available", () => {
  it("1. detects a NIP-07 provider, rejects everything else", () => {
    expect(isNip07Available({ nostr: provider() })).toBe(true);
    expect(isNip07Available({})).toBe(false);
    expect(isNip07Available({ nostr: { getPublicKey: () => {} } })).toBe(false);
    expect(isNip07Available(null)).toBe(false);
    expect(isNip07Available("window")).toBe(false);
  });
});

describe("Nip07EventSigner", () => {
  it("2. getPublicKey delegates to the provider", async () => {
    const getPublicKey = vi.fn(async () => PUB_A);
    const signer = new Nip07EventSigner(provider({ getPublicKey }));
    expect(await signer.getPublicKey()).toBe(PUB_A);
    expect(getPublicKey).toHaveBeenCalled();
  });

  it("rejects an invalid pubkey from the provider", async () => {
    const signer = new Nip07EventSigner(provider({ getPublicKey: async () => "nope" }));
    await expect(signer.getPublicKey()).rejects.toThrow();
  });

  it("3. signEvent delegates to the provider", async () => {
    const signEvent = vi.fn(async () => signed());
    const signer = new Nip07EventSigner(provider({ signEvent }));
    await signer.signEvent(unsigned);
    expect(signEvent).toHaveBeenCalledWith(unsigned);
  });

  it("6. accepts a valid signed event matching the signer pubkey", async () => {
    const signer = new Nip07EventSigner(provider());
    const result = await signer.signEvent(unsigned);
    expect(result.id).toBe("1".repeat(64));
    expect(result.pubkey).toBe(PUB_A);
  });

  it("4. rejects when the signed pubkey differs from the signer pubkey", async () => {
    const signer = new Nip07EventSigner(
      provider({ signEvent: async () => signed({ pubkey: PUB_B }) }),
    );
    await expect(signer.signEvent(unsigned)).rejects.toThrow(/pubkey/i);
  });

  it("5. rejects a malformed signed event", async () => {
    const signer = new Nip07EventSigner(
      provider({ signEvent: async () => ({ ...signed(), sig: "short" }) as SignedNostrEvent }),
    );
    await expect(signer.signEvent(unsigned)).rejects.toThrow(/malformed/i);
  });

  it("7. propagates a provider error", async () => {
    const signer = new Nip07EventSigner(
      provider({
        signEvent: async () => {
          throw new Error("user rejected");
        },
      }),
    );
    await expect(signer.signEvent(unsigned)).rejects.toThrow("user rejected");
  });
});
