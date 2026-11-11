# Specifications

Read the relevant owner document; linked details inherit its rules. Requirements
describe target behavior, not implementation status.

## Start here

| Document                              | Owns                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------- |
| [Functionality](functionality.md)     | Release scope, user behavior, stable requirement IDs and acceptance cases |
| [Stack](stack.md)                     | Technology choices only                                                   |
| [Conventions](conventions.md)         | Architecture, package boundaries and implementation patterns              |
| [Contributing](contributing.md)       | Workflow, code rules, formatting and specification format                 |
| [Domain contract](domain-contract.md) | Shared models, identities, serialization and clearing semantics           |

## Feature specifications

| Document                                           | Owns                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| [Backend](backend.md)                              | Private APIs, sessions, replication, sharing and parser configuration |
| [Catalog](catalog-spec.md)                         | Shared discovery/metadata behavior and pagination                     |
| [External list sync](user-list-sync-spec.md)       | Common reconciliation, jobs, privacy and removal policy               |
| [Kinopoisk Dev](integration-kinopoisk-spec.md)     | Film/TV catalog adapter differences                                   |
| [Smotret Anime](integration-smotret-anime-spec.md) | Anime catalog adapter differences                                     |
| [Shikimori](integration-shikimori-spec.md)         | Personal-list adapter, OAuth and field mapping                        |

## Decisions, delivery and ideas

- [Baseline decisions](../implementation/baseline-decisions.md) and [backend design](../implementation/backend-decisions.md): detailed technical contracts.
- [Implementation plan](../implementation/implementation-plan.md) and [checklist](../implementation/requirement-checklist.md): delivery order and evidence.
- [Plans](plans.md): optional improvements and pointers to baseline follow-ups.

## Mockups

[Dark layout](mockup-dark.png) · [Light colors](mockup-white.png) · [Settings](mockup-settings.png)

Use the supplied [SVG icons](../apps/extension/public/icons) and
[Filecab logo](../apps/extension/public/wish-list-icon.png).
