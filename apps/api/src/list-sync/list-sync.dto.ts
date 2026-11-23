import { ApiProperty, ApiPropertyOptional, type ApiPropertyOptions } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  Category,
  ListSyncErrorCode,
  ListSyncField,
  ListSyncIssue,
  ListSyncJobKind,
  ListSyncJobState,
  ListSyncOutcome,
  ListSyncState,
  Status,
} from '@filecab/contracts';

/** A preview has at most this many additions and changes, like the import row limit. */
const MAX_SELECTION = 10000;

/** Selects the fields of one previewed change. */
export class ListSyncChangeSelectionDto {
  @ApiProperty({ type: String, maxLength: 200 }) @IsString() @MaxLength(200) key!: string;
  @ApiProperty({ enum: ListSyncField, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsIn(Object.values(ListSyncField), { each: true })
  fields!: ListSyncField[];
}

/** Applies the selected additions and field changes of the open import preview. */
export class ListSyncImportApplyDto {
  @ApiProperty({ type: String, format: 'uuid' }) @IsUUID('all') jobId!: string;
  @ApiProperty({ type: String, isArray: true, description: 'Keys of the additions to add' })
  @IsArray()
  @ArrayMaxSize(MAX_SELECTION)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  additions!: string[];
  @ApiProperty({ type: ListSyncChangeSelectionDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(MAX_SELECTION)
  @ValidateNested({ each: true })
  @Type(() => ListSyncChangeSelectionDto)
  changes!: ListSyncChangeSelectionDto[];
}

/** Documents the transferable values of one item. */
export class ListSyncValuesDto {
  @ApiProperty({ enum: Status, nullable: true }) status!: Status | null;
  @ApiProperty({ type: Number, minimum: 0, maximum: 10 }) rating!: number;
  @ApiProperty({ type: Number, minimum: 0 }) progress!: number;
}

/** Documents one skipped or failed item. */
export class ListSyncItemReportDto {
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) entryId!: string | null;
  @ApiProperty({ enum: ListSyncOutcome }) outcome!: ListSyncOutcome;
  @ApiProperty({ enum: ListSyncIssue, nullable: true }) issue!: ListSyncIssue | null;
}

/** Documents the result of a finished export or import apply job. */
export class ListSyncJobResultDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'integer' },
    description: 'Item count for each ListSyncOutcome value',
  })
  counts!: Record<string, number>;
  @ApiProperty({ type: ListSyncItemReportDto, isArray: true }) items!: ListSyncItemReportDto[];
}

/** Documents job progress. */
export class ListSyncProgressDto {
  @ApiProperty({ type: Number }) done!: number;
  @ApiProperty({ type: Number }) total!: number;
}

/** Documents a durable export or import job. */
export class ListSyncJobDto {
  @ApiProperty({ type: String, format: 'uuid' }) jobId!: string;
  @ApiProperty({ enum: ListSyncJobKind }) kind!: ListSyncJobKind;
  @ApiProperty({ enum: ListSyncJobState }) state!: ListSyncJobState;
  @ApiProperty({ type: ListSyncProgressDto }) progress!: ListSyncProgressDto;
  @ApiProperty({ type: ListSyncJobResultDto, nullable: true }) result!: ListSyncJobResultDto | null;
  @ApiProperty({ enum: ListSyncErrorCode, nullable: true }) error!: ListSyncErrorCode | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) finishedAt!: string | null;
}

/** Documents a connected remote account. Credentials never appear. */
export class ListSyncConnectionDto {
  @ApiProperty({ type: String }) accountId!: string;
  @ApiProperty({ type: String }) accountName!: string;
  @ApiProperty({ enum: ListSyncState }) state!: ListSyncState;
  @ApiProperty({ enum: ListSyncField, isArray: true }) fields!: ListSyncField[];
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) lastExportAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) lastImportAt!: string | null;
  @ApiProperty({ type: ListSyncJobDto, nullable: true }) job!: ListSyncJobDto | null;
  @ApiProperty({ type: Boolean }) previewReady!: boolean;
}

/** Documents one registered list provider. */
export class ListSyncProviderDto {
  @ApiProperty({ type: String, example: 'shikimori' }) provider!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ enum: Category, isArray: true }) categories!: Category[];
  @ApiPropertyOptional({ type: ListSyncConnectionDto, nullable: true })
  connection!: ListSyncConnectionDto | null;
}

/** Documents the list providers and the connections of the account. */
export class ListSyncOverviewDto {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ type: ListSyncProviderDto, isArray: true }) providers!: ListSyncProviderDto[];
}

/** Documents the provider consent address. */
export class ListSyncAuthorizationDto {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ type: String, format: 'uri' }) authorizationUrl!: string;
}

/** Documents an addition of an import preview. */
export class ListSyncImportAdditionDto {
  @ApiProperty({ type: String }) key!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ enum: Category }) category!: Category;
  @ApiProperty({ type: ListSyncValuesDto }) values!: ListSyncValuesDto;
}

/** Documents a field value: a status for `status`, a number for `rating` and `progress`. */
const FIELD_VALUE: ApiPropertyOptions = {
  type: 'string',
  oneOf: [{ type: 'string', enum: Object.values(Status) }, { type: 'number' }],
  nullable: true,
};

/** Documents one different field. */
export class ListSyncFieldChangeDto {
  @ApiProperty({ enum: ListSyncField }) field!: ListSyncField;
  @ApiProperty(FIELD_VALUE) current!: string | number | null;
  @ApiProperty(FIELD_VALUE) incoming!: string | number | null;
}

/** Documents a change of an import preview. */
export class ListSyncImportChangeDto {
  @ApiProperty({ type: String }) key!: string;
  @ApiProperty({ type: String, format: 'uuid' }) entryId!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ type: ListSyncFieldChangeDto, isArray: true }) fields!: ListSyncFieldChangeDto[];
}

/** Documents an import preview. */
export class ListSyncImportPreviewDto {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ type: String, format: 'uuid' }) jobId!: string;
  @ApiProperty({ type: ListSyncImportAdditionDto, isArray: true })
  additions!: ListSyncImportAdditionDto[];
  @ApiProperty({ type: ListSyncImportChangeDto, isArray: true })
  changes!: ListSyncImportChangeDto[];
  @ApiProperty({ type: Number }) unchanged!: number;
}
