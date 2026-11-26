import {
  ApiErrorCode,
  type Backup,
  type BackupPreview,
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
  ApiHeader,
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
  ApplyMergeDto,
  CatalogAssociationDto,
  ApplyCatalogAssociationDto,
} from './library.dto';
import {
  MutationPreviewDto,
  MutationResultDto,
  OwnerSnapshotDto,
  ServerEntryDto,
} from './response.dto';
import { MutationError } from './proposals';
import { BackupDto, BackupPreviewDto, BackupRestoreDto } from './backup.dto';
import {
  LibraryImportPreviewDto,
  LibraryImportPreviewRequestDto,
  LibraryImportRequestDto,
  LibraryImportSummaryDto,
} from './library-import.dto';

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
@ApiHeader({
  name: 'X-Filecab-Owner',
  required: false,
  description:
    'Optional account precondition. Must match the authenticated owner; does not select an owner.',
})
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

  @Post('catalog/preview')
  @HttpCode(200)
  @ApiBody({ type: CatalogAssociationDto })
  @ApiResponse({ status: 200, type: MutationPreviewDto })
  async previewCatalog(
    @CurrentAccount() account: AuthIdentity,
    @Body(new RequestDtoPipe(CatalogAssociationDto)) input: CatalogAssociationDto,
  ): Promise<LibraryMutationPreview> {
    return (await this.mutations.associate(account.ownerId, {
      ...input,
      fields: { ...input.fields },
    })) as LibraryMutationPreview;
  }

  @Post('catalog/apply')
  @HttpCode(200)
  @ApiBody({ type: ApplyCatalogAssociationDto })
  @ApiResponse({ status: 200, type: MutationResultDto })
  async applyCatalog(
    @CurrentAccount() account: AuthIdentity,
    @Body(new RequestDtoPipe(ApplyCatalogAssociationDto)) input: ApplyCatalogAssociationDto,
  ): Promise<LibraryMutationResult> {
    const { previewToken, ...request } = input;
    const entries = (await this.mutations.associate(
      account.ownerId,
      { ...request, fields: { ...request.fields } },
      previewToken,
    )) as ServerEntry[];

    return { schemaVersion: 1, entries };
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

  @Get('backup')
  @ApiOperation({ summary: 'Export the active owner library in the current backup format' })
  @ApiResponse({ status: 200, type: BackupDto })
  exportBackup(@CurrentAccount() account: AuthIdentity): Promise<Backup> {
    return this.mutations.exportBackup(account.ownerId);
  }

  @Post('backup/preview')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Validate a backup and preview the replacement',
    description:
      'Body limit 10 MiB. Issues locate errors as entries, index and field. The token binds the owner, backup digest and library revision.',
  })
  @ApiBody({ type: BackupDto })
  @ApiResponse({ status: 200, type: BackupPreviewDto })
  previewBackup(
    @CurrentAccount() account: AuthIdentity,
    @Body(new RequestDtoPipe(BackupDto)) input: BackupDto,
  ): Promise<BackupPreview> {
    return this.mutations.previewBackup(account.ownerId, input);
  }

  @Post('backup/restore')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Replace the active library with a previewed backup',
    description:
      'One transaction publishes tombstones and entries. A changed library or backup returns 409 without changes.',
  })
  @ApiBody({ type: BackupRestoreDto })
  @ApiResponse({ status: 200, type: OwnerSnapshotDto })
  restoreBackup(
    @CurrentAccount() account: AuthIdentity,
    @Body(new RequestDtoPipe(BackupRestoreDto)) input: BackupRestoreDto,
  ): Promise<OwnerSnapshot> {
    return this.mutations.restoreBackup(
      account.ownerId,
      input.backup,
      input.confirmationToken,
      input.confirmEmpty,
    );
  }

  @Post('import/preview')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Validate a CSV file and preview the import',
    description:
      'Body limit 11 MiB; the file can be 10 MiB. Issues give the line and column. Rows give add, skip or possible-duplicate with a reason. The token binds the owner, the file digest and the library revision. No catalog provider requests.',
  })
  @ApiBody({ type: LibraryImportPreviewRequestDto })
  @ApiResponse({ status: 200, type: LibraryImportPreviewDto })
  previewImport(
    @CurrentAccount() account: AuthIdentity,
    @Body(new RequestDtoPipe(LibraryImportPreviewRequestDto)) input: LibraryImportPreviewRequestDto,
  ): Promise<LibraryImportPreviewDto> {
    return this.mutations.previewImport(account.ownerId, input.csv);
  }

  @Post('import')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Add the selected rows of a previewed CSV file',
    description:
      'One transaction adds the selected add and possible-duplicate rows. Skipped rows and existing entries never change. A changed library or file returns 409 without changes.',
  })
  @ApiBody({ type: LibraryImportRequestDto })
  @ApiResponse({ status: 200, type: LibraryImportSummaryDto })
  importLibrary(
    @CurrentAccount() account: AuthIdentity,
    @Body(new RequestDtoPipe(LibraryImportRequestDto)) input: LibraryImportRequestDto,
  ): Promise<LibraryImportSummaryDto> {
    return this.mutations.importLibrary(
      account.ownerId,
      input.csv,
      input.lines,
      input.confirmationToken,
    );
  }
}
