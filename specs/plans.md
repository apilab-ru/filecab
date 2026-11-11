# Plans

This file separates optional ideas from existing release requirements. It does not
claim delivery status; use the [implementation checklist](../implementation/requirement-checklist.md)
for code and verification evidence.

## Optional improvements

| Priority | Idea                                             | Boundary                                                   |
| -------- | ------------------------------------------------ | ---------------------------------------------------------- |
| High     | Import merge with per-field preview              | Keep atomic replacement as a separate action               |
| High     | Better viewing-source presentation               | Multiple source links are already required                 |
| High     | Popup draft recovery                             | Visibly separate drafts from saved entries                 |
| Medium   | Settings backup                                  | Extend the versioned format with non-sensitive preferences |
| Medium   | More parser hosts                                | Beyond the required PAGE-03 host set                       |
| Medium   | Season/edition relations and rewatch history     | Define identity/progress units before automation           |
| Medium   | Manual metadata refresh UI                       | Caching/freshness already belong to Catalog                |
| Medium   | Duplicate-review tool                            | Suggest manual/ambiguous matches; never auto-merge titles  |
| Low      | `/` search focus shortcut and keyboard shortcuts | Preserve text-input behavior                               |
| Low      | Release schedules and episode notifications      | Require separate permissions/scheduling design             |
| Low      | Tags                                             | Add after core reliability                                 |

## Existing requirements to verify

These items came from the original backlog and remain part of the baseline, not
optional new scope:

- Add search results to the library and show saved status: SEARCH-03–04, LIB-01.
- Show truthful result counts: API-01–02, LIB-05.
- Replicate with Filecab and update open popup/full-page surfaces: DATA-02, DATA-06 and [Backend replication](backend.md#extension-offline-data-and-synchronization).
- Preserve data and explain server/offline failures: DATA-04–06.
- Cache metadata/provider requests with correct ownership/locale separation: [Catalog cache](catalog-spec.md#provider-resilience-and-metadata-cache).
