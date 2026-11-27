# Specifications

Read the document that owns the topic. Linked details follow its rules. Requirements
describe target behavior, not implementation status.

## Start here

| Document                              | Owns                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------- |
| [Functionality](functionality.md)     | Release scope, user behavior, requirement IDs and acceptance scenarios |
| [Stack](stack.md)                     | Technology choices                                                     |
| [Conventions](conventions.md)         | Architecture, package boundaries and implementation patterns           |
| [Contributing](contributing.md)       | Workflow, code rules, formatting and spec format                       |
| [Domain contract](domain-contract.md) | Shared models, identities, normalization, clearing and serialization   |

## Feature specifications

| Document                                           | Owns                                                                                     |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [Backend](backend.md)                              | Sessions, library API, replication server, public library, parser config, API foundation |
| [Extension storage](extension-storage.md)          | Device persistence, recovery and client replication                                      |
| [Library UI](library-ui.md)                        | Library and catalog screens, cards, ordering and loading                                 |
| [Catalog](catalog-spec.md)                         | Provider-independent discovery, metadata, genres and cache                               |
| [Library import](library-import.md)                | CSV import of entries of any category, format and duplicates                             |
| [External list sync](user-list-sync-spec.md)       | Manual export and import, jobs, privacy and deletion rules                               |
| [Kinopoisk Dev](integration-kinopoisk-spec.md)     | Film and TV catalog adapter                                                              |
| [Smotret Anime](integration-smotret-anime-spec.md) | Anime catalog adapter                                                                    |
| [Shikimori](integration-shikimori-spec.md)         | Personal-list adapter, OAuth and field mapping                                           |

## Delivery and ideas

- [Implementation plan](../implementation/implementation-plan.md): delivery order.
- [Requirement checklist](../implementation/requirement-checklist.md): status and evidence.
- [Plans](plans.md): optional improvements.

## Mockups

[Dark layout](mockup-dark.png) · [Light colors](mockup-light.png) ·
[Light list](mockup-light-list.png) · [Settings](mockup-settings.png)
https://www.figma.com/design/jeP8zMiyIcu38cg9yhp2uD/Filecab?node-id=0-1&t=R5cz4jW1bEjVudbf-1

Use the supplied [SVG icons](../apps/extension/public/icons) and the
[Filecab logo](../apps/extension/public/wish-list-icon.png).
