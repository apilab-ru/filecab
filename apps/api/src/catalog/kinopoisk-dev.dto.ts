import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

/** Validates one localized KinoPoisk title field. */
export class KinopoiskNameDto {
  @IsString() name!: string;
  @IsOptional() @IsString() language?: string;
}

/** Validates a provider-scoped genre label. */
export class KinopoiskGenreDto {
  @IsString() name!: string;
}

/** Validates provider rating values independently from user ratings. */
export class KinopoiskRatingDto {
  @IsOptional() @IsNumber() kp?: number | null;
  @IsOptional() @IsNumber() imdb?: number | null;
  @IsOptional() @IsNumber() tmdb?: number | null;
}

/** Validates external identifiers without coercing IMDb strings or HD IDs. */
export class KinopoiskExternalIdDto {
  @IsOptional() @IsString() imdb?: string | null;
  @IsOptional() @IsInt() @Min(1) tmdb?: number | null;
  @IsOptional() @IsString() kpHD?: string | null;
}

/** Validates a normalized v1.4 movie record while allowing unknown future fields. */
export class KinopoiskMovieDto {
  @IsInt() @Min(1) id!: number;
  @IsString() type!: string;
  @IsOptional() isSeries?: boolean | null;
  @IsOptional() @IsString() name?: string | null;
  @IsOptional() @IsString() alternativeName?: string | null;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsInt() @Min(1) year?: number | null;
  @IsOptional() @IsObject() poster?: { url?: string | null } | null;
  @IsOptional() @IsObject() rating?: KinopoiskRatingDto | null;
  @IsOptional() @IsObject() externalId?: KinopoiskExternalIdDto | null;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KinopoiskNameDto)
  names?: KinopoiskNameDto[];
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KinopoiskGenreDto)
  genres?: KinopoiskGenreDto[];
  @IsOptional() @IsArray() @Type(() => Number) seasonsInfo?: number[];
}

/** Validates paginated search and discovery response metadata. */
export class KinopoiskMoviesResponseDto {
  @IsInt() @Min(1) page!: number;
  @IsInt() @Min(1) limit!: number;
  @IsOptional() @IsInt() @Min(0) total?: number;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KinopoiskMovieDto)
  docs!: KinopoiskMovieDto[];
}
