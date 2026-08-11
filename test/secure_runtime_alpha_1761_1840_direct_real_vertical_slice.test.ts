/**
 * Secure Runtime Alpha 1761–1840 ("NIP-17 Rumor Seal Gift Wrap Standard
 * Delivery Arc") Phase I (Alpha 1803/1805/1806) — the REAL, no-fake-crypto
 * Direct vertical slice, the Arc's own acceptance bar: two independent
 * real identities (Alice, Bob), each with their own real, freshly
 * generated Master Seed, exchange one genuinely NIP-17/NIP-44/NIP-59
 * encrypted Direct message through the REAL `NostrNip17V1WireAdapter` —
 * `build()` on Alice's side (real Rumor -> real Seal signed by Alice's
 * real Nostr identity -> real ephemeral-key Gift Wrap, all through the
 * real Rust/WASM NIP-44 wire bridge), `parse()` on Bob's side (real
 * decrypt through the SAME bridge, real inner-Rumor validation).
 *
 * Runs entirely IN-PROCESS under an explicit, locally save/restored
 * `NODE_ENV=development` override, mirroring
 * `test/secure_runtime_alpha_1261_1320_real_crypto_vertical_slice.test.ts`'s
 * own established discipline exactly (the SAME, already-reviewed
 * Development Runtime environment every real WASM-backed test in this
 * repository already requires). This is the "closest honest in-process
 * model of two independent participants" this Arc's own time budget
 * allows — the SAME documented precedent that prior Arc's own vertical
 * slice test already established for an analogous scope decision.
 *
 * Requires `packages/fedos-core-rust/pkg/` to already be built
 * (`npm run build:wasm`) — this file does not build it itself.
 */
import { describe, it, expect } from "vitest";
import { NostrNip17V1WireAdapter } from "../src/os/messenger/adapters/nostr/conversation_delivery/nip17/fedos_nostr_nip17_v1_wire_adapter.js";
import { FedosWasmEphemeralGiftWrapSigningAuthority } from "../src/os/messenger/adapters/nostr/conversation_delivery/nip17/fedos_wasm_ephemeral_gift_wrap_signing_authority.js";
import { FedosWasmLoaderSkeleton } from "../src/runtime/fedos_wasm_loader.js";
import { FedosWasmMasterSeedAuthority } from "../src/os/core/vault/wasm/fedos_wasm_master_seed_authority.js";
import { FedosWasmNostrSigningAuthority } from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_wasm_nostr_signing_authority.js";
import type { FedosConversationMessageEnvelope } from "../src/os/messenger/conversations/envelope/fedos_conversation_message_envelope.js";
import type { FedosEventDescriptor } from "../src/os/messenger/desktop/fedos_event_descriptor.js";

declare const process: { env: { NODE_ENV?: string; [key: string]: string | undefined } };

async function withDevelopmentNodeEnv<T>(fn: () => Promise<T>): Promise<T> {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try {
    return await fn();
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
}

function fakeEnvelope(id: string, createdAt: number): FedosConversationMessageEnvelope {
  return Object.freeze({
    id: id as never,
    conversationId: "conversation-1" as never,
    senderMembershipId: "membership-1" as never,
    payloadId: "payload-1" as never,
    encryptionSuite: "ChaCha20Poly1305",
    keyEpoch: 0,
    createdAt,
    replyToEnvelopeId: null,
  });
}

/** Converts a real signed `FedosNostrWireEvent` into the `FedosEventDescriptor` shape a Relay round trip would deliver it as -- the same field mapping `NostrNip17V1WireAdapter.parse()`'s own caller (a real inbound subscription) would perform. */
function eventToDescriptor(event: {
  readonly id: string;
  readonly pubkey: string;
  readonly created_at: number;
  readonly kind: number;
  readonly tags: readonly (readonly string[])[];
  readonly content: string;
  readonly sig: string;
}): FedosEventDescriptor {
  return Object.freeze({
    id: event.id,
    provider: "nostr",
    author: event.pubkey,
    createdAt: event.created_at,
    kind: event.kind,
    tags: event.tags,
    content: event.content,
    signature: event.sig,
  });
}

/**
 * `FedosWasmMasterSeedAuthority`/`FedosWasmNostrSigningAuthority`/
 * `FedosWasmEphemeralGiftWrapSigningAuthority` all default-construct
 * their OWN fresh, un-primed `FedosWasmLoaderSkeleton()` unless one is
 * injected — and an un-primed loader's own gating fields
 * (`generatedArtifactCheckResult`/`devOnlyGateEvaluation`/
 * `importReadiness`/`importExecution`/`jsGlueModule`/`wasmInitialization`)
 * are all `null` until `planLoad()`/`attemptDevOnlyJsGlueImport()`/
 * `attemptDevOnlyWasmInitialization()` run on it once. Mirrors
 * `assembleFedosConversationProductionCryptoGraph()`'s own EXACT priming
 * sequence (`src/conversation/encryption/production/fedos_conversation_production_crypto_authority_factory.ts`)
 * rather than modifying any authority class itself. ONE shared,
 * already-primed loader is reused across every identity in this file
 * (a real process would have exactly one too) — this is the ONE thing
 * that IS shared between "independent" identities in this in-process
 * model; no secret material of any kind lives on the loader itself.
 */
async function primedLoader(): Promise<FedosWasmLoaderSkeleton> {
  const loader = new FedosWasmLoaderSkeleton();
  loader.planLoad();
  await loader.attemptDevOnlyJsGlueImport();
  await loader.attemptDevOnlyWasmInitialization();
  return loader;
}

interface RealIdentity {
  readonly masterSeed: FedosWasmMasterSeedAuthority;
  readonly signingAuthority: FedosWasmNostrSigningAuthority;
  readonly adapter: NostrNip17V1WireAdapter;
  readonly publicKeyHex: string;
}

async function buildRealIdentity(loader: FedosWasmLoaderSkeleton): Promise<RealIdentity> {
  const masterSeed = new FedosWasmMasterSeedAuthority(loader);
  const generated = await masterSeed.generate();
  expect(generated).toBe(true);
  const signingAuthority = new FedosWasmNostrSigningAuthority(masterSeed, loader);
  const identity = await signingAuthority.publicIdentityForAccount(0);
  expect(identity).not.toBeNull();
  const ephemeralSigningAuthority = new FedosWasmEphemeralGiftWrapSigningAuthority(loader);
  const adapter = new NostrNip17V1WireAdapter({
    localAccountIndex: 0,
    signingAuthority,
    nip44Wire: masterSeed,
    ephemeralSigningAuthority,
  });
  return { masterSeed, signingAuthority, adapter, publicKeyHex: identity!.publicKeyHex };
}

describe("Secure Runtime Alpha 1761-1840 -- Phase I: real Direct vertical slice (no fake crypto)", () => {
  it("1. Alice builds a real Gift Wrap for Bob; Bob's adapter unwraps it to the exact original plaintext", async () => {
    await withDevelopmentNodeEnv(async () => {
      const loader = await primedLoader();
      const alice = await buildRealIdentity(loader);
      const bob = await buildRealIdentity(loader);

      const plaintext = "hello bob, this is a real end-to-end NIP-17 message";
      const built = await alice.adapter.build({
        envelope: fakeEnvelope("envelope-1", 1_715_000_000),
        ciphertext: new Uint8Array(),
        counterpartyPublicKeyHex: bob.publicKeyHex,
        localAccountIndex: 0,
        plaintext: new TextEncoder().encode(plaintext),
      });
      expect(built.outcome).toBe("built-signed");
      if (built.outcome !== "built-signed") return;

      // The Gift Wrap's own outer identity must be a FRESH ephemeral
      // key -- never Alice's or Bob's real identity (NIP-59's own "no
      // Metadata Leak" property).
      expect(built.event.pubkey).not.toBe(alice.publicKeyHex);
      expect(built.event.pubkey).not.toBe(bob.publicKeyHex);
      expect(built.event.kind).toBe(1059);
      expect(built.event.tags).toEqual([["p", bob.publicKeyHex]]);

      const descriptor = eventToDescriptor(built.event);
      const parsed = await bob.adapter.parse(descriptor);
      expect(parsed.outcome).toBe("parsed-rumor");
      if (parsed.outcome !== "parsed-rumor") return;

      expect(parsed.rumor.content).toBe(plaintext);
      expect(parsed.rumor.senderPublicKeyHex).toBe(alice.publicKeyHex);
      expect(parsed.rumor.recipientPublicKeyHex).toBe(bob.publicKeyHex);
      expect(parsed.rumor.kind).toBe(14);
    });
  });

  it("2. Bob's own copy of the message never round-trips back through Alice's adapter as if Alice were the recipient (wrong-recipient denial, no oracle detail)", async () => {
    await withDevelopmentNodeEnv(async () => {
      const loader = await primedLoader();
      const alice = await buildRealIdentity(loader);
      const bob = await buildRealIdentity(loader);
      const mallory = await buildRealIdentity(loader);

      const built = await alice.adapter.build({
        envelope: fakeEnvelope("envelope-2", 1_715_000_000),
        ciphertext: new Uint8Array(),
        counterpartyPublicKeyHex: bob.publicKeyHex,
        localAccountIndex: 0,
        plaintext: new TextEncoder().encode("only for bob"),
      });
      expect(built.outcome).toBe("built-signed");
      if (built.outcome !== "built-signed") return;

      const descriptor = eventToDescriptor(built.event);
      const malloryResult = await mallory.adapter.parse(descriptor);
      expect(malloryResult).toEqual({ outcome: "not-mine" });
    });
  });

  it("3. a tampered Gift Wrap (flipped content byte) fails closed, never a partial plaintext", async () => {
    await withDevelopmentNodeEnv(async () => {
      const loader = await primedLoader();
      const alice = await buildRealIdentity(loader);
      const bob = await buildRealIdentity(loader);

      const built = await alice.adapter.build({
        envelope: fakeEnvelope("envelope-3", 1_715_000_000),
        ciphertext: new Uint8Array(),
        counterpartyPublicKeyHex: bob.publicKeyHex,
        localAccountIndex: 0,
        plaintext: new TextEncoder().encode("tamper me not"),
      });
      expect(built.outcome).toBe("built-signed");
      if (built.outcome !== "built-signed") return;

      const tamperedContent =
        built.event.content.slice(0, -1) + (built.event.content.endsWith("A") ? "B" : "A");
      const descriptor = eventToDescriptor({ ...built.event, content: tamperedContent });
      const result = await bob.adapter.parse(descriptor);
      expect(result).toEqual({ outcome: "not-mine" });
    });
  });

  it("4. restart: a freshly-constructed adapter over a restored (sealed/unsealed) Master Seed still decrypts correctly -- no ephemeral state survives a restart because none was ever needed", async () => {
    await withDevelopmentNodeEnv(async () => {
      const loader = await primedLoader();
      const alice = await buildRealIdentity(loader);
      const bobOriginal = await buildRealIdentity(loader);

      const passphrase = new TextEncoder().encode("test-only passphrase, never reused in production");
      const sealedEnvelope = await bobOriginal.masterSeed.seal(passphrase);
      expect(sealedEnvelope).not.toBeNull();

      const built = await alice.adapter.build({
        envelope: fakeEnvelope("envelope-4", 1_715_000_000),
        ciphertext: new Uint8Array(),
        counterpartyPublicKeyHex: bobOriginal.publicKeyHex,
        localAccountIndex: 0,
        plaintext: new TextEncoder().encode("still here after restart"),
      });
      expect(built.outcome).toBe("built-signed");
      if (built.outcome !== "built-signed") return;

      // Simulate a restart: a BRAND NEW Master Seed Authority instance,
      // restored from the sealed envelope -- never the original
      // in-memory `bobOriginal.masterSeed` object.
      const restoredMasterSeed = new FedosWasmMasterSeedAuthority(loader);
      const restored = await restoredMasterSeed.restoreSealed(sealedEnvelope!, passphrase);
      expect(restored).toBe(true);
      const restoredSigningAuthority = new FedosWasmNostrSigningAuthority(restoredMasterSeed, loader);
      const restoredAdapter = new NostrNip17V1WireAdapter({
        localAccountIndex: 0,
        signingAuthority: restoredSigningAuthority,
        nip44Wire: restoredMasterSeed,
      });

      const descriptor = eventToDescriptor(built.event);
      const parsed = await restoredAdapter.parse(descriptor);
      expect(parsed.outcome).toBe("parsed-rumor");
      if (parsed.outcome !== "parsed-rumor") return;
      expect(parsed.rumor.content).toBe("still here after restart");
    });
  });

  it("5. the SAME Gift Wrap parsed twice (simulating duplicate Relay delivery) yields the identical Rumor both times -- this adapter's own parse() is a pure function of its input, real dedup is the Transport's own separate concern (Alpha 1798)", async () => {
    await withDevelopmentNodeEnv(async () => {
      const loader = await primedLoader();
      const alice = await buildRealIdentity(loader);
      const bob = await buildRealIdentity(loader);

      const built = await alice.adapter.build({
        envelope: fakeEnvelope("envelope-5", 1_715_000_000),
        ciphertext: new Uint8Array(),
        counterpartyPublicKeyHex: bob.publicKeyHex,
        localAccountIndex: 0,
        plaintext: new TextEncoder().encode("delivered twice, imported once"),
      });
      expect(built.outcome).toBe("built-signed");
      if (built.outcome !== "built-signed") return;

      const descriptor = eventToDescriptor(built.event);
      const firstParse = await bob.adapter.parse(descriptor);
      const secondParse = await bob.adapter.parse(descriptor);
      expect(firstParse).toEqual(secondParse);
      expect(firstParse.outcome).toBe("parsed-rumor");
      if (firstParse.outcome !== "parsed-rumor") return;
      expect(firstParse.rumor.envelopeId).toBe(secondParse.outcome === "parsed-rumor" ? secondParse.rumor.envelopeId : undefined);
    });
  });
});
