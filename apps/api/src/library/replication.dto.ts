import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Category, Status, type Snapshot } from '@filecab/contracts';
import { EntryDto, ServerEntryDto, SnapshotDto } from './response.dto';

/** Validates one original URL and its versioned normalized representation. */
export class ReplicationSourceDto {
  @ApiProperty({ type: String, maxLength: 8192 })
  @IsString()
  @MaxLength(8192)
  originalUrl!: string;

  @ApiProperty({ type: String, maxLength: 8192 })
  @IsString()
  @MaxLength(8192)
  normalizedUrl!: string;

  @ApiProperty({ type: String, enum: ['generic-v1'] })
  @Equals('generic-v1')
  policyVersion!: 'generic-v1';
}

/** Validates the full transport document; snapshots are compared with authoritative metadata. */
export class ReplicationEntryDto {
  @ApiProperty({ type: Number, enum: [1] }) @Equals(1) schemaVersion!: 1;
  @ApiProperty({ type: String, format: 'uuid' }) @IsUUID('all') entryId!: string;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  @ValidateIf((_, value) => value !== null)
  @IsUUID('all')
  catalogId!: string | null;
  @ApiProperty({ type: String, enum: Category }) @IsIn(Object.values(Category)) category!: Category;
  @ApiProperty({ type: String, maxLength: 10000 }) @IsString() @MaxLength(10000) userTitle!: string;
  @ApiProperty({ type: String, enum: [...Object.values(Status), null], nullable: true })
  @IsIn([...Object.values(Status), null])
  status!: Status | null;
  @ApiProperty({ type: Number, minimum: 0, maximum: 10 }) @IsInt() @Min(0) @Max(10) rating!: number;
  @ApiProperty({ type: Number, minimum: 0, maximum: Number.MAX_SAFE_INTEGER })
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  progress!: number;
  @ApiProperty({ type: String, maxLength: 100000 }) @IsString() @MaxLength(100000) comment!: string;
  @ApiProperty({ type: [ReplicationSourceDto], maxItems: 100 })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReplicationSourceDto)
  sources!: ReplicationSourceDto[];
  @ApiProperty({
    type: () => SnapshotDto,
    description: 'Must equal server-authoritative metadata.',
  })
  @IsObject()
  snapshot!: Snapshot;
  @ApiProperty({ type: String, format: 'date-time' })
  @IsISO8601({ strict: true })
  createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' })
  @IsISO8601({ strict: true })
  updatedAt!: string;
  @ApiProperty({ type: String, nullable: true, pattern: '^[1-9][0-9]{0,18}$' })
  @ValidateIf((_, value) => value !== null)
  @Matches(/^[1-9][0-9]{0,18}$/)
  serverVersion!: string | null;
  @ApiProperty({ type: Boolean }) @IsBoolean() deleted!: boolean;
}

/** Carries one assumed master and the proposed replacement document. */
export class ReplicationRowDto {
  @ApiProperty({ type: () => ReplicationEntryDto, nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => ReplicationEntryDto)
  assumedMaster!: ReplicationEntryDto | null;

  @ApiProperty({ type: () => ReplicationEntryDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => ReplicationEntryDto)
  proposed!: ReplicationEntryDto;
}

/** Bounds push work and rejects repeated identities within a single batch. */
export class ReplicationPushDto {
  @ApiProperty({ type: Number, enum: [1] }) @Equals(1) schemaVersion!: 1;
  @ApiProperty({ type: [ReplicationRowDto], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((row: ReplicationRowDto) => row?.proposed?.entryId)
  @ValidateNested({ each: true })
  @Type(() => ReplicationRowDto)
  rows!: ReplicationRowDto[];
}

/** Marks the last consumed owner revision without using floating point numbers. */
export class CheckpointDto {
  @ApiProperty({ type: String, pattern: '^(0|[1-9][0-9]{0,18})$' })
  @Matches(/^(0|[1-9][0-9]{0,18})$/)
  cursor!: string;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  @ValidateIf((_, value) => value !== null)
  @IsUUID('all')
  entryId!: string | null;
}

/** Bounds each pull independently of display pagination. */
export class ReplicationPullDto {
  @ApiProperty({ type: Number, enum: [1] }) @Equals(1) schemaVersion!: 1;
  @ApiProperty({ type: () => CheckpointDto, nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => CheckpointDto)
  checkpoint!: CheckpointDto | null;
  @ApiProperty({ type: Number, minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  limit!: number;
}

/** Documents complete changed states and the consumed change-feed position. */
export class ReplicationPullResponseDto {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ type: [ServerEntryDto] }) documents!: ServerEntryDto[];
  @ApiProperty({ type: () => CheckpointDto }) checkpoint!: CheckpointDto;
  @ApiProperty({ type: Boolean }) hasMore!: boolean;
}

/** Documents a rejection without exposing another owner's state. */
export class ReplicationConflictDto {
  @ApiProperty({ type: String, format: 'uuid' }) entryId!: string;
  @ApiProperty({ type: String, enum: ['VERSION', 'IDENTITY', 'SOURCE', 'CATEGORY'] })
  reason!: string;
  @ApiProperty({ type: () => EntryDto, nullable: true }) serverDocument!: ServerEntryDto | null;
}

/** Returns rejected rows; accepted states arrive through checkpoint pull. */
export class ReplicationPushResponseDto {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ type: [ReplicationConflictDto] }) conflicts!: ReplicationConflictDto[];
}
