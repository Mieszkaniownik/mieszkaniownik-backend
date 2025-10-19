import {
  Controller,
  Get,
  Logger,
  Query,
  Req,
  SetMetadata,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { AuthGuard } from "../auth/auth.guard";
import type { UserRequest } from "../auth/dto/user-request";
import { HeatmapQueryDto } from "./dto/heatmap-query.dto";
import { HeatmapService } from "./heatmap.service";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@ApiTags("heatmap")
@ApiBearerAuth()
@Controller("heatmap")
@UseGuards(AuthGuard)
export class HeatmapController {
  private readonly logger = new Logger(HeatmapController.name);

  constructor(private readonly heatmapService: HeatmapService) {}

  @Get("data")
  @Public()
  @ApiOperation({
    summary: "Get heatmap heat layer data for all offers",
  })
  @ApiResponse({
    status: 200,
    description: "Retrieved heatmap data successfully",
  })
  @ApiResponse({
    status: 500,
    description: "Internal server error",
  })
  async getHeatmapData(@Query() query: HeatmapQueryDto) {
    try {
      this.logger.log(`Heatmap data requested with filters:`, query);

      const heatmapData = await this.heatmapService.generateHeatmapData(query);

      this.logger.log(
        `Returning ${String(heatmapData.points.length)} heatmap points`,
      );

      return {
        success: true,
        data: heatmapData,
        message: `Generated heatmap with ${String(heatmapData.points.length)} offers`,
      };
    } catch (error) {
      this.logger.error("Error generating heatmap data:", error);
      return {
        success: false,
        data: {
          points: [],
          avgViews: 0,
          minViews: 0,
          totalOffers: 0,
        },
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  @Get("matches")
  @ApiOperation({
    summary: "Get user match markers for authenticated users",
  })
  @ApiResponse({
    status: 200,
    description: "Retrieved user matches successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - authentication required",
  })
  @ApiResponse({
    status: 500,
    description: "Internal server error",
  })
  async getUserMatches(
    @Query() query: HeatmapQueryDto,
    @Req() request: UserRequest,
  ) {
    try {
      const userId = request.user.id;
      this.logger.log(
        `User matches requested by user ${String(userId)} with filters:`,
        query,
      );

      const matchesData = await this.heatmapService.generateHeatmapData(
        query,
        userId,
      );

      this.logger.log(
        `Returning ${String(matchesData.points.length)} match markers for user ${String(userId)}`,
      );

      return {
        success: true,
        data: matchesData,
        message: `Generated ${String(matchesData.points.length)} match markers`,
      };
    } catch (error) {
      this.logger.error("Error generating user matches:", error);
      return {
        success: false,
        data: {
          points: [],
          avgViews: 0,
          minViews: 0,
          totalOffers: 0,
        },
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  @Get("stats")
  @Public()
  @ApiOperation({
    summary: "Get heatmap statistics",
  })
  @ApiResponse({
    status: 200,
    description: "Retrieved heatmap statistics successfully",
  })
  @ApiResponse({
    status: 500,
    description: "Internal server error",
  })
  async getHeatmapStats(@Req() request?: UserRequest) {
    try {
      const userId = request?.user.id;
      const stats = await this.heatmapService.getHeatmapStats(userId);
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error("Error getting heatmap stats:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
