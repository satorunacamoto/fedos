/**
 * Secure Runtime Alpha 1761–1840 ("NIP-17 Rumor Seal Gift Wrap Standard
 * Delivery Arc") Phase G (Alpha 1788–1789) — `NostrNip17V1WireAdapter`
 * is now REAL: it builds and unwraps genuine NIP-17 Direct-message Gift
 * Wraps through the Rust/WASM NIP-44 wire bridge (Phase B), the real
 * sender signing authority (Phase D, Seal), and the ephemeral Gift-Wrap
 * authority (Phase E/F). `isAvailable()` is `true` — the Alpha 1617
 * Normative Source Gate blocker this class's own prior stub existed to
 * honestly report is RESOLVED (Phase B's own real vector-gate pass: real
 * cargo test, real wasm32 build, real wasm-bindgen artifact, real
 * TypeScript-adapter round trip, all independently re-verified in this
 * exact worktree — see the completion declaration for the full log).
 *
 * Implements the SAME `FedosPrivateWireAdapter` interface
 * (`../../../transport/fedos_private_wire_adapter.js`) — `route`/
 * `isAvailable`/`build`/`parse` are unchanged in count and name; `build`/
 * `parse` are now `async` (a reviewed, documented interface change, see
 * that file's own header) and use the two NEW additive outcome variants
 * (`"built-signed"`/`"parsed-rumor"`) that file also added.
 *
 * SCOPE (Alpha 1763's own smallest-standard-scope decision, still in
 * force): Direct messages only (one explicit recipient, `kind:14` Chat
 * Message Rumor, `kind:1059` mailbox Gift Wrap). Group pairwise fanout
 * is NOT built here — this adapter's `build()` still only ever produces
 * ONE Gift Wrap per call, for the ONE `counterpartyPublicKeyHex` its
 * input names; a caller wanting Group pairwise fanout must call `build()`
 * once per active recipient itself (the SAME "N calls, no shared key"
 * shape `FedosPrivateV1WireAdapter`'s own proprietary Group fanout
 * already uses) — this Arc does not add that orchestration.
 */
import type { FedosEventDescriptor } from "../../../../desktop/fedos_event_descriptor.js";
import type { FedosNostrWireEvent } from "../../../../desktop/fedos_nostr_wire_event.js";
import type { FedosNostrSigningAuthority } from "../../protocol/sign/fedos_nostr_signing_authority.js";
import { createFedosWasmNostrSigningAuthority } from "../../protocol/sign/fedos_wasm_nostr_signing_authority.js";
import type { FedosMasterSeedAuthority } from "../../../../../core/vault/wasm/fedos_master_seed_authority.js";
import { FedosWasmMasterSeedAuthority } from "../../../../../core/vault/wasm/fedos_wasm_master_seed_authority.js";
import {
  createFedosWasmEphemeralGiftWrapSigningAuthority,
  type FedosEphemeralGiftWrapSigningAuthority,
} from "./fedos_wasm_ephemeral_gift_wrap_signing_authority.js";
import {
  buildFedosNip17GiftWrap,
  openFedosNip17GiftWrap,
  FEDOS_GIFT_WRAP_KIND,
  FEDOS_EPHEMERAL_GIFT_WRAP_KIND,
} from "./fedos_nip59_gift_wrap.js";
import type {
  FedosPrivateWireAdapter,
  FedosPrivateWireBuildInput,
  FedosPrivateWireBuildResult,
  FedosPrivateWireParsedRumor,
  FedosPrivateWireParseResult,
} from "../../transport/fedos_private_wire_adapter.js";

const NOSTR_PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;
/** NIP-17 §"Encrypting" / NIP-59 §"Other Considerations" — "randomize `created_at` in up to two days in the past". */
const TWO_DAYS_SECONDS = 2 * 24 * 60 * 60;

export interface NostrNip17V1WireAdapterOptions {
  /** The LOCAL account index this adapter instance unwraps inbound Gift Wraps for (`parse()` has no per-call account parameter — see this file's own header). Defaults to `0`, the SAME "first local account" default this repository's own tests already use pervasively. */
  readonly localAccountIndex?: number;
  readonly signingAuthority?: FedosNostrSigningAuthority;
  readonly nip44Wire?: FedosMasterSeedAuthority;
  readonly ephemeralSigningAuthority?: FedosEphemeralGiftWrapSigningAuthority;
  /** Injected clock — Alpha 1784's own "injected clock/random source for deterministic tests" requirement. Defaults to `Date.now`. */
  readonly now?: () => number;
  /** Injected randomness source for the two-days-in-the-past timestamp tweak — Alpha 1784. Defaults to `Math.random`. Returns a value in `[0, 1)`. */
  readonly random?: () => number;
}

export class NostrNip17V1WireAdapter implements FedosPrivateWireAdapter {
  readonly route = "nostr-nip17-v1" as const;

  readonly #localAccountIndex: number;
  readonly #signingAuthority: FedosNostrSigningAuthority;
  readonly #nip44Wire: FedosMasterSeedAuthority;
  readonly #ephemeralSigningAuthority: FedosEphemeralGiftWrapSigningAuthority;
  readonly #now: () => number;
  readonly #random: () => number;

  constructor(options?: NostrNip17V1WireAdapterOptions) {
    this.#localAccountIndex = options?.localAccountIndex ?? 0;
    this.#signingAuthority = options?.signingAuthority ?? createFedosWasmNostrSigningAuthority();
    this.#nip44Wire = options?.nip44Wire ?? new FedosWasmMasterSeedAuthority();
    this.#ephemeralSigningAuthority =
      options?.ephemeralSigningAuthority ?? createFedosWasmEphemeralGiftWrapSigningAuthority();
    this.#now = options?.now ?? Date.now;
    this.#random = options?.random ?? Math.random;
  }

  /**
   * `true` — the Alpha 1617 Normative Source Gate blocker this class's
   * own prior stub existed to report is resolved (Phase B's own real
   * vector-gate pass). Never probes the network or a Relay — a static,
   * local fact about this build (the WASM boundary either exports the
   * required functions or it does not; this is determined at build
   * time, not per-call).
   */
  isAvailable(): boolean {
    return true;
  }

  /** Unix seconds, randomized up to two days in the past — NIP-17 §"Encrypting"/NIP-59 §"Other Considerations". Each call draws its own independent tweak (Alpha 1784's own "SHOULD use independent random timestamps for each layer"). */
  #randomizeCreatedAtUpToTwoDaysInThePast(): number {
    const nowSeconds = Math.floor(this.#now() / 1000);
    const tweak = Math.floor(this.#random() * TWO_DAYS_SECONDS);
    return Math.max(0, nowSeconds - tweak);
  }

  /**
   * Builds ONE real, standard Gift Wrap for `input.counterpartyPublicKeyHex`.
   * REQUIRES `input.plaintext` — this Arc's own absolute prohibition on
   * repurposing this crate's generic Envelope-AEAD `input.ciphertext` as
   * NIP-44 wire ciphertext means `build()` cannot proceed from
   * `ciphertext` alone (see `FedosPrivateWireBuildInput.plaintext`'s own
   * doc comment). Resolves `{outcome:"unsupported"}` — never a partial
   * event — if `plaintext` is missing/empty, if it is not valid UTF-8
   * text (NIP-17's own "`.content` MUST be plain text" requirement), if
   * the local sender's own public identity cannot be resolved, or if any
   * step of the real Rumor->Seal->Gift-Wrap pipeline fails.
   */
  async build(input: FedosPrivateWireBuildInput): Promise<FedosPrivateWireBuildResult> {
    if (input.plaintext === undefined || input.plaintext.length === 0) return { outcome: "unsupported" };
    if (
      typeof input.counterpartyPublicKeyHex !== "string" ||
      !NOSTR_PUBLIC_KEY_HEX_PATTERN.test(input.counterpartyPublicKeyHex)
    ) {
      return { outcome: "unsupported" };
    }

    let content: string;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(input.plaintext);
    } catch {
      return { outcome: "unsupported" };
    }

    const senderIdentity = await this.#signingAuthority.publicIdentityForAccount(input.localAccountIndex);
    if (senderIdentity === null) return { outcome: "unsupported" };

    const result = await buildFedosNip17GiftWrap({
      rumor: {
        localEnvelopeId: input.envelope.id,
        senderPublicKeyHex: senderIdentity.publicKeyHex,
        createdAt: input.envelope.createdAt,
        recipientPublicKeysHex: [input.counterpartyPublicKeyHex],
        content,
      },
      senderAccountIndex: input.localAccountIndex,
      recipientPublicKeyHex: input.counterpartyPublicKeyHex,
      sealCreatedAt: this.#randomizeCreatedAtUpToTwoDaysInThePast(),
      giftWrapCreatedAt: this.#randomizeCreatedAtUpToTwoDaysInThePast(),
      giftWrapKind: FEDOS_GIFT_WRAP_KIND,
      signingAuthority: this.#signingAuthority,
      nip44Wire: this.#nip44Wire,
      ephemeralSigningAuthority: this.#ephemeralSigningAuthority,
    });
    if (result === null) return { outcome: "unsupported" };

    return { outcome: "built-signed", event: result.giftWrap };
  }

  /**
   * Unwraps a candidate Gift Wrap event descriptor into a fully
   * validated, fully decrypted Rumor. `{outcome:"not-mine"}` for any
   * non-Gift-Wrap kind (structurally not this adapter's own event
   * shape) OR any unwrap failure (malformed shape, decrypt/authentication
   * failure against this adapter's own `localAccountIndex`, or a
   * malformed inner Rumor) — this Arc deliberately does NOT distinguish
   * "wrong kind" from "wrong recipient" from "tampered": all collapse to
   * the SAME `"not-mine"` outcome, matching NIP-17's own "no oracle
   * detail in the failure" requirement (Alpha 1805) at this boundary
   * too. `{outcome:"unsupported"}` is reserved for this adapter
   * reporting itself unavailable, which never happens today.
   */
  async parse(descriptor: FedosEventDescriptor): Promise<FedosPrivateWireParseResult> {
    if (descriptor.kind !== FEDOS_GIFT_WRAP_KIND && descriptor.kind !== FEDOS_EPHEMERAL_GIFT_WRAP_KIND) {
      return { outcome: "not-mine" };
    }

    const giftWrap: FedosNostrWireEvent = {
      id: descriptor.id,
      pubkey: descriptor.author,
      created_at: descriptor.createdAt,
      kind: descriptor.kind,
      tags: descriptor.tags,
      content: descriptor.content,
      sig: descriptor.signature,
    };

    const rumor = await openFedosNip17GiftWrap({
      giftWrap,
      localAccountIndex: this.#localAccountIndex,
      nip44Wire: this.#nip44Wire,
    });
    if (rumor === null) return { outcome: "not-mine" };

    const recipientTag = giftWrap.tags.find(
      (tag) => tag[0] === "p" && typeof tag[1] === "string" && NOSTR_PUBLIC_KEY_HEX_PATTERN.test(tag[1] ?? ""),
    );
    const recipientPublicKeyHex = recipientTag?.[1];
    if (recipientPublicKeyHex === undefined) return { outcome: "not-mine" };

    const parsed: FedosPrivateWireParsedRumor = {
      envelopeId: rumor.id,
      senderPublicKeyHex: rumor.pubkey,
      recipientPublicKeyHex,
      createdAt: rumor.created_at,
      kind: rumor.kind,
      tags: rumor.tags,
      content: rumor.content,
    };
    return { outcome: "parsed-rumor", rumor: parsed };
  }
}
