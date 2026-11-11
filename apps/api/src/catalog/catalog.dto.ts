import { ApiProperty } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import type {
  CatalogCapabilities,
  CatalogProviderCapability,
  CatalogRecord,
  CatalogSearchRequest,
  CatalogSearchResponse,
} from '@filecab/contracts';
import { Category, Locale } from '@filecab/contracts';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SnapshotDto } from '../library/response.dto';

/** Documents one enabled provider's truthful catalog capabilities. */
export class CatalogProviderCapabilityDto implements CatalogProviderCapability {
  @ApiProperty({ type: String }) provider!: string;
  @ApiProperty({ type: [String], enum: ['anime', 'films', 'tv'] })
  categories!: CatalogProviderCapability['categories'];
  @ApiProperty({ type: [String], enum: ['search', 'details', 'resolve-reference', 'genres'] })
  operations!: CatalogProviderCapability['operations'];
  @ApiProperty({ type: [String] }) filters!: string[];
  @ApiProperty({ type: [String] }) ordering!: string[];
  @ApiProperty({ type: [String] }) referenceNamespaces!: string[];
  @ApiProperty({ type: [String], enum: ['en', 'ru'] })
  languages!: CatalogProviderCapability['languages'];
}

/** Documents provider defaults and operations currently supplied by enabled adapters. */
export class CatalogCapabilitiesDto implements CatalogCapabilities {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  defaults!: CatalogCapabilities['defaults'];
  @ApiProperty({ type: [CatalogProviderCapabilityDto] })
  providers!: CatalogCapabilities['providers'];
}

/** Documents a stable catalog identity with normalized metadata. */
export class CatalogRecordDto implements CatalogRecord {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ type: String, format: 'uuid' }) catalogId!: string;
  @ApiProperty({ type: String, enum: ['anime', 'films', 'tv'] })
  category!: CatalogRecord['category'];
  @ApiProperty({
    type: String,
    enum: ['series', 'season', 'film', 'special', 'edition', 'unknown'],
  })
  granularity!: CatalogRecord['granularity'];
  @ApiProperty({ type: () => SnapshotDto }) snapshot!: CatalogRecord['snapshot'];
}

/** Validates one bounded normalized search request at the HTTP boundary. */
export class CatalogSearchRequestDto implements CatalogSearchRequest {
  @ApiProperty({ enum: Category })
  @IsEnum(Category)
  category!: Category;

  @ApiPropertyOptional({ type: String, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  provider?: string;

  @ApiProperty({ type: String, maxLength: 500 })
  @IsString()
  @MaxLength(500)
  query!: string;

  @ApiProperty({ enum: Locale })
  @IsEnum(Locale)
  locale!: Locale;

  @ApiProperty({ type: Number, minimum: 1, maximum: 100000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page!: number;

  @ApiProperty({ type: Number, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize!: number;

  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'string' } })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  })
  @IsObject()
  filters?: Record<string, string | number | boolean>;

  @ApiPropertyOptional({ type: String, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  order?: string;
}

/** Documents a normalized provider result page and its truthful continuation. */
export class CatalogSearchResponseDto implements CatalogSearchResponse {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ enum: Locale }) locale!: Locale;
  @ApiProperty({ type: Number, minimum: 1 }) page!: number;
  @ApiProperty({ type: [CatalogRecordDto] }) results!: CatalogRecord[];
  @ApiProperty({ type: Boolean }) hasMore!: boolean;
  @ApiPropertyOptional({ type: Number, minimum: 0 }) total?: number;
  @ApiPropertyOptional({
    type: String,
    enum: ['none', 'lookahead-exhausted', 'unsupported-filter', 'upstream-unavailable'],
  })
  limitation?: CatalogSearchResponse['limitation'];
}
