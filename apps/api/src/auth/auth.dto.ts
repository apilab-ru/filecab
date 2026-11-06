import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { AuthClient } from './credentials';

/** Bounds the login destination and extension attempt binding before issuing state. */
export class LoginStartDto {
  @ApiProperty({ enum: AuthClient })
  @IsEnum(AuthClient)
  client!: AuthClient;

  @ApiProperty({ type: String, maxLength: 2048, example: 'http://127.0.0.1:5173/' })
  @IsString()
  @MaxLength(2048)
  returnTo!: string;

  @ApiPropertyOptional({ type: String, pattern: '^[A-Za-z0-9_-]{43}$' })
  @ValidateIf((_, value) => value !== undefined)
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  challenge?: string;

  @ApiPropertyOptional({ type: String, pattern: '^[A-Za-z0-9_-]{43}$' })
  @ValidateIf((_, value) => value !== undefined)
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  attempt?: string;
}

/** Bounds the security-relevant Google callback fields; ancillary fields are ignored. */
export class GoogleCallbackDto {
  @ApiProperty({ type: String, pattern: '^[A-Za-z0-9_-]{43}$' })
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  state!: string;

  @ApiPropertyOptional({ type: String, maxLength: 4096 })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(4096)
  code?: string;

  @ApiPropertyOptional({ type: String, maxLength: 256 })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(256)
  error?: string;
}

/** Redeems an extension code only with its initiating verifier and attempt. */
export class ExchangeDto {
  @ApiProperty({ type: String, pattern: '^[A-Za-z0-9_-]{43}$' })
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  code!: string;

  @ApiProperty({ type: String, pattern: '^[A-Za-z0-9_-]{43}$' })
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  attempt!: string;

  @ApiProperty({ type: String, pattern: '^[A-Za-z0-9._~-]{43,128}$' })
  @Matches(/^[A-Za-z0-9._~-]{43,128}$/)
  verifier!: string;
}

/** Supports a JSON extension refresh token or an empty website cookie refresh body. */
export class RefreshDto {
  @ApiPropertyOptional({ type: String, pattern: '^[A-Za-z0-9_-]{43}$' })
  @ValidateIf((_, value) => value !== undefined)
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  refreshToken?: string;
}

/** Returns only the authenticated Filecab owner identity. */
export class AccountDto {
  @ApiProperty({ type: Number, enum: [1] })
  schemaVersion!: 1;

  @ApiProperty({ type: String, format: 'uuid' })
  ownerId!: string;
}

/** Documents credentials returned exclusively to the privileged extension client. */
export class ExtensionTokensDto extends AccountDto {
  @ApiProperty({ type: String, minLength: 43, maxLength: 43 })
  accessToken!: string;

  @ApiProperty({ type: String, minLength: 43, maxLength: 43 })
  refreshToken!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  accessExpiresAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  sessionExpiresAt!: string;
}

/** Bounds an anonymous extension readiness request to one exact Chrome ID. */
export class ExtensionConfigQueryDto {
  @ApiProperty({ type: String, pattern: '^[a-p]{32}$' })
  @Matches(/^[a-p]{32}$/)
  extensionId!: string;
}

/** Documents public login enablement without exposing configured credentials or other origins. */
export class ExtensionLoginConfigDto {
  @ApiProperty({ type: Number, enum: [1] })
  schemaVersion!: 1;

  @ApiProperty({ type: Boolean })
  googleEnabled!: boolean;

  @ApiProperty({ type: Boolean })
  extensionAllowed!: boolean;
}
