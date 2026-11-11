import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  Genre,
  GenreMappingConflict,
  GenreMappingReview,
  GenreRefreshResponse,
  GenreReviewResponse,
  GenreResponse,
  LocalizedText,
} from '@filecab/contracts';
import { Category, Locale } from '@filecab/contracts';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Validates a provider genre label before adding server-owned provenance. */
export class CatalogGenreLabelInputDto {
  @ApiProperty({ type: String, maxLength: 16 })
  @IsString()
  @MaxLength(16)
  language!: string;

  @ApiProperty({ type: String, maxLength: 200 })
  @IsString()
  @MaxLength(200)
  text!: string;
}

/** Validates one provider identity and its localized labels. */
export class CatalogGenreInputDto {
  @ApiProperty({ type: String, maxLength: 200 })
  @IsString()
  @MaxLength(200)
  externalId!: string;

  @ApiProperty({ type: [CatalogGenreLabelInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CatalogGenreLabelInputDto)
  labels!: CatalogGenreLabelInputDto[];
}

/** Validates a bounded normalized provider genre list. */
export class CatalogGenreProviderResponseDto {
  @ApiProperty({ type: Number, enum: [1] })
  @IsInt()
  @Min(1)
  @Max(1)
  schemaVersion!: 1;

  @ApiProperty({ type: [CatalogGenreInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogGenreInputDto)
  genres!: CatalogGenreInputDto[];
}

/** Validates the protected refresh request without allowing adapter selection by URL. */
export class CatalogGenreRefreshRequestDto {
  @ApiProperty({ type: String, maxLength: 100 })
  @IsString()
  @MaxLength(100)
  provider!: string;

  @ApiProperty({ enum: Locale })
  @IsEnum(Locale)
  locale!: Locale;
}

/** Validates an optional provider namespace filter on the operator review route. */
export class CatalogGenreReviewQueryDto {
  @ApiPropertyOptional({ type: String, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  provider?: string;
}

/** Validates the locale query used by side-effect-free public genre reads. */
export class CatalogGenreLocaleQueryDto {
  @ApiProperty({ enum: Locale })
  @IsEnum(Locale)
  locale!: Locale;
}

/** Documents the stable public genre model. */
export class CatalogGenreDto implements Genre {
  @ApiProperty({ type: String, format: 'uuid' }) genreId!: string;
  @ApiProperty({ type: String }) key!: string;
  @ApiProperty({ type: 'array', items: { type: 'object' } }) labels!: LocalizedText[];
  @ApiPropertyOptional({ enum: Category, isArray: true }) categories?: Genre['categories'];
}

/** Documents read-only localized genre results. */
export class CatalogGenreResponseDto implements GenreResponse {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ enum: Locale }) locale!: Locale;
  @ApiProperty({ type: [CatalogGenreDto] }) genres!: Genre[];
}

/** Documents one unresolved provider-to-catalog genre mapping. */
export class CatalogGenreMappingReviewDto implements GenreMappingReview {
  @ApiProperty({ type: String }) provider!: string;
  @ApiProperty({ type: String }) externalId!: string;
  @ApiProperty({ type: String, format: 'uuid' }) genreId!: string;
  @ApiProperty({ type: 'array', items: { type: 'object' } }) labels!: LocalizedText[];
  @ApiProperty({ type: 'object', additionalProperties: true })
  provenance!: GenreMappingReview['provenance'];
  @ApiProperty({ type: Boolean }) verified!: boolean;
}

/** Documents retained crosswalk conflicts without provider payload details. */
export class CatalogGenreMappingConflictDto implements GenreMappingConflict {
  @ApiProperty({ type: String, format: 'uuid' }) conflictId!: string;
  @ApiProperty({ type: String }) provider!: string;
  @ApiProperty({ type: String }) externalId!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) currentGenreId!: string | null;
  @ApiProperty({ type: String }) proposedKey!: string;
  @ApiProperty({ type: 'array', items: { type: 'object' } }) labels!: LocalizedText[];
  @ApiProperty({ type: 'object', additionalProperties: true })
  provenance!: GenreMappingConflict['provenance'];
  @ApiProperty({ type: String, enum: ['target-missing', 'mapping-change'] })
  reason!: GenreMappingConflict['reason'];
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
}

/** Documents a protected refresh result, including conflicts for review. */
export class CatalogGenreRefreshResponseDto implements GenreRefreshResponse {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ type: String }) provider!: string;
  @ApiProperty({ enum: Locale }) locale!: Locale;
  @ApiProperty({ type: Number, minimum: 0 }) imported!: number;
  @ApiProperty({ type: Number, minimum: 0 }) unresolved!: number;
  @ApiProperty({ type: [CatalogGenreMappingConflictDto] }) conflicts!: GenreMappingConflict[];
}

/** Documents operator-only review of unknown mappings and crosswalk conflicts. */
export class CatalogGenreReviewResponseDto implements GenreReviewResponse {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ type: [CatalogGenreMappingReviewDto] }) mappings!: GenreMappingReview[];
  @ApiProperty({ type: [CatalogGenreMappingConflictDto] }) conflicts!: GenreMappingConflict[];
}
