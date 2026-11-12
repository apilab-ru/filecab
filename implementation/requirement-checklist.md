# Requirement Delivery Checklist

Status: steps 1–10 delivered, with evidence and remaining verification limits recorded below; complete client library workflows remain pending. Step 1 establishes this checklist; it does not implement the requirements. Each row is a checkable delivery unit. A named requirement includes every clause under that heading.

For each completed row, replace Pending with Complete and record actual code paths, test names/results, and any remaining blocker. Use Blocked only with a concrete dependency. Planned code areas below are targets, not evidence. `—` means no implementation or verification evidence recorded. Provider fixtures and live verification must be recorded separately.

Delivery steps refer to [Implementation Plan](implementation-plan.md). Baseline choices are defined in [Baseline Decisions](baseline-decisions.md). `plans.md` and optional Functionality section 13 recommendations are excluded.

## Product requirements

| Done | Requirement                                                                         | Steps             | Planned code area                              | Status                                                 | Code / verification evidence                                       | Blocker              |
| ---- | ----------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------ | -------------------- |
| [ ]  | [NAV-01](../specs/functionality.md#2-users-surfaces-and-navigation)                 | 10, 11, 16        | packages/library; apps/web; apps/extension     | Shell delivered; later workflows pending               | [Step 10 evidence](#shared-ui-localization-and-navigation-step-10) | —                    |
| [ ]  | [NAV-02](../specs/functionality.md#2-users-surfaces-and-navigation)                 | 10, 11, 16        | packages/library; apps/web; apps/extension     | Shell delivered; later workflows pending               | [Step 10 evidence](#shared-ui-localization-and-navigation-step-10) | —                    |
| [ ]  | [NAV-03](../specs/functionality.md#2-users-surfaces-and-navigation)                 | 10, 11, 16        | packages/library; apps/web; apps/extension     | Pending                                                | —                                                                  | —                    |
| [ ]  | [NAV-04](../specs/functionality.md#2-users-surfaces-and-navigation)                 | 10, 11, 16        | packages/library; apps/web; apps/extension     | Pending                                                | —                                                                  | —                    |
| [ ]  | [NAV-05](../specs/functionality.md#2-users-surfaces-and-navigation)                 | 10, 11, 16        | packages/library; apps/web; apps/extension     | Shell delivered; later workflows pending               | [Step 10 evidence](#shared-ui-localization-and-navigation-step-10) | —                    |
| [ ]  | [MODEL-01](../specs/functionality.md#3-domain-identity-and-validation)              | 3, 4, 11          | packages/contracts; packages/library; apps/api | Contracts/rules delivered; feature integration pending | [Step 3 evidence](#shared-domain-contracts-step-3)                 | Later delivery steps |
| [ ]  | [MODEL-02](../specs/functionality.md#3-domain-identity-and-validation)              | 3, 4, 11          | packages/contracts; packages/library; apps/api | Contracts/rules delivered; feature integration pending | [Step 3 evidence](#shared-domain-contracts-step-3)                 | Later delivery steps |
| [ ]  | [MODEL-03](../specs/functionality.md#3-domain-identity-and-validation)              | 3, 4, 11          | packages/contracts; packages/library; apps/api | Contracts/rules delivered; feature integration pending | [Step 3 evidence](#shared-domain-contracts-step-3)                 | Later delivery steps |
| [ ]  | [MODEL-04](../specs/functionality.md#3-domain-identity-and-validation)              | 3, 4, 11          | packages/contracts; packages/library; apps/api | Contracts/rules delivered; feature integration pending | [Step 3 evidence](#shared-domain-contracts-step-3)                 | Later delivery steps |
| [ ]  | [MODEL-05](../specs/functionality.md#3-domain-identity-and-validation)              | 3, 4, 11          | packages/contracts; packages/library; apps/api | Contracts/rules delivered; feature integration pending | [Step 3 evidence](#shared-domain-contracts-step-3)                 | Later delivery steps |
| [ ]  | [MODEL-06](../specs/functionality.md#3-domain-identity-and-validation)              | 3, 4, 11          | packages/contracts; packages/library; apps/api | Contracts/rules delivered; feature integration pending | [Step 3 evidence](#shared-domain-contracts-step-3)                 | Later delivery steps |
| [ ]  | [MODEL-07](../specs/functionality.md#3-domain-identity-and-validation)              | 3, 4, 11          | packages/contracts; packages/library; apps/api | Contracts/rules delivered; feature integration pending | [Step 3 evidence](#shared-domain-contracts-step-3)                 | Later delivery steps |
| [ ]  | [MODEL-08](../specs/functionality.md#3-domain-identity-and-validation)              | 3, 4, 11          | packages/contracts; packages/library; apps/api | Contracts/rules delivered; feature integration pending | [Step 3 evidence](#shared-domain-contracts-step-3)                 | Later delivery steps |
| [ ]  | [PAGE-01](../specs/functionality.md#4-page-extraction-and-matching)                 | 16                | apps/extension; apps/api                       | Pending                                                | —                                                                  | —                    |
| [ ]  | [PAGE-02](../specs/functionality.md#4-page-extraction-and-matching)                 | 16                | apps/extension; apps/api                       | Pending                                                | —                                                                  | —                    |
| [ ]  | [PAGE-03](../specs/functionality.md#4-page-extraction-and-matching)                 | 16                | apps/extension; apps/api                       | Pending                                                | —                                                                  | —                    |
| [ ]  | [PAGE-04](../specs/functionality.md#4-page-extraction-and-matching)                 | 16                | apps/extension; apps/api                       | Pending                                                | —                                                                  | —                    |
| [ ]  | [MATCH-01](../specs/functionality.md#4-page-extraction-and-matching)                | 4, 15, 16         | packages/library; apps/api                     | Pending                                                | —                                                                  | —                    |
| [ ]  | [MATCH-02](../specs/functionality.md#4-page-extraction-and-matching)                | 4, 15, 16         | packages/library; apps/api                     | Pending                                                | —                                                                  | —                    |
| [ ]  | [MATCH-03](../specs/functionality.md#4-page-extraction-and-matching)                | 4, 15, 16         | packages/library; apps/api                     | Pending                                                | —                                                                  | —                    |
| [ ]  | [SEARCH-01](../specs/functionality.md#5-catalog-search-editing-and-saving)          | 12–15             | packages/library; apps/api                     | Pending                                                | —                                                                  | —                    |
| [ ]  | [SEARCH-02](../specs/functionality.md#5-catalog-search-editing-and-saving)          | 12–15             | packages/library; apps/api                     | Pending                                                | —                                                                  | —                    |
| [ ]  | [SEARCH-03](../specs/functionality.md#5-catalog-search-editing-and-saving)          | 12–15             | packages/library; apps/api                     | Pending                                                | —                                                                  | —                    |
| [ ]  | [SEARCH-04](../specs/functionality.md#5-catalog-search-editing-and-saving)          | 12–15             | packages/library; apps/api                     | Pending                                                | —                                                                  | —                    |
| [ ]  | [EDIT-01](../specs/functionality.md#5-catalog-search-editing-and-saving)            | 7, 8, 11          | packages/library; apps/api; apps/extension     | Pending                                                | —                                                                  | —                    |
| [ ]  | [EDIT-02](../specs/functionality.md#5-catalog-search-editing-and-saving)            | 7, 8, 11          | packages/library; apps/api; apps/extension     | Pending                                                | —                                                                  | —                    |
| [ ]  | [EDIT-03](../specs/functionality.md#5-catalog-search-editing-and-saving)            | 7, 8, 11          | packages/library; apps/api; apps/extension     | Pending                                                | —                                                                  | —                    |
| [ ]  | [EDIT-04](../specs/functionality.md#5-catalog-search-editing-and-saving)            | 7, 8, 11          | packages/library; apps/api; apps/extension     | Pending                                                | —                                                                  | —                    |
| [ ]  | [LIB-01](../specs/functionality.md#6-library-browsing)                              | 10, 11            | packages/library                               | Pending                                                | —                                                                  | —                    |
| [ ]  | [LIB-02](../specs/functionality.md#6-library-browsing)                              | 10, 11            | packages/library                               | Pending                                                | —                                                                  | —                    |
| [ ]  | [LIB-03](../specs/functionality.md#6-library-browsing)                              | 10, 11            | packages/library                               | Pending                                                | —                                                                  | —                    |
| [ ]  | [LIB-04](../specs/functionality.md#6-library-browsing)                              | 10, 11            | packages/library                               | Pending                                                | —                                                                  | —                    |
| [ ]  | [LIB-05](../specs/functionality.md#6-library-browsing)                              | 10, 11            | packages/library                               | Pending                                                | —                                                                  | —                    |
| [ ]  | [LIB-06](../specs/functionality.md#6-library-browsing)                              | 10, 11            | packages/library                               | Pending                                                | —                                                                  | —                    |
| [ ]  | [LIB-07](../specs/functionality.md#6-library-browsing)                              | 10, 11            | packages/library                               | Pending                                                | —                                                                  | —                    |
| [ ]  | [DATA-01](../specs/functionality.md#7-persistence-offline-behavior-and-concurrency) | 7–9, 11           | apps/api; apps/extension; apps/web             | Pending                                                | —                                                                  | —                    |
| [ ]  | [DATA-02](../specs/functionality.md#7-persistence-offline-behavior-and-concurrency) | 7–9, 11           | apps/api; apps/extension; apps/web             | Pending                                                | —                                                                  | —                    |
| [ ]  | [DATA-03](../specs/functionality.md#7-persistence-offline-behavior-and-concurrency) | 7–9, 11           | apps/api; apps/extension; apps/web             | Pending                                                | —                                                                  | —                    |
| [ ]  | [DATA-04](../specs/functionality.md#7-persistence-offline-behavior-and-concurrency) | 7–9, 11           | apps/api; apps/extension; apps/web             | Pending                                                | —                                                                  | —                    |
| [ ]  | [DATA-05](../specs/functionality.md#7-persistence-offline-behavior-and-concurrency) | 7–9, 11           | apps/api; apps/extension; apps/web             | Pending                                                | —                                                                  | —                    |
| [ ]  | [DATA-06](../specs/functionality.md#7-persistence-offline-behavior-and-concurrency) | 7–9, 11           | apps/api; apps/extension; apps/web             | Pending                                                | —                                                                  | —                    |
| [ ]  | [BACKUP-01](../specs/functionality.md#8-backup-and-restore)                         | 17                | packages/library; apps/api; apps/extension     | Pending                                                | —                                                                  | —                    |
| [ ]  | [BACKUP-02](../specs/functionality.md#8-backup-and-restore)                         | 17                | packages/library; apps/api; apps/extension     | Pending                                                | —                                                                  | —                    |
| [ ]  | [BACKUP-03](../specs/functionality.md#8-backup-and-restore)                         | 17                | packages/library; apps/api; apps/extension     | Pending                                                | —                                                                  | —                    |
| [ ]  | [BACKUP-04](../specs/functionality.md#8-backup-and-restore)                         | 17                | packages/library; apps/api; apps/extension     | Pending                                                | —                                                                  | —                    |
| [ ]  | [BACKUP-05](../specs/functionality.md#8-backup-and-restore)                         | 17                | packages/library; apps/api; apps/extension     | Pending                                                | —                                                                  | —                    |
| [ ]  | [API-01](../specs/functionality.md#9-backend-and-shared-contracts)                  | 3, 5, 7, 9, 12–15 | packages/contracts; apps/api                   | Contracts/rules delivered; feature integration pending | [Step 3 evidence](#shared-domain-contracts-step-3)                 | Later delivery steps |
| [ ]  | [API-02](../specs/functionality.md#9-backend-and-shared-contracts)                  | 3, 5, 7, 9, 12–15 | packages/contracts; apps/api                   | Pending                                                | —                                                                  | —                    |
| [ ]  | [API-03](../specs/functionality.md#9-backend-and-shared-contracts)                  | 3, 5, 7, 9, 12–15 | packages/contracts; apps/api                   | Pending                                                | —                                                                  | —                    |
| [ ]  | [API-04](../specs/functionality.md#9-backend-and-shared-contracts)                  | 3, 5, 7, 9, 12–15 | packages/contracts; apps/api                   | Contracts/rules delivered; feature integration pending | [Step 3 evidence](#shared-domain-contracts-step-3)                 | Later delivery steps |
| [ ]  | [API-05](../specs/functionality.md#9-backend-and-shared-contracts)                  | 3, 5, 7, 9, 12–15 | packages/contracts; apps/api                   | Contracts/rules delivered; feature integration pending | [Step 3 evidence](#shared-domain-contracts-step-3)                 | Later delivery steps |
| [ ]  | [API-06](../specs/functionality.md#9-backend-and-shared-contracts)                  | 3, 5, 7, 9, 12–15 | packages/contracts; apps/api                   | Contracts/rules delivered; feature integration pending | [Step 3 evidence](#shared-domain-contracts-step-3)                 | Later delivery steps |
| [ ]  | [API-07](../specs/functionality.md#9-backend-and-shared-contracts)                  | 3, 5, 7, 9, 12–15 | packages/contracts; apps/api                   | Pending                                                | —                                                                  | —                    |
| [ ]  | [LANG-01](../specs/functionality.md#10-english-and-russian)                         | 3, 10–15          | packages/library; packages/ui; apps/api        | Shell delivered; later workflows pending               | [Step 10 evidence](#shared-ui-localization-and-navigation-step-10) | —                    |
| [ ]  | [LANG-02](../specs/functionality.md#10-english-and-russian)                         | 3, 10–15          | packages/library; packages/ui; apps/api        | Shell delivered; later workflows pending               | [Step 10 evidence](#shared-ui-localization-and-navigation-step-10) | —                    |
| [ ]  | [LANG-03](../specs/functionality.md#10-english-and-russian)                         | 3, 10–15          | packages/library; packages/ui; apps/api        | Contracts/rules delivered; feature integration pending | [Step 3 evidence](#shared-domain-contracts-step-3)                 | Later delivery steps |
| [ ]  | [LANG-04](../specs/functionality.md#10-english-and-russian)                         | 3, 10–15          | packages/library; packages/ui; apps/api        | Contracts/rules delivered; feature integration pending | [Step 3 evidence](#shared-domain-contracts-step-3)                 | Later delivery steps |
| [ ]  | [LANG-05](../specs/functionality.md#10-english-and-russian)                         | 3, 10–15          | packages/library; packages/ui; apps/api        | Contracts/rules delivered; feature integration pending | [Step 3 evidence](#shared-domain-contracts-step-3)                 | Later delivery steps |
| [ ]  | [LANG-06](../specs/functionality.md#10-english-and-russian)                         | 3, 10–15          | packages/library; packages/ui; apps/api        | Contracts/rules delivered; feature integration pending | [Step 3 evidence](#shared-domain-contracts-step-3)                 | Later delivery steps |
| [ ]  | [PLAT-01](../specs/functionality.md#11-platform-privacy-and-usability)              | 5, 6, 16          | apps/extension; apps/api                       | Pending                                                | —                                                                  | —                    |
| [ ]  | [PLAT-02](../specs/functionality.md#11-platform-privacy-and-usability)              | 5, 6, 16          | apps/extension; apps/api                       | Pending                                                | —                                                                  | —                    |
| [ ]  | [PLAT-03](../specs/functionality.md#11-platform-privacy-and-usability)              | 5, 6, 16          | apps/extension; apps/api                       | Pending                                                | —                                                                  | —                    |
| [ ]  | [UX-01](../specs/functionality.md#11-platform-privacy-and-usability)                | 10, 11, 21        | packages/ui; packages/library                  | Pending                                                | —                                                                  | —                    |

## Acceptance scenarios

| Done | Scenario                                                                      | Steps                                      | Status  | Verification evidence | Blocker |
| ---- | ----------------------------------------------------------------------------- | ------------------------------------------ | ------- | --------------------- | ------- |
| [ ]  | [AC01](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |
| [ ]  | [AC02](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |
| [ ]  | [AC03](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |
| [ ]  | [AC04](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |
| [ ]  | [AC05](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |
| [ ]  | [AC06](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |
| [ ]  | [AC07](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |
| [ ]  | [AC08](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |
| [ ]  | [AC09](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |
| [ ]  | [AC10](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |
| [ ]  | [AC11](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |
| [ ]  | [AC12](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |
| [ ]  | [AC13](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |
| [ ]  | [AC14](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |
| [ ]  | [AC15](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |
| [ ]  | [AC16](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |
| [ ]  | [AC17](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |
| [ ]  | [AC18](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |
| [ ]  | [AC19](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |
| [ ]  | [AC20](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |
| [ ]  | [AC21](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |
| [ ]  | [AC22](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |
| [ ]  | [AC23](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |
| [ ]  | [AC24](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |
| [ ]  | [AC25](../specs/functionality.md#12-release-acceptance-and-defect-resolution) | 21 (and owning implementation steps above) | Pending | —                     | —       |

## Backend

| Done | Requirement                                                                                                                   | Step     | Planned code area                             | Status    | Code / verification evidence                                | Blocker |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------- | --------- | ----------------------------------------------------------- | ------- |
| [ ]  | [Google authentication](../specs/backend.md#google-authentication)                                                            | 6        | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Website and extension login](../specs/backend.md#website-and-extension-login)                                                | 6        | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Session lifecycle](../specs/backend.md#session-lifecycle)                                                                    | 6        | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Independent entry identity](../specs/backend.md#independent-entry-identity)                                                  | 3        | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Library fields](../specs/backend.md#library-fields)                                                                          | 3        | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Ownership and duplicate protection](../specs/backend.md#ownership-and-duplicate-protection)                                  | 4        | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Multiple viewing links](../specs/backend.md#multiple-viewing-links)                                                          | 4        | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Create, read, update, and delete](../specs/backend.md#create-read-update-and-delete)                                         | 7        | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Delete and undo](../specs/backend.md#delete-and-undo)                                                                        | 7        | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Retrieve the complete owner library](../specs/backend.md#retrieve-the-complete-owner-library)                                | 7        | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Client-side search, filters, sorting, and pagination](../specs/backend.md#client-side-search-filters-sorting-and-pagination) | 11       | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Provider adapters](../specs/backend.md#provider-adapters)                                                                    | 12       | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Search contract](../specs/backend.md#search-contract)                                                                        | 12       | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Catalog identity and metadata refresh](../specs/backend.md#catalog-identity-and-metadata-refresh)                            | 12       | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Genres](../specs/backend.md#genres)                                                                                          | 12       | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Candidate identification](../specs/backend.md#candidate-identification)                                                      | 16       | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Manual entry reconciliation](../specs/backend.md#manual-entry-reconciliation)                                                | 15       | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Durable local extension state](../specs/backend.md#durable-local-extension-state)                                            | 8        | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [x]  | [RxDB pull and push](../specs/backend.md#rxdb-pull-and-push)                                                                  | 9        | apps/api; packages/contracts; client adapters | Delivered | [Step 9 evidence](#extension-to-filecab-replication-step-9) | —       |
| [ ]  | [Commit-safe change tracking](../specs/backend.md#commit-safe-change-tracking)                                                | 4        | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [x]  | [Conflict recovery](../specs/backend.md#conflict-recovery)                                                                    | 9        | apps/api; packages/contracts; client adapters | Delivered | [Step 9 evidence](#extension-to-filecab-replication-step-9) | —       |
| [x]  | [Sync lifecycle and retention](../specs/backend.md#sync-lifecycle-and-retention)                                              | 9        | apps/api; packages/contracts; client adapters | Delivered | [Step 9 evidence](#extension-to-filecab-replication-step-9) | —       |
| [x]  | [Guest adoption](../specs/backend.md#guest-adoption)                                                                          | 9        | apps/api; packages/contracts; client adapters | Delivered | [Step 9 evidence](#extension-to-filecab-replication-step-9) | —       |
| [ ]  | [Sharing controls](../specs/backend.md#sharing-controls)                                                                      | 18       | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Shared data projection](../specs/backend.md#shared-data-projection)                                                          | 18       | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Shared freshness and privacy](../specs/backend.md#shared-freshness-and-privacy)                                              | 18       | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Export and import formats](../specs/backend.md#export-and-import-formats)                                                    | 17       | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Preview and atomic replacement](../specs/backend.md#preview-and-atomic-replacement)                                          | 17       | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Locale-aware API](../specs/backend.md#locale-aware-api)                                                                      | 12       | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Preserve user text](../specs/backend.md#preserve-user-text)                                                                  | 3        | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Declarative extraction configuration](../specs/backend.md#declarative-extraction-configuration)                              | 16       | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Configuration compatibility and rollback](../specs/backend.md#configuration-compatibility-and-rollback)                      | 16       | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Page data minimization](../specs/backend.md#page-data-minimization)                                                          | 16       | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Validated, versioned contracts](../specs/backend.md#validated-versioned-contracts)                                           | 5        | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Actionable errors](../specs/backend.md#actionable-errors)                                                                    | 5        | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Provider resilience and cache](../specs/backend.md#provider-resilience-and-cache)                                            | 12       | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Secure operations](../specs/backend.md#secure-operations)                                                                    | 2, 5, 21 | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Swagger API documentation](../specs/backend.md#swagger-api-documentation)                                                    | 5        | apps/api; packages/contracts; client adapters | Pending   | —                                                           | —       |
| [ ]  | [Cross-cutting verification](../specs/backend.md#verification)                                                                | 21       | All applications                              | Pending   | —                                                           | —       |

## Catalog

| Done | Requirement                                                                                               | Step | Planned code area                    | Status  | Code / verification evidence | Blocker |
| ---- | --------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------ | ------- | ---------------------------- | ------- |
| [ ]  | [Provider adapters and capabilities](../specs/catalog-spec.md#provider-adapters-and-capabilities)         | 12   | apps/api catalog; packages/contracts | Pending | —                            | —       |
| [ ]  | [Routing and selection](../specs/catalog-spec.md#routing-and-selection)                                   | 12   | apps/api catalog; packages/contracts | Pending | —                            | —       |
| [ ]  | [Search contract](../specs/catalog-spec.md#search-contract)                                               | 12   | apps/api catalog; packages/contracts | Pending | —                            | —       |
| [ ]  | [Pagination integrity](../specs/catalog-spec.md#pagination-integrity)                                     | 12   | apps/api catalog; packages/contracts | Pending | —                            | —       |
| [ ]  | [Identity and cross-provider references](../specs/catalog-spec.md#identity-and-cross-provider-references) | 12   | apps/api catalog; packages/contracts | Pending | —                            | —       |
| [ ]  | [Details and safe enrichment](../specs/catalog-spec.md#details-and-safe-enrichment)                       | 12   | apps/api catalog; packages/contracts | Pending | —                            | —       |
| [ ]  | [Normalized media metadata](../specs/catalog-spec.md#normalized-media-metadata)                           | 12   | apps/api catalog; packages/contracts | Pending | —                            | —       |
| [ ]  | [Localization](../specs/catalog-spec.md#localization)                                                     | 12   | apps/api catalog; packages/contracts | Pending | —                            | —       |
| [ ]  | [Genres](../specs/catalog-spec.md#genres)                                                                 | 12   | apps/api catalog; packages/contracts | Pending | —                            | —       |
| [ ]  | [Provider resilience and metadata cache](../specs/catalog-spec.md#provider-resilience-and-metadata-cache) | 12   | apps/api catalog; packages/contracts | Pending | —                            | —       |
| [ ]  | [Client and API boundaries](../specs/catalog-spec.md#client-and-api-boundaries)                           | 12   | apps/api catalog; packages/contracts | Pending | —                            | —       |
| [ ]  | [Verification](../specs/catalog-spec.md#verification)                                                     | 12   | apps/api catalog; packages/contracts | Pending | —                            | —       |

12.a core code has been delivered in `apps/api/src/catalog/` and
`packages/contracts/src/models/index.ts`: capability discovery and category defaults,
single-provider search dispatch with capability rejection, separate internal-ID and
provider-reference detail routes, verified-reference identity upserts, safe partial
metadata enrichment, and explicit continuation limitation fields. Catalog persistence
now stores granularity in `CatalogItem` through migration
`20261111000000_catalog_granularity`. Contracts and API typechecks pass. The catalog
requirement rows above remain unchecked until provider adapters and deterministic
identity/pagination fixtures establish their full behavior; no provider is advertised
or available through the search service yet.

12.b cache code is delivered in `apps/api/src/catalog/catalog-cache.service.ts` with
PostgreSQL search-page and locale metadata tables from migration
`20261111010000_catalog_cache`. Canonical request hashes isolate provider, locale, query,
category, filters, ordering, page size/page, contract version and adapter schema version.
Fresh search results are reused for 15 minutes; retryable upstream failures can return
an explicitly stale-labeled page for up to 24 hours. Successful empty pages replace
cached pages. Metadata projections retain provider provenance and exclude owner fields;
cache limits are 5,000 search pages globally, 20 per request identity and 10,000 metadata
rows. Typecheck, Prisma schema validation, ESLint and Prettier pass; deterministic cache
behavior checks remain pending, so the broader catalog requirement rows stay unchecked.

12.c administration code is delivered in `apps/api/src/catalog/catalog-genre.service.ts`
and `catalog-genre-admin.controller.ts`, with conflict persistence from migration
`20261111020000_genre_administration`. Refresh/review require an authenticated account
listed in `CATALOG_OPERATOR_ACCOUNT_IDS`; the default allowlist is empty. Public
`GET /catalog/genres` is read-only and returns stable internal genres; adapters still
require verified provider mappings. Provider data is
bounded and validated; budgets are configurable in `apps/api/.env.example`. Unmapped
provider IDs and contradictory/missing crosswalk targets remain visible to operator
review. No genre adapter is wired yet, so refresh correctly remains unavailable. API
typecheck, Prisma validation, ESLint and Prettier pass; deterministic genre authorization,
mapping and budget checks remain pending.

Seed data was scanned from `https://api.apilab.ru/file-cab/genres/list` on 11 November
2026 and added in migration `20261111030000_seed_catalog_genres`: 117 source rows become
112 stable internal genre keys, 136 category associations and 135 provider mappings.
The source contains 12 conflicting Smotret ID claims; conflict rows are not seeded by
this migration. Provider mapping provenance remains
unverified until the provider adapters are independently verified; the internal genre
list is still publicly readable and the adapters must not consume these mappings yet.

## External list synchronization

| Done | Requirement                                                                                                            | Step | Planned code area                             | Status  | Code / verification evidence | Blocker |
| ---- | ---------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------- | ------- | ---------------------------- | ------- |
| [ ]  | [Provider abstraction](../specs/user-list-sync-spec.md#provider-abstraction)                                           | 19   | apps/api list-sync; packages/library settings | Pending | —                            | —       |
| [ ]  | [Separation from catalog providers](../specs/user-list-sync-spec.md#separation-from-catalog-providers)                 | 19   | apps/api list-sync; packages/library settings | Pending | —                            | —       |
| [ ]  | [Account connection](../specs/user-list-sync-spec.md#account-connection)                                               | 19   | apps/api list-sync; packages/library settings | Pending | —                            | —       |
| [ ]  | [Common sync records](../specs/user-list-sync-spec.md#common-sync-records)                                             | 19   | apps/api list-sync; packages/library settings | Pending | —                            | —       |
| [ ]  | [Identity resolution](../specs/user-list-sync-spec.md#identity-resolution)                                             | 19   | apps/api list-sync; packages/library settings | Pending | —                            | —       |
| [ ]  | [Initial synchronization](../specs/user-list-sync-spec.md#initial-synchronization)                                     | 19   | apps/api list-sync; packages/library settings | Pending | —                            | —       |
| [ ]  | [Field policy and privacy](../specs/user-list-sync-spec.md#field-policy-and-privacy)                                   | 19   | apps/api list-sync; packages/library settings | Pending | —                            | —       |
| [ ]  | [Three-way reconciliation](../specs/user-list-sync-spec.md#three-way-reconciliation)                                   | 19   | apps/api list-sync; packages/library settings | Pending | —                            | —       |
| [ ]  | [Scheduling and asynchronous writes](../specs/user-list-sync-spec.md#scheduling-and-asynchronous-writes)               | 19   | apps/api list-sync; packages/library settings | Pending | —                            | —       |
| [ ]  | [Retry safety and feedback-loop prevention](../specs/user-list-sync-spec.md#retry-safety-and-feedback-loop-prevention) | 19   | apps/api list-sync; packages/library settings | Pending | —                            | —       |
| [ ]  | [Complete scans and missing records](../specs/user-list-sync-spec.md#complete-scans-and-missing-records)               | 19   | apps/api list-sync; packages/library settings | Pending | —                            | —       |
| [ ]  | [Explicit deletion policy](../specs/user-list-sync-spec.md#explicit-deletion-policy)                                   | 19   | apps/api list-sync; packages/library settings | Pending | —                            | —       |
| [ ]  | [Pause, disconnect, and authorization loss](../specs/user-list-sync-spec.md#pause-disconnect-and-authorization-loss)   | 19   | apps/api list-sync; packages/library settings | Pending | —                            | —       |
| [ ]  | [User-visible state and API documentation](../specs/user-list-sync-spec.md#user-visible-state-and-api-documentation)   | 19   | apps/api list-sync; packages/library settings | Pending | —                            | —       |
| [ ]  | [Reliability verification](../specs/user-list-sync-spec.md#reliability-verification)                                   | 19   | apps/api list-sync; packages/library settings | Pending | —                            | —       |

## Smotret catalog adapter

| Done | Requirement                                                                                                             | Step | Planned code area        | Status   | Code / verification evidence                                                         | Blocker                                                                                 |
| ---- | ----------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------ | -------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| [x]  | [Configuration and provider identity](../specs/integration-smotret-anime-spec.md#configuration-and-provider-identity)   | 13   | apps/api catalog/smotret | Verified | `smotret-anime.adapter.ts`; `environment.ts`; `app.module.ts`; adapter fixture suite | Mirrors remain restricted to configured approved hosts                                  |
| [x]  | [Series search](../specs/integration-smotret-anime-spec.md#series-search)                                               | 13   | apps/api catalog/smotret | Verified | `smotret-anime.adapter.ts`; offset/filter/dedup fixture                              | Live provider behavior remains subject to availability                                  |
| [x]  | [External-reference separation](../specs/integration-smotret-anime-spec.md#external-reference-separation)               | 13   | apps/api catalog/smotret | Verified | `smotret-anime.adapter.ts`; namespace fixture                                        | Exact MAL lookup is implemented; fixture suite verifies separation and unverified links |
| [x]  | [Titles and descriptions](../specs/integration-smotret-anime-spec.md#titles-and-descriptions)                           | 13   | apps/api catalog/smotret | Verified | `smotret-anime.adapter.ts`; missing-optional-array fixture                           | Original title language remains unknown as documented                                   |
| [x]  | [Media and episode metadata](../specs/integration-smotret-anime-spec.md#media-and-episode-metadata)                     | 13   | apps/api catalog/smotret | Verified | `smotret-anime.adapter.ts`; incomplete episode fixture                               | Provider does not establish array completeness                                          |
| [x]  | [Genre normalization](../specs/integration-smotret-anime-spec.md#genre-normalization)                                   | 13   | apps/api catalog/smotret | Verified | Provider-scoped candidate behavior; no unsupported canonical mapping enabled         | Verified canonical crosswalk/dictionary unavailable; genre filter disabled              |
| [x]  | [Persistence and pagination integrity](../specs/integration-smotret-anime-spec.md#persistence-and-pagination-integrity) | 13   | apps/api catalog/smotret | Verified | `smotret-anime.adapter.ts`; identity persistence boundary and pagination fixtures    | Database race coverage belongs to shared catalog step 12                                |
| [x]  | [Failure handling](../specs/integration-smotret-anime-spec.md#failure-handling)                                         | 13   | apps/api catalog/smotret | Verified | Throttling and denial fixtures; structured errors in `smotret-anime.adapter.ts`      | Timeout/malformed response are guarded by shared request/DTO validation paths           |
| [x]  | [Verification and documentation](../specs/integration-smotret-anime-spec.md#verification-and-documentation)             | 13   | apps/api catalog/smotret | Verified | Official OpenAPI/terms and `smotret-anime.adapter.unit.test.ts` (6 fixtures)         | Live checks document only the observed search/detail surface                            |

## Kinopoisk catalog adapter

| Done | Requirement                                                                                                         | Step | Planned code area          | Status   | Code / verification evidence                                                          | Blocker                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------- | -------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [ ]  | [Configuration and scope](../specs/integration-kinopoisk-spec.md#configuration-and-scope)                           | 14   | apps/api catalog/kinopoisk | Partial  | Adapter gated by configured origin/key; docs review recorded                          | Discovery/search work with configured key; full entitlement/terms remain unverified   |
| [ ]  | [Text search and filtered discovery](../specs/integration-kinopoisk-spec.md#text-search-and-filtered-discovery)     | 14   | apps/api catalog/kinopoisk | Partial  | v1.4 `/movie/search` and `/movie` adapter paths                                       | Deterministic operation/filter fixtures pending                                       |
| [ ]  | [Film and TV classification](../specs/integration-kinopoisk-spec.md#film-and-tv-classification)                     | 14   | apps/api catalog/kinopoisk | Partial  | Explicit type and `isSeries` checks                                                   | Classification fixtures pending                                                       |
| [ ]  | [Detail and external-reference lookup](../specs/integration-kinopoisk-spec.md#detail-and-external-reference-lookup) | 14   | apps/api catalog/kinopoisk | Partial  | Scoped `kinopoisk`, IMDb and TMDB resolution paths                                    | Additional TMDB scope checks excluded by user; title detail revalidation unverified   |
| [ ]  | [Metadata normalization](../specs/integration-kinopoisk-spec.md#metadata-normalization)                             | 14   | apps/api catalog/kinopoisk | Partial  | Normalized names, poster, description, genres, ratings and references                 | Provider payload fixture verification pending                                         |
| [ ]  | [Episode totals](../specs/integration-kinopoisk-spec.md#episode-totals)                                             | 14   | apps/api catalog/kinopoisk | Partial  | Totals remain unknown                                                                 | Season-count endpoint/policy not verified                                             |
| [ ]  | [Genres, filters, and ordering](../specs/integration-kinopoisk-spec.md#genres-filters-and-ordering)                 | 14   | apps/api catalog/kinopoisk | Partial  | Year/format only; no genre/order advertised                                           | Verified mapping and operation contract pending                                       |
| [x]  | [Pagination](../specs/integration-kinopoisk-spec.md#pagination)                                                     | 14   | apps/api catalog/kinopoisk | Verified | Bounded replay, category filtering, title deduplication and eligible lookahead tested | Completed for bounded replay; scan limit reported explicitly                          |
| [ ]  | [Localization and enrichment](../specs/integration-kinopoisk-spec.md#localization-and-enrichment)                   | 14   | apps/api catalog/kinopoisk | Partial  | Locale preference uses supplied language only                                         | Live field language/payload behavior pending                                          |
| [ ]  | [Authentication failures and quotas](../specs/integration-kinopoisk-spec.md#authentication-failures-and-quotas)     | 14   | apps/api catalog/kinopoisk | Partial  | 401/403/429 structured mapping implemented                                            | HTTP 401/403/429/503 fixtures pass; configurable budgets/Retry-After excluded by user |
| [ ]  | [Contract verification](../specs/integration-kinopoisk-spec.md#contract-verification)                               | 14   | apps/api catalog/kinopoisk | Partial  | 17 adapter tests and typecheck pass; HTTP 200 discovery/search probes                 | Remaining metadata/contracts listed in step 14 review; pagination delivered           |

## Shikimori list adapter

| Done | Requirement                                                                                                         | Step | Planned code area                                       | Status  | Code / verification evidence | Blocker                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------- | ------- | ---------------------------- | --------------------------------------------------------------------------- |
| [ ]  | [Independent OAuth connection](../specs/integration-shikimori-spec.md#independent-oauth-connection)                 | 20   | apps/api list-sync/shikimori; packages/library settings | Pending | —                            | Provider contract/credentials/usage verification required before activation |
| [ ]  | [Token lifecycle](../specs/integration-shikimori-spec.md#token-lifecycle)                                           | 20   | apps/api list-sync/shikimori; packages/library settings | Pending | —                            | Provider contract/credentials/usage verification required before activation |
| [ ]  | [Anime-list reading](../specs/integration-shikimori-spec.md#anime-list-reading)                                     | 20   | apps/api list-sync/shikimori; packages/library settings | Pending | —                            | Provider contract/credentials/usage verification required before activation |
| [ ]  | [Verified identity mapping](../specs/integration-shikimori-spec.md#verified-identity-mapping)                       | 20   | apps/api list-sync/shikimori; packages/library settings | Pending | —                            | Provider contract/credentials/usage verification required before activation |
| [ ]  | [Bidirectional field mapping](../specs/integration-shikimori-spec.md#bidirectional-field-mapping)                   | 20   | apps/api list-sync/shikimori; packages/library settings | Pending | —                            | Provider contract/credentials/usage verification required before activation |
| [ ]  | [Remote list mutations](../specs/integration-shikimori-spec.md#remote-list-mutations)                               | 20   | apps/api list-sync/shikimori; packages/library settings | Pending | —                            | Provider contract/credentials/usage verification required before activation |
| [ ]  | [Reconciliation and consistency](../specs/integration-shikimori-spec.md#reconciliation-and-consistency)             | 20   | apps/api list-sync/shikimori; packages/library settings | Pending | —                            | Provider contract/credentials/usage verification required before activation |
| [ ]  | [Scheduling, limits, and failures](../specs/integration-shikimori-spec.md#scheduling-limits-and-failures)           | 20   | apps/api list-sync/shikimori; packages/library settings | Pending | —                            | Provider contract/credentials/usage verification required before activation |
| [ ]  | [Connection management and disconnect](../specs/integration-shikimori-spec.md#connection-management-and-disconnect) | 20   | apps/api list-sync/shikimori; packages/library settings | Pending | —                            | Provider contract/credentials/usage verification required before activation |
| [ ]  | [Documentation and verification](../specs/integration-shikimori-spec.md#documentation-and-verification)             | 20   | apps/api list-sync/shikimori; packages/library settings | Pending | —                            | Provider contract/credentials/usage verification required before activation |

## Architecture and stack constraints

Each row covers the complete linked section, including its table rows, bullets, and normative paragraphs. Technology choices live in Stack; implementation rules live in Conventions, detailed decisions and the relevant product/API specifications. Injected UI constraints apply if introduced.

| Done | Constraint group                                                                               | Steps      | Planned code area      | Status    | Code / verification evidence                                | Blocker |
| ---- | ---------------------------------------------------------------------------------------------- | ---------- | ---------------------- | --------- | ----------------------------------------------------------- | ------- |
| [ ]  | [Scope](../specs/functionality.md#11-release-scope)                                            | 1, 3       | Relevant apps/packages | Pending   | —                                                           | —       |
| [ ]  | [Core stack](../specs/stack.md#core-stack)                                                     | 2–10       | Relevant apps/packages | Pending   | —                                                           | —       |
| [ ]  | [Repository structure](../specs/conventions.md#repository-structure)                           | 2          | Relevant apps/packages | Pending   | —                                                           | —       |
| [ ]  | [Shared UI components](../specs/conventions.md#shared-ui-components)                           | 10         | Relevant apps/packages | Pending   | —                                                           | —       |
| [ ]  | [Styling convention](../specs/conventions.md#styling-convention)                               | 10         | Relevant apps/packages | Pending   | —                                                           | —       |
| [ ]  | [Extension surfaces](../specs/functionality.md#2-users-surfaces-and-navigation)                | 8, 10, 16  | Relevant apps/packages | Pending   | —                                                           | —       |
| [ ]  | [Data ownership and database usage](../specs/conventions.md#data-ownership-and-database-usage) | 4, 7–9, 11 | Relevant apps/packages | Pending   | —                                                           | —       |
| [x]  | [Extension persistence and replication](baseline-decisions.md#extension-replication)           | 8–9        | Relevant apps/packages | Delivered | [Step 9 evidence](#extension-to-filecab-replication-step-9) | —       |
| [ ]  | [Website server state](../specs/conventions.md#website-server-state)                           | 6, 11      | Relevant apps/packages | Pending   | —                                                           | —       |
| [ ]  | [Read-only sharing through unlisted links](../specs/backend.md#unlisted-read-only-sharing)     | 18         | Relevant apps/packages | Pending   | —                                                           | —       |
| [ ]  | [Temporary UI state and shared packages](../specs/conventions.md#local-state-management)       | 3, 10–11   | Relevant apps/packages | Pending   | —                                                           | —       |
| [ ]  | [Identity and catalog integration](../specs/catalog-spec.md)                                   | 3, 12–15   | Relevant apps/packages | Pending   | —                                                           | —       |
| [ ]  | [Parser configuration](../specs/backend.md#server-managed-parser-configuration)                | 16         | Relevant apps/packages | Pending   | —                                                           | —       |
| [ ]  | [Google authentication](../specs/backend.md#accounts-and-sessions)                             | 6          | Relevant apps/packages | Pending   | —                                                           | —       |
| [ ]  | [Local development on macOS](../README.md#postgresql-and-migrations-macos)                     | 2          | Relevant apps/packages | Pending   | —                                                           | —       |

## Baseline decision constraints

| Done | Decision                                                                                       | Steps              | Status  | Code / verification evidence | Blocker |
| ---- | ---------------------------------------------------------------------------------------------- | ------------------ | ------- | ---------------------------- | ------- |
| [ ]  | [Scope and client storage](baseline-decisions.md#scope-and-client-storage)                     | 3–21 as applicable | Pending | —                            | —       |
| [ ]  | [Progress and provider roles](baseline-decisions.md#progress-and-provider-roles)               | 3–21 as applicable | Pending | —                            | —       |
| [ ]  | [Viewing-source normalization](baseline-decisions.md#viewing-source-normalization)             | 3–21 as applicable | Pending | —                            | —       |
| [ ]  | [Current-format backup](baseline-decisions.md#current-format-backup)                           | 3–21 as applicable | Pending | —                            | —       |
| [ ]  | [Mutation and clearing semantics](baseline-decisions.md#mutation-and-clearing-semantics)       | 3–21 as applicable | Pending | —                            | —       |
| [ ]  | [Sessions](baseline-decisions.md#sessions)                                                     | 3–21 as applicable | Pending | —                            | —       |
| [ ]  | [Replication batch semantics](baseline-decisions.md#replication-batch-semantics)               | 3–21 as applicable | Pending | —                            | —       |
| [ ]  | [Installment boundaries](baseline-decisions.md#installment-boundaries)                         | 3–21 as applicable | Pending | —                            | —       |
| [ ]  | [Evidence and external dependencies](baseline-decisions.md#evidence-and-external-dependencies) | 3–21 as applicable | Pending | —                            | —       |

## Scope and delivery rules

- [ ] [Release scope and product defaults](../specs/functionality.md#11-release-scope): implement the aligned baseline, including anime/films/TV and bilingual surfaces; steps 3–21. Evidence: pending.
- [ ] [Categories and statuses](../specs/functionality.md#31-categories-and-statuses): preserve stable domain keys and distinct media format; steps 3 and 11. Evidence: pending.
- [ ] [Required defect resolutions](../specs/functionality.md#121-problems-in-the-source-and-required-resolutions): verify each listed problem through its mapped requirement; step 21. Evidence: pending.
- [ ] [Delivery and evidence](../specs/functionality.md#122-delivery-order): follow foundation-first sequencing and record actual implementation traceability; all steps. Evidence: pending.
- [ ] [Contributing](../specs/contributing.md): update affected specifications before each implementation change; all steps. Evidence: pending.

## Workspace infrastructure (step 2)

Infrastructure initially verified on 2 November 2026; test review and current suites verified on 3 November 2026 with Node 24.20.0, pnpm 12.16.1, Prisma 7.10.1, and PostgreSQL 17.11. CI has been configured but has not yet executed remotely. Infrastructure checks do not establish product acceptance or live provider availability.

| Done | Deliverable                    | Code                                                                                                                                                                                         | Verification evidence                                                                                                                                                                                                       | Status / blocker                                       |
| ---- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [x]  | Dependency boundaries          | [Checker](../scripts/check-boundaries.mjs), [negative cases](../tests/unit/boundaries.test.ts)                                                                                               | `pnpm check:boundaries`; 16 unit cases cover relative/alias server imports, re-exports, type imports, npm aliases, Node modules, environment access, and UI data dependencies                                               | Complete                                               |
| [x]  | Validated server configuration | [Validation](../apps/api/src/config/environment.ts), [bootstrap](../apps/api/src/main.ts), backend/client `.env.example` files                                                               | 19 configuration cases in [unit suite](../tests/unit/environment.test.ts); rejects invalid configuration without echoing values; disabled providers require no credentials                                                  | Complete; actual auth/provider features remain pending |
| [x]  | Test and Nx targets            | [Vitest](../vitest.config.ts), [Playwright](../playwright.config.ts), [Nx checks](../tools/checks/project.json)                                                                              | `pnpm test` (35 passed), `pnpm test:contracts` (1 passed), `pnpm test:e2e` (1 passed); Nx test target verified                                                                                                              | Complete; later product suites remain pending          |
| [x]  | Prisma/PostgreSQL foundation   | [Schema](../apps/api/prisma/schema.prisma), [migration](../apps/api/prisma/migrations/20261102000000_workspace_baseline/migration.sql), [client factory](../apps/api/src/database/client.ts) | `db:validate`, `db:generate`, `db:deploy`, `db:status`; [database tests](../tests/integration/database.test.ts) verify the committed migration marker through generated-client queries on an isolated PostgreSQL 17 cluster | Complete; domain schema remains step 4                 |
| [x]  | Reproducible setup and checks  | [README](../README.md), [Brewfile](../Brewfile), root/API package scripts and lockfile                                                                                                       | `pnpm install --frozen-lockfile`; `pnpm build` (6 targets); `pnpm typecheck` (7 targets); `pnpm typecheck:tools`                                                                                                            | Complete                                               |

The PostgreSQL test cluster used a temporary directory and port 55439; it was stopped after verification. The Homebrew PostgreSQL service was not started. No production database or live provider credentials were used.

### Test review — 3 November 2026

Applied the testing rule from AGENTS.md: retain checks of Filecab behavior and regression risks. Removed the generic Prisma transaction rollback test, which exercised third-party behavior without a Filecab operation. Kept the migration/client integration smoke check and real-workspace dependency contract. Removed the separate CI boundary command because the contract suite already invokes it. The standalone local command remains available.

Production configuration coverage now independently checks missing session/encryption secrets and HTTP-origin rejection from an otherwise valid production configuration. The redaction assertion checks that sensitive input is absent without depending on exact error formatting. Boundary negative cases and browser startup smoke coverage remain relevant. Application transaction rollback tests will accompany application mutation behavior in later steps.

## Shared domain contracts (step 3)

Verified locally on 3 November 2026. These are tested shared domain rules;
endpoint, database, UI and live-provider requirements remain unchecked until
integrated in their later delivery steps.

Shared contracts now expose typed models and domain helpers without runtime parsers
or client validation. Tests cover identity matching, semantic edits/no-ops, source
normalization, language fallback and metadata enrichment. Server DTO validation
remains in `apps/api`. Parser rejection tests were removed with the parser layer.

Persistence, transactional services, native RxDB adaptation and atomic backup restore
remain in their later implementation steps. Previous parser-specific verification
claims no longer apply.

### Scope simplification — 3 November 2026

Removed MIG-01–05 and old-format compatibility requirements. AC18 now verifies
current-format restore durability; AC23 verifies current-format validation.
Removed legacy payloads, tags retained only for old imports, inferred timestamps,
the `_filecab` extension and implicit request-locale defaults from contracts.
`Backup`/`BackupEntry` describe only portable current data; server versions/deletion
state are excluded and timestamps remain required model fields.
Current-format backup UI/application remains pending in step 17. Database/RxDB
schema migrations and live external-list synchronization remain in scope.

## Transactional persistence (step 4)

Verified locally on 4 November 2026 against an isolated PostgreSQL 17 cluster on port 55434. No development or production database was changed. CI execution remains pending.

- [Schema](../apps/api/prisma/schema.prisma) and [migration](../apps/api/prisma/migrations/20261104000000_library_transactions/migration.sql) add users, hashed-credential session storage, catalog identities/references/translations, genres/mappings, owner entries, ordered active source claims and retained change documents/tombstones. Active catalog uniqueness uses a partial SQL index. Source uniqueness uses a database-checked SHA-256 key to support long valid URLs without oversized index keys.
- [Mutation service](../apps/api/src/library/mutation.service.ts) serializes owner writes with a library-row lock held through commit. Create/update/delete/restore, source reassignment and explicit merges use one transaction for documents, claims, bigint revisions and full change-feed documents. Global entry IDs cannot be reused or overwritten by another owner. No-op updates preserve version/time, and user edits retain creation time and nondecreasing modification time.
- [Integration tests](../tests/integration/library-mutations.test.ts) cover owner isolation, no-op edits, same-entry update races, concurrent source/catalog/entry-ID duplicates, atomic source movement, restore conflicts, exact delete/restore data, explicit merge identity and tombstones, rollback after a tombstone was written, owner-lock blocking, cursor precision beyond 2^53 and long source URLs.
- Shared server imports use generated contract declarations; Nx builds dependencies before typechecking. Server validation uses the shared enum types with class-validator/class-transformer. The tools compiler enables server decorators for integration-test imports.

Verification: fresh migration deployment, Prisma schema validation/client generation, 38 unit tests, 12 contract tests, 10 PostgreSQL integration tests (including the baseline migration check), all workspace typecheck/build targets, ESLint/Prettier checks and one Chromium startup smoke test pass locally. The temporary PostgreSQL cluster was stopped after verification.

This establishes the storage and internal mutation boundary only. Authentication/session lifecycle, controllers/OpenAPI, replication transport/retention cleanup, catalog provider operations, merge previews and import/backup orchestration remain in their planned steps. Create inputs are internal typed models; HTTP create/snapshot validation belongs with the later API endpoints. Broad product requirement rows remain unchecked until their complete workflows are delivered.

### Account/library separation — 4 November 2026

`User` owns account identity and sessions; its one-to-one `UserLibrary` owns the revision, entry relations and change history. Mutations lock and increment `UserLibrary` only. The additive [migration](../apps/api/prisma/migrations/20261104010000_separate_user_library/migration.sql) backfills libraries and preserves revisions before redirecting foreign keys and removing `User.revision`. Account creation uses nested library creation in one transaction.

Verified an upgrade with existing entry/history data and a revision above 2^53, plus all 12 PostgreSQL integration tests. Regression coverage checks independent account/library locking and cascading account deletion. Existing duplicate, version, rollback and ordering tests now use the library row.

## API foundation and OpenAPI (step 5)

Verified locally on 4 November 2026. Authentication and owner-library HTTP endpoints remain steps 6–7. No live-provider or production deployment claims are made.

- [Application configuration](../apps/api/src/http/application.ts) mounts `/api/v1`, exact-origin credentialed CORS, a 1 MiB JSON parser, cookie Origin/custom-header CSRF checks and production loopback-proxy HTTPS enforcement. Swagger UI `/api/docs` and JSON `/api/docs-json` exist outside production only; YAML is disabled. Production returns no documentation assets. The document declares bearer/cookie schemes, anonymous access, errors, correlation headers and clearing/CSRF conventions.
- [Error boundary](../apps/api/src/http/api-error.ts) normalizes middleware, parser, validation, domain and unexpected exceptions into safe shared error envelopes with status, correlation UUID and retryability. Framework logging is disabled; diagnostics allowlist only correlation ID, method, status and elapsed time. Configuration startup failures identify invalid fields without their values; unexpected failures use a generic message. Paths, credentials, private input and exception messages are omitted.
- [Validation pipeline](../apps/api/src/http/validation.ts) uses class-validator/class-transformer with no coercion, unknown-field rejection, reserved-key checks before transformation and a 32-level nesting limit. Production controllers are currently health endpoints with an empty query allowlist; test-only routes prove DTO bounds and unsafe-request behavior without introducing public mutations.
- [Health controller](../apps/api/src/health/health.controller.ts) exposes anonymous provider-independent liveness and [bounded PostgreSQL readiness](../apps/api/src/health/readiness.ts). Database access is lazy and disconnected during application shutdown. Failures return generic retryable 503 responses.
- [HTTP tests](../apps/api/src/http/application.unit.test.ts) cover invalid request shapes, unknown/reserved fields, nesting, numeric bounds/coercion/null, malformed/oversized/unsupported bodies, CORS/preflight, cookie CSRF with bearer credentials present, redaction/correlation, Swagger schemas and production protection. [Readiness integration](../apps/api/src/health/readiness.integration.test.ts) exercises the real PostgreSQL probe over HTTP.
- [Setup documentation](../README.md#api-foundation) explains routes, origin setup, request policy, trusted HTTPS termination and logging. The synthetic environment file leaves extension origins empty until an exact extension ID is configured. Swagger's Scarf telemetry installation script is explicitly disabled in pnpm's build policy.

Verification: frozen offline install; 50 unit tests, 12 contract tests and 13 PostgreSQL integration tests; all workspace typecheck/build targets; ESLint/Prettier; one Chromium smoke test. A separate Node run of compiled API code confirmed readiness against PostgreSQL 17 and exactly two documented health routes. The isolated PostgreSQL cluster on port 55434 was stopped afterward. GitHub CI execution remains pending.

Subsequent routes must deliver their DTO/OpenAPI schemas, nullable-field semantics and authentication declarations together. Actual sessions, Secure/HttpOnly cookie issuance, OAuth validation and authenticated owner access remain in step 6; entry endpoints and merge previews remain in step 7. No frontend or provider capability is marked delivered by these foundation checks.

### Startup configuration diagnostics — 5 November 2026

Introduced a typed environment-validation error so startup can report invalid field names and extension-origin guidance while continuing to suppress arbitrary exception details. Regression tests cover safe guidance and suppression of untrusted exception messages. Verified 21 configuration tests, API typecheck, formatting/lint, and a real `pnpm dev:api` startup with HTTP 200 liveness. Local database readiness remained HTTP 503, indicating a separate PostgreSQL connectivity/configuration issue; database credentials were not changed.

## Google authentication and account isolation (step 6)

Implemented 5–6 November 2026. Automated behavior is verified; completed live Google consent/code exchange and real Chrome identity-window login remain manual verification items. No production server was modified or deployment performed.

- [Google adapter](../apps/api/src/auth/google.ts) constructs authorization URLs with state, nonce and S256 PKCE; fixed HTTPS token/JWKS endpoints have five-second and 64 KiB response bounds. `jose` verifies RS256 signatures, issuer/audience, required time claims, nonce, subject and authorized party, including multiple-audience handling. Google credentials remain server-side and Google tokens are neither persisted nor returned to clients.
- [Authentication service](../apps/api/src/auth/auth.service.ts), [guard](../apps/api/src/auth/auth.guard.ts) and [migration](../apps/api/prisma/migrations/20261105000000_google_authentication/migration.sql) persist browser-bound single-use attempts, verifier/attempt-bound exchange codes, opaque access/refresh hashes and consumed refresh history. Verified Google subjects create independent accounts/libraries atomically. Refresh/revocation serialize on the account row, independently of library writes; replay revocation commits before returning an error. Existing infrastructure-era sessions require a fresh login after migration.
- [Controllers](../apps/api/src/auth/auth.controller.ts) and [DTOs](../apps/api/src/auth/auth.dto.ts) provide seven versioned login/session endpoints with OpenAPI schemas, allowlists, account-derived ownership, CSRF controls and safe cookie/bearer separation. Production uses Secure HttpOnly `__Host-` cookies with Path=/ and no Domain; HTTP development uses unprefixed HttpOnly cookies. Only extension exchange/refresh JSON contains reusable credentials.
- [Website session adapter](../apps/web/src/auth/session.ts) serializes cookie refresh, uses Web Locks across tabs and clears private queries/mutations when account identity changes. The observed account query is reset to null on sign-out so mounted controls in other tabs update immediately. No credentials are stored in browser JavaScript storage.
- [Extension worker](../apps/extension/src/auth/worker.ts) owns `identity.launchWebAuthFlow`, trusted-only local/session credential storage, serialized refresh and callback binding. It rejects content-script senders and returns only account state to popup/full-page controls. Refresh state is removed before network consumption so suspension or uncertain responses cannot replay a consumed credential. Identity/storage permissions and API host access are declared; live Chrome consent remains unverified.
- [Signed-token/provider tests](../apps/api/src/auth/google.unit.test.ts), [HTTP/PostgreSQL tests](../apps/api/src/auth/auth.integration.test.ts), website/worker unit suites and [browser regression](../tests/e2e/website.spec.ts) cover signature/claim rejection, bounded provider failures, destination/state/exchange security, rotation/replay races, all expiry limits, subject identity races, logout/account isolation, production cookies, DTO/OpenAPI parity, worker trust boundaries and cross-tab sign-out.

Local development PostgreSQL 17 was started using the documented Homebrew command. A separate `filecab_dev` role/database was created, all migrations applied and a generated database password saved only in the external private `api.env` (permissions 600). Existing OAuth settings and session/encryption keys were preserved. The compiled API reported HTTP 200 readiness, seven documented auth routes and an HttpOnly browser-binding cookie. Its configured authorization request reached Google’s `/v3/signin/identifier` with HTTP 200 rather than an OAuth error. This establishes the authorization entry only; it does not verify the OAuth client secret or a completed Google code exchange.

Verification: frozen offline install; 77 unit tests, 12 contract tests, 25 PostgreSQL integration tests and two Chromium tests; workspace typecheck/build targets, schema validation and ESLint/Prettier checks. The isolated test PostgreSQL cluster on port 55434 was stopped after final checks; the development service on port 5432 remains available. GitHub CI execution is pending.

Manual follow-up: run `pnpm dev`, open `http://127.0.0.1:5173/`, choose **Sign in with Google** and complete consent. Check **Sign out** and **Sign out all sessions**. For extension login, first allowlist its actual Chrome extension ID in the private API config, then use its popup/full-page sign-in controls. Public/private library endpoints, guest adoption, durable offline library data and replication remain in steps 7–9. Broad auth capability checklist rows remain unchecked until the manual live-provider/client verification is recorded.

### Extension login diagnosis — 6 November 2026

Found an empty extension-origin allowlist in the private local API configuration and added the user-supplied installed extension ID there. The running Nx API initially retained the previous inherited environment, so a full API command restart is required. No credential values were printed or added to Git.

Added anonymous, bounded `/api/v1/auth/extension/config` and a privileged worker preflight that reports disabled Google login or missing origin configuration before opening the browser flow. Replaced the blanket error with static stage/code guidance, safe HTTP status/correlation metadata and public connection details. Removed raw exception logging from the extension UI. Sender checks now allow popup/full-page query/fragment variants without accepting foreign or content-script contexts. Missing worker replies remain recoverable.

Regression coverage includes safe preflight failure without credential loss, exchange error redaction/correlation and trusted debug senders. The Chromium extension test loads the actual unpacked build in an isolated persistent browser context, exercises native worker messaging/storage, displays a real preflight error and completes an externally mocked login. The test uses no real Google credentials and is not recorded as live Google consent verification. `test:e2e` now builds the extension before running browser tests. See the [debugging guide](../apps/extension/README.md#debugging-sign-in).

Final extension-debug checks: 81 unit tests, 12 contract tests, three Chromium tests, all workspace typecheck/build targets and ESLint/Prettier pass. A fresh compiled API loaded the private config and returned HTTP 200 with `googleEnabled=true` and `extensionAllowed=true` for the supplied ID. The pre-existing Nx process still reported the previous allowlist until a full API restart; it was not force-terminated.

### Live extension sign-in confirmation — 6 November 2026

After the installed extension origin was added to the private API configuration, the user confirmed that extension authentication works. This records a real user-observed Chrome/Google login, separately from mocked Chromium tests. Separate live website consent and session-control verification remains pending.

## Owner library API and complete snapshots (step 7)

Implemented and verified locally on 6 November 2026. No deployment or production database changes were performed.

- [Library controller](../apps/api/src/library/library.controller.ts) exposes authenticated create/read/update/delete/restore, complete snapshots, explicit merge previews/apply and source-reassignment previews/apply. Owner identity comes from the session. DTOs reject unknown fields, owner/server metadata, query parameters and invalid versions; catalog snapshots come from server storage. Manual entries require a nonblank title and work with catalog providers disabled.
- [Mutation service](../apps/api/src/library/mutation.service.ts) keeps all writes on the shared owner-lock/version/change-feed boundary. Snapshot reads use a repeatable-read transaction so their revision and documents describe one committed state; hidden entries are included, tombstones excluded, and no display pagination/filter/sort is accepted. No-op edits preserve revision/time; clear operations preserve explicit null/zero/empty values.
- [Preview signer](../apps/api/src/library/preview.ts) issues five-minute HMAC confirmations bound to owner, operation, choices and both versioned documents. Verification occurs inside the mutation transaction. Previewing makes no persistent changes; stale, tampered, expired, cross-owner and replayed confirmations fail. Unrelated entry edits do not invalidate a preview. Merges preserve the selected survivor UUID, union ordered sources without truncation and publish the removed UUID as a tombstone. Source transfers publish both documents atomically.
- [HTTP integration tests](../apps/api/src/library/library.integration.test.ts) cover manual CRUD/clearing/no-op behavior, owner isolation, allowlists, concurrent version conflicts, restore rollback, merge/source confirmations, server-controlled catalog snapshots and OpenAPI schemas. A deterministic concurrent-write test pauses snapshot reading between revision/document queries and proves a consistent result. [Signer tests](../apps/api/src/library/preview.unit.test.ts) cover expiry, operation/owner binding, canonical choices and noncanonical signature rejection.
- [API documentation](../README.md#owner-library-api) lists routes and create/version/clearing/preview conventions. OpenAPI includes cookie/bearer authentication, required fields, nullable metadata and decimal-string versions. Shared contracts contain typed request/result models without runtime parsers. No schema migration was required.

Verification: 82 unit tests, 12 contract tests, 33 PostgreSQL integration tests, three Chromium tests, all six build targets and all ten workspace typecheck targets passed. The final eight library HTTP tests and workspace typechecks were rerun after the final test edits. ESLint/Prettier checks passed, including the requested blank line after complete `if` statements. A separate compiled API smoke test used cookie authentication against the development database to create a synthetic hidden manual entry and retrieve its consistent snapshot, then removed its fixture account/data. Google responses in this smoke test and automated suites were synthetic; no live-provider behavior is claimed from them. GitHub CI execution remains pending.

The isolated test PostgreSQL cluster on port 55434 is stopped after verification; the development service on port 5432 remains available. Client offline persistence, replication transport/retention cleanup, library editing/Undo interfaces, provider catalog fetching and backup/import orchestration remain in their planned later steps. Broad product checklist rows remain unchecked until complete user workflows are delivered.

## Extension offline persistence (step 8)

Implemented and verified locally on 6 November 2026. No production services or databases were changed.

- [Storage connection manager](../apps/extension/src/library/database.ts) opens RxDB 17.6.0 with the free Dexie adapter, multi-instance events and the migration-schema plugin. Version zero is the first local format, with an explicit empty strategy map; future upgrades must preserve existing data with versioned migration tests. The fixed `filecab-local` database stores one device-local library independent of the authenticated account. Reference-counted per-page connections handle React StrictMode and overlapping reopen/close safely.
- [Repository](../apps/extension/src/library/repository.ts) uses origin-scoped Web Locks for reads/writes. Locked reads query committed storage directly, avoiding cross-page broadcast/query-cache delays. Each one-entry write commits its data, next safe-integer revision, millisecond update time and optional Undo state in one document. Snapshot revisions include retained tombstones; no separate counter transaction or mutation outbox exists. Expected local revisions reject stale edits; catalog/source claims are checked under the lock. No-ops retain revision/time and explicit clearing retains null/zero/empty values.
- [Storage schemas](../apps/extension/src/library/entry.schema.json) retain full typed entries, metadata snapshots, ordered sources and tombstones. A separate settings collection stores category/mode preferences with expected revisions. [Build-time generation](../apps/extension/scripts/build-storage-validators.mjs) compiles full RxDB schemas to standalone AJV validators and converts their helper references to bundled ES modules. The extension uses RxDB's storage-validation wrapper without runtime code generation; shared contracts remain typed models without client request parsers. Reads check the same schemas before exposing stored data.
- [Local UI](../apps/extension/src/library/local-library/local-library.tsx) provides basic manual create/edit/delete/Undo in popup and full page. Success follows persistence; stale/failed saves keep unsaved input, and stale editing offers an explicit Reload entry. Deletion persists a ten-second deadline and previous entry; Undo checks the deletion revision/deadline, restores exact entry data/timestamps and rejects newly conflicting claims. Sign-in/sign-out keep the same library and open editor visible; authentication does not select local storage or upload entries. Future replication requires explicit account linking.
- [Recovery reader](../apps/extension/src/library/recovery.ts) exports readable raw IndexedDB stores and safe per-store errors without opening a replacement store. Open/read/schema failures show recovery with Retry/raw export, never an empty-library success state. Recovery export is separate from current-format portable backup/import.
- [Chromium storage tests](../tests/e2e/extension-storage.spec.ts) load the actual production extension in isolated persistent profiles. They verify offline popup/full-page edits, simultaneous creates and different-entry edits with unique revisions, stale input/reload, injected IndexedDB quota failure, exact clearing/no-op/Undo, Undo expiry and claim-conflict rollback, settings scope/revision/durability, shared device storage across authentication changes and direct raw export after deliberate on-disk schema corruption. Chrome's serviceworker-internals reports STOPPED both before and after successful local delete/Undo. Browser restart retains entries, sources, exact notes, the device library and settings. The test-only repository bundle is created during testing and removed afterward.
- [Auth browser regression](../tests/e2e/extension-auth.spec.ts) verifies that real worker messaging/storage leaves saved entries and unsaved editor input unchanged through mocked login/sign-out. Google/API responses remain mocked in these tests; no new live-provider claim is made.

Verification: 82 unit tests, 12 contract tests, six Chromium tests, all six build targets and all ten workspace typecheck targets pass. ESLint/Prettier and diff-whitespace checks pass. Schema validators are generated by extension build/dev/prepare/typecheck commands and are excluded from Git, with a checked-in declaration for independent tools typechecking. No API/schema migration changes were needed; PostgreSQL integration tests were not rerun for this client-only step. GitHub CI execution remains pending.

This delivers extension-local persistence and a basic manual editor. Server replication, rejected-intent handling, guest adoption, tombstone retention/reset policy, offline backup replacement, shared UI/localization and full library filtering/navigation remain in their planned steps. The website continues to use online API state without durable offline library storage.

### Fixed extension database — 6 November 2026

At the user's request, extension authentication no longer changes local libraries. The repository has one fixed `filecab-local` database and no account parameter; its entries, revisions, category/mode preferences and unsaved editor remain visible across login/logout. Replication/linking remains a separate explicit action in step 9, with account-bound state to prevent accidental cross-account submission.

The preceding scoped preview storage was never used, as confirmed by the user. Compatibility copying, its completion marker, old-name recovery scanning and its migration-only regression test were removed. The auth Chromium test verifies entries remain visible after sign-in and unsaved comment input remains intact on sign-out. Supported storage schema migrations remain required for future versions.

## Replication server foundation (step 9, initial delivery)

Initial server delivery on 6 November 2026. Client completion and final verification are recorded below.

- [Replication controller](../apps/api/src/library/replication.controller.ts) exposes authenticated, owner-scoped `/api/v1/replication/pull` and `/api/v1/replication/push`. [Request DTOs](../apps/api/src/library/replication.dto.ts) use class-validator/class-transformer, bound batch sizes and reject unknown transport fields and duplicate row IDs. OpenAPI documents request/result models, authentication, partial commits, conflicts and reset errors.
- [Common mutation service](../apps/api/src/library/mutation.service.ts) serializes each replicated write through the existing owner lock and source/catalog constraints, publishes its complete document to the same transactional feed, and assigns server versions/timestamps. Equivalent retries are no-ops. Stale assumed versions retain the current document; foreign UUID collisions return a conflict without exposing foreign data. Metadata must match authoritative snapshots and sources must match the server normalization policy.
- Pull reads revision/history in a RepeatableRead snapshot, consumes contiguous bigint revisions in order, collapses repeated entry IDs within a batch, includes tombstones and reports `hasMore`. Future checkpoints or missing history return `SYNC_RESET_REQUIRED`. History and tombstones are retained indefinitely; no pruning job was introduced.
- Five new [HTTP integration tests](../apps/api/src/library/library.integration.test.ts) cover retry-safe create/update/delete, restore, stale intent, cross-account UUID collisions, metadata injection, source claims, deterministic pull pages and duplicate collapse, missing history, mixed-row validation/commits, concurrent writes and generated OpenAPI routes.

Verification: all 82 unit tests, 12 contract tests and 38 PostgreSQL integration tests passed. API typecheck/build, boundary checks and repository ESLint/Prettier checks passed. Integration tests used a newly initialized PostgreSQL 17 cluster on port 55439 with all four migrations applied; it was stopped after verification. No production or development data was modified.

At the server-only delivery, the following remained pending: the installed RxDB client adapter and metadata, durable rejected-intent recovery/reapplication, synchronization triggers/status, explicit account-bound linking/adoption previews, account switching and pending-intent isolation, and fresh-snapshot reset reconciliation that prevents resurrection. No extension synchronization is enabled by this server-only delivery; no browser replication verification is claimed.

## Extension-to-Filecab replication (step 9)

Delivered and verified locally on 6 November 2026. No production or development
database was modified; Google consent verification remains the separate step 6
record. The preceding server-only status is superseded by this delivery.

- [Native adapter](../apps/extension/src/library/replication.ts) replicates the existing entry wrappers using RxDB 17.6.0's native checkpoints/assumed master metadata. Only typed entry data crosses transport. It consumes collapsed server pages until RxDB's batch contract is satisfied, maps retained application tombstones, skips uncommitted local tombstones and checks the persisted pull position before each upload. Replication identity includes API origin, owner, schema and generation. No second mutation queue was added.
- [Worker bridge](../apps/extension/src/auth/worker.ts) allows only fixed snapshot/pull/push operations from trusted UI pages, serializes them with login/refresh/logout and checks captured owner identity against the current credential. It returns safe errors/data without credentials. Unit and real Chrome tests verify sender restrictions, prototype-name route rejection, account mismatch and logout handling.
- [Link/reset session](../apps/extension/src/library/sync-session.ts) binds confirmation to owner, local content digest and current server revision. Cancellation makes no writes. The fixed device library remains bound to one account across logout/switches, preventing another account from receiving pending changes. A shared Web Lock drains in-flight replication before reset; all local intent is durably recorded before entry replacement. Interrupted/quota-failed recovery remains paused. Missing server entries become uncommitted local tombstones, and a new generation resumes from the fresh snapshot's revision.
- [Conflict handler/recovery log](../apps/extension/src/library/sync-recovery.ts) durably preserves differing editable/deletion intent before selecting master state. Absent-master source/identity conflicts produce retained local tombstones with the original proposal saved. Content-derived issue IDs deduplicate retries. [Repository reapplication](../apps/extension/src/library/repository.ts) checks current local revision, binding and identity/claims before deliberately applying saved user fields. A failed log write prevents overwrite. Server-assigned creation/version metadata is preserved during Undo.
- [Controls](../apps/extension/src/library/sync-controls/sync-controls.tsx) provide preview/confirmation/cancel, truthful active/failure/suspended states, cross-surface manual refresh, durable conflict review/reapply/dismiss and explicit history recovery. One Web Lock selects a syncing surface; open/edit/reconnect and a 30-second open-surface timer trigger synchronization. Authentication changes do not remount or clear the local editor. New binding/issue collections use standalone CSP-compatible validators; existing entry/settings schemas remain version zero without destructive migration.
- [Chromium protocol tests](../tests/e2e/extension-storage.spec.ts) prove explicit/stale-preview adoption, native metadata/browser restart, lost-response retry safety, delete/Undo, server-wins recovery and deliberate reapplication, gap reset before uploads, quota failure before replacement, restartable reset, collapsed feed continuation and missing-master conflict recovery. [Production UI tests](../tests/e2e/extension-auth.spec.ts) verify cancellation/confirmation, multi-surface visibility, preserved drafts and account-switch suspension through the actual worker bridge with HTTP fixtures.
- [Full-stack test](../tests/replication/extension.test.ts), run with `pnpm test:replication`, loads the production unpacked extension and uses real Chrome worker messaging, credential checks, HTTP guards/DTOs, mutation transactions, PostgreSQL and native RxDB replication. It verifies adoption, offline/server concurrent edits, durable rejection/reapplication and replicated delete/Undo. Only Google identity is synthetic, and the worker's API port is redirected to an isolated test application. CI runs this check after installing Chromium.

Verification: 83 unit tests, 12 contract tests, 38 PostgreSQL integration tests,
10 Chromium E2E tests and one real-extension/API/PostgreSQL replication test pass.
All ten workspace typecheck targets, all six build targets, boundary checks,
ESLint/Prettier and diff-whitespace checks pass. PostgreSQL used the isolated test
cluster on port 55439; it was stopped after verification. GitHub CI execution
remains pending.

Operational bounds: synchronization requires an open library surface; MV3 worker
suspension does not discard native pending state. History/tombstones are retained
indefinitely (exceeding 90 days); no pruning job is enabled. The device library has
one durable owner binding and no detach/rebind UI. Shared bilingual UI/navigation,
full catalog interfaces, backup/import and external provider synchronization
remain in steps 10–20. Broad product checklist rows remain open where later
workflows are still required.

### Sync failure reporting correction — 6 November 2026

A user reported the generic synchronization failure message. The running local
API's liveness/readiness endpoints and both replication routes were verified;
the underlying error in the user's Chrome session has not yet been identified.
The adapter was overwriting specific transport failures with a generic failure
when RxDB emitted its wrapped error event. Worker HTTP error responses also lost
their status when they contained non-JSON bodies.

The extension now preserves allowlisted code/operation/status/request UUID through
RxDB's error serialization using a bounded safe diagnostic envelope, displays the
specific cause, and logs only safe metadata. Messaging, forbidden origin, missing
API routes, invalid documents, body limits, server availability and malformed JSON
responses remain distinct. Raw native errors, payloads and credentials are never
logged. The rebuilt extension needs to be reloaded to obtain the actual diagnostic
for the reported session; no claim of fixing that unknown underlying cause is made.

Verification: 94 unit tests, extension build/typecheck, tools typecheck and
ESLint/Prettier pass. Two production Chrome worker/UI tests pass; the replication
test injects an HTTP 403 text response and verifies that `FORBIDDEN`, HTTP status,
request UUID and specific explanation survive the real native RxDB error event,
while private response text never reaches the UI.

### Shared enum organization — 7 November 2026

Shared domain enums now each have a dedicated contracts module and remain
re-exported through the existing package entry point. `ApiErrorCode` owns API
failures including `SYNC_RESET_REQUIRED`; `SyncErrorCode` owns client-specific
synchronization failures and `SyncOperation` owns bridge operation names.
`SyncDiagnostic` is a shared typed model. Server exceptions/DTO metadata, worker
responses, replication handling and UI message keys reference enum members.
Diagnostic allowlists derive from enum values. All wire values are preserved;
no storage schema, request parser, dependency or database migration was added.

Verification: 94 unit tests, 12 contract tests, 38 PostgreSQL integration tests and
10 Chromium E2E tests pass, as do all builds/typechecks, boundary checks and
ESLint/Prettier. Existing wire-format assertions verify unchanged serialized
codes. PostgreSQL verification uses only the isolated test cluster on port 55439.

## Shared UI, localization, and navigation (step 10)

Delivered and verified locally on 7 November 2026. The shared shell uses the
[light](../specs/mockup-white.png) and [dark](../specs/mockup-dark.png) mockups for
navigation, surface colors, typography and focus styling. Full card layouts and
browsing controls remain in step 11; no fixture titles are shown in production.

- `packages/ui` wraps Base UI buttons and modal dialogs; shared SCSS variables
  support light/dark surfaces and focus states. Responsive rules remain inside
  their selectors. Base UI supplies modal keyboard handling and focus restoration.
- `packages/library` owns the shell, category/mode route fallback, interface
  messages, English fallback and locale-aware plural/number formatting. Shared
  packages import neither WXT nor client persistence/authentication libraries.
- Client adapters store only interface preferences: extension storage with a
  cross-surface write lock, and website localStorage with cross-tab notifications.
  Explicit locale/theme choices persist independently of library replacement,
  login and replication. Initial locale uses supported browser-language priority.
- Website, popup and full extension page use the same shell. Extension editing,
  account controls and replication messages are translated without remounting
  editors. Dirty navigation offers Save, Discard and Continue editing; failed
  saves retain input and block navigation. Browser closure uses beforeunload.
- Website navigation retains URL query parameters; unknown routes fall back to
  Anime Library. Catalog and page-detection routes explain current unavailability
  rather than presenting fake search results. Extension metadata includes en/ru.
- Chromium tests cover locale/theme propagation and persistence, browser-locale
  initialization, category filtering, draft retention across locale changes,
  Save/Discard/Continue, browser Back with unsaved input, Escape/focus restoration, responsive width and simulated
  200% zoom. Existing offline/restart, authentication and replication tests remain
  passing. Unit tests cover language priority, Russian plurals 1/2/5/11/21 and
  unsupported routes.

Verification: 97 unit tests, 12 contract tests and 13 Chromium E2E tests pass;
all workspace typechecks/builds, boundary checks and ESLint/Prettier pass.
No database or provider changes were made. Catalog/search/page extraction and
website library data adapters remain in their planned later steps. Broad product
rows stay open when later workflows are required; CI execution remains pending.

### Mockup fidelity correction — 7 November 2026

The initial step 10 shell did not implement the supplied mockup's library layout.
This correction replaces the generic navigation/button treatment with flat
category/status tabs, icon navigation, a fixed desktop sidebar, bottom language
selection, and a compact popup header with Page/Search tabs and header actions.
The current Filecab PNG is used unchanged: the extension loads its packaged
`wish-list-icon.png`; the shared UI asset is byte-identical and supplies the
website brand and favicon. Light/dark production browser screenshots were
reviewed against both mockups.

The extension now renders real local entries through shared `LibraryBrowser`
poster cards with status, year, personal rating, unknown-total handling and
progress. The toolbar searches available titles/private notes, filters status,
rating and genre, sorts entries, switches grid/list layout and paginates twelve
entries per page. Hidden entries stay excluded until explicitly selected. Missing
or broken posters use a neutral placeholder. Existing Edit/Delete/Undo,
replication controls and draft guards remain available; storage/account details
are placed below library content rather than above the header.

The website uses an online, account-scoped TanStack Query snapshot adapter and
the same browser presentation. Unauthenticated, loading and failed requests are
not displayed as a successful empty library; failed snapshots have Retry.
Snapshot requests are abortable and private queries remain subject to the
existing account cache clearing. No library data is written to localStorage.
Website editing, complete filter semantics/preferences/conflict workflows and
live popup page detection remain in later implementation steps; the correction
does not claim those capabilities or complete step 11.

Verification: 97 unit tests, 12 contract tests, 16 Chromium E2E tests, all workspace
typechecks/builds, boundaries and formatting pass. Chromium coverage includes the shared layout,
snapshot filtering/pagination, poster failure, current icon loading in the real
extension, and failed snapshot Retry, alongside existing offline/account/replication
and draft preservation tests. Visual screenshots use synthetic data only in tests;
production receives only saved local or authenticated server entries.

### Settings mockup and supplied SVG icons — 7 November 2026

The new [Settings reference](../specs/mockup-settings.png) is linked from the spec
index. Shared Settings now renders Account, Sync and Appearance sections, with
bordered desktop cards and compact popup sections. Popup Settings has a dedicated
Back/Settings header and preserves the previous route; the desktop keeps its
sidebar. Light/Dark segmented buttons retain persisted preference propagation,
and language selection remains available. Account controls keep their original
client adapters, logout/all-session behavior and safe diagnostics; available
account contracts supply only signed-in state, so no example name/email/avatar
is presented as real profile data.

The extension uses all interface SVGs from its supplied public icons directory.
Shared website copies of all 23 SVGs match the originals byte for byte. CSS masks
preserve the supplied shapes and inherit light/dark foreground colors; navigation,
rating, language, Back, refresh and theme controls no longer redraw those icons.
Extension asset roots are supplied by the client rather than imported into shared
packages. The existing PNG brand is preserved.

Settings Sync now calls the active extension replication surface through the
existing refresh channel. It is unavailable for signed-out, unlinked, mismatched
or recovery-paused account bindings. Last-success time is populated only after an
observed successful replication and cleared across account/generation changes;
there is no fabricated default time. The website action refetches the online
snapshot and labels its timestamp as a library refresh. Failed snapshot state is
reported in Settings as well as Library. The shared UI has no RxDB, WXT or query
library dependency.

Verification: 97 unit tests and 12 contract tests pass; all workspace builds and
typechecks, formatting and boundary checks pass. All 16 Chromium E2E tests pass,
with added Settings assertions for disabled guest sync, Back navigation, SVG
asset loading, theme propagation, actual bound-account replication refresh and
website snapshot refresh. Light/dark popup, desktop and linked-account Settings
screenshots were inspected against the new mockup. Existing offline, recovery,
account-switch, draft and browser-restart checks remain passing.

### Popup Page default and route scope correction — 7 November 2026

The popup now contains only Page, Search and Settings. It opens on Page unless an
explicit valid popup URL selects Search or Settings; saved full-page/older popup
modes do not change that default. Legacy Library and invalid popup hashes are
normalized to Page. The library header action and browser/editor component were
removed from the popup; the external-link action opens the full extension page.
Popup navigation no longer overwrites full-page mode preferences.

A headless device-sync component keeps native replication and Settings sync state
active while the popup is open, without mounting library browsing UI. Library
CRUD/concurrency tests now use full-page tabs; popup authentication, Settings,
locale/theme propagation and asset checks remain exercised in the real popup.
Regression coverage checks saved Library/Search/Settings modes, legacy popup
Library URLs, absence of library UI/actions and preservation of full-page mode.
