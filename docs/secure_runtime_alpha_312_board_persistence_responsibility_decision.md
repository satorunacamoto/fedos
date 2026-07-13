# Secure Runtime Alpha 312 — Board Persistence Responsibility Decision

**Status: this Stage is a DESIGN DECISION Stage — it adds NO new
production file this Stage; the decision is implemented starting at
Alpha 313.** Stage 2 of the Alpha 311–320 Canonical Board Persistence
Boundary Arc.

## 1. Why now

Alpha 311's own inventory confirmed no Board post persistence exists and
found three tempting-but-wrong candidates to build on (Secure Runtime
ciphertext storage, `D1MetadataIndex`, `p2p/`). This Stage fixes WHICH
of five architectural options this Arc adopts before any persistence
code is written.

## 2. The five options

- **Option A — Persist `FedosBoardPost` directly through a dedicated
  Board persistence boundary.** **Adopted**, exactly this Arc's own
  required preferred candidate.
- Option B — Serialize Board posts and put them into Secure Runtime
  ciphertext storage. Rejected.
- Option C — Persist only protocol-native source objects and rebuild
  Board posts. Rejected.
- Option D — Use the P2P Ontology Engine as canonical persistence.
  Rejected.
- Option E — Persist Repository/Index/Feed snapshots as one aggregate.
  Rejected.

## 3. Evaluation against all fifteen required criteria

| Criterion | Option A (adopted) | Option B | Option C | Option D | Option E |
| --- | --- | --- | --- | --- | --- |
| **Authority** | The persisted record names the SAME authoritative fact the Canonical Board Model already established (Alpha 255) — no second source of truth. | Ciphertext storage was never designed to be authoritative for anything but encrypted secrets. | Authority shifts to protocol-native replay, which requires re-running EVERY adapter's own mapping decisions (including ones Alpha 264/276/286/295 explicitly deferred) just to answer "what is post X" — fragile authority. | The Ontology Engine is a SEPARATE repository this Arc's own boundary rules forbid treating as canonical (§ "P2P Ontology Engine Boundary"). | A Feed/Index snapshot is, BY THIS SERIES' OWN DESIGN (Alpha 308 §, Alpha 305 §6), rebuildable/derived — making a DERIVED artifact authoritative inverts the whole Repository/Index separation Alpha 301–310 built. |
| **Protocol neutrality** | `FedosBoardPost` IS the protocol-neutral model (Alpha 255) — persisting it directly preserves neutrality by construction. | Neutral in principle, but the storage TYPE (`AeadCiphertextWire`) forces an encryption step no protocol-neutral model needs. | Explicitly NOT neutral — a "protocol-native source object" is, by definition, protocol-specific; this option reintroduces the exact per-protocol coupling the whole four-Arc adapter series existed to remove. | N/A — the Engine's own semantic model is unrelated to the Canonical Board Model's own shape. | Neutral in principle (the aggregate would still be built from `FedosBoardPost` values) but couples persistence to THIS Arc's own in-memory container internals (Alpha 302–308), not to the stable model. |
| **Rebuildability** | Indexes/Feed remain rebuildable FROM persisted posts (Alpha 318) — the property this whole Arc's own "Core Persistence Rule" requires. | Same property achievable in principle, but nothing about ciphertext storage's own shape supports listing/iterating all stored items (`RuntimeStorageBackend` has no `list()` method at all). | Rebuilding a `FedosBoardPost` from a stored protocol-native object requires RE-INVOKING an adapter at read time — reintroducing exactly the "no protocol adapter imports" prohibition this Arc's own persistence layer must honor (Alpha 315). | The Engine's own internal rebuildability, if any, is unknown and out of this Arc's own inspection scope (§ boundary rules) — cannot be relied on. | Rebuilding the aggregate itself would still require decomposing it back into individual posts — an extra, unnecessary indirection with no benefit over persisting posts directly. |
| **Migration** | A single, explicit `schemaVersion` on ONE record shape (Alpha 313) is the smallest possible migration surface. | Ciphertext wire format migration is ALREADY a separate, harder problem (crypto format evolution) this Arc must not touch. | Migration would mean tracking EVERY protocol's own wire-format evolution independently — Nostr NIP changes, ActivityPub extensions, Lexicon schema changes, Session Gateway format changes — multiplying this Arc's own migration surface by four. | Unknown and unreviewable (§ boundary rules). | Migrating an aggregate snapshot requires versioning the WHOLE Repository/Index/Feed shape together, coupling unrelated components' own evolution. |
| **Corruption isolation** | One corrupt record affects at most ONE post (Alpha 317 §"list corruption policy"). | Corruption of an encrypted blob is normally undetectable without decrypting it first — worse isolation, not better. | A corrupt protocol-native object could fail adapter re-validation in ways this Arc's own adapters were never designed to report as "storage corruption" versus "protocol input rejected." | Unknown (§ boundary rules). | A single corrupt aggregate can plausibly invalidate the ENTIRE Repository/Index/Feed state at once — the worst possible corruption blast radius of the five options. |
| **Schema evolution** | One record shape (Alpha 313) evolves independently of the Canonical Board Model's own branded runtime types — a deliberate, reviewed decoupling (Alpha 313 §"stable wire shape"). | Bound to the ciphertext wire format's own versioning (`CiphertextTransportVersion`), a concern this Arc must not touch. | Bound to four independent upstream protocol schemas this repository does not control. | Unknown (§ boundary rules). | Bound to this Arc's own in-memory container implementation details (Map/Set internals) — the ONE thing Alpha 313 §"no branded-type implementation details" explicitly forbids leaking into a persisted shape. |
| **Moderation** | A future moderation record slots in as ITS OWN separate persisted shape (Alpha 313 §"separate record or deferred"), matching `FedosBoardModerationRecord`'s own established separation (Alpha 258). | No natural extension point for a second record kind. | Same problem — no natural second-record extension point. | The Engine has no concept of FedOS's own moderation model at all. | An aggregate snapshot has no natural place for a growing set of INDEPENDENT moderation records without re-versioning the whole aggregate on every addition. |
| **Source deduplication** | `source` (protocol + reference) is carried on the SAME persisted record (Alpha 313) — `fedosBoardSourceKey` (Alpha 253) still applies identically after a read. | Achievable, but only after decrypting every candidate record to inspect its `source` — an expensive, wrong-layer operation. | Source identity would need to be RE-DERIVED from the protocol-native object at read time, duplicating logic Alpha 253/273/283/296 already fixed. | Unknown (§ boundary rules). | Source index data would need to be extracted back out of the aggregate on every read — an unnecessary indirection. |
| **Testing** | A plain, serializable record (Alpha 313) is trivial to construct as a test fixture — no cryptography, no adapter invocation required. | Every test would need a real (or faked) `AeadCiphertextWire` — an unrelated crypto concern leaking into Board persistence tests. | Every test would need a real (or faked) protocol-native object per protocol — multiplying fixture complexity by four for a persistence-layer test. | Untestable within this repository's own review boundary (§ boundary rules). | Aggregate fixtures couple persistence tests to Repository/Index/Feed internals, breaking test isolation between layers. |
| **Backend portability** | `FedosBoardPersistence` (Alpha 315) is backend-neutral by construction — SQLite/D1/IndexedDB/append-only-file could all satisfy it later (Alpha 320 §5's own recommended next Arc) without touching this Arc's own record shape. | Any future real backend would inherit ciphertext storage's own Development-Runtime gating and payload-type restriction — a poor foundation to port away from later. | A future backend would need protocol-adapter access at the STORAGE layer — architecturally backwards. | The Engine is not a storage backend candidate this Arc's own instruction permits considering (§ boundary rules, Alpha 320 §5's own explicit "do not recommend the Ontology Engine as a storage backend"). | A future backend would need to serialize/deserialize the WHOLE aggregate atomically — a much harder portability target than one record shape. |
| **Storage boundary integrity** | Zero reference to `src/storage/`/`src/runtime/*storage*`/`*ciphertext*` anywhere in this Arc's own code (confirmed structurally at every later Stage). | Requires importing the Secure Runtime Storage stack directly — violates this Arc's own Absolute Prohibition ("Secure Runtime Storage reuse"). | No inherent violation, but reintroduces protocol-adapter coupling at the storage layer (see Rebuildability). | No inherent violation of Storage boundary integrity specifically, but violates the separate Ontology boundary instead. | No inherent violation, but the "no Map/Set" and "plain serializable data only" requirements (Alpha 313) are violated by construction if the aggregate embeds live container internals. |
| **Ontology separation** | Trivially maintained — this Arc's own persistence layer never references `p2p/` at all. | Same. | Same. | DIRECTLY VIOLATES this Arc's own "P2P Ontology Engine Boundary" section — explicitly rejected for exactly this reason. | Same as Option A (no inherent conflict), but rejected on other grounds above. |
| **Recovery** | A future backend can recover by replaying/loading persisted records and re-running Alpha 318's own hydration algorithm — well-defined. | Recovery requires the Development-Runtime gate to be open and the crypto stack to be reachable — an unnecessary dependency for board content recovery. | Recovery requires re-running FOUR separate adapters correctly against historically-stored protocol objects — a much larger surface to keep working correctly over time. | Unknown (§ boundary rules). | Recovery of a corrupted aggregate has no natural "partial recovery" path — the whole snapshot is one unit. |
| **Atomicity** | One record, one `putPost` call — the SAME single-fact atomicity `FedosBoardRepository.register` (Alpha 303) already established; `FedosBoardService` (Alpha 307) already proved consistency without a transaction framework, and this Arc's own `PersistedFedosBoardRepository` (Alpha 317) simply composes with that same proof. | Same single-key atomicity is achievable, but at the cost of the type/gating/classification problems already named above. | Achievable per protocol object, but re-derivation logic at read time is NOT atomic with the original write (a read could observe a different result if adapter logic ever changed). | Unknown (§ boundary rules). | An aggregate write is a SINGLE larger atomic unit covering MANY posts at once — any failure mid-write risks losing unrelated posts' own already-durable state, the opposite of fine-grained atomicity. |
| **Conflict behavior** | `FedosBoardPersistenceWriteResult` (Alpha 315) mirrors the EXACT three/four-way discriminated-outcome discipline `FedosBoardRepositoryWriteResult` (Alpha 302) already established — no boolean hides the reason, continuing this whole series' own convention. | Achievable but requires inventing NEW conflict semantics unrelated to this series' own established `"inserted"`/`"already-present"`/`"conflict"` vocabulary. | Conflict would mean "two different protocol objects mapped to the same id" — a DIFFERENT, adapter-layer concern already handled upstream (Alpha 257's own `validateFedosBoardPost`), not a persistence-layer one. | Unknown (§ boundary rules). | "Conflict" has no clear meaning for a whole-aggregate snapshot write — either the whole write succeeds or it does not; no per-post conflict resolution is expressible. |

## 4. Explicitly rejected, per this Arc's own instruction, verbatim

- **Secure Runtime Storage as an arbitrary object store** — rejected;
  confirmed unsuitable by TYPE (Alpha 311 §3.2), not by preference.
- **Ontology Engine as canonical storage** — rejected; directly
  contradicts this Arc's own "P2P Ontology Engine Boundary" section.
- **Feed/Index snapshots as authoritative state** — rejected; inverts
  the Repository/Index separation Alpha 301–310 built specifically so
  indexes/feeds stay REBUILDABLE, never authoritative.

## 5. See also

- `docs/secure_runtime_alpha_311_existing_board_persistence_inventory.md`
- `docs/secure_runtime_alpha_255_canonical_board_post_model.md`
- `docs/secure_runtime_alpha_302_board_repository_contract.md`
- `docs/secure_runtime_alpha_313_persisted_board_record_v1.md`
