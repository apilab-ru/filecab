import {
  ListSyncJobKind,
  type ListSyncAuthorization,
  type ListSyncImportPreview,
  type ListSyncJob,
  type ListSyncOverview,
} from '@filecab/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthGuard, CurrentAccount } from '../auth/auth.guard';
import type { AuthIdentity } from '../auth/auth.service';
import { ApiErrorDto } from '../http/openapi.dto';
import { RequestDtoPipe } from '../http/validation';
import {
  ListSyncAuthorizationDto,
  ListSyncImportApplyDto,
  ListSyncImportPreviewDto,
  ListSyncJobDto,
  ListSyncOverviewDto,
} from './list-sync.dto';
import { ListSyncService } from './list-sync.service';

/** Owner routes of external list connections. Clients never send or receive provider tokens. */
@ApiTags('External lists')
@ApiBearerAuth()
@ApiCookieAuth()
@ApiResponse({ status: 401, type: ApiErrorDto, description: 'Authentication required' })
@ApiResponse({ status: 404, type: ApiErrorDto, description: 'Unknown provider or no connection' })
@ApiResponse({
  status: 409,
  type: ApiErrorDto,
  description: 'The connection state or a running job does not permit the action',
})
@Controller('list-sync')
export class ListSyncController {
  constructor(@Inject(ListSyncService) private readonly service: ListSyncService) {}

  @Get()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'List the providers, connections and latest jobs of the account' })
  @ApiResponse({ status: 200, type: ListSyncOverviewDto })
  overview(@CurrentAccount() account: AuthIdentity): Promise<ListSyncOverview> {
    return this.service.overview(account.ownerId);
  }

  @Post(':provider/authorize')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiParam({ name: 'provider' })
  @ApiOperation({
    summary: 'Start provider consent',
    description:
      'Returns the provider address. After consent the provider returns to the callback, which redirects to Settings. A connected account must be disconnected before another account links.',
  })
  @ApiResponse({ status: 200, type: ListSyncAuthorizationDto })
  authorize(
    @CurrentAccount() account: AuthIdentity,
    @Param('provider') provider: string,
  ): Promise<ListSyncAuthorization> {
    return this.service.authorize(account.ownerId, provider);
  }

  @Get(':provider/callback')
  @ApiParam({ name: 'provider' })
  @ApiOperation({
    summary: 'Provider consent callback',
    description:
      'The single-use state binds the request to its owner. Redirects to Settings with listSync and listSyncResult query parameters.',
  })
  @ApiResponse({ status: 302, description: 'Redirect to Settings' })
  async callback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    response.redirect(
      302,
      await this.service.callback(
        provider,
        typeof code === 'string' ? code : undefined,
        typeof state === 'string' ? state : undefined,
      ),
    );
  }

  @Post(':provider/pause')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiParam({ name: 'provider' })
  @ApiOperation({ summary: 'Pause new jobs. The connection data stays.' })
  @ApiResponse({ status: 200, type: ListSyncOverviewDto })
  pause(
    @CurrentAccount() account: AuthIdentity,
    @Param('provider') provider: string,
  ): Promise<ListSyncOverview> {
    return this.service.setPaused(account.ownerId, provider, true);
  }

  @Post(':provider/resume')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiParam({ name: 'provider' })
  @ApiResponse({ status: 200, type: ListSyncOverviewDto })
  resume(
    @CurrentAccount() account: AuthIdentity,
    @Param('provider') provider: string,
  ): Promise<ListSyncOverview> {
    return this.service.setPaused(account.ownerId, provider, false);
  }

  @Delete(':provider')
  @UseGuards(AuthGuard)
  @ApiParam({ name: 'provider' })
  @ApiOperation({
    summary: 'Disconnect the account',
    description:
      'Deletes credentials, mappings and jobs, and revokes upstream tokens when possible. Filecab entries stay.',
  })
  @ApiResponse({ status: 200, type: ListSyncOverviewDto })
  disconnect(
    @CurrentAccount() account: AuthIdentity,
    @Param('provider') provider: string,
  ): Promise<ListSyncOverview> {
    return this.service.disconnect(account.ownerId, provider);
  }

  @Post(':provider/export')
  @HttpCode(202)
  @UseGuards(AuthGuard)
  @ApiParam({ name: 'provider' })
  @ApiOperation({
    summary: 'Queue an export',
    description:
      'Filecab values replace remote values. Never deletes remote records. Read the job through the overview.',
  })
  @ApiResponse({ status: 202, type: ListSyncJobDto })
  export(
    @CurrentAccount() account: AuthIdentity,
    @Param('provider') provider: string,
  ): Promise<ListSyncJob> {
    return this.service.start(account.ownerId, provider, ListSyncJobKind.Export);
  }

  @Post(':provider/import')
  @HttpCode(202)
  @UseGuards(AuthGuard)
  @ApiParam({ name: 'provider' })
  @ApiOperation({
    summary: 'Queue an import preview',
    description: 'Reads the remote list and stores a preview. Changes nothing in Filecab.',
  })
  @ApiResponse({ status: 202, type: ListSyncJobDto })
  import(
    @CurrentAccount() account: AuthIdentity,
    @Param('provider') provider: string,
  ): Promise<ListSyncJob> {
    return this.service.start(account.ownerId, provider, ListSyncJobKind.ImportPreview);
  }

  @Get(':provider/import/preview')
  @UseGuards(AuthGuard)
  @ApiParam({ name: 'provider' })
  @ApiResponse({ status: 200, type: ListSyncImportPreviewDto })
  preview(
    @CurrentAccount() account: AuthIdentity,
    @Param('provider') provider: string,
  ): Promise<ListSyncImportPreview> {
    return this.service.preview(account.ownerId, provider);
  }

  @Post(':provider/import/apply')
  @HttpCode(202)
  @UseGuards(AuthGuard)
  @ApiParam({ name: 'provider' })
  @ApiOperation({
    summary: 'Queue the selected additions and changes of the open preview',
    description:
      'Remote values replace the selected Filecab fields. An entry that changed after the preview is skipped.',
  })
  @ApiBody({ type: ListSyncImportApplyDto })
  @ApiResponse({ status: 202, type: ListSyncJobDto })
  apply(
    @CurrentAccount() account: AuthIdentity,
    @Param('provider') provider: string,
    @Body(new RequestDtoPipe(ListSyncImportApplyDto)) input: ListSyncImportApplyDto,
  ): Promise<ListSyncJob> {
    return this.service.apply(account.ownerId, provider, input);
  }

  @Delete(':provider/import/preview')
  @UseGuards(AuthGuard)
  @ApiParam({ name: 'provider' })
  @ApiOperation({ summary: 'Cancel the open import preview. Changes nothing.' })
  @ApiResponse({ status: 200, type: ListSyncOverviewDto })
  cancelPreview(
    @CurrentAccount() account: AuthIdentity,
    @Param('provider') provider: string,
  ): Promise<ListSyncOverview> {
    return this.service.cancelPreview(account.ownerId, provider);
  }
}
