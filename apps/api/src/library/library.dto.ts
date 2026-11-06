import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsObject,
  IsIn,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { Category } from '@filecab/contracts';
import { EntryPatchDto } from '../contracts/entry-patch.dto';

/** Accepts editable creation fields and only an existing internal catalog association. */
export class CreateLibraryEntryDto extends EntryPatchDto {
  @ApiProperty({ type: String, enum: ['anime', 'films', 'tv'], required: true })
  @ValidateIf(() => true)
  @IsIn(['anime', 'films', 'tv'])
  declare category: Category;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @ValidateIf((_, value) => value !== undefined)
  @IsUUID('all')
  entryId?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Existing internal catalog identity. Snapshot is loaded server-side.',
  })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUUID('all')
  catalogId?: string | null;
}

/** Requires an exact canonical server version for a single-entry state change. */
export class ExpectedVersionDto {
  @ApiProperty({ type: String, pattern: '^[1-9][0-9]{0,127}$', example: '1' })
  @Matches(/^[1-9][0-9]{0,127}$/)
  expectedVersion!: string;
}

/** Combines expected-version concurrency protection with editable field allowlists. */
export class UpdateLibraryEntryDto extends EntryPatchDto {
  @ApiProperty({ type: String, pattern: '^[1-9][0-9]{0,127}$', example: '1' })
  @Matches(/^[1-9][0-9]{0,127}$/)
  expectedVersion!: string;
}

/** Selects two owned identities and explicit field choices for preview and merge. */
export class MergeEntriesDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('all')
  survivorId!: string;

  @ApiProperty({ type: String, pattern: '^[1-9][0-9]{0,127}$' })
  @Matches(/^[1-9][0-9]{0,127}$/)
  survivorVersion!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('all')
  removedId!: string;

  @ApiProperty({ type: String, pattern: '^[1-9][0-9]{0,127}$' })
  @Matches(/^[1-9][0-9]{0,127}$/)
  removedVersion!: string;

  @ApiProperty({
    type: () => EntryPatchDto,
    description:
      'Explicit surviving user-field choices; sourceUrls and category changes are rejected.',
  })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => EntryPatchDto)
  fields!: EntryPatchDto;
}

/** Selects exactly one source transfer, protected by both entry versions. */
export class ReassignSourceDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('all')
  fromId!: string;

  @ApiProperty({ type: String, pattern: '^[1-9][0-9]{0,127}$' })
  @Matches(/^[1-9][0-9]{0,127}$/)
  fromVersion!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('all')
  toId!: string;

  @ApiProperty({ type: String, pattern: '^[1-9][0-9]{0,127}$' })
  @Matches(/^[1-9][0-9]{0,127}$/)
  toVersion!: string;

  @ApiProperty({
    type: String,
    maxLength: 8192,
    description: 'Exact normalized URL currently attached to fromId.',
  })
  @IsString()
  @MaxLength(8192)
  normalizedUrl!: string;
}

/** Confirms the exact previously previewed merge choices. */
export class ApplyMergeDto extends MergeEntriesDto {
  @ApiProperty({ type: String, maxLength: 256 })
  @IsString()
  @MaxLength(256)
  previewToken!: string;
}

/** Confirms the exact previously previewed source movement. */
export class ApplyReassignmentDto extends ReassignSourceDto {
  @ApiProperty({ type: String, maxLength: 256 })
  @IsString()
  @MaxLength(256)
  previewToken!: string;
}
