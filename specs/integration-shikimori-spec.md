# Shikimori list synchronization

## Purpose

Implement the shared [External list synchronization](user-list-sync-spec.md) rules
for the connected user's anime list. Shikimori is not a catalog search/browse/genre
provider; embedded list metadata may support import only.

## Requirements

### Independent OAuth connection

Use explicit owner consent via `/oauth/authorize`, backend exchange and refresh via
`/oauth/token`, state validation and allowlisted callbacks. Verify account identity with
`GET /api/users/whoami`; request/verify `user_rates` write scope. Google remains Filecab
login. Do not collect provider passwords or trust matching email/nickname.
Use configured HTTPS origin (initially `https://shikimori.io`), documented Bearer auth
and the registered application name as User-Agent, not a browser impersonation.

### Token lifecycle

Honor returned expiry. Serialize refresh per connection and atomically replace rotating
token pairs. Encrypt tokens at rest and exclude them from library sync, sharing, exports,
client logs and Swagger examples. Failed/revoked refresh pauses for reconnection without
deleting data.

### Anime-list reading

Read the verified account's Anime targets only; exclude manga/ranobe and other owners.

| Operation                        | Use and limitation                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/users/:id/anime_rates` | Default metadata-complete scan; bounded page/limit and all statuses without silently omitting censored/status-filtered records |
| `GET /api/v2/user_rates`         | Rate/identity reads; `page`/`limit` are ignored with `user_id`, so do not loop identical responses as pages                    |
| `GET /api/v2/user_rates/:id`     | Verify mapped records                                                                                                          |

Report access restrictions rather than claim completeness. Preserve rate ID, owner ID,
anime target ID, status, score, episodes, rewatches and timestamps. Keep rate/anime/
Filecab IDs separate. Success requires all pages/segments and reconciled duplicates.

### Verified identity mapping

Use `{ provider: "shikimori", entityType: "anime", id: target_id }` for media and a
separate `user_rate.id` for writes. Recheck owner/target type. Link by verified reference,
verified crosswalk or explicit confirmation, never equal MAL/Shikimori numbers or arbitrary
titles. Imported list metadata may form a minimal snapshot; optional catalog enrichment
must not discard unresolved imports or start general Shikimori search.

### Bidirectional field mapping

| Filecab          | Shikimori    | Policy                                                           |
| ---------------- | ------------ | ---------------------------------------------------------------- |
| `planned`        | `planned`    | Bidirectional                                                    |
| `process`        | `watching`   | Preserve remote rewatch state                                    |
| `complete`       | `completed`  | Bidirectional                                                    |
| `drop`           | `dropped`    | Bidirectional                                                    |
| `hide`           | None         | Local only; never delete, drop or put on hold                    |
| null status      | None         | Do not guess; remote creation needs an explicit supported status |
| Rating 0–10      | `score` 0–10 | Bidirectional; 0 clears                                          |
| Episode progress | `episodes`   | Absolute integers, including deliberate decreases                |
| Notes            | `text`       | Excluded both ways by default                                    |
| Viewing links    | None         | Never export                                                     |

Import `on_hold` as null plus preserved remote status; import `rewatching` as `process`
plus preserved status/rewatches. Make these projections visible; they alone never trigger
reverse status writes. Unrelated score/progress edits preserve projected remote status;
only explicit Filecab status actions replace it. Keep provider-only metadata without
new domain statuses. Hiding does not export status; inbound status updates change shadow
state without unhiding. Omit unrelated remote text, rewatches, chapters and volumes from
writes. Never trust provider `text_html` as safe HTML.

### Remote list mutations

| Operation                       | Contract                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| `POST /api/v2/user_rates`       | Verified owner, mapped anime target, `target_type=Anime`, enabled fields inside `user_rate` |
| `PATCH /api/v2/user_rates/:id`  | Changed fields only; preserve explicit score/progress zero                                  |
| `DELETE /api/v2/user_rates/:id` | Verified mapping and explicit removal resolution                                            |

PUT and increment endpoints are not required; increments are unsafe for retries.
Reconcile account/anime state before retrying uncertain creates. Read before mutation,
verify returned/post-write state, then advance the acknowledged baseline.

### Reconciliation and consistency

Use common initial preview, per-field three-way reconciliation and explicit conflict
resolution. Inbound changes use Filecab ownership/version/change-feed services.
Do not claim compare-and-swap unless verified upstream. Read-before/write-after checks
reduce races but do not protect atomically against simultaneous external edits;
uncertain outcomes remain reconcilable.

### Scheduling, limits, and failures

Use common manual/debounced/periodic jobs, generation checks, per-target serialization
and acknowledged state. Do not assume webhooks or realtime delivery. Apply one limiter
across accounts/instances, below documented ceilings of 5 requests/second and 90/minute,
allowing for bursts, OAuth and other traffic. Honor stricter responses/updated limits
and 429 Retry-After with bounded backoff. Classify 401/403 by provider semantics;
refresh only boundedly for invalid/expired tokens, not missing scope/access denial.
Missing rates create removal issues, never silent Filecab deletions.

### Connection management and disconnect

Expose connected ID/name, write capability, last scan, mappings/conflicts/removals,
pending count and actionable failures. Disconnect retains entries, invalidates jobs/
mappings and deletes credentials. A different reconnected account needs a new preview.

## Documentation and verification

Document Filecab-owned operations without asking clients for provider tokens. Test scope,
rotation, pagination differences, rate/media IDs, projections/hidden entries, explicit
zeros, private-text preservation, retry-safe creates, removals, quotas and remote races.

## API references

- [OAuth](https://shikimori.io/oauth)
- [User rates](https://shikimori.io/api/doc/2.0/user_rates)
- [Anime list](https://shikimori.io/api/doc/1.0/users/anime_rates)
- [General documentation](https://shikimori.io/api/doc)

Verify schema/permissions before writes. The documented REST operations define the
mutation contract; a later transport change, including GraphQL, must preserve shared
sync behavior and identity namespaces.
