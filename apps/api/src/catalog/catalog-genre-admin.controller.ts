import type { GenreRefreshResponse, GenreReviewResponse } from '@filecab/contracts';
import { Body, Controller, Get, Inject, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorDto } from '../http/openapi.dto';
import { RequestDtoPipe } from '../http/validation';
import {
  CatalogGenreRefreshRequestDto,
  CatalogGenreRefreshResponseDto,
  CatalogGenreReviewQueryDto,
  CatalogGenreReviewResponseDto,
} from './catalog-genre.dto';
import { CatalogGenreService } from './catalog-genre.service';
import { CatalogOperatorGuard } from './catalog-operator';

/** Protects genre refresh and mapping review with the configured operator allowlist. */
@ApiTags('Catalog administration')
@ApiBearerAuth()
@UseGuards(CatalogOperatorGuard)
@Controller('catalog/admin/genres')
export class CatalogGenreAdminController {
  constructor(@Inject(CatalogGenreService) private readonly genres: CatalogGenreService) {}

  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh one provider genre list (operator only; no sign-in in development)',
    description:
      'Requires an authenticated account ID in CATALOG_OPERATOR_ACCOUNT_IDS. Unknown provider genres and conflicting canonical keys are preserved for review.',
  })
  @ApiResponse({ status: 200, type: CatalogGenreRefreshResponseDto })
  @ApiResponse({ status: 403, type: ApiErrorDto, description: 'Catalog operator access required' })
  @ApiResponse({
    status: 429,
    type: ApiErrorDto,
    description: 'Provider or local refresh budget exceeded',
  })
  @ApiResponse({
    status: 502,
    type: ApiErrorDto,
    description: 'Provider genre response was invalid',
  })
  @ApiResponse({
    status: 503,
    type: ApiErrorDto,
    description: 'Provider genre operation unavailable',
  })
  @ApiResponse({ status: 504, type: ApiErrorDto, description: 'Provider genre request timed out' })
  async refresh(
    @Body(new RequestDtoPipe(CatalogGenreRefreshRequestDto)) body: CatalogGenreRefreshRequestDto,
  ): Promise<GenreRefreshResponse> {
    return this.genres.refresh(body.provider, body.locale);
  }

  @Get('review')
  @ApiOperation({
    summary:
      'Read unknown genre mappings and unresolved conflicts (operator only; no sign-in in development)',
    description: 'This route is read-only and does not refresh or resolve provider mappings.',
  })
  @ApiQuery({ name: 'provider', type: String, required: false })
  @ApiResponse({ status: 200, type: CatalogGenreReviewResponseDto })
  @ApiResponse({ status: 403, type: ApiErrorDto, description: 'Catalog operator access required' })
  async review(
    @Query(new RequestDtoPipe(CatalogGenreReviewQueryDto)) query: CatalogGenreReviewQueryDto,
  ): Promise<GenreReviewResponse> {
    return this.genres.review(query.provider);
  }
}
