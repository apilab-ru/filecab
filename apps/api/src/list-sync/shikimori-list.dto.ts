import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

/** Validates an OAuth token response. */
export class ShikimoriTokenDto {
  @IsString()
  access_token!: string;

  @IsOptional()
  @IsString()
  refresh_token?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(1)
  expires_in?: number;

  @IsOptional()
  @IsNumber()
  created_at?: number;

  @IsString()
  scope!: string;
}

/** Validates the account of the authorized token. */
export class ShikimoriUserDto {
  @IsInt()
  @Min(1)
  id!: number;

  @IsString()
  nickname!: string;
}

/** Validates the image paths of an anime. */
export class ShikimoriImageDto {
  @IsOptional()
  @IsString()
  original?: string | null;

  @IsOptional()
  @IsString()
  preview?: string | null;
}

/** Validates the anime metadata embedded in a list record. */
export class ShikimoriAnimeDto {
  @IsInt()
  @Min(1)
  id!: number;

  @IsOptional()
  @IsString()
  name?: string | null;

  @IsOptional()
  @IsString()
  russian?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShikimoriImageDto)
  image?: ShikimoriImageDto | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  episodes?: number | null;

  @IsOptional()
  @IsString()
  aired_on?: string | null;
}

/** Validates the owner reference of a list record. */
export class ShikimoriRateUserDto {
  @IsInt()
  id!: number;
}

/** Shared list record fields of the anime list and the user rate API. */
class ShikimoriRateFieldsDto {
  @IsInt()
  @Min(1)
  id!: number;

  @IsInt()
  @Min(0)
  score!: number;

  @IsString()
  status!: string;

  @IsInt()
  @Min(0)
  episodes!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  rewatches?: number | null;

  @IsOptional()
  @IsString()
  created_at?: string | null;

  @IsOptional()
  @IsString()
  updated_at?: string | null;
}

/** Validates one record of `GET /api/users/:id/anime_rates`. Manga records have no anime. */
export class ShikimoriAnimeRateDto extends ShikimoriRateFieldsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ShikimoriRateUserDto)
  user?: ShikimoriRateUserDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShikimoriAnimeDto)
  anime?: ShikimoriAnimeDto | null;
}

/** Validates one record of the `/api/v2/user_rates` API. */
export class ShikimoriUserRateDto extends ShikimoriRateFieldsDto {
  @IsInt()
  user_id!: number;

  @IsInt()
  @Min(1)
  target_id!: number;

  @IsIn(['Anime', 'Manga'])
  target_type!: string;
}
