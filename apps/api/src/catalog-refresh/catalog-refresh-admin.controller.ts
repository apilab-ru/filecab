import type { CatalogRefreshStatus } from '@filecab/contracts';
import { Body, Controller, Get, HttpCode, Inject, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CatalogOperatorGuard } from '../catalog/catalog-operator';
import { ApiErrorDto } from '../http/openapi.dto';
import { RequestDtoPipe } from '../http/validation';
import { CatalogRefreshProviderDto, CatalogRefreshStatusDto } from './catalog-refresh.dto';
import { CATALOG_REFRESH_TARGETS, CatalogRefreshRunner } from './catalog-refresh-runner';

/** Lets catalog operators start and read the detail refresh job of a provider. */
@ApiTags('Catalog administration')
@ApiBearerAuth()
@UseGuards(CatalogOperatorGuard)
@ApiResponse({ status: 400, type: ApiErrorDto, description: 'Unknown provider' })
@ApiResponse({ status: 403, type: ApiErrorDto, description: 'Catalog operator access required' })
@Controller('catalog/admin/refresh')
export class CatalogRefreshAdminController {
  constructor(@Inject(CatalogRefreshRunner) private readonly runner: CatalogRefreshRunner) {}

  @Get()
  @ApiOperation({
    summary: 'Read the latest detail refresh job (operator only; no sign-in in development)',
  })
  @ApiQuery({ name: 'provider', enum: Object.keys(CATALOG_REFRESH_TARGETS), required: true })
  @ApiResponse({ status: 200, type: CatalogRefreshStatusDto })
  status(
    @Query(new RequestDtoPipe(CatalogRefreshProviderDto)) query: CatalogRefreshProviderDto,
  ): Promise<CatalogRefreshStatus> {
    return this.runner.status(query.provider);
  }

  @Post()
  @HttpCode(202)
  @ApiOperation({
    summary: 'Start a detail refresh job (operator only; no sign-in in development)',
    description:
      'Reads the provider details of stored catalog items again: items without a description, with an unknown episode total or count, or with fewer available episodes than declared. Linked library entries receive the new metadata. The server also starts the job at CATALOG_REFRESH_INTERVAL_SECONDS. When a job is active, the route returns it.',
  })
  @ApiBody({ type: CatalogRefreshProviderDto })
  @ApiResponse({ status: 202, type: CatalogRefreshStatusDto })
  @ApiResponse({ status: 503, type: ApiErrorDto, description: 'Provider details are unavailable' })
  start(
    @Body(new RequestDtoPipe(CatalogRefreshProviderDto)) body: CatalogRefreshProviderDto,
  ): Promise<CatalogRefreshStatus> {
    return this.runner.start(body.provider);
  }
}
