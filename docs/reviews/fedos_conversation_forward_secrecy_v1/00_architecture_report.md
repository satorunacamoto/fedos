# FedOS Conversation Forward Secrecy — Architecture Report

**Base:** `master` @ `c59c2614`, traced directly from source. The prior
Independent Review was treated as a claim to test, not a finding to repeat.
**Branch:** `arc/fedos-conversation-forward-secrecy-default`.
**Verdict on the reviewed claim:** **CONFIRMED — and the real situation is
worse than the claim states.**

---

## 1. The claim, and what tracing actually found

> "The Double Ratchet Runtime exists, but is not used for ordinary message
> sending."

Confirmed. But the claim understates it in two ways that matter:

1. It is not merely *disabled by default* — it is **unreachable in
   production**, because the trust bootstrap it depends on does not exist for
   a counterparty.
2. The absence was, until this Arc, **invisible**: a non-forward-secret send
   and a forward-secret send produced indistinguishable results.

---

## 2. The verified call path

Every hop below was read on `c59c2614`.

```
FedosDesktopApplicationShell.sendMessage()                     shell:475
  └─> conversationContentAccessor().sendMessage()              content_accessor:301
        └─> conversationRuntime.sendDirectMessage()            conversation_runtime:1158
              └─> FedosConversationDirectMessagingCoordinator
                    .sendDirectMessage()                       coordinator:173
```

Inside the coordinator, two things happen — and it is essential to keep them
apart:

**(a) Local storage (at rest).** `encryptionCoordinator.encrypt()` with
`FIXED_DIRECT_MESSAGE_SUITE = "ChaCha20Poly1305"` and
`FIXED_DIRECT_MESSAGE_KEY_EPOCH`. This is the persisted Envelope. **The
Ratchet has nothing to do with this path at all.**

**(b) Wire delivery.** A two-way branch:

```ts
if (result.outcome === "sent-locally" && this.#deps.ratchetDelivery !== undefined) {
  ... sendRatchetMailboxNip17(...)        // forward-secret route
}
if (result.outcome === "sent-locally" && this.#deps.delivery !== undefined) {
  ... sendMailboxNip17(wireBytes)          // legacy static route
}
```

So the entire question reduces to: **is `ratchetDelivery` ever defined in a
shipped build?**

---

## 3. Why `ratchetDelivery` is always `undefined` in production

Four gates in series, all verified:

| # | Gate | Location | Production reality |
|---|---|---|---|
| 1 | `ratchetDelivery` requires `#directRatchetRuntime !== null` **and** `deps.directRatchet.messageDelivery !== undefined` | `fedos_conversation_runtime.ts:876` | second condition fails |
| 2 | `messageDelivery` is built only when `config.directRatchetMessageDeliveryRemoteDeviceRef !== undefined` | `fedos_desktop_runtime.ts:1054` | undefined |
| 3 | That config value comes only from `process.env.FEDOS_BETA_DIRECT_RATCHET_MESSAGE_DELIVERY_REMOTE_DEVICE_REF` | `fedos_electron_beta_main.cts:722` | unset on every ordinary launch |
| 4 | The field's own doc calls it construction-time-fixed to **exactly one** `remoteDeviceRef` | `fedos_desktop_runtime.ts:590-601` | one Device for the whole Runtime |

The source is candid about this. `fedos_electron_beta_main.cts:718-721` says
the variable is *"TEST-INJECTION ONLY … unset on every ordinary launch, so
`sendMessage()` keeps using the legacy static route for every real user by
default."* That comment is accurate. Nothing hidden — but nothing surfaced to
the user either.

**Gate 4 is the architectural blocker even for a determined operator.** One
global `remoteDeviceRef` cannot serve two conversations with two different
peers. Forward secrecy *per conversation* was never expressible in this
design.

---

## 4. The deeper blocker: the trust bootstrap does not exist

Even if gates 1–4 were opened, the Ratchet still could not run for a real
peer.

`resolveFedosDirectRatchetDevicePair()`
(`fedos_direct_ratchet_device_pair_resolver.ts:169`) requires the remote
Device to be present **and trusted** in the *local* Device Registry:

```ts
const remoteBinding = deviceRegistry.getBinding(request.remoteDeviceRef);
if (remoteBinding === null) return { outcome: "remote-device-unknown" };
```

The only production writer of that registry is
`FedosDeviceBindingRegistrationAuthority.registerDevice()`, reached solely
through `fedos_device_pairing_facade.ts`. That facade's own header describes
a flow where an **Authorizing Device "holding the account's own Nostr signing
capability"** approves a **Joining Device** — i.e. *same-account,
multi-device pairing*. It further states, honestly:

> this codebase has NO cross-machine Device Registry synchronization … "Trust"
> recorded through this file is therefore always a LOCAL fact

I checked the one other candidate: **Peer Capability never writes Device
bindings** (grep over `src/conversation/ratchet/peer_capability/` for
`registerDevice`/`putEvent` → no results).

**Conclusion: there is no mechanism, anywhere in this codebase, by which one
account learns and trusts another account's Device reference.** For a real
two-party conversation, `remote-device-unknown` is the guaranteed outcome.
Per-conversation forward secrecy is not switched off — it is **not yet
buildable** without a new protocol.

---

## 5. Forward secrecy failure cases — complete and explicit

Per the mission's "隠蔽禁止". Each is real and reachable.

### FS-1 — Every ordinary message (the default, 100% of real sends)
Route: legacy static NIP-17. The NIP-59 **seal** is encrypted with
`encryptNip44Wire(localAccountIndex, recipientPubkey, …)`
(`fedos_nip59_seal.ts:66`) — NIP-44 static ECDH between the two parties'
**long-term account keys**.
**Consequence: compromise of either party's long-term account key
retroactively decrypts every previously captured message of that
conversation.** The outer gift wrap uses an ephemeral key, so it hides the
sender from the relay — it provides **no** forward secrecy for content.

### FS-2 — Cross-account conversations can never use the Ratchet
No peer-Device discovery exists (§4). `remote-device-unknown`.

### FS-3 — Even the opted-in route is single-peer
One construction-time `remoteDeviceRef` for the whole Runtime (§3, gate 4).
A second conversation with a different peer silently keeps using FS-1.

### FS-4 — Data at rest has no forward secrecy
The persisted Envelope uses a fixed suite and a **fixed key epoch**
(`FIXED_DIRECT_MESSAGE_KEY_EPOCH`). The Ratchet never touches local storage.
Master-Seed compromise exposes all locally stored message content regardless
of any wire ratchet.

### FS-5 — Group conversations have no forward secrecy at all
Already disclosed in `KNOWN_LIMITATIONS.md` §4: pairwise fanout, not a group
ratchet. Unchanged by this Arc.

### FS-6 — Identity Replacement severs existing sessions
Ratchet sessions bind to `localAccountRef`. After a replacement, prior
sessions no longer match and the conversation silently returns to FS-1. The
new selector reports this as `no-session-for-conversation` rather than
pretending continuity.

### FS-7 — Revocation was not re-checked at send time
Before this Arc nothing re-validated the remote binding per send. The new
selector re-checks the live registry on **every** send, so a revocation takes
effect immediately rather than at the next restart.

### FS-8 — Ambiguity had no defined behaviour
Two sessions for the same conversation with different peer Devices had no
specified resolution. The new selector fails **closed**
(`ambiguous-remote-device`) rather than guessing which peer to encrypt to.

---

## 6. What this Arc implemented (Phase 1)

Deliberately **not** a claim to have delivered forward secrecy. What it does:

**`src/conversation/ratchet/fedos_direct_conversation_forward_secrecy_route.ts`** — a
pure, injected, per-conversation, send-time route decision returning either
`{route:"ratchet", remoteDeviceRef, remoteAccountRef, generation}` or
`{route:"legacy", reason}` from the closed
`FedosForwardSecrecyUnavailableReason` vocabulary. It replaces the
construction-time global device ref with a **per-conversation** resolution
derived from the conversation's own highest-generation Ratchet session, and
re-validates the Device binding against the live registry every time.

**Reporting.** `FedosConversationDirectMessageSendResult` gains an optional
`forwardSecrecy: { forwardSecrecy: boolean; reason: … }` on `sent-locally`,
supplied through a new optional `forwardSecrecySelector` dependency and wired
in `FedosConversationRuntime`. Carries no key material, no Device id, no
account id — safe to log and to surface in the UI.

**Compatibility.** Both the dependency and the result field are optional.
Omitted, `sendDirectMessage()` behaves byte-for-byte as before. Routing is
**unchanged**: the selector reports, it does not choose. Existing suite:
`secure_runtime_alpha_1111_1180_direct_messaging` 23/23 green.

**Why reporting before routing.** Changing the route without a peer-Device
bootstrap would move messages onto a path that cannot succeed for any real
user. Making the negative answer explicit is the honest, verifiable first
step — and it is the instrument Phase 2 needs to prove it worked.

---

## 7. Honest status

| Property | Before | After Phase 1 |
|---|---|---|
| Ordinary send is forward-secret | No | **No — unchanged** |
| That fact is visible to caller/UI/tests | No | **Yes, with a specific reason** |
| Route decision is per conversation | No (one global Device) | Yes (primitive exists) |
| Revocation re-checked per send | No | Yes |
| Ambiguity defined | No | Yes, fails closed |
| Cross-account Ratchet possible | No | **No — needs Phase 2** |
| At-rest forward secrecy | No | **No — out of scope** |

**FedOS does not provide per-conversation forward secrecy today, and this Arc
does not change that.** It removes the two design blockers that made it
inexpressible, and makes its absence impossible to ship silently. The
protocol work that actually delivers it is `01_migration_plan.md`.

---

## 8. Verification

| Gate | Result |
|---|---|
| `tsc --noEmit` | 4 errors, all pre-existing baseline, **none in changed files** |
| New suite `fedos_direct_conversation_forward_secrecy_route` | **16 / 16 passed** |
| Existing `secure_runtime_alpha_1111_1180_direct_messaging` | **23 / 23 passed** — routing genuinely unchanged |
| Release build (`npm run release:beta`) | **OK, all 9 stages** |
| Secret scan | **OK — 753 staging files, 0 findings** |
| Checksum verify | **OK — 3 files** |

Release artifacts, built from a clean detached worktree at `58ccb56d`
(unsigned):

| Artifact | SHA-256 |
|---|---|
| `FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe` | `ecdc3b0d4ef266e27146258969a6c0badb7218aeb79215eca24b8a49c871ce7a` |
| `FedOS Desktop Beta-0.1.0-beta.1-win.zip` | `825afe22b1c4f0ac6a5833d152e795203ce0cae998cdb003d3e38c4a2ae29a43` |

### Coverage limits, stated rather than implied

The 16 new tests are behavioural against the selection function. The
Runtime-level wiring (`forwardSecrecySelector` construction in
`FedosConversationRuntime`) is covered by typecheck plus the existing
direct-messaging suite, **not** by a dedicated end-to-end assertion that a
real packaged send reports `forwardSecrecy:false`. That assertion belongs
with Phase 3, where it becomes meaningful — a real two-profile relay slice
showing `false` before session establishment and `true` after.

The `REAL crypto, REAL WASM` ratchet vertical slices
(`secure_runtime_alpha_5561_5640_real_vertical_slice` and siblings) remain
**unrunnable in this environment**, failing at participant construction with
`unsupported-runtime` from the staged WASM loader's dev-only gate. That is a
pre-existing condition unrelated to this Arc, and it means the Ratchet's own
end-to-end behaviour was not re-exercised here.
