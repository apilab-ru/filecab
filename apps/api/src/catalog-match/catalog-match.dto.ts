import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import {
  CATALOG_MATCH_MAX_ENTRIES,
  Category,
  CatalogMatchJobState,
  CatalogMatchOutcome,
  CatalogMatchPause,
} from '@filecab/contracts';

/** Names an entry and its category. The category selects the provider job. */
export class CatalogMatchTargetDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('all')
  entryId!: string;

  @ApiProperty({ enum: Category, enumName: 'Category' })
  @IsEnum(Category)
  category!: Category;
}

/** Starts jobs for the given entries, or for all entries without catalog data. */
export class CatalogMatchStartDto {
  @ApiPropertyOptional({ type: () => [CatalogMatchTargetDto], maxItems: CATALOG_MATCH_MAX_ENTRIES })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(CATALOG_MATCH_MAX_ENTRIES)
  @ValidateNested({ each: true })
  @Type(() => CatalogMatchTargetDto)
  entries?: CatalogMatchTargetDto[];
}

/** Documents one entry that the job did not link. */
export class CatalogMatchItemDto {
  @ApiProperty({ type: String, format: 'uuid' }) entryId!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ enum: CatalogMatchOutcome, enumName: 'CatalogMatchOutcome' })
  outcome!: CatalogMatchOutcome;
}

/** Documents the progress of a job. */
export class CatalogMatchProgressDto {
  @ApiProperty({ type: Number }) done!: number;
  @ApiProperty({ type: Number }) total!: number;
}

/** Documents a catalog data job. */
export class CatalogMatchJobDto {
  @ApiProperty({ type: String, format: 'uuid' }) jobId!: string;
  @ApiProperty({ type: String, example: 'kinopoisk' }) provider!: string;
  @ApiProperty({ enum: CatalogMatchJobState, enumName: 'CatalogMatchJobState' })
  state!: CatalogMatchJobState;
  @ApiProperty({ type: () => CatalogMatchProgressDto }) progress!: CatalogMatchProgressDto;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description: 'Counts by CatalogMatchOutcome.',
  })
  counts!: Partial<Record<CatalogMatchOutcome, number>>;
  @ApiProperty({ type: () => [CatalogMatchItemDto] }) items!: CatalogMatchItemDto[];
  @ApiProperty({ enum: CatalogMatchPause, enumName: 'CatalogMatchPause', nullable: true })
  pause!: CatalogMatchPause | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) resumeAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) finishedAt!: string | null;
}

/** Documents the latest job of each provider. */
export class CatalogMatchStatusDto {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ type: () => [CatalogMatchJobDto] }) jobs!: CatalogMatchJobDto[];
}
