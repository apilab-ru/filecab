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

/** Confirms the exact previously previewed merge choices. */
export class ApplyMergeDto extends MergeEntriesDto {
  @ApiProperty({ type: String, maxLength: 256 })
  @IsString()
  @MaxLength(256)
  previewToken!: string;
}

/** Validates a version-bound catalog association and optional donor selection. */
export class CatalogAssociationDto extends ExpectedVersionDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('all')
  entryId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID('all')
  catalogId!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @ValidateIf((_, value) => value !== undefined)
  @IsUUID('all')
  mergeEntryId?: string;

  @ApiPropertyOptional({ type: String })
  @ValidateIf((_, value) => value !== undefined)
  @Matches(/^[1-9][0-9]{0,127}$/)
  mergeExpectedVersion?: string;

  @ApiProperty({ type: () => EntryPatchDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => EntryPatchDto)
  fields!: EntryPatchDto;
}

/** Confirms the exact catalog association preview. */
export class ApplyCatalogAssociationDto extends CatalogAssociationDto {
  @ApiProperty({ type: String, maxLength: 256 })
  @IsString()
  @MaxLength(256)
  previewToken!: string;
}
