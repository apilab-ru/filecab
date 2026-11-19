import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { CatalogCacheClearResponse } from '@filecab/contracts';
import { IsIn, IsOptional } from 'class-validator';

export const CATALOG_CACHE_PROVIDERS = ['smotret', 'kinopoisk'] as const;

/** Validates the optional provider of a cache clear. Without it, all providers are cleared. */
export class CatalogCacheClearQueryDto {
  @ApiPropertyOptional({
    enum: CATALOG_CACHE_PROVIDERS,
    description: 'Clears only this provider. Omit it to clear the cache of all providers.',
  })
  @IsOptional()
  @IsIn(CATALOG_CACHE_PROVIDERS)
  provider?: (typeof CATALOG_CACHE_PROVIDERS)[number];
}

/** Documents the counts of removed cache rows. */
export class CatalogCacheClearResponseDto implements CatalogCacheClearResponse {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Null when all providers were cleared',
  })
  provider!: string | null;
  @ApiProperty({ type: Number, minimum: 0 }) searchPages!: number;
  @ApiProperty({ type: Number, minimum: 0 }) metadata!: number;
}
