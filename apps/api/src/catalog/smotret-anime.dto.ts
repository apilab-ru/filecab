import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsObject,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

/** Validates one linked provider reference returned with a Smotret series. */
export class SmotretLinkDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  url?: string;
}

/** Validates provider genre rows while allowing future documented fields. */
export class SmotretGenreDto {
  @IsInt()
  @Min(1)
  id!: number;

  @IsString()
  title!: string;
}

/** Validates attributed descriptions returned by the observed detail response. */
export class SmotretDescriptionDto {
  @IsString()
  source!: string;

  @IsString()
  value!: string;
}

/** Validates episode records without treating their count as the declared total. */
export class SmotretEpisodeDto {
  @IsInt()
  @Min(1)
  id!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  seriesId?: number;

  @IsOptional()
  @IsString()
  episodeType?: string;

  @IsOptional()
  @IsNumber()
  episodeInt?: number;
}

/** Validates normalized fields from the documented Smotret series schema. */
export class SmotretSeriesDto {
  @IsInt()
  @Min(1)
  id!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  myAnimeListId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  aniDbId?: number;

  @IsOptional()
  @IsNumber()
  myAnimeListScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  numberOfEpisodes?: number;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  season?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  posterUrl?: string;

  @IsOptional()
  @IsString()
  posterUrlSmall?: string;

  @IsOptional()
  @IsObject()
  titles?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SmotretLinkDto)
  links?: SmotretLinkDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SmotretGenreDto)
  genres?: SmotretGenreDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SmotretDescriptionDto)
  descriptions?: SmotretDescriptionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SmotretEpisodeDto)
  episodes?: SmotretEpisodeDto[];
}

/** Validates the public API's mandatory data envelope and series rows. */
export class SmotretSeriesResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SmotretSeriesDto)
  data!: SmotretSeriesDto[];
}

/** Validates the detail endpoint's single-series data envelope. */
export class SmotretSeriesDetailResponseDto {
  @ValidateNested()
  @Type(() => SmotretSeriesDto)
  data!: SmotretSeriesDto;
}
