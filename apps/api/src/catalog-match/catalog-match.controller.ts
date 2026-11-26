import { Body, Controller, Get, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { CatalogMatchStatus } from '@filecab/contracts';
import { AuthGuard, CurrentAccount } from '../auth/auth.guard';
import type { AuthIdentity } from '../auth/auth.service';
import { ApiErrorDto } from '../http/openapi.dto';
import { RequestDtoPipe } from '../http/validation';
import { CatalogMatchStartDto, CatalogMatchStatusDto } from './catalog-match.dto';
import { CatalogMatchService } from './catalog-match.service';

@ApiTags('Library')
@ApiBearerAuth()
@ApiCookieAuth()
@ApiResponse({ status: 401, type: ApiErrorDto, description: 'Authentication required' })
@Controller('library/catalog-match')
@UseGuards(AuthGuard)
export class CatalogMatchController {
  constructor(@Inject(CatalogMatchService) private readonly service: CatalogMatchService) {}

  @Get()
  @ApiOperation({ summary: 'Read the latest catalog data job of each provider' })
  @ApiResponse({ status: 200, type: CatalogMatchStatusDto })
  status(@CurrentAccount() account: AuthIdentity): Promise<CatalogMatchStatus> {
    return this.service.status(account.ownerId);
  }

  @Post()
  @HttpCode(202)
  @ApiOperation({
    summary: 'Find catalog data for entries without a catalog item',
    description:
      'Each provider has its own job. Entries go to the job of the default provider of their category; entries of a provider with an active job join it. Without entries, the jobs take all active entries without a catalog item. Only exact matches link: a resolved reference, or exactly one result with the same title (and year, when the entry has one). A job pauses at its provider limits and continues later.',
  })
  @ApiBody({ type: CatalogMatchStartDto })
  @ApiResponse({ status: 202, type: CatalogMatchStatusDto })
  @ApiResponse({
    status: 409,
    type: ApiErrorDto,
    description: 'Another request started a job at the same time',
  })
  start(
    @CurrentAccount() account: AuthIdentity,
    @Body(new RequestDtoPipe(CatalogMatchStartDto)) input: CatalogMatchStartDto,
  ): Promise<CatalogMatchStatus> {
    return this.service.start(account.ownerId, input.entries);
  }

  @Post('stop')
  @HttpCode(200)
  @ApiOperation({ summary: 'Stop the active catalog data jobs. Linked entries stay linked.' })
  @ApiResponse({ status: 200, type: CatalogMatchStatusDto })
  stop(@CurrentAccount() account: AuthIdentity): Promise<CatalogMatchStatus> {
    return this.service.stop(account.ownerId);
  }
}
