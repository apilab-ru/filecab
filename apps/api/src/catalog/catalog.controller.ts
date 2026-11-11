import {
  ApiErrorCode,
  Category,
  type CatalogCapabilities,
  type CatalogRecord,
} from '@filecab/contracts';
import { Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { ApiException } from '../http/api-error';
import { ApiErrorDto } from '../http/openapi.dto';
import { RequestDtoPipe } from '../http/validation';
import { CatalogCacheService } from './catalog-cache.service';
import {
  CatalogCapabilitiesDto,
  CatalogDetailsQueryDto,
  CatalogRecordDto,
  CatalogSearchRequestDto,
  CatalogSearchResponseDto,
} from './catalog.dto';
import { CatalogSearchService } from './catalog-search.service';

/** Exposes public provider-independent catalog discovery and identity reads. */
@ApiTags('Catalog')
@ApiResponse({ status: 400, type: ApiErrorDto, description: 'Invalid catalog identity' })
@ApiResponse({ status: 404, type: ApiErrorDto, description: 'Catalog record not found' })
@ApiResponse({ status: 409, type: ApiErrorDto, description: 'Provider reference conflict' })
@Controller('catalog')
export class CatalogController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(CatalogSearchService) private readonly catalog: CatalogSearchService,
    @Inject(CatalogCacheService) private readonly cache: CatalogCacheService,
  ) {}

  @Get('capabilities')
  @ApiOperation({
    summary: 'Read catalog provider defaults and active adapter capabilities',
    description:
      'Only verified, wired adapters appear in providers. An empty list means no catalog search operation is currently available.',
  })
  @ApiResponse({ status: 200, type: CatalogCapabilitiesDto })
  capabilities(): CatalogCapabilities {
    return this.catalog.capabilities();
  }

  @Get('search')
  @ApiQuery({ name: 'category', enum: Category, required: true })
  @ApiQuery({ name: 'provider', type: String, required: false })
  @ApiQuery({ name: 'query', type: String, required: true })
  @ApiQuery({ name: 'locale', enum: ['en', 'ru'], required: true })
  @ApiQuery({ name: 'page', type: Number, required: true, minimum: 1 })
  @ApiQuery({ name: 'pageSize', type: Number, required: true, minimum: 1, maximum: 50 })
  @ApiQuery({ name: 'filters', type: String, required: false })
  @ApiQuery({ name: 'order', type: String, required: false })
  @ApiOperation({
    summary: 'Search one selected catalog provider',
    description:
      'GET /api/v1/catalog/search. The provider is explicit or the category default. Filters may be supplied as a JSON-encoded query value. Unsupported provider capabilities fail instead of being ignored.',
  })
  @ApiResponse({ status: 200, type: CatalogSearchResponseDto })
  @ApiResponse({ status: 502, type: ApiErrorDto, description: 'Provider response was invalid' })
  @ApiResponse({ status: 503, type: ApiErrorDto, description: 'Selected provider unavailable' })
  search(@Query(new RequestDtoPipe(CatalogSearchRequestDto)) input: CatalogSearchRequestDto) {
    return this.catalog.search(input);
  }

  @Get('items/:catalogId')
  @ApiParam({ name: 'catalogId', format: 'uuid' })
  @ApiOperation({
    summary: 'Read normalized catalog details by internal catalog ID',
    description: 'GET /api/v1/catalog/items/{catalogId}.',
  })
  @ApiQuery({ name: 'locale', enum: ['en', 'ru'], required: false })
  @ApiResponse({ status: 200, type: CatalogRecordDto })
  async details(
    @Param('catalogId', new ParseUUIDPipe({ version: 'all' })) catalogId: string,
    @Query(new RequestDtoPipe(CatalogDetailsQueryDto)) query: CatalogDetailsQueryDto,
  ): Promise<CatalogRecord & { cachedAt?: string }> {
    if (query.locale) {
      let cached;

      try {
        cached = await this.cache.getMetadata(catalogId, query.locale);
      } catch {
        // Cache availability must not block the canonical catalog detail read.
      }

      if (cached)
        return {
          ...cached.record,
          cachedAt: cached.fetchedAt.toISOString(),
        };
    }

    const item = await this.auth.database.catalogItem.findUnique({ where: { id: catalogId } });

    if (!item) throw new ApiException(404, ApiErrorCode.NotFound, 'Catalog record not found');

    return {
      schemaVersion: 1,
      catalogId: item.id,
      category: item.category as Category,
      granularity: item.granularity as CatalogRecord['granularity'],
      snapshot: item.snapshot as unknown as CatalogRecord['snapshot'],
    };
  }

  @Get('references/:namespace/:entity/:id')
  @ApiParam({ name: 'namespace', type: String })
  @ApiParam({ name: 'entity', type: String })
  @ApiParam({ name: 'id', type: String, example: '00123' })
  @ApiOperation({
    summary: 'Resolve an exact provider reference to normalized catalog details',
    description:
      'GET /api/v1/catalog/references/{namespace}/{entity}/{id}. The string ID is matched exactly, including leading zeros.',
  })
  @ApiResponse({ status: 200, type: CatalogRecordDto })
  async resolveReference(
    @Param('namespace') namespace: string,
    @Param('entity') entity: string,
    @Param('id') id: string,
  ): Promise<CatalogRecord> {
    const reference = await this.auth.database.catalogReference.findUnique({
      where: { namespace_entity_externalId: { namespace, entity, externalId: id } },
      include: { catalog: true },
    });

    if (!reference)
      throw new ApiException(404, ApiErrorCode.NotFound, 'Catalog reference not found');

    return {
      schemaVersion: 1,
      catalogId: reference.catalog.id,
      category: reference.catalog.category as Category,
      granularity: reference.catalog.granularity as CatalogRecord['granularity'],
      snapshot: reference.catalog.snapshot as unknown as CatalogRecord['snapshot'],
    };
  }
}
