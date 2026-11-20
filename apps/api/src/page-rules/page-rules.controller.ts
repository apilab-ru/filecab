import type { PageRulesConfig } from '@filecab/contracts';
import { Controller, Get, Headers, Inject, Res } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PageRulesConfigDto } from './page-rules.dto';
import { SERVED_PAGE_RULES, type ServedPageRules } from './served-page-rules';

/** Serves the reviewed declarative page rules that the extension engine runs. */
@ApiTags('Page rules')
@Controller('page-rules')
export class PageRulesController {
  constructor(@Inject(SERVED_PAGE_RULES) private readonly rules: ServedPageRules) {}

  @Get()
  @ApiOperation({
    summary: 'Read the page rule configuration',
    description:
      'Anonymous. Returns declarative rules only: host names, selectors, fixed cleanup strings and URL path patterns. Never returns code. The source is a reviewed JSON file in the repository.',
    security: [],
  })
  @ApiHeader({ name: 'If-None-Match', required: false })
  @ApiResponse({ status: 200, type: PageRulesConfigDto })
  @ApiResponse({ status: 304, description: 'The cached configuration is current' })
  read(
    @Headers('if-none-match') tag: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): PageRulesConfig | undefined {
    response.setHeader('ETag', this.rules.etag);
    response.setHeader('Cache-Control', 'public, max-age=300');

    if (tag === this.rules.etag) {
      response.status(304);

      return undefined;
    }

    return this.rules.config;
  }
}
