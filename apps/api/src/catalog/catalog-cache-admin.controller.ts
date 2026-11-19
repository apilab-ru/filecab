import type { CatalogCacheClearResponse } from '@filecab/contracts';
import { Controller, Delete, Inject, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiErrorDto } from '../http/openapi.dto';
import { RequestDtoPipe } from '../http/validation';
import { CatalogCacheClearQueryDto, CatalogCacheClearResponseDto } from './catalog-cache.dto';
import { CatalogCacheService } from './catalog-cache.service';
import { CatalogOperatorGuard } from './catalog-operator';

/** Lets catalog operators clear cached search pages and metadata. */
@ApiTags('Catalog administration')
@ApiBearerAuth()
@UseGuards(CatalogOperatorGuard)
@Controller('catalog/admin/cache')
export class CatalogCacheAdminController {
  constructor(@Inject(CatalogCacheService) private readonly cache: CatalogCacheService) {}

  @Delete()
  @ApiOperation({
    summary: 'Clear the catalog cache (operator only; no sign-in in development)',
    description:
      'Removes cached search pages and metadata of one provider, or of all providers when provider is omitted. Catalog identities and owner libraries do not change. The next search reads the provider again.',
  })
  @ApiResponse({ status: 200, type: CatalogCacheClearResponseDto })
  @ApiResponse({ status: 400, type: ApiErrorDto, description: 'Unknown provider' })
  @ApiResponse({ status: 403, type: ApiErrorDto, description: 'Catalog operator access required' })
  async clear(
    @Query(new RequestDtoPipe(CatalogCacheClearQueryDto)) query: CatalogCacheClearQueryDto,
  ): Promise<CatalogCacheClearResponse> {
    const removed = await this.cache.clear(query.provider);

    return { schemaVersion: 1, provider: query.provider ?? null, ...removed };
  }
}
