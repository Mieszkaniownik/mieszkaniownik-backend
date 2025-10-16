import { Controller, Post, Get, SetMetadata, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ScraperService, SortOrder } from './scraper.service';
import { ScrapeRequestDto } from './dto/scrape-request.dto';
import { OtodomAuthService } from './services/otodom-auth.service';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@ApiTags('scraper')
@Controller('scraper')
export class ScraperController {
  constructor(
    private readonly scraperService: ScraperService,
    private readonly otodomAuth: OtodomAuthService,
  ) {}

  @Post('start')
  @ApiOperation({
    summary: 'Start the scraper for all platforms',
  })
  @ApiResponse({
    status: 200,
    description: 'Scraper started successfully',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async startScraping() {
    try {
      console.log('Starting scraper...');
      const result = await this.scraperService.handleCron();
      console.log('Scraper result:', result);
      return result;
    } catch (error) {
      console.error('Error in scraper:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
      }
      throw error;
    }
  }

  @Post('start-with-sort')
  @ApiOperation({
    summary: 'Start scraper with custom sort order',
  })
  @ApiResponse({
    status: 200,
    description: 'Scraper started successfully with sort order',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async startScrapingWithSort(@Body() body: ScrapeRequestDto) {
    try {
      const { sortOrder = SortOrder.NEWEST } = body;
      console.log(`Starting scraper with sort order: ${sortOrder}`);
      const result = await this.scraperService.scrapeWithSortOrder(sortOrder);
      console.log('Scraper result:', result);
      return result;
    } catch (error) {
      console.error('Error in scraper:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
      }
      throw error;
    }
  }

  @Post('start-olx-threaded')
  @ApiOperation({
    summary: 'Start threaded OLX scraper',
  })
  @ApiResponse({
    status: 200,
    description: 'OLX scraper started successfully with threading',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async startOlxThreaded(
    @Body()
    body?: {
      maxPages?: number;
      maxWorkers?: number;
      sortOrder?: SortOrder;
    },
  ) {
    try {
      const {
        maxPages = 25,
        maxWorkers = 3,
        sortOrder = SortOrder.NEWEST,
      } = body || {};
      console.log(
        `Starting threaded OLX scraper with ${maxWorkers} workers...`,
      );
      const result = await this.scraperService.scrapeOlxWithThreads(
        maxPages,
        sortOrder,
        maxWorkers,
      );
      console.log('Threaded OLX scraper result:', result);
      return result;
    } catch (error) {
      console.error('Error in threaded OLX scraper:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
      }
      throw error;
    }
  }

  @Post('start-otodom-threaded')
  @ApiOperation({
    summary: 'Start threaded Otodom scraper',
  })
  @ApiResponse({
    status: 200,
    description: 'Otodom scraper started successfully with threading',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async startOtodomThreaded(
    @Body() body?: { maxPages?: number; maxWorkers?: number },
  ) {
    try {
      const { maxPages = 500, maxWorkers = 3 } = body || {};
      console.log(
        `Starting threaded Otodom scraper with ${maxWorkers} workers...`,
      );
      const result = await this.scraperService.scrapeOtodomWithThreads(
        maxPages,
        maxWorkers,
      );
      console.log('Threaded Otodom scraper result:', result);
      return result;
    } catch (error) {
      console.error('Error in threaded Otodom scraper:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
      }
      throw error;
    }
  }

  @Post('start-both-threaded')
  @ApiOperation({
    summary: 'Start threaded scrapers for both OLX and Otodom simultaneously',
  })
  @ApiResponse({
    status: 200,
    description: 'Both scrapers started successfully with threading',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async startBothThreaded(
    @Body()
    body?: {
      olxMaxPages?: number;
      otodomMaxPages?: number;
      sortOrder?: SortOrder;
    },
  ) {
    try {
      const {
        olxMaxPages = 25,
        otodomMaxPages = 500,
        sortOrder = SortOrder.NEWEST,
      } = body || {};
      console.log(
        'Starting simultaneous threaded scraping for both OLX and Otodom...',
      );
      const result = await this.scraperService.scrapeBothWithThreads(
        olxMaxPages,
        otodomMaxPages,
        sortOrder,
      );
      console.log('Threaded dual scraper result:', result);
      return result;
    } catch (error) {
      console.error('Error in threaded dual scraper:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
      }
      throw error;
    }
  }

  @Get('otodom-auth/status')
  @ApiOperation({
    summary: 'Check Otodom authentication status',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication status retrieved',
  })
  async getOtodomAuthStatus() {
    try {
      const status = await this.otodomAuth.getAuthStatus();
      return {
        ...status,
        message: status.authenticated
          ? 'Otodom authentication is active'
          : status.configured
            ? 'Otodom authentication configured but not active'
            : 'Otodom authentication not configured',
      };
    } catch (error) {
      console.error('Error getting auth status:', error);
      throw error;
    }
  }

  @Post('otodom-auth/refresh')
  @ApiOperation({
    summary: 'Force refresh Otodom authentication',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication refreshed successfully',
  })
  @ApiResponse({
    status: 500,
    description: 'Authentication refresh failed',
  })
  async refreshOtodomAuth() {
    try {
      const auth = await this.otodomAuth.forceReauth();
      return {
        success: !!auth,
        message: auth
          ? 'Otodom authentication refreshed successfully'
          : 'Failed to refresh Otodom authentication',
        cookieCount: auth?.cookies.length,
      };
    } catch (error) {
      console.error('Error refreshing auth:', error);
      throw error;
    }
  }

  @Post('otodom-auth/clear')
  @ApiOperation({
    summary: 'Clear cached Otodom authentication',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication cache cleared',
  })
  async clearOtodomAuth() {
    try {
      await this.otodomAuth.clearAuth();
      return {
        success: true,
        message: 'Otodom authentication cache cleared',
      };
    } catch (error) {
      console.error('Error clearing auth:', error);
      throw error;
    }
  }
}
