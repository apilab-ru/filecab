import type { Backup, ValidationIssue } from '@filecab/contracts';

/** Reports why a viewing link is not a valid `generic-v1` source, or null when it is valid. */
function sourceProblem(originalUrl: string, normalizedUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(originalUrl);
  } catch {
    return 'The link is not an absolute URL.';
  }

  if (!/^https?:$/.test(url.protocol)) return 'The link must use HTTP or HTTPS.';

  if (url.username || url.password) return 'The link must not contain credentials.';

  if (url.href !== normalizedUrl) return 'The normalized link does not match the link.';

  return null;
}

/** Finds file-level backup errors after DTO validation. Paths start with the entry index. */
export function backupIssues(backup: Backup): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const entryIds = new Set<string>();
  const catalogIds = new Set<string>();
  const links = new Set<string>();

  backup.entries.forEach((entry, index) => {
    const path = ['entries', index];

    if (entryIds.has(entry.entryId.toLowerCase()))
      issues.push({ path: [...path, 'entryId'], message: 'The entry ID is repeated.' });

    entryIds.add(entry.entryId.toLowerCase());

    if (entry.catalogId !== null) {
      if (catalogIds.has(entry.catalogId.toLowerCase()))
        issues.push({ path: [...path, 'catalogId'], message: 'The catalog ID is repeated.' });

      catalogIds.add(entry.catalogId.toLowerCase());
    } else if (!entry.userTitle.trim())
      issues.push({
        path: [...path, 'userTitle'],
        message: 'A title is required when the entry has no catalog item.',
      });

    if (Date.parse(entry.updatedAt) < Date.parse(entry.createdAt))
      issues.push({
        path: [...path, 'updatedAt'],
        message: 'The modification time is earlier than the creation time.',
      });

    entry.sources.forEach((source, position) => {
      const sourcePath = [...path, 'sources', position];
      const problem = sourceProblem(source.originalUrl, source.normalizedUrl);

      if (problem) {
        issues.push({ path: [...sourcePath, 'originalUrl'], message: problem });

        return;
      }

      if (links.has(source.normalizedUrl))
        issues.push({
          path: [...sourcePath, 'normalizedUrl'],
          message: 'The link belongs to another entry.',
        });

      links.add(source.normalizedUrl);
    });
  });

  return issues;
}
