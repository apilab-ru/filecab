# Library import from CSV

## Purpose

The owner adds entries of any category from a CSV file. The owner prepares the file with
any tool, for example from a Kinopoisk, Shikimori or Smotret Anime list. Filecab does not
read provider accounts or pages. The import only adds entries. It sends no requests to
catalog providers. After the import, the [catalog data job](#catalog-data-job) can find the
poster, genres and description of each new entry.

This import is separate from [backup and restore](functionality.md#8-backup-and-restore)
and from [external list sync](user-list-sync-spec.md).

## Requirements

### File format

- UTF-8 text, with or without a byte order mark. Quote values as in RFC 4180.
- The separator is a comma, a semicolon or a tab. The import finds it from the header row.
- The first row is the header. The column order is free.
- Column names, category values and status values are not case-sensitive. Spaces at the ends do not count. They have the English and Russian aliases below.
- Reject a file with an unknown, duplicate or missing required column. Two aliases of one column are a duplicate.
- Reject a row with more values than the header. Empty rows are ignored.
- Reject files larger than 10 MiB before parsing. Reject more than 10,000 data rows.
- Trim values. An empty optional value means no value.

| Column      | Required | Value                                                  |
| ----------- | -------- | ------------------------------------------------------ |
| `category`  | Yes      | `anime`, `films` or `tv`                               |
| `title`     | Yes      | 1–500 characters                                       |
| `year`      | No       | Positive integer                                       |
| `status`    | No       | `planned`, `process`, `complete`, `drop` or `hide`     |
| `rating`    | No       | Personal rating, integer 1–10                          |
| `progress`  | No       | Watched episodes, integer 0 or more                    |
| `comment`   | No       | Personal note, the same limit as an ordinary edit      |
| `link`      | No       | Viewing link, an absolute HTTP or HTTPS URL            |
| `reference` | No       | Provider reference as `namespace:entity:id`, see below |

| Column      | Aliases                                                 |
| ----------- | ------------------------------------------------------- |
| `category`  | `type`, `kind`, `категория`, `тип`                      |
| `title`     | `name`, `название`, `наименование`                      |
| `year`      | `год`                                                   |
| `status`    | `статус`                                                |
| `rating`    | `score`, `my rating`, `оценка`, `моя оценка`, `рейтинг` |
| `progress`  | `episodes`, `прогресс`, `эпизоды`, `серии`              |
| `comment`   | `note`, `notes`, `комментарий`, `заметка`               |
| `link`      | `url`, `ссылка`                                         |
| `reference` | `ref`                                                   |

| Value      | Aliases                                                         |
| ---------- | --------------------------------------------------------------- |
| `anime`    | `аниме`                                                         |
| `films`    | `film`, `movie`, `movies`, `фильм`, `фильмы`                    |
| `tv`       | `tv series`, `tv show`, `series`, `serial`, `сериал`, `сериалы` |
| `planned`  | `plan`, `plan to watch`, `запланировано`, `буду смотреть`       |
| `process`  | `watching`, `смотрю`                                            |
| `complete` | `completed`, `watched`, `просмотрено`                           |
| `drop`     | `dropped`, `брошено`                                            |
| `hide`     | `hidden`, `скрыто`                                              |

A row without a status gets `complete` when it has a rating and `planned` when it does not.
The preview shows that the import set the status.

### References

A reference identifies the title in a provider. It is optional. It stays an unverified
reference after the import.

| Reference                | ID format                 | Categories    |
| ------------------------ | ------------------------- | ------------- |
| `kinopoisk:title:{id}`   | Positive integer          | `films`, `tv` |
| `imdb:title:{id}`        | `tt` and digits, as given | `films`, `tv` |
| `tmdb:movie:{id}`        | Positive integer          | `films`       |
| `tmdb:tv:{id}`           | Positive integer          | `tv`          |
| `smotret:series:{id}`    | Positive integer          | `anime`       |
| `shikimori:anime:{id}`   | Positive integer          | `anime`       |
| `myanimelist:anime:{id}` | Positive integer          | `anime`       |
| `anidb:anime:{id}`       | Positive integer          | `anime`       |

- Reject an unknown namespace or entity and an ID in a wrong format.
- Reject a reference that does not agree with the row category.
- Keep the IMDb `tt` prefix and leading zeros. Never convert one namespace into another.

Example of a Kinopoisk list saved with a semicolon:

```csv
Title;Type;Rating;Year
Безумные родители;Film;6;2017
Дандадан;Anime;10;2024
Слушатели;TV series;;2024
```

Example with all common columns:

```csv
category,title,year,status,rating,progress,reference
films,Побег из Шоушенка,1994,complete,10,,kinopoisk:title:326
tv,Игра престолов,2011,planned,,,kinopoisk:title:464963
anime,Стальной алхимик: Братство,2009,process,9,12,shikimori:anime:5114
```

### Import steps

1. The owner selects a file in Settings, in the Import from CSV section after backup and restore. The popup opens the full page for the import.
2. Validate all rows. If a row is not valid, reject the file and show each error with its line number. Add nothing.
3. Show a preview of all rows with their result: add, skip or possible duplicate, and the reason.
4. The owner can exclude rows. Then the owner confirms or cancels. Cancel changes nothing.
5. Add the selected rows in one transaction. Publish replication changes.
   - Website: the server checks the file again and adds the rows through the common mutation service.
   - Extension: the device checks the file and adds the rows in one journal document. Replication sends them later. This also works for a library without an account.
6. Show the counts of added and skipped rows in a toast.

### Duplicates

- Skip a row when an active entry has the same reference as its catalog identity or a saved reference.
- Skip a row when its link belongs to an active entry. The import never moves a link.
- Skip a row when an earlier row in the file has the same reference or the same link.
- Mark a row as a possible duplicate when it has no reference and an active entry or an earlier row has the same category and the same title after case and space normalization. Equal years, when both are present, are also required. These rows are excluded by default. The owner can include them.
- Titles never prove identity. They only mark possible duplicates.

### New entries

- A new entry gets the category, the user fields and the link from the row.
- The title and year become a user snapshot. The entry has no catalog association.
- The reference becomes an unverified saved reference.
- The owner can associate the entry with the catalog later through ordinary editing.

### Confirmation

- Bind the confirmation to the owner, the file digest and the library revision. On the website, a signed token holds this binding for 5 minutes. On the device, the preview keeps the parsed rows, the account and the local revision.
- A stale preview must ask for confirmation again.
- The import never changes or deletes an existing entry.

### Catalog data job

Server jobs find catalog data for entries without a catalog item. Each catalog provider has
its own job, so a limit or failure of one provider does not stop the entries of another
provider. The jobs run only for an account. A device library without an account keeps the plain imported entries until the
owner signs in and syncs.

- An entry goes to the job of the default provider of its category: Smotret Anime for `anime` and Kinopoisk for `films` and `tv`. A category without an enabled provider is not searched.
- After an import, the jobs start for the new entries. The import result gives the ID and the category of each new entry. A device entry can reach the server after the start, so the server uses this category until it has the entry. In Settings, Find catalog data adds all active entries without a catalog item.
- One queued or running job at a time for each account and provider. New entries of a provider with an active job join that job. An entry that is already in the job is not added again. A job holds at most 10,000 entries.
- The jobs take turns by batches of 25 entries. A job that waits does not block the other jobs. The jobs are durable and continue after a restart.
- An entry whose category changed to the category of another provider after it joined is skipped.
- Only exact matches link:
  - A reference in a namespace of the provider is resolved by its ID.
  - Otherwise, the job searches by the entry title. It links only when exactly one result has the same category, an equal title and the same year. The comparison ignores case, extra spaces, quotes, the difference between `ё` and `е` and the kind of dash. Localized titles, the original title and the other provider names count. Smotret Anime sends the other names in search results (`allTitles`). They are not stored in the entry.
  - For an entry without a year, the year is not compared. It links only when exactly one result has the same category and an equal title.
- The link uses the ordinary catalog association, with version and claim checks. User fields stay. A user title that only repeats a localized or original catalog title is cleared, so the catalog shows the title in each language. A user title that equals only another provider name stays.
- An entry that another entry already links to the same catalog title stays unlinked and is reported.
- The job waits after each request: 1.2 seconds for Kinopoisk and 0.3 seconds for Smotret Anime.
- A refused quota (HTTP 403) pauses the job for 6 hours. A rate limit pauses it for the Retry-After time, at least 1 minute. An unavailable provider or a timeout pauses it for 5 minutes, then twice as long each time, up to 6 hours. After 40 pauses the job fails.
- A provider response that fails the provider schema fails only its entry. The job continues, and the response goes to Sentry as a warning. A reference that cannot be resolved falls back to the title search.
- Entries that a device has not synced yet are awaited for 10 minutes after they last joined the job.
- Settings shows the latest job of each provider: the progress, a pause with its end time, the counts and up to 20 entries that were not linked, with the reason. An entry that the owner linked or deleted after the job is not shown. Stop ends all active jobs. Linked entries stay linked.
- An entry with several matches or no match opens the [link dialog](mockup-catalog-match-resolve-dialog.png). The dialog searches the catalog of the category for the entry title.
- Put the search field, its Clear action, Delete library entry and Close in the dialog header. On narrow screens, put the search field below the title and buttons. Keep the header visible. Scroll the result area.
- Make the Delete library entry button 32 by 32 CSS pixels. Use the same reduced scale for the dialog, its header and its result cards.
- Show read-only catalog cards and loading placeholders in four columns when there is sufficient space. Use fewer columns on narrow screens. A card has a Link action and has no personal edit or delete controls.
- Link opens the shared editor. Save links the entry with the ordinary catalog association. Delete library entry closes the dialog and offers the usual Undo.
- An unexpected failure ends only the job of that provider and goes to Sentry.

## Verification

Test the format errors with line numbers, each reference format and category check,
skipped references and links, possible duplicates and their selection, cancel, stale
previews and the absence of provider requests during the import. For the catalog data job,
test exact, ambiguous, missing and yearless matches, alternative provider names,
references, duplicates, quota pauses, waiting for sync and Stop. Test that a paused provider
does not stop another provider, that an invalid provider response fails only its entry and
that new entries join an active job.
