import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CatalogMatchTargetDto } from '../catalog-match/catalog-match.dto';
import { ArrayMaxSize, IsArray, IsInt, IsString, MaxLength, Min } from 'class-validator';
import {
  Category,
  LIBRARY_IMPORT_MAX_BYTES,
  LIBRARY_IMPORT_MAX_ROWS,
  LibraryImportIssueCode,
  LibraryImportOutcome,
  LibraryImportReason,
  Status,
} from '@filecab/contracts';

/** Carries a CSV file. The parser checks the 10 MiB byte limit and the format. */
export class LibraryImportPreviewRequestDto {
  @ApiProperty({ type: String, maxLength: LIBRARY_IMPORT_MAX_BYTES })
  @IsString()
  @MaxLength(LIBRARY_IMPORT_MAX_BYTES)
  csv!: string;
}

/** Adds the selected rows of a previewed CSV file. */
export class LibraryImportRequestDto extends LibraryImportPreviewRequestDto {
  @ApiProperty({ type: [Number], maxItems: LIBRARY_IMPORT_MAX_ROWS })
  @IsArray()
  @ArrayMaxSize(LIBRARY_IMPORT_MAX_ROWS)
  @IsInt({ each: true })
  @Min(2, { each: true })
  lines!: number[];

  @ApiProperty({ type: String, maxLength: 200 })
  @IsString()
  @MaxLength(200)
  confirmationToken!: string;
}

/** Documents one import file error. */
export class LibraryImportIssueDto {
  @ApiProperty({ type: Number, description: 'Line 1 is the header. Line 0 is the whole file.' })
  line!: number;
  @ApiProperty({ type: String, nullable: true }) column!: string | null;
  @ApiProperty({ enum: LibraryImportIssueCode, enumName: 'LibraryImportIssueCode' })
  code!: LibraryImportIssueCode;
}

/** Documents a provider reference of an import row. */
export class LibraryImportReferenceDto {
  @ApiProperty({ type: String }) namespace!: string;
  @ApiProperty({ type: String }) entity!: string;
  @ApiProperty({ type: String }) id!: string;
}

/** Documents one planned import row. */
export class LibraryImportPlanRowDto {
  @ApiProperty({ type: Number }) line!: number;
  @ApiProperty({ enum: Category, enumName: 'Category' }) category!: Category;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ type: Number, nullable: true }) year!: number | null;
  @ApiProperty({ enum: Status, enumName: 'Status', nullable: true }) status!: Status | null;
  @ApiProperty({ type: Boolean }) statusFromRating!: boolean;
  @ApiProperty({ type: Number }) rating!: number;
  @ApiProperty({ type: Number }) progress!: number;
  @ApiProperty({ type: String }) comment!: string;
  @ApiProperty({ type: String, nullable: true }) link!: string | null;
  @ApiPropertyOptional({ type: () => LibraryImportReferenceDto, nullable: true })
  reference!: LibraryImportReferenceDto | null;
  @ApiProperty({ enum: LibraryImportOutcome, enumName: 'LibraryImportOutcome' })
  outcome!: LibraryImportOutcome;
  @ApiProperty({ enum: LibraryImportReason, enumName: 'LibraryImportReason', nullable: true })
  reason!: LibraryImportReason | null;
}

/** Documents an import preview. A file with issues has no rows and no token. */
export class LibraryImportPreviewDto {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ type: () => [LibraryImportIssueDto] }) issues!: LibraryImportIssueDto[];
  @ApiProperty({ type: () => [LibraryImportPlanRowDto] }) rows!: LibraryImportPlanRowDto[];
  @ApiProperty({ type: String, nullable: true }) confirmationToken!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) expiresAt!: string | null;
}

/** Documents the counts of an import. */
export class LibraryImportSummaryDto {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ type: Number }) added!: number;
  @ApiProperty({ type: Number }) skipped!: number;
  @ApiProperty({ type: () => [CatalogMatchTargetDto] }) entries!: CatalogMatchTargetDto[];
}
