import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  CatalogRefreshJobState,
  CatalogRefreshOutcome,
  type CatalogRefreshJob,
  type CatalogRefreshStatus,
} from '@filecab/contracts';
import { CATALOG_REFRESH_TARGETS } from './catalog-refresh-runner';

const CATALOG_REFRESH_PROVIDERS = Object.keys(CATALOG_REFRESH_TARGETS);

/** Names the provider of a detail refresh job. */
export class CatalogRefreshProviderDto {
  @ApiProperty({ enum: CATALOG_REFRESH_PROVIDERS, example: 'smotret' })
  @IsIn(CATALOG_REFRESH_PROVIDERS)
  provider!: string;
}

/** Documents a detail refresh job. */
export class CatalogRefreshJobDto implements CatalogRefreshJob {
  @ApiProperty({ type: String, format: 'uuid' }) jobId!: string;
  @ApiProperty({ type: String, example: 'smotret' }) provider!: string;
  @ApiProperty({ enum: CatalogRefreshJobState, enumName: 'CatalogRefreshJobState' })
  state!: CatalogRefreshJobState;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description: 'Counts by CatalogRefreshOutcome.',
  })
  counts!: Partial<Record<CatalogRefreshOutcome, number>>;
  @ApiProperty({ type: Number, minimum: 0, description: 'Library entries with a new snapshot' })
  entries!: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) resumeAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) finishedAt!: string | null;
}

/** Documents the latest detail refresh job of a provider. */
export class CatalogRefreshStatusDto implements CatalogRefreshStatus {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ type: () => CatalogRefreshJobDto, nullable: true })
  job!: CatalogRefreshJobDto | null;
}
