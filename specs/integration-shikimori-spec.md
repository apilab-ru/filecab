# Shikimori User List Synchronization Specification

## Purpose

Implement [User List Synchronization](user-list-sync-spec.md) for the connected user's Shikimori anime list in both directions. Shikimori SHALL NOT be used for general catalog search, catalog browsing, or genre-dictionary refresh. Catalog metadata acquisition SHALL remain the responsibility of separate catalog providers.

## Requirements

### Requirement: Independent OAuth connection

An authenticated Filecab user SHALL explicitly connect their Shikimori account using the provider's authorization-code flow. The backend SHALL own code exchange and token refresh, keep the OAuth client secret server-side, validate state and allowlisted callbacks, and identify the connected account using `GET /api/users/whoami`.

The adapter SHALL request the `user_rates` scope for list mutations and verify that required permissions are available. Google sign-in SHALL remain the Filecab login method. The integration SHALL not collect a Shikimori password or assume that a matching email/nickname proves account ownership.

Provider requests SHALL use HTTPS, `Authorization: Bearer ...` where required, and the registered OAuth application's name as User-Agent rather than mimic a browser. Base origin SHALL be explicitly configured, initially `https://shikimori.io`.

### Requirement: Token lifecycle

The backend SHALL use `/oauth/authorize` for consent and `/oauth/token` for authorization-code and refresh-token exchanges. Token expiry SHALL follow the returned lifetime rather than a client timer fixed to one day. When refresh returns new tokens, store the replacement pair atomically under connection-level refresh serialization.

Provider tokens SHALL be encrypted at rest and never included in library synchronization, sharing, exports, client logs, or Swagger examples. Failed/revoked refresh SHALL pause synchronization and require reconnection without deleting data.

### Requirement: Anime-list reading

The adapter SHALL read list data for the verified connected account using the documented user-rate operations, selecting `target_type=Anime` when supported. Manga/ranobe and other accounts' list entries SHALL be excluded.

The default metadata-complete list scan SHALL use `GET /api/users/:id/anime_rates` with bounded `page` and `limit`, collecting all statuses without applying censorship/status filters that would silently omit user entries. If a documented access restriction prevents complete acquisition, report it instead of treating the response as a full list.

`GET /api/v2/user_rates` MAY be used for rate-only reads and identity-target checks. Its documented `page` and `limit` are ignored when `user_id` is supplied; the adapter SHALL NOT loop identical responses pretending they are successive pages. `GET /api/v2/user_rates/:id` SHALL support mapped-record verification.

Preserve remote `user_rate.id`, `user_id`, anime `target_id`, status, score, episodes, rewatches, and available timestamps. Rate ID, anime ID, and Filecab entry ID SHALL remain separate. A scan is successful only after all required pages/segments have completed and duplicate identities are reconciled.

### Requirement: Verified identity mapping

Use `{ provider: "shikimori", entityType: "anime", id: target_id }` for anime identity and a separate mapped `user_rate.id` for mutations. Validate owner and `target_type` before reading or changing a mapped record.

Filecab entries SHALL link by verified Shikimori reference, an established crosswalk from another catalog provider, or explicit user-confirmed mapping. MyAnimeList IDs SHALL not be substituted for Shikimori IDs based on numeric equality. Arbitrary manual titles SHALL remain unresolved until identified.

Minimal anime metadata embedded in list reads MAY create a usable imported snapshot. Missing metadata MAY be enriched through the configured catalog service; it SHALL not trigger unrestricted Shikimori catalog search. An unresolved catalog association SHALL not prevent retaining imported list data.

### Requirement: Bidirectional field mapping

| Filecab field | Shikimori field | Behavior |
| --- | --- | --- |
| `planned` | `planned` | Bidirectional |
| `process` | `watching` | Bidirectional, subject to preserved remote rewatch status |
| `complete` | `completed` | Bidirectional |
| `drop` | `dropped` | Bidirectional |
| `hide` | No equivalent | Filecab-only state; do not map to deletion, dropped, or on_hold |
| null status | No equivalent | Do not export as a guessed status; require an explicit supported choice when creating a remote rate |
| Rating 0–10 | `score` 0–10 | Bidirectional; 0 means unrated |
| Episode progress | `episodes` | Bidirectional absolute integer; preserve decreases chosen by user |
| Private notes | `text` | Excluded by default in both directions |
| Viewing links | No synchronized field | Never export |

Remote `on_hold` SHALL import with a null Filecab status plus namespaced preserved remote status. Remote `rewatching` SHALL import with `process` plus preserved remote status and `rewatches`. These projections SHALL be visibly distinguishable from ordinary null/watching state and SHALL not trigger a reverse status rewrite by themselves.

For a linked `on_hold` or `rewatching` item, unrelated progress/score updates SHALL preserve its remote status. Only an explicit Filecab status action SHALL replace it. Provider-only fields SHALL remain preserved without introducing new Filecab domain statuses. Hiding locally SHALL not export a status change; an inbound remote status change while hidden SHALL update its integration shadow state without unhiding the entry.

Private Filecab notes SHALL remain private. Existing remote `text`, rewatches, chapters, and volumes SHALL be preserved by omitting them from unrelated updates. Provider-rendered `text_html` SHALL never be rendered as trusted HTML.

### Requirement: Remote list mutations

The adapter SHALL create rates through `POST /api/v2/user_rates`, supplying the verified connected `user_id`, mapped anime `target_id`, `target_type=Anime`, and enabled mapped fields inside `user_rate`.

Existing rates SHALL be updated through `PATCH /api/v2/user_rates/:id`, sending only fields intended to change. `PUT` is not required. Setting score or progress to zero SHALL be preserved as an explicit value, not omitted by truthiness checks.

Confirmed deletion SHALL use `DELETE /api/v2/user_rates/:id` only after the common explicit removal-resolution policy. The integration SHALL not use increment endpoints for synchronization because retries could apply progress more than once.

Before retrying an uncertain creation, query the verified account/anime rate and reconcile rather than create blindly. Re-read relevant remote state before changing it, and verify the returned/post-write state before advancing the acknowledged baseline.

### Requirement: Reconciliation and consistency

Apply the common per-field three-way reconciliation policy. Initial sync SHALL require a preview before writes; same-field concurrent changes SHALL require a user decision. Incoming Shikimori changes SHALL commit through ordinary Filecab mutation/version/change-tracking services and become available to the extension and website.

Shikimori mutation operations SHALL not be described as supporting compare-and-swap unless the selected API explicitly provides it. Read-before-write and post-write verification reduce conflicts but cannot guarantee protection from simultaneous external edits. Uncertain results SHALL remain reconcilable instead of being marked synchronized.

### Requirement: Scheduling, limits, and failures

Use manual synchronization, debounced server-committed local changes, and the common periodic scan schedule. No webhook or realtime update delivery SHALL be assumed. The backend SHALL use durable sync jobs, account/generation checks, per-target serialization, and acknowledged-state tracking.

Apply a shared provider limiter across users and server instances. The documented ceilings are 5 requests per second and 90 per minute; configured budgets SHALL remain below both, with allowance for bursts, OAuth calls, and other application traffic. Handle 429 with bounded backoff and Retry-After when present. Respect stricter provider responses and updated limits.

401/403 responses SHALL be classified using actual provider error semantics: attempt a bounded refresh only for an expired/invalid token, and do not loop refreshes for missing scope or access denial. Missing remote rates SHALL produce a removal issue, not a silent Filecab deletion.

### Requirement: Connection management and disconnect

Expose provider connection status, connected Shikimori ID/display name, granted write capability, last successful scan, unresolved mappings, conflicts, removals, pending count, and actionable errors. Disconnection SHALL retain Filecab entries, invalidate jobs/mappings for further use, and delete stored provider credentials. Reconnection to another account SHALL require a new preview.

### Requirement: Documentation and verification

Swagger SHALL document Filecab-owned Shikimori connection/sync operations, not require provider tokens from clients. Contract tests SHALL cover `user_rates` scope, token rotation, list pagination differences, anime/rate ID separation, status projections, hidden entries, explicit zero values, preservation of private text, retry-safe creates, remote removals, quota control, and external-write race limitations.

## API references

- OAuth guide: https://shikimori.io/oauth
- User-rate API: https://shikimori.io/api/doc/2.0/user_rates
- Anime list: https://shikimori.io/api/doc/1.0/users/anime_rates
- General documentation: https://shikimori.io/api/doc

The implementation SHALL verify response schemas and permissions against the configured provider version before enabling writes. General documentation recommends GraphQL where suitable; the documented REST user-rate operations define the mutation contract here. Transport changes SHALL preserve the common synchronization behavior and identity namespaces.
