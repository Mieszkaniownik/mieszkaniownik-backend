import { Body, Controller, Get, Post, SetMetadata } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { ScrapeRequestDto } from "./dto/scrape-request.dto";
import { ScraperService, SortOrder } from "./scraper.service";
import { OtodomAuthService } from "./services/otodom-auth.service";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@ApiTags("scraper")
@Controller("scraper")
export class ScraperController {
  constructor(
    private readonly scraperService: ScraperService,
    private readonly otodomAuth: OtodomAuthService,
  ) {}

  @Post("start")
  @ApiOperation({
    summary: "Start the scraper for all platforms",
  })
  @ApiResponse({
    status: 200,
    description: "Scraper started successfully",
  })
  @ApiResponse({
    status: 500,
    description: "Internal server error",
  })
  startScraping() {
    this.scraperService.handleCron().catch((error: unknown) => {
      console.error("Error in background scraper:", error);
    });
    return { message: "Scraper started successfully" };
  }

  @Post("start-with-sort")
  @ApiOperation({
    summary: "Start scraper with custom sort order",
  })
  @ApiResponse({
    status: 200,
    description: "Scraper started successfully with sort order",
  })
  @ApiResponse({
    status: 500,
    description: "Internal server error",
  })
  async startScrapingWithSort(@Body() body: ScrapeRequestDto) {
    try {
      const { sortOrder = SortOrder.NEWEST } = body;
      const result = await this.scraperService.scrapeWithSortOrder(sortOrder);
      return result;
    } catch (error) {
      console.error("Error in scraper:", error);
      if (error instanceof Error) {
        console.error("Error details:", error.message, error.stack);
      }
      throw error;
    }
  }

  @Get("otodom-auth/status")
  @ApiOperation({
    summary: "Check Otodom authentication status",
  })
  @ApiResponse({
    status: 200,
    description: "Authentication status retrieved",
  })
  async getOtodomAuthStatus() {
    try {
      const status = await this.otodomAuth.getAuthStatus();
      return {
        ...status,
        message: status.authenticated
          ? "Otodom authentication is active"
          : status.configured
            ? "Otodom authentication configured but not active"
            : "Otodom authentication not configured",
      };
    } catch (error) {
      console.error("Error getting auth status:", error);
      throw error;
    }
  }

  @Post("otodom-auth/refresh")
  @ApiOperation({
    summary: "Force refresh Otodom authentication",
  })
  @ApiResponse({
    status: 200,
    description: "Authentication refreshed successfully",
  })
  @ApiResponse({
    status: 500,
    description: "Authentication refresh failed",
  })
  async refreshOtodomAuth() {
    try {
      const auth = await this.otodomAuth.forceReauth();
      const message =
        auth === null
          ? "Failed to refresh Otodom authentication"
          : "Otodom authentication refreshed successfully";
      return {
        success: Boolean(auth),
        message,
        cookieCount: auth?.cookies.length,
      };
    } catch (error) {
      console.error("Error refreshing auth:", error);
      throw error;
    }
  }

  @Post("otodom-auth/clear")
  @ApiOperation({
    summary: "Clear cached Otodom authentication",
  })
  @ApiResponse({
    status: 200,
    description: "Authentication cache cleared",
  })
  async clearOtodomAuth() {
    try {
      await this.otodomAuth.clearAuth();
      return {
        success: true,
        message: "Otodom authentication cache cleared",
      };
    } catch (error) {
      console.error("Error clearing auth:", error);
      throw error;
    }
  }
}
