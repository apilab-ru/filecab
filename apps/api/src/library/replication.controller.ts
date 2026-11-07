import { Body, Controller, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type {
  ReplicationPullResponse,
  ReplicationPushResponse,
  ReplicationRow,
} from '@filecab/contracts';
import { AuthGuard, CurrentAccount } from '../auth/auth.guard';
import type { AuthIdentity } from '../auth/auth.service';
import { RequestDtoPipe } from '../http/validation';
import { ApiErrorDto } from '../http/openapi.dto';
import { LibraryInputGuard } from './library.controller';
import { LibraryMutationService } from './mutation.service';
import {
  ReplicationPullDto,
  ReplicationPushDto,
  ReplicationPullResponseDto,
  ReplicationPushResponseDto,
} from './replication.dto';

/** Exposes owner-authenticated replication without permitting display queries. */
@ApiTags('Replication')
@ApiBearerAuth()
@ApiCookieAuth()
@ApiResponse({
  status: 400,
  type: ApiErrorDto,
  description: 'Invalid request or row; preceding rows may already be committed.',
})
@ApiResponse({ status: 401, type: ApiErrorDto, description: 'Authentication required' })
@ApiResponse({ status: 403, type: ApiErrorDto, description: 'CSRF, origin or HTTPS policy failed' })
@ApiResponse({
  status: 409,
  type: ApiErrorDto,
  description: 'SYNC_RESET_REQUIRED: checkpoint exceeds current revision or history is missing',
})
@ApiResponse({ status: 413, type: ApiErrorDto, description: 'Request body exceeds limit' })
@ApiResponse({ status: 415, type: ApiErrorDto, description: 'JSON required' })
@ApiResponse({
  status: 500,
  type: ApiErrorDto,
  description: 'Internal failure; retry original batch',
})
@UseGuards(AuthGuard, LibraryInputGuard)
@Controller('replication')
export class ReplicationController {
  constructor(@Inject(LibraryMutationService) private readonly mutations: LibraryMutationService) {}

  @Post('pull')
  @HttpCode(200)
  @ApiOperation({ summary: 'Pull owner changes including tombstones in revision order' })
  @ApiBody({ type: ReplicationPullDto })
  @ApiResponse({ status: 200, type: ReplicationPullResponseDto })
  pull(
    @CurrentAccount() account: AuthIdentity,
    @Body(new RequestDtoPipe(ReplicationPullDto)) input: ReplicationPullDto,
  ): Promise<ReplicationPullResponse> {
    return this.mutations.pull(account.ownerId, input);
  }

  @Post('push')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Push assumed-master states; each row commits independently',
    description:
      'Stale versions retain the server state. Conflicts do not prevent later rows. Semantic errors stop the batch; retrying previously committed proposals is safe.',
  })
  @ApiBody({ type: ReplicationPushDto })
  @ApiResponse({ status: 200, type: ReplicationPushResponseDto })
  async push(
    @CurrentAccount() account: AuthIdentity,
    @Body(new RequestDtoPipe(ReplicationPushDto)) input: ReplicationPushDto,
  ): Promise<ReplicationPushResponse> {
    const conflicts: ReplicationPushResponse['conflicts'] = [];
    for (const row of input.rows) {
      const conflict = await this.mutations.pushRow(account.ownerId, row as ReplicationRow);

      if (conflict) conflicts.push(conflict);
    }

    return { schemaVersion: 1, conflicts };
  }
}
