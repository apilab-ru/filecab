import { ApiErrorCode, type AccountUsername } from '@filecab/contracts';
import { Body, Controller, Get, Inject, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiException } from '../http/api-error';
import { ApiErrorDto } from '../http/openapi.dto';
import { RequestDtoPipe } from '../http/validation';
import { AccountUsernameDto, UsernameDto } from './account.dto';
import { AuthGuard, CurrentAccount } from './auth.guard';
import { AuthService, type AuthIdentity } from './auth.service';

@ApiTags('Account')
@ApiBearerAuth()
@ApiCookieAuth()
@ApiResponse({ status: 401, type: ApiErrorDto, description: 'Authentication required' })
@UseGuards(AuthGuard)
@Controller('account')
export class AccountController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get('username')
  @ApiOperation({ summary: 'Read the public library username. Null means public access is off.' })
  @ApiResponse({ status: 200, type: AccountUsernameDto })
  async username(@CurrentAccount() account: AuthIdentity): Promise<AccountUsername> {
    const user = await this.auth.database.user.findUnique({
      where: { id: account.ownerId },
      select: { username: true },
    });

    return { schemaVersion: 1, username: user?.username ?? null };
  }

  @Put('username')
  @ApiOperation({
    summary: 'Set or clear the public library username',
    description:
      'The username is stored in lowercase. An empty string turns public access off. A username of another account returns 409.',
  })
  @ApiBody({ type: UsernameDto })
  @ApiResponse({ status: 200, type: AccountUsernameDto })
  @ApiResponse({ status: 409, type: ApiErrorDto, description: 'The username is taken' })
  async setUsername(
    @CurrentAccount() account: AuthIdentity,
    @Body(new RequestDtoPipe(UsernameDto)) input: UsernameDto,
  ): Promise<AccountUsername> {
    const username = input.username ? input.username.toLowerCase() : null;
    try {
      await this.auth.database.user.update({ where: { id: account.ownerId }, data: { username } });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002')
        throw new ApiException(409, ApiErrorCode.Conflict, 'The username is taken');

      throw error;
    }

    return { schemaVersion: 1, username };
  }
}
