# Library import from CSV

## Purpose

The owner adds entries of any category from a CSV file. The owner prepares the file with
any tool, for example from a Kinopoisk, Shikimori or Smotret Anime list. Filecab does not
read provider accounts or pages. The import only adds entries. It sends no requests to
catalog providers.

This import is separate from [backup and restore](functionality.md#8-backup-and-restore)
and from [external list sync](user-list-sync-spec.md).

## Requirements

### File format

- UTF-8 text, with or without a byte order mark. The separator is a comma. Quote values as in RFC 4180.
- The first row is the header. Column names are case-sensitive. The column order is free.
- Reject a file with an unknown, duplicate or missing required column.
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

Example:

```csv
category,title,year,status,rating,progress,reference
films,Побег из Шоушенка,1994,complete,10,,kinopoisk:title:326
tv,Игра престолов,2011,planned,,,kinopoisk:title:464963
anime,Стальной алхимик: Братство,2009,process,9,12,shikimori:anime:5114
```

### Import steps

1. The owner selects a file in Settings, next to backup and restore.
2. Validate all rows. If a row is not valid, reject the file and show each error with its line number. Add nothing.
3. Show a preview of all rows with their result: add, skip or possible duplicate, and the reason.
4. The owner can exclude rows. Then the owner confirms or cancels. Cancel changes nothing.
5. Add the selected rows in one transaction through the common mutation service. Publish replication changes.
6. Show the counts of added and skipped rows.

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

- Bind the confirmation to the owner, the file digest and the library revision.
- A stale preview must ask for confirmation again.
- The import never changes or deletes an existing entry.

## Verification

Test the format errors with line numbers, each reference format and category check,
skipped references and links, possible duplicates and their selection, cancel, stale
previews and the absence of provider requests.
