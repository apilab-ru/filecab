import {
  ApiErrorCode,
  type LibraryMutationPreview,
  type LibraryMutationResult,
  type OwnerSnapshot,
  type ServerEntry,
  type Snapshot,
} from '@filecab/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard, CurrentAccount } from '../auth/auth.guard';
import type { AuthIdentity } from '../auth/auth.service';
import { AuthService } from '../auth/auth.service';
import { ApiException } from '../http/api-error';
import { ApiErrorDto } from '../http/openapi.dto';
import { RequestDtoPipe } from '../http/validation';
import { LibraryMutationService } from './mutation.service';
import {
  CreateLibraryEntryDto,
  ExpectedVersionDto,
  UpdateLibraryEntryDto,
  MergeEntriesDto,
  ReassignSourceDto,
  ApplyMergeDto,
  ApplyReassignmentDto,
} from './library.dto';
import {
  MutationPreviewDto,
  MutationResultDto,
  OwnerSnapshotDto,
  ServerEntryDto,
} from './response.dto';
import { MutationError } from './proposals';

/** Constructs manual metadata without accepting client-supplied catalog snapshots. */
function manualSnapshot(): Snapshot {
  return {
    originalTitle: null,
    titles: [],
    descriptions: [],
    posterUrl: null,
    year: null,
    genres: [],
    format: null,
    episodeCount: null,
    availableEpisodeCount: null,
    providerRatings: [],
    references: [],
  };
}

/** Keeps display queries out of owner transport and rejects bodies on reads. */
@Injectable()
export class LibraryInputGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (
      Object.keys(request.query).length ||
      (['GET', 'HEAD'].includes(request.method) && request.body !== undefined)
    )
      throw new ApiException(
        400,
        ApiErrorCode.ValidationError,
        'Owner-library routes accept no query parameters or read bodies',
      );

    return true;
  }
}

@ApiTags('Owner library')
@ApiBearerAuth()
@ApiCookieAuth()
@ApiResponse({
  status: 400,
  type: ApiErrorDto,
  description: 'Invalid fields, IDs, versions or unsupported display query',
})
@ApiResponse({ status: 401, type: ApiErrorDto, description: 'Authentication required' })
@ApiResponse({
  status: 403,
  type: ApiErrorDto,
  description: 'Cookie CSRF, origin or HTTPS policy failed',
})
@ApiResponse({ status: 404, type: ApiErrorDto, description: 'No active owned resource exists' })
@ApiResponse({
  status: 409,
  type: ApiErrorDto,
  description: 'Version, identity, source or preview conflict; no changes committed',
})
@ApiResponse({ status: 413, type: ApiErrorDto, description: 'Body exceeds the size limit' })
@ApiResponse({ status: 415, type: ApiErrorDto, description: 'JSON content type required' })
@ApiResponse({ status: 500, type: ApiErrorDto, description: 'Unexpected internal failure' })
@UseGuards(AuthGuard, LibraryInputGuard)
@Controller('library')
export class LibraryController {
  constructor(
    @Inject(LibraryMutationService) private readonly mutations: LibraryMutationService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Read the entire active owner library, including hidden entries',
    description:
      'Revision and documents share a RepeatableRead snapshot. No display filters, ordering or pagination.',
  })
  @ApiResponse({ status: 200, type: OwnerSnapshotDto })
  snapshot(@CurrentAccount() account: AuthIdentity): Promise<OwnerSnapshot> {
    return this.mutations.snapshot(account.ownerId);
  }

  @Get('entries/:entryId')
  @ApiParam({ name: 'entryId', format: 'uuid' })
  @ApiResponse({ status: 200, type: ServerEntryDto })
  get(
    @CurrentAccount() account: AuthIdentity,
    @Param('entryId', new ParseUUIDPipe({ version: 'all' })) entryId: string,
  ): Promise<ServerEntry> {
    return this.mutations.get(account.ownerId, entryId);
  }

  @Post('entries')
  @ApiBody({ type: CreateLibraryEntryDto })
  @ApiResponse({ status: 201, type: ServerEntryDto })
  async create(
    @CurrentAccount() account: AuthIdentity,
    @Body(new RequestDtoPipe(CreateLibraryEntryDto)) input: CreateLibraryEntryDto,
  ): Promise<ServerEntry> {
    const { entryId, catalogId, ...fields } = input;
    let snapshot = manualSnapshot();

    if (catalogId) {
      const catalog = await this.auth.database.catalogItem.findUnique({ where: { id: catalogId } });

      if (!catalog || catalog.category !== input.category)
        throw new MutationError(ApiErrorCode.ValidationError);

      snapshot = catalog.snapshot as unknown as Snapshot;
    }

    return this.mutations.create(account.ownerId, {
      entryId: entryId ?? randomUUID(),
      category: input.category,
      catalogId: catalogId ?? null,
      snapshot,
      fields: { ...fields },
    });
  }

  @Patch('entries/:entryId')
  @ApiParam({ name: 'entryId', format: 'uuid' })
  @ApiBody({ type: UpdateLibraryEntryDto })
  @ApiResponse({ status: 200, type: ServerEntryDto })
  update(
    @CurrentAccount() account: AuthIdentity,
    @Param('entryId', new ParseUUIDPipe({ version: 'all' })) entryId: string,
    @Body(new RequestDtoPipe(UpdateLibraryEntryDto)) input: UpdateLibraryEntryDto,
  ): Promise<ServerEntry> {
    const { expectedVersion, ...fields } = input;

    return this.mutations.update(account.ownerId, entryId, expectedVersion, { ...fields });
  }

  @Delete('entries/:entryId')
  @ApiParam({ name: 'entryId', format: 'uuid' })
  @ApiBody({ type: ExpectedVersionDto })
  @ApiResponse({
    status: 200,
    type: ServerEntryDto,
    description: 'Complete deletion tombstone for Undo/version tracking',
  })
  delete(
    @CurrentAccount() account: AuthIdentity,
    @Param('entryId', new ParseUUIDPipe({ version: 'all' })) entryId: string,
    @Body(new RequestDtoPipe(ExpectedVersionDto)) input: ExpectedVersionDto,
  ): Promise<ServerEntry> {
    return this.mutations.setDeleted(account.ownerId, entryId, input.expectedVersion, true);
  }

  @Post('entries/:entryId/restore')
  @HttpCode(200)
  @ApiParam({ name: 'entryId', format: 'uuid' })
  @ApiBody({ type: ExpectedVersionDto })
  @ApiResponse({ status: 200, type: ServerEntryDto })
  restore(
    @CurrentAccount() account: AuthIdentity,
    @Param('entryId', new ParseUUIDPipe({ version: 'all' })) entryId: string,
    @Body(new RequestDtoPipe(ExpectedVersionDto)) input: ExpectedVersionDto,
  ): Promise<ServerEntry> {
    return this.mutations.setDeleted(account.ownerId, entryId, input.expectedVersion, false);
  }

  @Post('merges/preview')
  @HttpCode(200)
  @ApiBody({ type: MergeEntriesDto })
  @ApiResponse({ status: 200, type: MutationPreviewDto })
  previewMerge(
    @CurrentAccount() account: AuthIdentity,
    @Body(new RequestDtoPipe(MergeEntriesDto)) input: MergeEntriesDto,
  ): Promise<LibraryMutationPreview> {
    return this.mutations.previewMerge(account.ownerId, { ...input, fields: { ...input.fields } });
  }

  @Post('merges/apply')
  @HttpCode(200)
  @ApiBody({ type: ApplyMergeDto })
  @ApiResponse({ status: 200, type: MutationResultDto })
  async applyMerge(
    @CurrentAccount() account: AuthIdentity,
    @Body(new RequestDtoPipe(ApplyMergeDto)) input: ApplyMergeDto,
  ): Promise<LibraryMutationResult> {
    const entries = await this.mutations.merge(
      account.ownerId,
      input.survivorId,
      input.survivorVersion,
      input.removedId,
      input.removedVersion,
      { ...input.fields },
      input.previewToken,
    );

    return { schemaVersion: 1, entries };
  }

  @Post('sources/reassignment/preview')
  @HttpCode(200)
  @ApiBody({ type: ReassignSourceDto })
  @ApiResponse({ status: 200, type: MutationPreviewDto })
  previewReassignment(
    @CurrentAccount() account: AuthIdentity,
    @Body(new RequestDtoPipe(ReassignSourceDto)) input: ReassignSourceDto,
  ): Promise<LibraryMutationPreview> {
    return this.mutations.previewReassignment(account.ownerId, { ...input });
  }

  @Post('sources/reassignment/apply')
  @HttpCode(200)
  @ApiBody({ type: ApplyReassignmentDto })
  @ApiResponse({ status: 200, type: MutationResultDto })
  async applyReassignment(
    @CurrentAccount() account: AuthIdentity,
    @Body(new RequestDtoPipe(ApplyReassignmentDto)) input: ApplyReassignmentDto,
  ): Promise<LibraryMutationResult> {
    const entries = await this.mutations.reassignSource(
      account.ownerId,
      input.fromId,
      input.fromVersion,
      input.toId,
      input.toVersion,
      input.normalizedUrl,
      input.previewToken,
    );

    return { schemaVersion: 1, entries };
  }
}
