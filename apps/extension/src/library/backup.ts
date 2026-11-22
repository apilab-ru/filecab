import type { Backup, FieldPath, ValidationIssue } from '@filecab/contracts';
import { BackupValidationError } from '@filecab/library';
import validateBackupShape from './generated-backup-validator.mjs';

/** Converts an AJV JSON pointer, such as `/entries/3/rating`, to a field path. */
function fieldPath(pointer: string): FieldPath {
  return pointer
    .split('/')
    .slice(1)
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

/** Reports why a link is not a valid `generic-v1` source, or null when it is valid. */
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

/** Finds timestamp, title, link and duplicate identity errors in a backup with a valid shape. */
function backupIssues(backup: Backup): ValidationIssue[] {
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

    for (const field of ['createdAt', 'updatedAt'] as const)
      if (Number.isNaN(Date.parse(entry[field])))
        issues.push({ path: [...path, field], message: 'The time is not valid.' });

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

/**
 * Parses and validates a backup file on the device. Throws `BackupValidationError` with
 * entry-indexed issues. Old formats, unknown fields and other versions fail the shape check.
 */
export function parseBackup(text: string): Backup {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new BackupValidationError([{ path: [], message: 'The file is not valid JSON.' }]);
  }

  if (!validateBackupShape(value))
    throw new BackupValidationError(
      (validateBackupShape.errors ?? []).map((error) => ({
        path: fieldPath(error.instancePath),
        message: error.message ?? 'Invalid field',
      })),
    );

  const backup = value as Backup;
  const issues = backupIssues(backup);

  if (issues.length) throw new BackupValidationError(issues);

  return backup;
}
