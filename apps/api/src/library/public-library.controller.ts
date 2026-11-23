import { ApiErrorCode, type Entry, type PublicLibrary } from '@filecab/contracts';
import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { ApiException } from '../http/api-error';
import { ApiErrorDto } from '../http/openapi.dto';
import { SnapshotDto } from './response.dto';
import { publicEntries, STORED_USERNAME } from './public-library';

/** Documents one public entry without notes, links or identities. */
class PublicEntryDto {
  @ApiProperty({ type: String, enum: ['anime', 'films', 'tv'] }) category!: string;
  @ApiProperty({ type: String }) userTitle!: string;
  @ApiProperty({ type: String, nullable: true }) status!: string | null;
  @ApiProperty({ type: 'integer' }) rating!: number;
  @ApiProperty({ type: 'integer' }) progress!: number;
  @ApiProperty({ type: () => SnapshotDto }) snapshot!: SnapshotDto;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

/** Documents the public projection of an account library. */
class PublicLibraryDto {
  @ApiProperty({ type: Number, enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ type: String }) username!: string;
  @ApiProperty({ type: [PublicEntryDto] }) entries!: PublicEntryDto[];
}

@ApiTags('Public library')
@ApiResponse({
  status: 404,
  type: ApiErrorDto,
  description: 'Unknown, empty or invalid username. The response does not tell which.',
})
@ApiResponse({ status: 429, type: ApiErrorDto, description: 'Too many requests from one client' })
@Controller('public/libraries')
export class PublicLibraryController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get(':username')
  @ApiOperation({
    summary: 'Read the public read-only library of a username',
    description:
      'Anonymous. Hidden and deleted entries, notes, links, entry UUIDs, catalog IDs and versions are excluded.',
  })
  @ApiParam({ name: 'username', example: 'anna' })
  @ApiResponse({ status: 200, type: PublicLibraryDto })
  async library(@Param('username') input: string): Promise<PublicLibrary> {
    const username = input.toLowerCase();
    const user = STORED_USERNAME.test(username)
      ? await this.auth.database.user.findUnique({ where: { username }, select: { id: true } })
      : null;

    if (!user) throw new ApiException(404, ApiErrorCode.NotFound, 'Library not found');

    const rows = await this.auth.database.libraryEntry.findMany({
      where: { ownerId: user.id, deleted: false },
      orderBy: { id: 'asc' },
      select: { document: true },
    });

    return {
      schemaVersion: 1,
      username,
      entries: publicEntries(rows.map((row) => row.document as unknown as Entry)),
    };
  }
}
