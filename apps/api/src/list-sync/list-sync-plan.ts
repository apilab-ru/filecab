import {
  ListSyncField,
  ListSyncIssue,
  Status,
  type ListSyncFieldChange,
  type ListSyncValues,
} from '@filecab/contracts';

/** Describes the remote write that an export needs for one entry. */
export type ExportAction =
  | { kind: 'create'; values: Partial<ListSyncValues> }
  | { kind: 'update'; values: Partial<ListSyncValues> }
  | { kind: 'unchanged' }
  | { kind: 'skip'; issue: ListSyncIssue };

/** Reads one transferable field of a value set. */
function fieldValue(values: ListSyncValues, field: ListSyncField): Status | number | null {
  return values[field];
}

/** Returns true when the provider can store the status. `hide` and null never export. */
function exportableStatus(status: Status | null, statuses: Status[]): status is Status {
  return status !== null && status !== Status.Hide && statuses.includes(status);
}

/**
 * Plans the export of one entry. Filecab values replace remote values. Remote values are
 * projections, so an equal projection is unchanged and never starts a write.
 */
export function planExport(
  entry: ListSyncValues,
  remote: ListSyncValues | null,
  fields: ListSyncField[],
  statuses: Status[],
): ExportAction {
  const statusEnabled = fields.includes(ListSyncField.Status);
  const statusExportable = statusEnabled && exportableStatus(entry.status, statuses);

  if (!remote) {
    if (!statusExportable) return { kind: 'skip', issue: ListSyncIssue.UnsupportedStatus };

    const values: Partial<ListSyncValues> = { status: entry.status };

    if (fields.includes(ListSyncField.Rating)) values.rating = entry.rating;

    if (fields.includes(ListSyncField.Progress)) values.progress = entry.progress;

    return { kind: 'create', values };
  }

  const values: Partial<ListSyncValues> = {};

  if (statusExportable && entry.status !== remote.status) values.status = entry.status;

  if (fields.includes(ListSyncField.Rating) && entry.rating !== remote.rating)
    values.rating = entry.rating;

  if (fields.includes(ListSyncField.Progress) && entry.progress !== remote.progress)
    values.progress = entry.progress;

  if (!Object.keys(values).length) return { kind: 'unchanged' };

  return { kind: 'update', values };
}

/**
 * Lists the fields that an import would change. A remote status without a Filecab
 * equivalent is not a change, and a hidden entry keeps its status.
 */
export function planImport(
  entry: ListSyncValues,
  remote: ListSyncValues,
  fields: ListSyncField[],
): ListSyncFieldChange[] {
  return fields.flatMap((field) => {
    const current = fieldValue(entry, field);
    const incoming = fieldValue(remote, field);

    if (current === incoming) return [];

    if (field === ListSyncField.Status && (incoming === null || current === Status.Hide)) return [];

    return [{ field, current, incoming }];
  });
}

/** Returns true when every given value equals the matching value of the record. */
export function valuesMatch(record: ListSyncValues, values: Partial<ListSyncValues>): boolean {
  return Object.entries(values).every(
    ([field, value]) => record[field as keyof ListSyncValues] === value,
  );
}
