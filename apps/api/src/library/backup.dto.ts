import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Category, Format, Granularity, Status } from '@filecab/contracts';

/** UTC timestamp with milliseconds, as the shared contract requires. */
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** At most this many entries fit in one backup. The 10 MiB body limit applies first. */
export const MAX_BACKUP_ENTRIES = 50000;

/** Validates the origin and verification state of backup metadata. */
export class BackupProvenanceDto {
  @ApiProperty({ type: String, maxLength: 200 }) @IsString() @MaxLength(200) source!: string;
  @ApiProperty({ type: String, format: 'date-time' })
  @IsISO8601({ strict: true })
  retrievedAt!: string;
  @ApiProperty({ type: Boolean }) @IsBoolean() verified!: boolean;
}

/** Validates text with its actual language and provenance. */
export class BackupLocalizedTextDto {
  @ApiProperty({ type: String, maxLength: 100000 }) @IsString() @MaxLength(100000) text!: string;
  @ApiProperty({ type: String, maxLength: 35 }) @IsString() @MaxLength(35) language!: string;
  @ApiProperty({ type: () => BackupProvenanceDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => BackupProvenanceDto)
  provenance!: BackupProvenanceDto;
}

/** Validates one genre and its localized labels. */
export class BackupGenreDto {
  @ApiProperty({ type: String, maxLength: 200 }) @IsString() @MaxLength(200) genreId!: string;
  @ApiProperty({ type: String, maxLength: 200 }) @IsString() @MaxLength(200) key!: string;
  @ApiProperty({ type: [BackupLocalizedTextDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BackupLocalizedTextDto)
  labels!: BackupLocalizedTextDto[];
  @ApiPropertyOptional({ type: String, enum: Category, isArray: true })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @IsIn(Object.values(Category), { each: true })
  categories?: Category[];
}

/** Validates an attributed provider score. */
export class BackupProviderRatingDto {
  @ApiProperty({ type: Number })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  value!: number;
  @ApiProperty({ type: Number, exclusiveMinimum: true, minimum: 0 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(Number.MIN_VALUE)
  scale!: number;
  @ApiProperty({ type: () => BackupProvenanceDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => BackupProvenanceDto)
  provenance!: BackupProvenanceDto;
}

/** Validates a provider identity. */
export class BackupProviderReferenceDto {
  @ApiProperty({ type: String, maxLength: 200 }) @IsString() @MaxLength(200) namespace!: string;
  @ApiProperty({ type: String, maxLength: 200 }) @IsString() @MaxLength(200) entity!: string;
  @ApiProperty({ type: String, maxLength: 200 }) @IsString() @MaxLength(200) id!: string;
  @ApiProperty({ type: String, enum: Granularity })
  @IsIn(Object.values(Granularity))
  granularity!: Granularity;
  @ApiProperty({ type: () => BackupProvenanceDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => BackupProvenanceDto)
  provenance!: BackupProvenanceDto;
}

/** Validates the shape of a backup snapshot. The server stores its own catalog snapshot. */
export class BackupSnapshotDto {
  @ApiProperty({ type: () => BackupLocalizedTextDto, nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => BackupLocalizedTextDto)
  originalTitle!: BackupLocalizedTextDto | null;
  @ApiProperty({ type: [BackupLocalizedTextDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BackupLocalizedTextDto)
  titles!: BackupLocalizedTextDto[];
  @ApiProperty({ type: [BackupLocalizedTextDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BackupLocalizedTextDto)
  descriptions!: BackupLocalizedTextDto[];
  @ApiProperty({ type: String, nullable: true, maxLength: 8192 })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(8192)
  posterUrl!: string | null;
  @ApiProperty({ type: 'integer', nullable: true, minimum: 1, maximum: 9999 })
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(9999)
  year!: number | null;
  @ApiProperty({ type: [BackupGenreDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BackupGenreDto)
  genres!: BackupGenreDto[];
  @ApiProperty({ type: String, enum: [...Object.values(Format), null], nullable: true })
  @IsIn([...Object.values(Format), null])
  format!: Format | null;
  @ApiProperty({ type: 'integer', nullable: true, minimum: 1 })
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  episodeCount!: number | null;
  @ApiProperty({ type: 'integer', nullable: true, minimum: 1 })
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  availableEpisodeCount!: number | null;
  @ApiProperty({ type: [BackupProviderRatingDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BackupProviderRatingDto)
  providerRatings!: BackupProviderRatingDto[];
  @ApiProperty({ type: [BackupProviderReferenceDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BackupProviderReferenceDto)
  references!: BackupProviderReferenceDto[];
}

/** Validates one viewing link. The service checks the URL and its normalized form. */
export class BackupSourceDto {
  @ApiProperty({ type: String, maxLength: 8192 })
  @IsString()
  @MaxLength(8192)
  originalUrl!: string;
  @ApiProperty({ type: String, maxLength: 8192 })
  @IsString()
  @MaxLength(8192)
  normalizedUrl!: string;
  @ApiProperty({ type: String, enum: ['generic-v1'] })
  @Equals('generic-v1')
  policyVersion!: 'generic-v1';
}

/** Validates one portable entry without server versions or deletion state. */
export class BackupEntryDto {
  @ApiProperty({ type: String, format: 'uuid' }) @IsUUID('all') entryId!: string;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  @ValidateIf((_, value) => value !== null)
  @IsUUID('all')
  catalogId!: string | null;
  @ApiProperty({ type: String, enum: Category }) @IsIn(Object.values(Category)) category!: Category;
  @ApiProperty({ type: String, maxLength: 10000 }) @IsString() @MaxLength(10000) userTitle!: string;
  @ApiProperty({ type: String, enum: [...Object.values(Status), null], nullable: true })
  @IsIn([...Object.values(Status), null])
  status!: Status | null;
  @ApiProperty({ type: 'integer', minimum: 0, maximum: 10 })
  @IsInt()
  @Min(0)
  @Max(10)
  rating!: number;
  @ApiProperty({ type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER })
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  progress!: number;
  @ApiProperty({ type: String, maxLength: 100000 }) @IsString() @MaxLength(100000) comment!: string;
  @ApiProperty({ type: [BackupSourceDto], maxItems: 1 })
  @IsArray()
  @ArrayMaxSize(1)
  @ValidateNested({ each: true })
  @Type(() => BackupSourceDto)
  sources!: BackupSourceDto[];
  @ApiProperty({ type: () => BackupSnapshotDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => BackupSnapshotDto)
  snapshot!: BackupSnapshotDto;
  @ApiProperty({ type: String, format: 'date-time' })
  @IsISO8601({ strict: true })
  @Matches(UTC_TIMESTAMP)
  createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' })
  @IsISO8601({ strict: true })
  @Matches(UTC_TIMESTAMP)
  updatedAt!: string;
}

/** Validates the current backup format. Old arrays, grouped data and other versions fail. */
export class BackupDto {
  @ApiProperty({ type: Number, enum: [1] }) @Equals(1) schemaVersion!: 1;
  @ApiProperty({ type: [BackupEntryDto], maxItems: MAX_BACKUP_ENTRIES })
  @IsArray()
  @ArrayMaxSize(MAX_BACKUP_ENTRIES)
  @ValidateNested({ each: true })
  @Type(() => BackupEntryDto)
  entries!: BackupEntryDto[];
}

/** Confirms a previewed restore with its signed token. */
export class BackupRestoreDto {
  @ApiProperty({ type: () => BackupDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => BackupDto)
  backup!: BackupDto;
  @ApiProperty({ type: String, maxLength: 256 })
  @IsString()
  @MaxLength(256)
  confirmationToken!: string;
  @ApiPropertyOptional({ type: Boolean, description: 'Required when the backup has no entries.' })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  confirmEmpty?: boolean;
}

/** Documents the counts and conflicts of a replacement. */
export class BackupComparisonDto {
  @ApiProperty({ type: 'integer' }) current!: number;
  @ApiProperty({ type: 'integer' }) incoming!: number;
  @ApiProperty({ type: 'integer' }) added!: number;
  @ApiProperty({ type: 'integer' }) updated!: number;
  @ApiProperty({ type: 'integer' }) unchanged!: number;
  @ApiProperty({ type: 'integer' }) removed!: number;
  @ApiProperty({ type: 'integer' }) conflicts!: number;
}

/** Documents a restore preview and its confirmation token. */
export class BackupPreviewDto {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ type: String }) confirmationToken!: string;
  @ApiProperty({ type: String, format: 'date-time' }) expiresAt!: string;
  @ApiProperty({ type: String }) revision!: string;
  @ApiProperty({ type: () => BackupComparisonDto }) comparison!: BackupComparisonDto;
}
