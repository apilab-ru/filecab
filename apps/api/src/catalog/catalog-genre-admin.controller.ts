import {
  ApiErrorCode,
  type GenreRefreshResponse,
  type GenreReviewResponse,
} from '@filecab/contracts';
import { Body, Controller, Get, Inject, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard, CurrentAccount } from '../auth/auth.guard';
import { AUTH_ENVIRONMENT } from '../auth/credentials';
import type { AuthIdentity } from '../auth/auth.service';
import { ApiException } from '../http/api-error';
import type { ApiEnvironment } from '../config/environment';
import { ApiErrorDto } from '../http/openapi.dto';
import { RequestDtoPipe } from '../http/validation';
import {
  CatalogGenreRefreshRequestDto,
  CatalogGenreRefreshResponseDto,
  CatalogGenreReviewQueryDto,
  CatalogGenreReviewResponseDto,
} from './catalog-genre.dto';
import { CatalogGenreService } from './catalog-genre.service';

/** Rejects authenticated accounts not explicitly configured as catalog operators. */
function assertCatalogOperator(ownerId: string, operators: readonly string[]): void {
  if (!operators.includes(ownerId))
    throw new ApiException(403, ApiErrorCode.Forbidden, 'Catalog operator access is required');
}

/** Protects genre refresh and mapping review with the configured operator allowlist. */
@ApiTags('Catalog administration')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('catalog/admin/genres')
export class CatalogGenreAdminController {
  constructor(
    @Inject(AUTH_ENVIRONMENT) private readonly environment: ApiEnvironment,
    @Inject(CatalogGenreService) private readonly genres: CatalogGenreService,
  ) {}

  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh one provider genre list (operator only)',
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
    @CurrentAccount() identity: AuthIdentity,
    @Body(new RequestDtoPipe(CatalogGenreRefreshRequestDto)) body: CatalogGenreRefreshRequestDto,
  ): Promise<GenreRefreshResponse> {
    assertCatalogOperator(identity.ownerId, this.environment.catalog.operatorAccountIds);

    return this.genres.refresh(body.provider, body.locale);
  }

  @Get('review')
  @ApiOperation({
    summary: 'Read unknown genre mappings and unresolved conflicts (operator only)',
    description: 'This route is read-only and does not refresh or resolve provider mappings.',
  })
  @ApiQuery({ name: 'provider', type: String, required: false })
  @ApiResponse({ status: 200, type: CatalogGenreReviewResponseDto })
  @ApiResponse({ status: 403, type: ApiErrorDto, description: 'Catalog operator access required' })
  async review(
    @CurrentAccount() identity: AuthIdentity,
    @Query(new RequestDtoPipe(CatalogGenreReviewQueryDto)) query: CatalogGenreReviewQueryDto,
  ): Promise<GenreReviewResponse> {
    assertCatalogOperator(identity.ownerId, this.environment.catalog.operatorAccountIds);

    return this.genres.review(query.provider);
  }
}
