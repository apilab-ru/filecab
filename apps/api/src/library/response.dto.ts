import { ApiProperty } from '@nestjs/swagger';

/** Documents the origin and verification state of catalog metadata. */
export class ProvenanceDto {
  @ApiProperty({ type: String }) source!: string;
  @ApiProperty({ type: String, format: 'date-time' }) retrievedAt!: string;
  @ApiProperty({ type: Boolean }) verified!: boolean;
}

/** Documents text with its actual language and provenance. */
export class LocalizedTextDto {
  @ApiProperty({ type: String }) text!: string;
  @ApiProperty({ type: String }) language!: string;
  @ApiProperty({ type: () => ProvenanceDto }) provenance!: ProvenanceDto;
}

/** Documents provider identity without conflating numerical string namespaces. */
export class ProviderReferenceDto {
  @ApiProperty({ type: String }) namespace!: string;
  @ApiProperty({ type: String }) entity!: string;
  @ApiProperty({ type: String, example: '00123' }) id!: string;
  @ApiProperty({
    type: String,
    enum: ['series', 'season', 'film', 'special', 'edition', 'unknown'],
  })
  granularity!: string;
  @ApiProperty({ type: () => ProvenanceDto }) provenance!: ProvenanceDto;
}

/** Documents one stable genre and all available localized labels. */
export class GenreDto {
  @ApiProperty({ type: String }) genreId!: string;
  @ApiProperty({ type: String }) key!: string;
  @ApiProperty({ type: [LocalizedTextDto] }) labels!: LocalizedTextDto[];
}

/** Documents an attributed provider score independently of personal rating. */
export class ProviderRatingDto {
  @ApiProperty({ type: Number }) value!: number;
  @ApiProperty({ type: Number }) scale!: number;
  @ApiProperty({ type: () => ProvenanceDto }) provenance!: ProvenanceDto;
}

/** Documents the complete retained catalog snapshot, including nullable unknown metadata. */
export class SnapshotDto {
  @ApiProperty({ type: () => LocalizedTextDto, nullable: true })
  originalTitle!: LocalizedTextDto | null;
  @ApiProperty({ type: [LocalizedTextDto] }) titles!: LocalizedTextDto[];
  @ApiProperty({ type: [LocalizedTextDto] }) descriptions!: LocalizedTextDto[];
  @ApiProperty({ type: String, nullable: true, format: 'uri' }) posterUrl!: string | null;
  @ApiProperty({ type: 'integer', nullable: true }) year!: number | null;
  @ApiProperty({ type: [GenreDto] }) genres!: GenreDto[];
  @ApiProperty({
    type: String,
    nullable: true,
    enum: [
      'movie',
      'tv',
      'special',
      'ova',
      'ona',
      'music',
      'cartoon',
      'tv-series',
      'animated-series',
      'unknown',
      null,
    ],
  })
  format!: string | null;
  @ApiProperty({ type: 'integer', nullable: true, minimum: 1 }) episodeCount!: number | null;
  @ApiProperty({ type: 'integer', nullable: true, minimum: 0 }) availableEpisodeCount!:
    number | null;
  @ApiProperty({ type: [ProviderRatingDto] }) providerRatings!: ProviderRatingDto[];
  @ApiProperty({ type: [ProviderReferenceDto] }) references!: ProviderReferenceDto[];
}

/** Documents an original viewing URL and its authoritative normalization policy. */
export class SourceDto {
  @ApiProperty({ type: String, format: 'uri' }) originalUrl!: string;
  @ApiProperty({ type: String, format: 'uri' }) normalizedUrl!: string;
  @ApiProperty({ type: String, enum: ['generic-v1'] }) policyVersion!: 'generic-v1';
}

/** Documents a complete private document, including fields needed for filtering and replication. */
export class EntryDto {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ type: String, format: 'uuid', readOnly: true }) entryId!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) catalogId!: string | null;
  @ApiProperty({ type: String, enum: ['anime', 'films', 'tv'] }) category!: string;
  @ApiProperty({ type: String, maxLength: 10000 }) userTitle!: string;
  @ApiProperty({
    type: String,
    enum: ['planned', 'process', 'complete', 'drop', 'hide', null],
    nullable: true,
  })
  status!: string | null;
  @ApiProperty({ type: 'integer', minimum: 0, maximum: 10 }) rating!: number;
  @ApiProperty({ type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER }) progress!: number;
  @ApiProperty({ type: String, maxLength: 100000 }) comment!: string;
  @ApiProperty({ type: [SourceDto] }) sources!: SourceDto[];
  @ApiProperty({ type: () => SnapshotDto }) snapshot!: SnapshotDto;
  @ApiProperty({ type: String, format: 'date-time', readOnly: true }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time', readOnly: true }) updatedAt!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Null identifies unsaved preview intent.',
  })
  serverVersion!: string | null;
  @ApiProperty({ type: Boolean }) deleted!: boolean;
}

/** Documents a committed document with a required canonical string version. */
export class ServerEntryDto extends EntryDto {
  @ApiProperty({
    type: String,
    nullable: false,
    pattern: '^[1-9][0-9]{0,127}$',
    description: 'Committed decimal-string server version.',
  })
  declare serverVersion: string;
}

/** Documents the entire private active library at one consistent server revision. */
export class OwnerSnapshotDto {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ type: String, pattern: '^(0|[1-9][0-9]{0,127})$', example: '0' })
  revision!: string;
  @ApiProperty({ type: [ServerEntryDto] }) entries!: ServerEntryDto[];
}

/** Documents current state and proposed intent before an explicit two-entry operation. */
export class PreviewChangeDto {
  @ApiProperty({ type: () => ServerEntryDto }) before!: ServerEntryDto;
  @ApiProperty({ type: () => EntryDto }) proposed!: EntryDto;
}

/** Documents a short-lived owner/choices/version-bound confirmation preview. */
export class MutationPreviewDto {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ type: String, maxLength: 256 }) previewToken!: string;
  @ApiProperty({ type: String, format: 'date-time' }) expiresAt!: string;
  @ApiProperty({ type: [PreviewChangeDto] }) changes!: PreviewChangeDto[];
}

/** Documents every committed entry affected by a two-entry mutation. */
export class MutationResultDto {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ type: [ServerEntryDto] }) entries!: ServerEntryDto[];
}
