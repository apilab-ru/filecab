import { Category, PageTextSource } from '@filecab/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const HOST = /^(?!www\.)[a-z0-9-]+(\.[a-z0-9-]+)+$/;

const NAME = /^[a-z0-9-]+$/;

const PATH = /^(\/[a-z0-9_*:-]+)+$/;

/** Validates one title rule. Rule values are plain strings, never code. */
export class PageTextRuleDto {
  @ApiProperty({ enum: PageTextSource })
  @IsEnum(PageTextSource)
  source!: PageTextSource;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  selector?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  removePrefix?: string[];

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  split?: string;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  part?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  before?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  removeSuffix?: string[];
}

/** Validates one category rule. */
export class PageCategoryRuleDto {
  @ApiProperty({ enum: PageTextSource })
  @IsEnum(PageTextSource)
  source!: PageTextSource;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  selector?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  startsWith?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contains?: string;

  @ApiProperty({ enum: Category })
  @IsEnum(Category)
  category!: Category;
}

/** Validates one URL path reference rule. */
export class PageReferenceRuleDto {
  @ApiProperty({ type: String })
  @Matches(NAME)
  namespace!: string;

  @ApiProperty({ type: String })
  @Matches(NAME)
  entity!: string;

  @ApiProperty({ type: String, example: '/film/:id' })
  @Matches(PATH)
  @MaxLength(100)
  path!: string;

  @ApiPropertyOptional({ enum: Category })
  @IsOptional()
  @IsEnum(Category)
  category?: Category;
}

/** Validates the rules of one site. */
export class PageSiteRuleDto {
  @ApiProperty({ type: String })
  @Matches(NAME)
  id!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @Matches(HOST, { each: true })
  hosts!: string[];

  @ApiPropertyOptional({ enum: Category })
  @IsOptional()
  @IsEnum(Category)
  category?: Category;

  @ApiProperty({ type: [PageTextRuleDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PageTextRuleDto)
  title!: PageTextRuleDto[];

  @ApiPropertyOptional({ type: [PageCategoryRuleDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PageCategoryRuleDto)
  categories?: PageCategoryRuleDto[];

  @ApiPropertyOptional({ type: [PageReferenceRuleDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PageReferenceRuleDto)
  references?: PageReferenceRuleDto[];

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  searchOnly?: boolean;
}

/** Validates and documents the served page rule configuration. */
export class PageRulesConfigDto {
  @ApiProperty({ type: Number, enum: [1] })
  @IsIn([1])
  schemaVersion!: 1;

  @ApiProperty({ type: Number })
  @IsInt()
  @Min(1)
  revision!: number;

  @ApiProperty({ type: Number })
  @IsInt()
  @Min(1)
  engineVersion!: number;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(50)
  @Matches(HOST, { each: true })
  excludedHosts!: string[];

  @ApiProperty({ type: [PageTextRuleDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PageTextRuleDto)
  fallback!: PageTextRuleDto[];

  @ApiProperty({ type: [PageSiteRuleDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PageSiteRuleDto)
  sites!: PageSiteRuleDto[];
}
