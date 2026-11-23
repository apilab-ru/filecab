# Shikimori list synchronization

## Purpose

Apply the [External list synchronization](user-list-sync-spec.md) rules to the anime list
of the connected user. Shikimori is not a catalog, search or genre provider. Embedded list
metadata can support import only.

## Requirements

### OAuth connection

- Get explicit owner consent through `/oauth/authorize`.
- Exchange and refresh tokens on the backend through `/oauth/token`.
- Validate state. Allowlist callbacks.
- Verify the account with `GET /api/users/whoami`.
- Request and verify the `user_rates` write scope.
- Google stays the Filecab login. Do not collect provider passwords. Do not trust a matching email or nickname.
- Use the configured HTTPS origin, initially `https://shikimori.io`, with Bearer authentication.
- Send the registered application name as `User-Agent`. Do not impersonate a browser.

### Token lifecycle

- Obey the returned expiry.
- Serialize refresh for each connection. Replace rotating token pairs atomically.
- Encrypt tokens at rest.
- Exclude tokens from library sync, the public library, exports, client logs and Swagger examples.
- A failed or revoked refresh pauses the connection until reconnection. It deletes no data.

### Reading the anime list

Read only the anime records of the verified account. Exclude manga, ranobe and other owners.

| Operation                        | Use and limits                                                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/users/:id/anime_rates` | Default complete scan with metadata. Bounded page and limit. Read all statuses. Do not omit censored or status-filtered records. |
| `GET /api/v2/user_rates`         | Rate and identity reads. With `user_id`, `page` and `limit` are ignored. Do not loop on identical responses.                     |
| `GET /api/v2/user_rates/:id`     | Verify mapped records.                                                                                                           |

Report access restrictions. Do not claim completeness when restricted. Keep the rate ID,
owner ID, anime target ID, status, score, episodes, rewatches and timestamps. Keep rate,
anime and Filecab IDs separate. A scan succeeds only when all pages are read and duplicates are reconciled.

### Identity mapping

- Media reference: `{ provider: "shikimori", entityType: "anime", id: target_id }`.
- Writes use the separate `user_rate.id`.
- Check the owner and target type again.
- Link by a verified reference, a verified crosswalk or explicit confirmation. Never link by equal MAL and Shikimori numbers or by title.
- Imported list metadata can form a minimal snapshot.
- Optional catalog enrichment must not drop unresolved imports or start a Shikimori search.

### Field mapping

| Filecab          | Shikimori    | Rule                                                              |
| ---------------- | ------------ | ----------------------------------------------------------------- |
| `planned`        | `planned`    | Export and import                                                 |
| `process`        | `watching`   | Keep the remote rewatch state                                     |
| `complete`       | `completed`  | Export and import                                                 |
| `drop`           | `dropped`    | Export and import                                                 |
| `hide`           | None         | Local only. Never delete, drop or put on hold.                    |
| null status      | None         | Do not guess. Remote creation needs an explicit supported status. |
| Rating 0–10      | `score` 0–10 | Export and import. 0 clears.                                      |
| Episode progress | `episodes`   | Absolute integers, also deliberate decreases                      |
| Notes            | `text`       | Not transferred by default                                        |
| Viewing links    | None         | Never export                                                      |

- Import `on_hold` as null status and keep the remote status.
- Import `rewatching` as `process` and keep the remote status and rewatches.
- Show these projections. They alone never start a status write on export.
- Unrelated score or progress edits keep the projected remote status. Only an explicit Filecab status action replaces it.
- Keep provider-only metadata without new domain statuses.
- Hiding does not export a status. An imported status update changes shadow state and does not unhide the entry.
- Omit unrelated remote text, rewatches, chapters and volumes from writes.
- Never trust provider `text_html` as safe HTML.

### Remote mutations

| Operation                      | Rule                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `POST /api/v2/user_rates`      | Verified owner, mapped anime target, `target_type=Anime`, enabled fields inside `user_rate` |
| `PATCH /api/v2/user_rates/:id` | Changed fields only. Keep explicit score and progress zero.                                 |

Do not use PUT, DELETE or increment endpoints. Increments are unsafe for retries. Read
account and anime state again before you retry an uncertain create. Read before a mutation,
verify the result after it, then record the acknowledged remote value.

### Export and import

Use the common [export](user-list-sync-spec.md#export) and [import](user-list-sync-spec.md#import)
rules. Export replaces remote values with Filecab values. Import shows a preview and applies
only the selected changes through the Filecab ownership, version and change-feed services.
Do not claim compare-and-swap unless upstream supports it. Read-before and verify-after
checks reduce races but do not give atomic protection.

### Scheduling, limits and failures

- Use the common manual jobs, generation checks and acknowledged remote values. There are no periodic or debounced jobs.
- Do not assume webhooks or realtime delivery.
- Use one rate limiter across accounts and instances. Stay below the documented limits of 5 requests a second and 90 a minute, with space for bursts, OAuth and other traffic.
- Obey stricter responses and changed limits. Obey 429 Retry-After with bounded backoff.
- Classify 401 and 403 by provider meaning. Refresh a bounded number of times only for invalid or expired tokens. Do not refresh for a missing scope or access denial.
- A missing rate changes nothing in Filecab.

### Connection management

Show the connected ID and name, write capability, last export, last import, mappings,
job progress and actionable failures. Show separate Export and Import buttons. Disconnect
keeps entries, invalidates jobs and mappings and deletes credentials. Connecting a different
account needs new mappings.

## Verification

Document Filecab operations without asking clients for provider tokens. Test scope,
rotation, pagination differences, rate and media IDs, projections and hidden entries,
explicit zeros, private text preservation, retry-safe creates, missing rates, quotas and remote races.

Verify the schema and permissions before writes. The documented REST operations define
the mutation contract. A later transport change, for example GraphQL, must keep the
shared export and import behavior and identity namespaces.

## API references

- [OAuth](https://shikimori.io/oauth)
- [User rates](https://shikimori.io/api/doc/2.0/user_rates)
- [Anime list](https://shikimori.io/api/doc/1.0/users/anime_rates)
- [General documentation](https://shikimori.io/api/doc)
