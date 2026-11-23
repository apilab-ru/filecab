import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

/** An empty value, or 3 to 32 letters, digits, `-` and `_`, which start with a letter or digit. */
export const USERNAME_INPUT = /^(?:|[A-Za-z0-9][A-Za-z0-9_-]{2,31})$/;

/** Sets or clears the public library username. An empty string turns public access off. */
export class UsernameDto {
  @ApiProperty({ type: String, maxLength: 32, pattern: USERNAME_INPUT.source, example: 'anna' })
  @IsString()
  @MaxLength(32)
  @Matches(USERNAME_INPUT)
  username!: string;
}

/** Documents the public library username of the account. */
export class AccountUsernameDto {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ type: String, nullable: true, example: 'anna' }) username!: string | null;
}
